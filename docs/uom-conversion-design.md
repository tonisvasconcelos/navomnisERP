# UOM Conversion Design (CADEG)

## Principles

1. **Canonical stock unit** — each `Item` has `baseUomId` pointing to `UnitOfMeasure`.
2. **Transaction snapshot** — order lines and ledger entries store `conversionFactor` and `conversionTrace` at posting time.
3. **Hub conversion** — resolve `from → base → to` when no direct factor exists.
4. **Strict errors** — missing conversion blocks release/receipt when `UOM_ENFORCEMENT` tenant flag is on.

## Models

See `apps/api/prisma/schema.prisma`: `UnitOfMeasure`, `UnitOfMeasureAlias`, `ItemUomConversion`, `SupplierItemUom`, `CustomerItemUom`.

## Service API

`UomConversionService.convertItemQuantity({ itemId, quantity, fromUomId, toUomId?, at? })` returns transaction and base quantities plus trace JSON.

## Migration assumptions

- Legacy `quantity` = base quantity in `Item.baseUom` (default UN).
- `conversionFactor = 1`, `transactionUomId = baseUomId` for backfill.
- Produce items with `AgriculturalItemProfile` default base UOM to **KG**.

## Feature flags (`TenantFeatureOverride.moduleKey`)

| Key | Default | Effect |
|-----|---------|--------|
| `uom_enforcement` | false | Block PO/SO without valid conversion |
| `po_approval_required` | false | Require approval before PO release |
| `fefo_sales` | false | Allocate lots on sales release |

## Rounding

Per target UOM `decimalScale` with `roundingMode` on `ItemUomConversion` (HALF_UP default).
