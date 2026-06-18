import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CadegPurchaseReconstructionService } from '../src/modules/cadeg/cadeg-purchase-reconstruction.service';
import { PrismaService } from '../src/prisma/prisma.service';

const CADEG_TENANT_ID = 'cd147c04-75a8-47a4-a783-7f609170dddd';

async function main() {
  const tenantId = process.argv.find((a) => a.startsWith('--tenant-id='))?.split('=')[1] ?? CADEG_TENANT_ID;
  const dataDir =
    process.argv.find((a) => a.startsWith('--data-dir='))?.split('=')[1] ??
    process.env.CADEG_DATA_DIR ??
    path.join(process.cwd(), 'CADEG DATA BASE');
  const dryRun = process.argv.includes('--dry-run');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const reconstruction = app.get(CadegPurchaseReconstructionService);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.error(`Tenant not found: ${tenantId}`);
      process.exit(1);
    }

    console.log(`Importing purchases from ${dataDir} → tenant ${tenant.slug} (${tenantId})`);
    if (dryRun) console.log('DRY RUN — no database writes');

    const result = await reconstruction.importPurchases(tenantId, { dataDir, dryRun });

    const poCount = await prisma.purchaseOrder.count({ where: { tenantId } });
    const ledgerIn = await prisma.itemLedgerEntry.count({
      where: { tenantId, entryType: 'PURCHASE_RECEIVE' },
    });

    console.log(
      JSON.stringify(
        {
          import: result,
          tenant: { id: tenantId, slug: tenant.slug },
          purchaseOrders: poCount,
          purchaseLedgerEntries: ledgerIn,
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
