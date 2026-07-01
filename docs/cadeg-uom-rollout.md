# CADEG UOM rollout

Safe deployment of the UOM + item-detail slice for the **CADEG** tenant (`slug = cadeg`).

**Rule:** UOM enforcement applies only to **new write operations** and **in-flight OPEN/DRAFT documents**. POSTED sales, imported ledger history, and CADEG reconstruction data are **never backfilled or re-validated**.

**Important:** Enable `uom_enforcement` only **after** API and web with UOM UI are deployed and smoke tests pass. Enabling the flag before deploy causes 400 errors on new sales/purchase lines.

## Prerequisites

- API and web builds include the UOM slice (UOM selectors, item detail page, `ItemMedia` migration).
- `DATABASE_URL` points at the CADEG Postgres instance (use Railway `DATABASE_PUBLIC_URL` from your machine).
- **Do not** run `prisma db seed` against CADEG production — seed is demo-tenant only.

## Phase 1 — Backup and schema deploy

1. **Backup** the CADEG Postgres database (Railway snapshot or `pg_dump`).
2. Apply schema **only**:

```powershell
cd apps/api
$env:DATABASE_URL="<CADEG DATABASE_PUBLIC_URL>"
pnpm exec prisma migrate deploy
```

3. Confirm `ItemMedia` exists and is empty:

```sql
SELECT COUNT(*) FROM "ItemMedia";
```

## Phase 2 — Deploy API + web (before enabling flag)

1. Deploy API with UOM endpoints:

```powershell
cd <repo-root>
railway up -s api -e production
```

2. Deploy web with UOM UI (build must include `VITE_API_URL`):

```powershell
$env:VITE_API_URL = "https://api-production-b645.up.railway.app/api/v1"
pnpm --filter @navomnis/web run build
# Vercel prebuilt deploy from apps/web
```

3. Verify endpoints live:

```powershell
$env:CADEG_SMOKE_PASSWORD="<password>"
pnpm --filter @navomnis/api cadeg:uom-smoke
```

Expect `itemDetail: ok` and `uomAvailable: ok` before proceeding.

## Phase 3 — Audit OPEN/DRAFT lines

```powershell
pnpm cadeg:uom-rollout -- --audit --tenant=cadeg
```

See raw SQL in previous versions or [`fix plan`](../.cursor/plans/) for OPEN purchase + DRAFT sales queries.

## Phase 4 — Backfill in-flight lines only

```powershell
pnpm cadeg:uom-rollout -- --backfill --tenant=cadeg --dry-run
pnpm cadeg:uom-rollout -- --backfill --tenant=cadeg
```

Re-run audit until `openPurchaseOrDraftSalesLinesMissingUom` is `0`.

`--all` runs audit + backfill only (does **not** enable the flag).

## Phase 5 — Enable UOM enforcement for CADEG

**Only after Phase 2 smoke passes:**

```powershell
pnpm cadeg:uom-rollout -- --enable-flag --tenant=cadeg
```

Verify:

```sql
SELECT * FROM "TenantFeatureOverride"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'cadeg')
  AND "moduleKey" = 'uom_enforcement';
```

## Phase 6 — Smoke test (new transactions)

| Test | Expected |
|------|----------|
| Sales form shows UOM dropdown | Beside Artigo on draft orders |
| New sales order + line | UOM selector works; line has full snapshot |
| Release new sales order | Succeeds; ledger entry has UOM fields |
| Historical ledger | No quantity/total changes |

```powershell
$env:CADEG_SMOKE_PASSWORD="<password>"
pnpm --filter @navomnis/api cadeg:uom-smoke
```

## Rollback / emergency unblock

Disable enforcement without touching historical data:

```powershell
pnpm cadeg:uom-rollout -- --disable-flag --tenant=cadeg
```

Re-enable after deploy using `--enable-flag`.

## Related docs

- [cadeg-uom-stock-item-requirements.md](./cadeg-uom-stock-item-requirements.md)
- [uom-conversion-design.md](./uom-conversion-design.md)
- [staging.md](./staging.md)
