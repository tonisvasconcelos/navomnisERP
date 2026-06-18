# CADEG legacy CSV data

Place the legacy ERP exports here (or set `CADEG_DATA_DIR` to your folder path):

| File | Purpose |
|------|---------|
| `exportar vendas.csv` | Sales history — master data **and** transactional import (grouped by NF → `SalesOrder`) |
| `Exportar compras.csv` | **Monthly product cost matrix** (FOB/CIF by month) — used for purchase reconstruction |

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

## Purchases and stock reconstruction

`Exportar compras.csv` is **not** a purchase-invoice export. It contains monthly FOB/CIF spend totals per product (Jan–May 2026). The import pipeline reconstructs:

| Derived field | Source |
|---------------|--------|
| Purchase value | `Valor {Mês} FOB` from compras CSV |
| Purchase quantity | FOB ÷ avg(`Valor Custo FOB`) from sales lines for same SKU + month |
| Supplier | Mode of `Fornecedor` on sales lines for that SKU |
| Order number | `PO-{sku}-{YYYYMM}` (idempotent) |

**Stock model:** opening stock = **0 on 2026-01-01**. Current stock = purchase receipts − sales shipments (`ItemLedgerEntry`).

Run **in this order** against production/staging:

```powershell
$env:DATABASE_URL = "<postgres-url>"
$env:CADEG_DATA_DIR = "C:\Users\tonis\Documents\AL\navomnisERP-1\CADEG DATA BASE"

# 1. Purchase orders + positive inventory (receipts)
pnpm --filter @navomnis/api run import:cadeg-purchases -- --tenant-id=cd147c04-75a8-47a4-a783-7f609170dddd

# 2. Sales shipments (negative inventory)
pnpm --filter @navomnis/api run post:cadeg-sales-inventory -- --tenant-id=cd147c04-75a8-47a4-a783-7f609170dddd
```

Add `--dry-run` to either command to preview counts without writing.

Purchase order detail/list UIs show header fields using existing PO schema (`expectedDeliveryDate`, `paymentTerms`, …) plus `legacyMetadata` from reconstruction.

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
- Optional: purchase reconstruction + sales inventory posting (see above)

**Not imported automatically:** individual sales invoices (unless `stageTransactions` / import commit), true purchase NF documents (no source file in CADEG folder).
