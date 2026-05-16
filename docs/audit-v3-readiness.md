# Navomnis ERP - Complete V3 V1-Testing Readiness Audit

Date: 2026-05-15
Scope: full repository rescan for v3, excluding generated/vendor folders (`node_modules`, `dist`, `.turbo`, `.git`, Playwright output) plus targeted inspection of Prisma migrations/schema, sales V1 workflow, inventory, parties, audit, tests, CI, web V1 pages, mobile wrapper, and deployment documentation.

## 1. Executive Summary

V3 is another substantial improvement. The project now has a stronger V1 sales workflow than v2: document number series, sales line removal, stock-balance validation before release, inventory balance endpoint/UI, audit-log read endpoint, company/customer selectors in the sales UI, item selector in the line form, release confirmation, better API error display, expanded tenant-isolation tests, and fixed integration-test import paths.

The system is now approaching a credible internal engineering V1 validation release, but it is still not ready for a broad business-user test without one more hardening pass. Static quality checks pass, Prisma validates, Prisma formatting passes, and the monorepo builds. The remaining uncertainty is operational verification: the API integration command no longer fails with the v2 import error, but it timed out in this local environment while trying to use local Postgres/Redis. Docker is not available here, so CI-style service reproduction was blocked.

Current recommendation: run the GitHub Actions `integration` job or a machine with Docker/Postgres/Redis and prove API integration plus Playwright E2E green. If that is green, Navomnis ERP is close to a narrow internal web-only V1 sales/inventory test.

## 2. V3 Delta From V2

Major improvements since v2:
- Added `DocumentNumberSeries` model and migration.
- Sales order numbers now use a tenant-scoped persisted sequence in a transaction instead of `count + 1`.
- Sales release now checks item ledger balance before creating negative inventory movements.
- Added `DELETE /sales/orders/:id/lines/:lineId` for draft line removal.
- Added `GET /inventory/balances` and inventory UI balance table.
- Added `GET /parties/companies`; sales UI now selects company/customer through API instead of hardcoded client constants.
- Sales detail UI now selects items through API instead of hardcoding only `ITEM-001`.
- Added release confirmation and better server-error display in the sales UI.
- Added `AuditController` with `GET /audit/logs`.
- Seed now creates `audit.read`.
- API integration test imports have been corrected.
- Tenant isolation tests now include cross-tenant item rejection on sales line add.
- Sales integration test now asserts audit rows for create/release.
- CI now uploads Playwright report on failure.

Remaining blockers/new concerns:
- Integration tests could not be locally proven; command timed out without local Docker/Postgres/Redis availability.
- Unit test script still passes with no tests.
- CI integration/E2E is designed but must be observed green in GitHub Actions or a matching local environment.
- Finance and purchases remain largely non-operational.
- Stock validation is ledger-sum based only; there are no warehouses, reservations, costing, or shipment concepts.
- Release still transitions `DRAFT -> OPEN`; ERP semantics around `OPEN`, `RELEASED`, and `POSTED` remain fuzzy.

## 3. Validation Results

| Check | Result | Notes |
|---|---|---|
| `pnpm lint` | Passed | API/web lint green; config/ui/i18n/mobile still use no-op lint/build scripts. |
| `pnpm typecheck` | Passed | API and web typecheck green. |
| `pnpm build` | Passed | Full monorepo build green. Web main bundle warning remains. |
| `prisma validate` with `DATABASE_URL` | Passed | Schema valid. |
| `prisma format --check` | Passed | Schema formatted. |
| `pnpm --filter @navomnis/api test` | Technically passed | Still no unit tests under `src`; passes because of `--passWithNoTests`. |
| `pnpm run test:integration` in `apps/api` | Timed out locally | v2 import error appears fixed; local service dependency prevented proof. |
| `docker --version` | Failed | Docker CLI unavailable in this environment. |
| Playwright E2E | Not locally executed | Requires API running against DB/Redis; CI job is configured to do this. |

Build warning:
- `apps/web` main JS is about 614 kB minified, above Vite's 500 kB warning threshold.

## 4. Repository And Architecture Assessment

Architecture is moving from scaffold to a thin vertical slice:
- Sales, parties, inventory, and audit now have service/controller patterns.
- Finance and purchases still directly expose thin/stub behavior.
- Tenant context remains centralized through guards and AsyncLocalStorage.
- Prisma middleware still provides broad tenant filtering/injection.
- V1 flow has a defined product/testing document.
- CI now has a meaningful integration/E2E job.

The architecture is still not mature enterprise ERP architecture. It is a practical early SaaS architecture with one operational slice. That is acceptable for internal validation, as long as scope is communicated clearly.

## 5. Backend Audit

Implemented:
- Auth login/refresh/logout/register-dev/me.
- Refresh token rotation, configured expiry, DB expiry check, revoke-all logout.
- RBAC and tenant access guard.
- Health endpoints.
- Parties companies/customers list and customer create.
- Inventory items, balances, ledger, item create.
- Sales order list/get/create/add-line/remove-line/release.
- Audit log creation and tenant-scoped list endpoint.
- Notifications queue/worker skeleton.
- LGPD consent endpoints.

Backend strengths:
- V1 sales workflow is now a real service-layer workflow.
- Sales create validates company and customer tenant ownership.
- Sales add-line validates item tenant ownership.
- Release validates draft status, line existence, and stock availability.
- Release and order-number generation use transactions.
- Audit is no longer write-only; it is queryable.

Backend risks:
- `DocumentNumberSeries` is added, but migration/seeding must be proven in CI/staging.
- Stock availability is checked outside the same transaction that posts ledger entries. Concurrent releases can still over-allocate without locking/materialized stock/reservation.
- Sales line removal has no explicit tenant field on line; it scopes through parent relation, which is acceptable in Prisma but should be covered by tests.
- No edit line endpoint exists, only add/remove.
- No cancel/reopen/reverse flow exists for released sales orders.
- No GL/AR posting exists.
- No purchases write workflow exists.
- No unit tests for service methods exist.

## 6. ERP Functional Maturity

Finance:
- Still low.
- Models exist for chart of accounts and GL entries, but no journal header, balanced posting, periods, receivables, payables, banking, reports, or posting engine.

Sales:
- Improved to early internal V1.
- Functional: draft order creation, line addition/removal, stock-checked release, ledger movement, audit logging.
- Missing: quotes, pricing rules, discounts, taxes, customer credit checks, shipments, invoices, AR, cancellation/reversal, document lifecycle finalization.

Purchases:
- Still very low.
- Purchase orders are list-only; goods receipt and purchase invoices are absent.

Inventory:
- Improved.
- Functional: items list/create, ledger list, balance by item, sales release stock check.
- Missing: warehouses, bins/locations, reservations, costing/valuation, item tracking, adjustments, UOM conversions, availability by date/location.

Authentication/RBAC:
- Moderate for internal V1.
- Missing: failed-login logging, account lockout, MFA, session list, invite/provisioning, company-level authorization.

Notifications:
- Early scaffold; no production-grade preference/dead-letter/ops handling.

LGPD:
- Consent-only; no export/delete/anonymization/retention execution.

## 7. Multi-Tenant Audit

Improvements:
- V1 write paths validate connected company/customer/item tenant ownership.
- Audit list is tenant-scoped.
- Integration tests now include cross-tenant list isolation and cross-tenant item rejection.
- Number series is tenant-scoped.

Remaining risks:
- Integration tests were not locally proven green.
- Prisma middleware still silently bypasses tenant filtering without AsyncLocalStorage context.
- Database still lacks same-tenant composite foreign-key enforcement.
- Several child tables remain indirectly tenant-scoped through parent relations.
- Background jobs still do not carry tenant context.
- No Redis/cache key strategy exists yet.
- Company-level access (`UserCompany`) is modeled but not enforced on sales create/release.

Multi-tenant verdict: much better for the V1 slice, but still not enough for real multi-tenant customer testing until CI proves isolation green and company-level constraints are defined.

## 8. Database Audit

Improvements:
- New `DocumentNumberSeries` table with `@@unique([tenantId, code])`.
- Seed backfills `SALES_ORDER` number series by tenant.
- Prisma schema is valid and formatted.

Persistent database risks:
- Financial integrity remains weak; `GlEntry` can represent invalid accounting.
- No stock reservation or locked balance table.
- No warehouse/location tables.
- No database-level constraint that sales order company/customer/item belong to the same tenant.
- No soft-delete consistency policy.
- Migration rollback/backup strategy is documented but not proven.
- Number series uses Prisma `upsert` with increment, but high-concurrency behavior should be stress-tested on PostgreSQL.

## 9. Frontend UX Audit

Improvements:
- Sales list now has company/customer selectors from API.
- Sales detail now has item selector from API.
- Sales detail has remove-line action.
- Release has a confirmation dialog.
- Sales pages display API errors.
- Inventory page shows balances plus ledger.
- Dashboard links to sales/inventory.
- Mobile header navigation exists for V1 web routes.

Remaining UX gaps:
- Browser `window.confirm` is functional but not a polished ERP confirmation pattern.
- No customer/item creation flow inside the sales workflow.
- No edit line behavior.
- No toast/notification system.
- No optimistic feedback or robust server validation mapping.
- Dashboard still exposes raw session JSON.
- Finance and purchases remain disabled.
- Tables lack search/filter/sort/pagination.
- Accessibility is partial; no full keyboard/screen-reader audit is present.

## 10. Mobile Audit

Mobile remains out of V1 scope, correctly.

Current status:
- Capacitor wrapper exists.
- Mobile build copies web dist.
- No native Android/iOS folders or device validation.
- No native auth storage, push registration, deep links, safe-area verification, or offline strategy.

Mobile score improves only slightly because the web shell is more responsive, but mobile should remain excluded from V1.

## 11. DevOps Audit

Improvements:
- CI includes Postgres/Redis integration job.
- CI runs migrate/seed, API integration, API build/start, web build, Playwright, and uploads Playwright report on failure.
- Staging docs remain useful.
- Dockerfile and Docker Compose remain in place.

Risks:
- CI integration has not been observed green in this audit.
- Local Docker is unavailable, blocking local reproduction.
- Railway deploy workflow remains a placeholder.
- Migration execution is documented and included in CI, but staging/prod release execution is not proven.
- No backup/restore exercise exists.
- No monitoring/alerting baseline exists beyond health endpoints and optional Sentry DSNs.

Can it be safely deployed?
- To a private staging environment for V1 validation: likely, after CI integration is proven green.
- To production beta: no.

## 12. Security Audit

Improvements:
- Swagger gated by environment.
- Logout and refresh-token expiry improved in prior pass and remain in place.
- Audit log endpoint exists with `audit.read` permission.
- Generated/local metadata is ignored.

Remaining security risks:
- Browser auth store still persists access/refresh tokens through Zustand persistence.
- No failed-login logging.
- No account lockout or adaptive throttling.
- No MFA.
- Public registration still enabled outside production.
- OAuth token encryption is not implemented.
- CSP is not explicitly tuned.
- Tenant isolation and RBAC tests still need observed green CI proof.

## 13. Testing Readiness

Testing posture is significantly improved:
- API integration tests exist for V1 sales flow.
- Tests now assert audit creation.
- Tenant tests cover list isolation and cross-tenant item rejection.
- Playwright covers login, sales order create, add line, release, and ledger visibility.
- CI has a meaningful integration job.

But:
- Local integration command timed out because local DB/Redis/Docker are not available.
- Unit tests are still absent.
- Negative path coverage is still incomplete: release without stock, release twice, remove line cross-tenant, RBAC denial, audit endpoint permissions, invalid number-series concurrency.
- Playwright was not locally executed.

Testing readiness verdict: designed well enough for V1, but must be proven green in CI/staging before test release.

## 14. Gap Analysis

Critical:
- Run GitHub Actions integration job or equivalent Docker-backed local environment and prove API integration plus Playwright green.
- Confirm new `DocumentNumberSeries` migration applies cleanly to fresh and existing DBs.
- Add or verify test coverage for insufficient stock and release-twice behavior.
- Decide V1 wording for `DRAFT -> OPEN` release semantics.
- Document that V1 sales release is not shipment/invoice/accounting posting.

High:
- Add cancel/reversal for released sales test orders.
- Add edit-line endpoint/UI.
- Enforce or explicitly defer company-level authorization.
- Add failed-login logging and abuse controls.
- Replace browser token persistence or record an accepted internal-test risk.
- Deploy staging and run V1 E2E against staging.
- Implement Railway deploy path or formal manual deployment checklist.

Medium:
- Add customer/item creation from sales flow.
- Add audit viewer page in web.
- Add better confirmation modal/toasts.
- Add indexes for ledger document lookup, sales by customer/date, and audit by entity.
- Add queue failure visibility.
- Add CI artifacts for API logs when integration fails.

Low:
- Code split web bundle.
- Expand shared UI package.
- Improve i18n coverage.
- Replace raw dashboard session JSON.

## 15. Complete Pending Task List

### Backend Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Prove integration green | Run API integration tests with real Postgres/Redis in CI or Docker-backed machine. | API, CI | Medium | 0.5-1 day | DB/Redis services | High |
| Critical | Test stock failures | Add integration tests for insufficient stock and double release. | sales, inventory | Medium | 1 day | test harness | High |
| Critical | Clarify release semantics | Decide whether V1 should use `OPEN` or `RELEASED` for released sales orders. | sales | Low | 0.5 day | product decision | High |
| High | Add reversal/cancel | Add cancel/reversal with compensating ledger entries for V1 test cleanup. | sales, inventory | High | 3-5 days | lifecycle design | High |
| High | Add line edit | Support quantity/price correction without remove/add workaround. | sales | Medium | 1-2 days | draft rules | Medium |
| High | Company authorization | Enforce `UserCompany` permissions or document single-company V1 assumption. | auth, sales | Medium | 2 days | product/security decision | High |
| High | Failed-login logging | Record failed attempts and add identity-aware throttling/lockout. | auth | Medium | 2 days | auth policy | Medium |
| Medium | Audit filters | Add entity/action filters and pagination to audit endpoint. | audit | Medium | 1-2 days | UI needs | Medium |
| Medium | Queue ops | Add queue failure/retry visibility. | notifications | Medium | 2 days | ops scope | Medium |

### Frontend Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Run E2E green | Execute Playwright against real API/staging and fix failures. | web, API | Medium | 1 day | API integration green | High |
| High | Sales edit UX | Add edit-line flow and better release state handling. | sales UI | Medium | 2-3 days | API edit endpoint | Medium |
| High | Audit UI | Add tenant audit log page for V1 validation. | web audit | Medium | 1-2 days | audit endpoint | Medium |
| High | Replace confirm | Use accessible modal confirmation instead of `window.confirm`. | sales UI | Low | 1 day | UI component | Medium |
| Medium | Dashboard cleanup | Replace raw session JSON with user/tenant summary. | dashboard | Low | 0.5 day | none | Low |
| Medium | Table ergonomics | Add search/filter/sort/pagination for sales/inventory/audit. | web | Medium | 3 days | query conventions | Medium |
| Medium | Error/toast system | Add consistent global feedback and API error mapping. | web/ui | Medium | 2 days | UI package | Medium |

### Mobile Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Low | Keep out of V1 | Preserve web-only scope for internal V1. | docs/product | Low | 0.5 day | none | Low |
| Medium | Post-V1 mobile spike | Generate native projects and validate auth/nav/storage on device. | mobile | Medium | 2-4 days | web V1 stable | Medium |

### Database Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Migration proof | Apply migrations to fresh and seeded DB; verify number series state. | Prisma | Medium | 1 day | DB service | High |
| High | Stock concurrency | Design reservation/locking strategy or document V1 single-user assumption. | inventory | High | 3-5 days | product scope | High |
| High | Tenant relation constraints | Add service tests and consider composite DB constraints. | sales, inventory, parties | High | 3-5 days | schema design | High |
| High | Finance posting model | Add journal header/line, balanced posting, fiscal period design. | finance | High | 5-8 days | finance scope | High |
| Medium | Index pass | Add indexes for ledger document, audit entity, sales customer/date. | DB | Medium | 1-2 days | query patterns | Medium |
| Medium | Soft delete policy | Standardize `deletedAt` filtering and uniqueness behavior. | DB/services | Medium | 2 days | service conventions | Medium |

### DevOps Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Observe CI integration green | Run GitHub Actions integration and capture result. | CI | Medium | 0.5 day | remote CI | High |
| Critical | Staging smoke | Deploy staging and run V1 Playwright against it. | Vercel/Railway | High | 2-3 days | green CI | High |
| High | Railway deploy real path | Replace placeholder with Git integration or exact service commands. | Railway | Medium | 2 days | service config | High |
| High | Migration release step | Ensure `prisma migrate deploy` runs before API process in staging. | API deploy | Medium | 1 day | staging | High |
| Medium | Observability baseline | Add Sentry releases, uptime check, queue failure alerts. | API/web/worker | Medium | 2-4 days | staging | Medium |
| Medium | CI diagnostics | Upload API logs/test artifacts on integration failure. | CI | Low | 1 day | CI scripts | Low |

### Security Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Token storage decision | Move refresh token to safer storage or explicitly accept internal-test risk. | web/auth | High | 2-5 days | security decision | High |
| High | Auth abuse controls | Failed login log, lockout/slowdown, per-identity rate limit. | auth | Medium | 2-3 days | policy | Medium |
| High | RBAC negative tests | Test no-permission access for sales/audit/inventory endpoints. | API tests | Medium | 1-2 days | test DB | High |
| Medium | CSP hardening | Add explicit CSP for deployed web/API docs contexts. | web/API | Medium | 1-2 days | asset review | Medium |
| Medium | OAuth secret handling | Encrypt provider tokens before any OAuth launch. | auth/account | Medium | 2 days | OAuth scope | Medium |

### ERP Functional Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | V1 scope statement | State V1 release is sales/inventory validation, not accounting/invoicing. | product/docs | Low | 0.5 day | release decision | High |
| High | Sales reversal | Provide cleanup path for internal testers. | sales/inventory | High | 3-5 days | lifecycle | High |
| High | Finance boundary | Either keep finance read-only or add minimal GL posting. | finance | Medium | 1-5 days | scope | High |
| Medium | Purchase boundary | Clearly label purchases as out-of-scope or implement PO draft flow. | purchases | Medium | 1-5 days | scope | Medium |
| Medium | Inventory assumptions | Document ledger-sum balance, no warehouses/reservations/costing. | inventory/docs | Low | 0.5 day | V1 scope | Medium |

### UX Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| High | Accessible release modal | Replace native confirm with app modal and explicit consequences. | sales UI | Low | 1 day | UI component | Medium |
| High | Audit validation screen | Show audit entries for V1 test script. | web audit | Medium | 1-2 days | audit API | Medium |
| Medium | Empty/error polish | Improve all loading/empty/error states with actionable copy. | web | Medium | 1-2 days | none | Medium |
| Medium | Keyboard/accessibility pass | Validate login, nav, sales, release, inventory with keyboard/screen reader basics. | web | Medium | 2 days | UI stable | Medium |

### Testing Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | CI proof | Capture a green run of quality + integration jobs. | CI | Medium | 0.5-1 day | GitHub Actions | High |
| Critical | Add negative sales tests | Insufficient stock, release twice, remove after release, invalid item/company/customer. | API tests | Medium | 2 days | DB harness | High |
| High | RBAC tests | Confirm missing permissions fail for sales write/audit read/master write. | API tests | Medium | 1-2 days | test users | High |
| High | E2E staging test | Run Playwright V1 against staging URL. | web/API | Medium | 1 day | staging | High |
| Medium | Service unit tests | Add focused tests for number-series and stock logic. | API services | Medium | 2 days | test setup | Medium |
| Medium | Accessibility tests | Add basic Playwright/axe checks. | web | Medium | 1-2 days | E2E setup | Medium |

## 16. MVP Readiness Scores

| Area | V1 score | V2 score | V3 score |
|---|---:|---:|---:|
| Architecture | 58 | 66 | 70 |
| Backend maturity | 32 | 48 | 58 |
| Frontend maturity | 24 | 42 | 51 |
| Mobile readiness | 12 | 18 | 20 |
| ERP readiness | 14 | 31 | 40 |
| Security readiness | 46 | 55 | 58 |
| Multi-tenant readiness | 38 | 48 | 55 |
| Production readiness | 22 | 30 | 34 |
| Testing readiness | 18 | 34 | 45 |
| UX maturity | 20 | 38 | 48 |
| DevOps maturity | 42 | 50 | 54 |

Overall readiness score: 53/100.

Estimated completion percentage toward first usable internal ERP testing release: 55-60%, assuming CI integration/E2E can be made green without major surprises.

## 17. Recommended Next Sprints

Sprint 0 - Proof and release hygiene:
- Run GitHub Actions integration job.
- Confirm migrations apply cleanly from scratch.
- Run Playwright against CI/staging.
- Add negative tests for stock/release/RBAC.
- Freeze V1 known limitations.

Sprint 1 - V1 tester usability:
- Add audit web page.
- Add edit line.
- Replace confirm with accessible modal.
- Remove dashboard raw JSON.
- Add V1 test script for internal users.

Sprint 2 - Safety:
- Add sales reversal/cancel.
- Add failed-login logging/abuse controls.
- Decide token storage risk.
- Add company-level authorization or document single-company assumption.

Sprint 3 - Staging release:
- Deploy web/API/worker staging.
- Run migration release path.
- Execute E2E and manual smoke.
- Prepare internal testing release notes.

## 18. MVP Release Recommendation

First internal testing release should be positioned as:
- Web-only.
- Single controlled tenant/test environment.
- Sales/inventory validation only.
- Includes login, sales order draft/create/line/remove/release, stock balance check, inventory ledger/balance visibility, and audit log validation.
- Excludes finance posting, invoicing, taxes, banking, purchasing workflows, production data, mobile, and offline use.

Release gate:
- Do not release to business testers until CI integration and Playwright E2E are green in a Docker-backed/CI environment.

## 19. Production Risks

Dangerous today:
- Integration/E2E not proven green in this audit environment.
- No finance/accounting integrity.
- Inventory concurrency is not safe for multi-user production.
- Token persistence in browser storage remains a security risk.
- Railway deployment remains placeholder.
- No rollback/restore proof.
- No mature observability.
- Purchases and finance UI remain disabled/stubbed.

## 20. Final Verdict

First internal technical testing: very close. Static checks and build are green; V1 workflow is now substantial. The missing proof is green integration/E2E with real services.

First internal ERP workflow testing: close, but gated by CI/staging proof and clear scope wording.

Controlled customer demo: possible soon as a scripted sales/inventory prototype only, not as a full ERP demo.

Production beta: still far. Finance, purchasing, tenant guarantees, inventory concurrency, security hardening, deployment automation, and observability remain immature.

Bottom line: v3 is the first version that looks like a serious internal V1 candidate, provided the team proves the automated integration path green. The next best work is not broadening modules; it is proving, hardening, and documenting the sales/inventory slice already built.

## 21. Pós-auditoria (implementação do plano de follow-up)

- Documentação do job `integration` e artefactos: [ci-integration.md](./ci-integration.md), [staging.md](./staging.md), [ci-verification-log.md](./ci-verification-log.md).
- Limites V1 (incl. concorrência, `OPEN`, `UserCompany`, tokens web): [v1-known-limits.md](./v1-known-limits.md).
- Checklist manual alinhada ao Playwright: [v1-internal-test-script.md](./v1-internal-test-script.md).
- **Prova operacional:** confirmar o job **`integration`** verde no GitHub Actions na branch alvo (migração + seed + Jest + API + build web + Playwright). O repositório inclui testes de integração adicionais (stock insuficiente, libertação duplicada, RBAC, `UserCompany`) e endurecimento da libertação (validação de saldo na mesma transação que os movimentos).
- **Auditoria V4 (readiness atual):** [audit-v4-readiness.md](./audit-v4-readiness.md).
