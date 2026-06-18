import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ImportsService } from '../src/modules/imports/imports.service';
import { PrismaService } from '../src/prisma/prisma.service';

const CADEG_TENANT_ID = 'cd147c04-75a8-47a4-a783-7f609170dddd';
const SALES_FILES = ['exportar vendas.csv', 'Exportar vendas.csv'];

async function main() {
  const tenantId = process.argv.find((a) => a.startsWith('--tenant-id='))?.split('=')[1] ?? CADEG_TENANT_ID;
  const dataDir =
    process.argv.find((a) => a.startsWith('--data-dir='))?.split('=')[1] ??
    process.env.CADEG_DATA_DIR ??
    path.join(process.cwd(), 'CADEG DATA BASE');
  const skipCommit = process.argv.includes('--skip-commit');

  let salesPath: string | undefined;
  for (const name of SALES_FILES) {
    const full = path.join(dataDir, name);
    if (fs.existsSync(full)) {
      salesPath = full;
      break;
    }
  }
  if (!salesPath) {
    console.error(`Sales CSV not found in ${dataDir}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const imports = app.get(ImportsService);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.error(`Tenant not found: ${tenantId}`);
      process.exit(1);
    }

    const company = await prisma.company.findFirst({
      where: { tenantId, isHead: true, deletedAt: null },
    });
    if (!company) {
      console.error('Head company not found for tenant');
      process.exit(1);
    }

    console.log(`Importing ${salesPath} → tenant ${tenant.slug} (${tenantId})`);

    const buffer = fs.readFileSync(salesPath);
    const result = await imports.ingestSalesCsvSync({
      tenantId,
      companyId: company.id,
      fileName: path.basename(salesPath),
      idempotencyKey: `cadeg-sales-history-${tenantId}`,
      buffer,
      skipCommit,
    });

    const salesCount = await prisma.salesOrder.count({ where: { tenantId } });
    const lineCount = await prisma.salesOrderLine.count({
      where: { order: { tenantId } },
    });

    console.log(
      JSON.stringify(
        {
          import: result,
          tenant: { id: tenantId, slug: tenant.slug },
          salesOrders: salesCount,
          salesLines: lineCount,
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
