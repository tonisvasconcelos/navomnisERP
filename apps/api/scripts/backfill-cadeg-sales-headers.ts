import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  mapSalesCsvHeader,
  salesOrderNumberFromNf,
  csvField,
} from '../src/modules/imports/legacy-csv-header.mapper';
import type { ParsedCsvRow } from '../src/modules/imports/csv-parser.util';

const CADEG_TENANT_ID = 'cd147c04-75a8-47a4-a783-7f609170dddd';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tenantId =
    process.argv.find((a) => a.startsWith('--tenant-id='))?.split('=')[1] ?? CADEG_TENANT_ID;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const idempotencyKey = `cadeg-sales-history-${tenantId}`;
    const batchRecord = await prisma.importBatch.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });

    if (!batchRecord) {
      console.error(`Import batch not found for tenant ${tenantId}`);
      process.exit(1);
    }

    const orderIndex = new Map(
      (
        await prisma.salesOrder.findMany({
          where: { tenantId },
          select: { id: true, number: true },
        })
      ).map((o) => [o.number, o.id]),
    );

    const groups = new Map<string, ParsedCsvRow>();
    const chunkSize = 5000;
    let cursor: string | undefined;
    while (true) {
      const rows = await prisma.importRow.findMany({
        where: { batchId: batchRecord.id },
        select: { id: true, rawPayload: true },
        orderBy: { id: 'asc' },
        take: chunkSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!rows.length) break;
      for (const row of rows) {
        const payload = row.rawPayload as ParsedCsvRow;
        const nf = csvField(payload, 'NF');
        const customerCode = csvField(payload, 'Cod. Cliente');
        if (!nf || !customerCode) continue;
        const key = `${customerCode}::${nf}`;
        if (!groups.has(key)) groups.set(key, payload);
      }
      cursor = rows[rows.length - 1]!.id;
      if (rows.length < chunkSize) break;
    }

    let updated = 0;
    let notFound = 0;

    for (const payload of groups.values()) {
      const nf = csvField(payload, 'NF').replace(/\//g, '').trim();
      const orderNumber = salesOrderNumberFromNf(nf);
      const orderId = orderIndex.get(orderNumber);
      if (!orderId) {
        notFound++;
        continue;
      }

      const header = mapSalesCsvHeader(payload);
      if (dryRun) {
        updated++;
        continue;
      }

      await prisma.salesOrder.update({
        where: { id: orderId },
        data: header as Prisma.SalesOrderUpdateInput,
      });
      updated++;
      if (updated % 500 === 0) {
        console.log(`Updated ${updated} orders…`);
      }
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          tenantId,
          batchId: batchRecord.id,
          invoiceGroups: groups.size,
          updated,
          notFound,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
