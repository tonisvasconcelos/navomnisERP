# Conciliação bancária (MVP)

Matchers puros em `reconciliation-matcher.ts`:

| Matcher | Critério |
|---------|----------|
| `exact` | valor + dia + `documentNumber` |
| `pix` | `endToEndId` |
| `fuzzy` | valor ± tolerância, janela de dias |

Alvos: `CustomerLedgerEntry` / `SupplierLedgerEntry` abertos (`openAmount`, `isOpen`).

API:

- `GET /banking/reconciliation/suggestions`
- `POST /banking/reconciliation/suggest-persist`
- `POST /banking/matches/:id/confirm` → `BankLedgerEntry` via `FinanceBridgeService`

UI: `apps/web/src/features/banking/banking-reconciliation-page.tsx`.
