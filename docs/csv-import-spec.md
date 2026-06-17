# Legacy ERP CSV Import Specification

## Sales export (`exportar vendas.csv`)

| Property | Value |
|----------|-------|
| Encoding | cp1252 |
| Delimiter | `;` |
| Decimal | comma (`,` ) |
| Header row | Row 2 (row 1 = export timestamp) |
| Duplicate headers | Suffix `_2`, `_3` (e.g. `Local` → `Local_2`) |

### Key column mapping

| CSV column | Target |
|------------|--------|
| Cod. Prod | `Item.sku` / external code |
| Produto | `Item.name` |
| Qtd | `transactionQuantity` |
| Unidade NF | `UnitOfMeasureAlias` → `transactionUomId` |
| Valor Venda | unit price |
| Fornecedor | `Party` SUPPLIER |
| NF, Chave NFE, Cfop | fiscal staging (Phase 5b) |

### Idempotency

Row key: `hash(tenantId + NF + lineSeq + CodProd + emissionDate)`.

## Purchases export (`Exportar compras.csv`)

Aggregated FOB/CIF by product/month — **analytic import only** (no PO/receipt creation).

Maps to `PurchaseCostAnalytic` staging for variance dashboards.

## Pipeline

1. `POST /imports/batches` — upload, enqueue BullMQ `imports` queue
2. Parse → `ImportRow.rawPayload`
3. Validate → UOM alias, item/party match
4. Review UI → fix exceptions
5. `POST /imports/batches/:id/commit` — idempotent batch commit

## Exception report

`GET /imports/batches/:id/rows?status=ERROR` + `export-errors.csv`
