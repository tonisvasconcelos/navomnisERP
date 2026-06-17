# CADEG legacy CSV data

Place the legacy ERP exports here (or set `CADEG_DATA_DIR` to your folder path):

| File | Purpose |
|------|---------|
| `exportar vendas.csv` | Sales history — used to extract **master data** (items, customers, suppliers, UOM aliases) |
| `Exportar compras.csv` | Purchase cost aggregates — supplements item catalog |

Default path if unset: `CADEG DATA BASE/` at repository root.

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
