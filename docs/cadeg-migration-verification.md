# CADEG migration verification

Run after `20260518100000_cadeg_uom_operations`:

```sql
-- All items have baseUomId or legacy baseUom string
SELECT COUNT(*) FROM "Item" WHERE "baseUomId" IS NULL;

-- Lines backfilled
SELECT COUNT(*) FROM "SalesOrderLine" WHERE "baseQuantity" IS NULL;
SELECT COUNT(*) FROM "PurchaseOrderLine" WHERE "baseQuantity" IS NULL;

-- Ledger backfilled
SELECT COUNT(*) FROM "ItemLedgerEntry" WHERE "baseQuantity" IS NULL;

-- UOM seeded per tenant
SELECT "tenantId", COUNT(*) FROM "UnitOfMeasure" GROUP BY "tenantId";
```

Expected after seed: demo tenant has KG, UN, CX, BDJ, MOL, DZ, SC, PCT with aliases.

Rollback: restore DB snapshot before migration; do not run `migrate reset` on production.
