/**
 * CADEG UOM rollout helper — audit, backfill OPEN/DRAFT lines, enable uom_enforcement.
 *
 * Usage:
 *   pnpm cadeg:uom-rollout -- --audit --tenant=cadeg
 *   pnpm cadeg:uom-rollout -- --backfill --tenant=cadeg --dry-run
 *   pnpm cadeg:uom-rollout -- --backfill --tenant=cadeg
 *   pnpm cadeg:uom-rollout -- --enable-flag --tenant=cadeg
 *   pnpm cadeg:uom-rollout -- --disable-flag --tenant=cadeg
 *   pnpm cadeg:uom-rollout -- --all --tenant=cadeg --dry-run
 *
 * Requires DATABASE_URL. Does NOT touch POSTED orders or ledger history.
 */
import { DocumentStatus, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LineCandidate = {
  kind: 'purchase' | 'sales';
  documentNumber: string;
  lineId: string;
  itemId: string;
  sku: string;
  quantity: Prisma.Decimal;
  missing: string[];
};

function parseArgs() {
  const args = process.argv.slice(2);
  const tenant = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cadeg';
  return {
    tenant,
    dryRun: args.includes('--dry-run'),
    audit: args.includes('--audit') || args.includes('--all'),
    backfill: args.includes('--backfill') || args.includes('--all'),
    enableFlag: args.includes('--enable-flag'),
    disableFlag: args.includes('--disable-flag'),
  };
}

function missingFields(row: {
  transactionUomId: string | null;
  baseUomId: string | null;
  baseQuantity: Prisma.Decimal | null;
  conversionTrace: Prisma.JsonValue | null;
}): string[] {
  const missing: string[] = [];
  if (!row.transactionUomId) missing.push('transactionUomId');
  if (!row.baseUomId) missing.push('baseUomId');
  if (row.baseQuantity == null) missing.push('baseQuantity');
  if (row.conversionTrace == null) missing.push('conversionTrace');
  return missing;
}

async function resolveTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    throw new Error(`Tenant not found: ${slug}`);
  }
  return tenant;
}

async function findCandidates(tenantId: string): Promise<LineCandidate[]> {
  const purchaseLines = await prisma.purchaseOrderLine.findMany({
    where: {
      order: {
        tenantId,
        status: {
          in: [DocumentStatus.OPEN, DocumentStatus.RELEASED, DocumentStatus.PARTIALLY_RECEIVED],
        },
      },
    },
    include: {
      order: { select: { number: true } },
      item: { select: { id: true, sku: true, baseUomId: true, baseUom: true } },
    },
  });

  const salesLines = await prisma.salesOrderLine.findMany({
    where: {
      order: { tenantId, status: DocumentStatus.DRAFT },
    },
    include: {
      order: { select: { number: true } },
      item: { select: { id: true, sku: true, baseUomId: true, baseUom: true } },
    },
  });

  const candidates: LineCandidate[] = [];

  for (const line of purchaseLines) {
    const missing = missingFields(line);
    if (missing.length) {
      candidates.push({
        kind: 'purchase',
        documentNumber: line.order.number,
        lineId: line.id,
        itemId: line.itemId,
        sku: line.item.sku,
        quantity: line.quantity,
        missing,
      });
    }
  }

  for (const line of salesLines) {
    const missing = missingFields(line);
    if (missing.length) {
      candidates.push({
        kind: 'sales',
        documentNumber: line.order.number,
        lineId: line.id,
        itemId: line.itemId,
        sku: line.item.sku,
        quantity: line.quantity,
        missing,
      });
    }
  }

  return candidates;
}

async function resolveItemUomId(
  tenantId: string,
  item: { id: string; sku: string; baseUomId: string | null; baseUom: string },
): Promise<string | null> {
  if (item.baseUomId) return item.baseUomId;
  const code = item.baseUom?.trim();
  if (!code) return null;
  const uom = await prisma.unitOfMeasure.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });
  return uom?.id ?? null;
}

async function audit(tenantSlug: string) {
  const tenant = await resolveTenant(tenantSlug);
  const candidates = await findCandidates(tenant.id);
  const itemsMissingBaseUom = await prisma.item.count({
    where: { tenantId: tenant.id, isActive: true, baseUomId: null, baseUom: '' },
  });

  console.log(
    JSON.stringify(
      {
        phase: 'audit',
        tenant: { id: tenant.id, slug: tenant.slug },
        openPurchaseOrDraftSalesLinesMissingUom: candidates.length,
        itemsMissingBaseUom,
        candidates,
      },
      null,
      2,
    ),
  );

  return { tenant, candidates, itemsMissingBaseUom };
}

async function backfill(tenantSlug: string, dryRun: boolean) {
  const { tenant, candidates } = await audit(tenantSlug);
  const skipped: Array<{ lineId: string; sku: string; reason: string }> = [];
  let updated = 0;

  for (const row of candidates) {
    const item = await prisma.item.findUniqueOrThrow({
      where: { id: row.itemId },
      select: { id: true, sku: true, baseUomId: true, baseUom: true },
    });
    const uomId = await resolveItemUomId(tenant.id, item);
    if (!uomId) {
      skipped.push({ lineId: row.lineId, sku: row.sku, reason: 'item has no baseUomId or baseUom code' });
      continue;
    }

    const data = {
      transactionUomId: uomId,
      baseUomId: uomId,
      baseQuantity: row.quantity,
      conversionFactor: new Prisma.Decimal(1),
      conversionTrace: {
        path: 'identity',
        fromUomId: uomId,
        toUomId: uomId,
        source: 'cadeg-uom-rollout',
      } as Prisma.InputJsonValue,
    };

    if (dryRun) {
      console.log(`[dry-run] would update ${row.kind} line ${row.lineId} (${row.documentNumber} / ${row.sku})`);
      updated++;
      continue;
    }

    if (row.kind === 'purchase') {
      await prisma.purchaseOrderLine.update({ where: { id: row.lineId }, data });
    } else {
      await prisma.salesOrderLine.update({ where: { id: row.lineId }, data });
    }
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        phase: 'backfill',
        dryRun,
        tenant: { id: tenant.id, slug: tenant.slug },
        updated,
        skipped,
      },
      null,
      2,
    ),
  );

  return { updated, skipped };
}

async function enableFlag(tenantSlug: string, dryRun: boolean) {
  const tenant = await resolveTenant(tenantSlug);
  const remaining = (await findCandidates(tenant.id)).length;
  if (remaining > 0) {
    throw new Error(
      `${remaining} OPEN/DRAFT line(s) still missing UOM snapshot. Run --backfill first.`,
    );
  }

  if (dryRun) {
    console.log(`[dry-run] would enable uom_enforcement for tenant ${tenant.slug}`);
    return;
  }

  await prisma.tenantFeatureOverride.upsert({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'uom_enforcement' } },
    create: { tenantId: tenant.id, moduleKey: 'uom_enforcement', enabled: true },
    update: { enabled: true },
  });

  const flag = await prisma.tenantFeatureOverride.findUniqueOrThrow({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'uom_enforcement' } },
  });

  console.log(
    JSON.stringify(
      {
        phase: 'enable-flag',
        tenant: { id: tenant.id, slug: tenant.slug },
        flag,
      },
      null,
      2,
    ),
  );
}

async function disableFlag(tenantSlug: string, dryRun: boolean) {
  const tenant = await resolveTenant(tenantSlug);

  if (dryRun) {
    console.log(`[dry-run] would disable uom_enforcement for tenant ${tenant.slug}`);
    return;
  }

  await prisma.tenantFeatureOverride.upsert({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'uom_enforcement' } },
    create: { tenantId: tenant.id, moduleKey: 'uom_enforcement', enabled: false },
    update: { enabled: false },
  });

  const flag = await prisma.tenantFeatureOverride.findUniqueOrThrow({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'uom_enforcement' } },
  });

  console.log(
    JSON.stringify(
      {
        phase: 'disable-flag',
        tenant: { id: tenant.id, slug: tenant.slug },
        flag,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const opts = parseArgs();
  if (!opts.audit && !opts.backfill && !opts.enableFlag && !opts.disableFlag) {
    console.error('Specify --audit, --backfill, --enable-flag, --disable-flag, or --all');
    process.exit(1);
  }

  if (opts.audit) await audit(opts.tenant);
  if (opts.backfill) await backfill(opts.tenant, opts.dryRun);
  if (opts.enableFlag) await enableFlag(opts.tenant, opts.dryRun);
  if (opts.disableFlag) await disableFlag(opts.tenant, opts.dryRun);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
