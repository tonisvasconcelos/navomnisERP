# CADEG legacy CSV data

Place the legacy ERP exports here (or set `CADEG_DATA_DIR` to your folder path):

| File | Purpose |
|------|---------|
| `exportar vendas.csv` | Sales history — master data **and** transactional import (grouped by NF → `SalesOrder`) |
| `Exportar compras.csv` | **Monthly product cost matrix** (FOB/CIF by month) — enriches item catalog only; **not** purchase invoices |

Default path if unset: `CADEG DATA BASE/` at repository root.

## Sales transaction headers

When sales history is imported (`import:cadeg-history`), header fields from each NF group are persisted on `SalesOrder`:

- Dates: emissão, saída, faturamento, vencimento, pagamento, entrega
- Fiscal: NF, CFOP, situação tributária, chave NFE
- Commercial: local, tipo de venda, atendente, pedido externo
- Overflow columns → `legacyMetadata` (Setor, Equipe, Cidade, UF, etc.)

To backfill headers on orders imported **before** this feature:

```powershell
pnpm --filter @navomnis/api run backfill:cadeg-headers -- --tenant-id=<uuid>
# add --dry-run to preview counts
```

## Purchases

There is **no purchase invoice CSV** in the CADEG folder today. `Exportar compras.csv` must not be imported as `PurchaseOrder` documents.

Purchase order detail/list UIs show the same header layout as sales, using existing PO fields (`expectedDeliveryDate`, `paymentTerms`, …) plus symmetric schema fields for a future purchase NF import.

## Provision a new tenant

### Platform admin API

```http
POST /api/v1/platform/tenants
{
  "name": "CADEG Cliente",
  "slug": "cadeg-cliente",
  "provisionCadegMaster": true,
  "cadegDataDir": "C:/Users/.../navomnisERP-1/CADEG DATA BASE",
  "stageCadegTransactions": false
}
```

Or for an existing tenant:

```http
POST /api/v1/platform/tenants/{id}/provision/cadeg
{
  "dataDir": "C:/Users/.../navomnisERP-1/CADEG DATA BASE",
  "stageTransactions": true
}
```

### CLI (local / staging DB)

```powershell
$env:DATABASE_URL = "<postgres-url>"
$env:CADEG_DATA_DIR = "C:\Users\tonis\Documents\AL\navomnisERP-1\CADEG DATA BASE"
pnpm --filter @navomnis/api run provision:cadeg -- --tenant-id=<uuid>
```

Add `--stage-transactions` to queue the full ~80k sales rows for the import wizard (`/imports`).

## What gets imported

- Standard UOM codes (KG, UN, CX, …) + legacy aliases from `Unidade NF`
- Items (`Cod. Prod` → SKU, `Produto` → name)
- Customers (`Cod. Cliente`, `Cliente`)
- Suppliers (`Fornecedor`)
- Supplier-item purchase UOM links
- Default company + PO approval policy
- Optional: sales CSV staged as `ImportBatch` for transactional commit later

**Not imported automatically:** individual sales invoices (unless `stageTransactions` / import commit).
