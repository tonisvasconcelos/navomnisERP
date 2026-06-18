import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { CadegPurchaseReconstructionService } from '../src/modules/cadeg/cadeg-purchase-reconstruction.service';
import { PrismaService } from '../src/prisma/prisma.service';

const CADEG_TENANT_ID = 'cd147c04-75a8-47a4-a783-7f609170dddd';

async function main() {
  const tenantId = process.argv.find((a) => a.startsWith('--tenant-id='))?.split('=')[1] ?? CADEG_TENANT_ID;
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

    console.log(`Posting sales inventory → tenant ${tenant.slug} (${tenantId})`);
    if (dryRun) console.log('DRY RUN — no database writes');

    const result = await reconstruction.postSalesInventory(tenantId, { dryRun });

    const grouped = await prisma.itemLedgerEntry.groupBy({
      by: ['itemId'],
      where: { tenantId },
      _sum: { baseQuantity: true },
    });
    const nonZeroBalances = grouped.filter((g) => {
      const sum = g._sum.baseQuantity ?? new Prisma.Decimal(0);
      return !sum.isZero();
    }).length;

    console.log(
      JSON.stringify(
        {
          post: result,
          tenant: { id: tenantId, slug: tenant.slug },
          itemsWithLedgerBalance: nonZeroBalances,
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
