# Fiscal Implementation Backlog

Date: 2026-05-16

## P0 - Integrity And Proof

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Apply fiscal migration in disposable DB | Run `prisma migrate deploy` against Postgres and fix any SQL issue | DB | 0.5 day | Critical |
| Seed fiscal setup | Run `prisma db seed` and verify fiscal summary has rules/profiles | DB, API | 0.5 day | Critical |
| Add fiscal integration tests | Cover summary, rule list, tax preview, tenant/RBAC protection | API | 1-2 days | High |
| Add setup-change audit | Audit every create/update to fiscal setup/rules/profiles | API, audit | 1 day | High |
| Validate master-data migration | Apply `20260516133000_brazil_fiscal_master_data_foundation` in disposable Postgres | DB | 0.5 day | Critical |
| Add master-data integration tests | Cover item/service/company/branch/employee/party fiscal CRUD and tenant filtering | API | 1-2 days | High |

## P1 - Brazilian Current Tax Model

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Fiscal setup CRUD | CRUD for jurisdictions, tax groups, operation types, rules | API, web | 3-5 days | High |
| Item template inheritance | Attach item templates to items and preview inherited values before save | inventory, fiscal, web | 2-4 days | High |
| Service register foundation | Add service master table or service item type with template inheritance | sales, fiscal, DB | 2-4 days | High |
| Party fiscal profile completion | Add vendor listing, exemptions, SUFRAMA, retention editor, contributor/non-contributor rules | API, web | 2-3 days | High |
| UF-specific IE validation | Implement state-by-state IE validation strategy and warning levels | API | 3-5 days | High |
| ICMS/PIS/COFINS calculation formulas | Implement formula strategies driven by `formulaCode` and `parameters` | fiscal engine | 5-10 days | High |
| Retentions foundation | IRRF, CSLL, INSS, FUNRURAL, withheld tax ledger behavior | fiscal/posting | 5-10 days | High |
| DIFAL/FCP interstate rules | Origin/destination and taxpayer-type aware formulas | fiscal engine | 5-10 days | High |

## P2 - Tax Reform

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| CBS/IBS 2026 document fields | Persist required CBS/IBS highlights for NF-e/NFS-e layouts | fiscal docs | 3-5 days | High |
| Transition factor parameters | Store current/new tax coexistence factors by year/rule | fiscal setup | 2-3 days | High |
| Official calculator adapter | Prepare integration boundary for official RTC calculator outputs | fiscal engine | 3-5 days | Medium |
| IS selective-tax rules | Model product/service eligibility and activation from 2027 | fiscal setup | 3-5 days | Medium |

## P3 - NF-e/NFS-e Preparation

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Fiscal event table | Authorization, rejection, cancellation, correction, contingency events | DB, API | 2-4 days | High |
| XML storage strategy | Store generated XML keys, hashes, layout versions, attachments | API, storage | 2-4 days | High |
| SEFAZ adapter interface | Provider boundary for certificate, signing, transmit, query, cancel | API | 5-10 days | High |
| Municipal NFS-e adapter interface | Per-municipality provider strategy | API | 5-10 days | High |

## P4 - Enterprise Accounting

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Accounting periods | Open/close periods and posting date validation | finance | 2-4 days | High |
| Post journal command | Convert previews into immutable GL/customer/supplier/tax ledgers | posting | 5-10 days | High |
| Purchase recoverability | Recoverable ICMS/PIS/COFINS/IBS/CBS handling | purchases, posting | 5-10 days | High |
| Tax settlement | Periodic apuração and tax settlement ledger | fiscal, finance | 5-10 days | High |
