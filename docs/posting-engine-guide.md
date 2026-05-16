# Posting Engine Guide

Date: 2026-05-16

Navomnis posting architecture follows enterprise ERP principles similar to Business Central-style posting groups and posting previews, without copying product terminology or implementation.

## Implemented Foundation

### Setup Tables

- `PostingSetup`: business/product tax group to receivable, payable, revenue, expense, inventory, and COGS account numbers.
- `TaxPostingSetup`: tax kind to payable, recoverable, expense, and settlement accounts.
- `FiscalPostingSetup`: operation/document-specific posting requirements and JSON templates.

### Posting Journals

- `PostingJournal`: source, company, fiscal document, status, posting date, totals, validation errors, preview payload.
- `PostingJournalLine`: ledger, account number, debit/credit side, amount, source dimensions.

### Ledgers

- Existing `GlEntry` remains the general ledger entry table.
- Added `CustomerLedgerEntry`, `SupplierLedgerEntry`, `BankLedgerEntry`, `TaxLedgerEntry`, and `TaxSettlementLedgerEntry`.
- These entries are designed as append-only posting outputs.

## API

- `POST /api/v1/posting/preview`
- Permission: `finance.read`
- Initial source support: `SALES_ORDER`
- Output: balanced debit/credit preview with validation messages.

## Posting Flow

1. Source document is validated.
2. Fiscal preview calculates tax snapshots.
3. Posting preview builds journal lines.
4. Posting validation checks:
   - tenant and company access;
   - document status;
   - balanced debit/credit totals;
   - posting setup completeness;
   - fiscal setup completeness;
   - period status, once periods exist.
5. Posting creates immutable ledger entries.
6. Source document is marked posted.
7. Audit log records actor, source, posting journal, and fiscal document.

## Next Required Work

- Convert `PostingService.preview` into a full pipeline with strategy classes.
- Add `POST /posting/journals/:id/post` after period and setup validation exist.
- Enforce immutability at service level and with database permissions/policies in production.
- Add fiscal-document-to-ledger posting for ICMS, PIS, COFINS, IBS, CBS, IS, retentions, and recoverable purchase taxes.
- Add accounting periods and posting date restrictions.

