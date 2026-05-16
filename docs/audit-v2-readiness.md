# Navomnis ERP - Complete V2 V1-Testing Readiness Audit

Date: 2026-05-15
Scope: full repository rescan for v2, excluding generated/vendor folders (`node_modules`, `dist`, `.turbo`, `.git`) plus targeted inspection of CI, Docker/deploy docs, Prisma, API tests, web E2E, and V1 scenario docs.

## 1. Executive Summary

V2 is a meaningful step forward from the first audit. The repository is no longer only a platform skeleton: it now contains a defined V1 testing scenario, a real sales-order slice, basic customer/item creation endpoints, audit logging for new mutations, logout/refresh-token revocation, Swagger gating, improved `.gitignore`, staging documentation, API integration tests, and a Playwright V1 scenario.

However, the system is still not ready for a reliable internal V1 testing release. The main blocker is no longer "there is no workflow"; the new blocker is "the workflow exists but is incomplete, fragile, and the automated integration path is currently broken." The API integration test command fails at module resolution before it reaches the database. That means the new CI `integration` job is likely red as written.

Current recommendation: do not start business-user V1 testing yet. First fix the integration test imports, run the full CI-style integration/E2E path green, then perform a focused manual test of the sales V1 flow in staging.

## 2. V2 Delta From V1

Major improvements since v1:
- Added `docs/v1-scenario.md`, explicitly freezing a web-only V1 sales scenario.
- Added `docs/staging.md` with staging, migration, and E2E guidance.
- Added `AuditModule` and `AuditService`.
- Added `PartiesModule` with customer list/create.
- Added `InventoryService` and item create endpoint.
- Added `SalesService` with create order, add line, get order, release order.
- Sales release now creates negative `ItemLedgerEntry` rows.
- Added `sales.write`, `master.read`, and `master.write` seed permissions.
- Added `/auth/logout` to revoke all refresh tokens for the user.
- Refresh-token DB expiry now follows configured `JWT_REFRESH_EXPIRES` and is checked on refresh.
- Swagger is gated by `NODE_ENV` / `SWAGGER_ENABLED`.
- Web now has routes for sales and inventory.
- Web has a mobile header nav for core routes.
- Added API integration tests and Playwright E2E tests for the V1 flow.
- Prisma schema is now formatted correctly.
- `.gitignore` now excludes generated dist, Playwright output, Prisma/generated, and Vercel local metadata.

Regressions/new blockers:
- `pnpm --filter @navomnis/api run test:integration` fails because integration test imports point to the wrong relative paths.
- CI integration job is likely broken until that is fixed.
- Web V1 flow hardcodes demo company/customer IDs in the client.
- Sales order number generation uses `count + 1`, which is collision-prone under concurrency and after deletes/imports.
- Sales release has no stock availability check and no idempotency guard beyond status.
- Finance and purchases remain mostly read-only/stubbed.

## 3. Validation Results

Commands run from the current repo:

| Check | Result | Notes |
|---|---|---|
| `pnpm lint` | Passed | API and web lint pass; several packages still have no-op lint scripts. |
| `pnpm typecheck` | Passed | API and web TypeScript pass. |
| `pnpm build` | Passed | Full monorepo build passes. Web bundle warning remains. |
| `prisma validate` with `DATABASE_URL` | Passed | Schema valid. |
| `prisma format --check` | Passed | Fixed since v1. |
| `pnpm --filter @navomnis/api test` | Technically passed | Still no unit tests under `src`; passes via `--passWithNoTests`. |
| `pnpm run test:integration` in `apps/api` | Failed | Import path errors before DB access. |
| Docker local service check | Blocked | Docker CLI is not installed/available in this environment. |
| Playwright E2E | Not executed | CI would not reach this reliably while API integration tests are broken; also needs API/staging service. |

Integration failure details:
- `test/helpers/create-integration-app.ts` imports `../src/app.module`, but from `test/helpers` it should resolve one level differently.
- `test/tenant-isolation.integration-spec.ts` imports `../../src/prisma/prisma.service`, which resolves outside `apps/api`; from `test` it should not go up two levels.

## 4. Repository And Architecture Assessment

The monorepo architecture remains appropriate:
- pnpm workspace and Turborepo are configured.
- Apps are split into API, web, and mobile.
- Shared packages exist for config, i18n, and UI.
- Docker Compose remains useful for local Postgres/Redis, although Docker was unavailable in this audit environment.

Architecture maturity improved because controllers are beginning to delegate to services. Sales, inventory, and parties now have service-layer code, but finance and purchases still directly call Prisma from controllers. The architecture is therefore mixed: there is a pattern emerging, but it is not yet consistently applied across ERP domains.

## 5. Backend Audit

Implemented now:
- Auth login, refresh, logout, dev register, `/auth/me`.
- Global JWT guard and throttler.
- Tenant access guard plus AsyncLocalStorage tenant context.
- RBAC guard with permission decorators.
- Health endpoints.
- Parties customer list/create.
- Inventory item list/create and ledger list.
- Sales order list/get/create/add-line/release.
- Audit logging for customer/item/sales mutations.
- Notifications queue and email processor remain present.
- LGPD consent endpoints remain present.

Backend strengths:
- The V1 sales slice is now real enough for engineering validation.
- Mutations validate tenant ownership for company, customer, and item before sales writes.
- Sales release is transactional for ledger creation and status update.
- Refresh-token expiry and logout revocation are improved.
- Swagger exposure is no longer unconditional in production.

Backend risks:
- Sales release changes status from `DRAFT` to `OPEN`; naming does not clearly match ERP lifecycle semantics (`OPEN`, `RELEASED`, `POSTED`).
- Releasing a sales order creates inventory ledger entries but no reservation, shipment, posting, invoice, GL entry, or receivable.
- No inventory availability check exists before release.
- No reversal/cancel flow exists for released orders.
- No update/remove line endpoints exist.
- No customer/item update/deactivate endpoints exist.
- No purchase workflow implementation beyond read-only purchase order list.
- Finance remains a chart-of-accounts read endpoint plus summary stub.
- Some controllers still bypass service-layer invariant patterns.
- Unit test script still gives false confidence because it passes with no tests.

## 6. ERP Functional Maturity

Finance:
- Still low. Chart of accounts and GL tables exist; finance summary is still a stub.
- Missing journal batches, balanced posting, fiscal periods, receivables, payables, banking, reports, dimensions, tax, and reversal flows.

Sales:
- Improved from very low to early MVP slice.
- Current flow: list orders, create draft, add line, release, create inventory ledger movement.
- Missing: quote, pricing, discounts, taxes, customer credit control, order editing beyond add line, shipment, invoice, AR posting, cancellation/reopen, document numbering service.

Purchases:
- Still very low. Purchase orders can be listed only.
- Missing vendor CRUD, PO create/release, goods receipt, purchase invoice, AP posting, matching, landed cost.

Inventory:
- Improved to early MVP support.
- Item CRUD has only create/list; ledger is readable and sales release creates movements.
- Missing warehouses, locations, stock balance endpoint, availability check, reservations, costing, adjustments, item tracking, UOM conversions.

Authentication/RBAC:
- Improved. Logout revokes refresh tokens; refresh expiry is checked.
- Missing failed-login logging, lockout, MFA, session list, invite/provisioning flow, company-level permissions.

Notifications:
- Mostly unchanged. Queue and email worker exist, but no production-grade delivery/prefs/dead-letter flow.

LGPD:
- Mostly unchanged. Consent exists; export/delete/retention are absent.

## 7. Multi-Tenant Audit

Improvements:
- New sales service explicitly checks tenant ownership for `companyId`, `customerId`, and `itemId`.
- Integration test intent now includes tenant isolation checks.
- Services throw when tenant context is absent.

Remaining risks:
- Prisma middleware still silently bypasses tenant filtering when no AsyncLocalStorage context exists.
- Integration tests that should prove isolation currently do not run.
- Database constraints still do not enforce same-tenant relationships between sales orders, customers, companies, and items.
- `SalesOrderLine`, `PurchaseOrderLine`, `ApprovalStep`, `ApprovalTask`, and `NotificationDelivery` remain indirectly scoped via parent relations.
- Interactive transaction code uses `tx.salesOrder.update({ where: { id } })`; because the order was fetched tenant-scoped first this is acceptable for the current path, but future update paths should consistently include tenant validation or scoped helpers.
- Background jobs still do not carry an explicit tenant context in job payloads.
- Redis/cache tenant-key strategy is still not defined.

Multi-tenant verdict: better than v1, but still not sufficient for real multi-tenant customer testing until the isolation test suite runs green and relation constraints/guards are broadened.

## 8. Database Audit

Improvements:
- Schema formatting is now correct.
- Seed permissions expanded for V1 flow.

Persistent database risks:
- No migration changes were added to strengthen financial or tenant integrity.
- GL still allows invalid unbalanced accounting states.
- No journal document/header grouping.
- No warehouses or stock balances.
- No number-series table; sales order numbers are generated from count.
- No optimistic concurrency is enforced even though `version` fields exist.
- Soft delete remains inconsistent and not globally filtered.
- Indexes are still thin for operational scale.

## 9. Frontend UX Audit

Improvements:
- Sales list page exists with table, loading/error/empty states, and create draft button.
- Sales detail page exists with line-add form and release button.
- Inventory ledger page exists.
- Dashboard links to sales and inventory.
- Mobile header nav now exposes core V1 routes.
- Logout calls the API and clears local session.

Risks:
- The sales create flow hardcodes demo company/customer IDs; this is acceptable only for a seed-based internal test, not real user validation.
- Add-line flow hardcodes `ITEM-001`.
- No customer/item selector exists.
- No edit/remove line actions exist.
- No form-level validation feedback for API validation errors.
- No toast system or global error handling UX.
- Session data is still displayed as raw JSON on the dashboard.
- Finance and purchases are still visibly disabled.
- UI is still closer to a test harness than a modern ERP workspace.

## 10. Mobile Audit

Mobile V1 is explicitly out of scope in `docs/v1-scenario.md`, which is the right product decision at this stage.

Current mobile status:
- Capacitor config remains present.
- Mobile build copies the web dist.
- No native projects or device validation are present.
- No mobile-specific storage, push registration, deep links, offline behavior, or native QA exists.

Mobile readiness remains low, but it is no longer a V1 blocker because the scope has been frozen as web-only.

## 11. DevOps Audit

Improvements:
- CI now has an `integration` job with Postgres and Redis services.
- CI seeds the DB, runs API integration tests, starts API, builds web, installs Playwright, and runs E2E.
- Staging docs define env variables and migration flow.
- `.gitignore` now protects local generated artifacts and Vercel metadata.

Blockers:
- The integration job will fail until Jest import paths are corrected.
- Docker is not available in this local audit environment, so local reproduction of CI services was blocked.
- Railway deploy workflow remains a placeholder and does not actually deploy API/worker.
- No real rollback automation exists.
- No production backup/restore test is defined.
- Web bundle warning increased to about 607 kB minified main JS.

## 12. Security Audit

Improvements:
- Swagger gated in production unless `SWAGGER_ENABLED=true`.
- Logout revokes refresh tokens.
- Refresh token DB expiry now aligns with configuration and is checked.
- Generated/local deploy metadata is ignored.

Remaining security risks:
- Access and refresh tokens are still persisted by Zustand in browser storage.
- No failed login logging on invalid attempts.
- No account lockout or identity-aware throttling.
- No MFA implementation despite schema fields.
- Public register remains available outside production.
- OAuth account tokens are modeled but not encrypted.
- CSP is not explicitly tuned.
- Tenant isolation tests currently fail to run.

## 13. Testing Readiness

Testing posture improved in design but is currently not operational:
- API integration specs exist.
- Web Playwright spec exists.
- CI integration job exists.
- V1 scenario is documented.

But:
- Integration tests fail at module resolution.
- Unit tests are still absent.
- E2E was not executed in this audit due broken upstream test path and missing local Docker/API setup.
- There is no coverage around failed auth, RBAC denial, invalid sales transitions, stock availability, audit log assertions, or queue behavior.

Internal testing readiness:
- Engineering smoke testing: yes, after manual DB/API setup.
- Automated V1 validation: not yet, because integration tests fail.
- Business-user V1 testing: not yet.

## 14. Gap Analysis

Critical:
- Fix API integration test import paths and make `pnpm --filter @navomnis/api run test:integration` green.
- Run and verify the full CI integration job including Playwright.
- Replace demo hardcoded company/customer/item IDs with selectable or API-provided master data for V1 testing.
- Add stock availability check or explicitly label release as non-availability-controlled.
- Add tenant isolation tests for write/connect paths, not only list visibility.
- Decide secure token storage risk acceptance for internal testing.

High:
- Add sales order line edit/remove and cancel/reopen flow.
- Implement stock balance endpoint and show stock effect in UI.
- Add audit log assertions and an audit viewer/admin endpoint for V1.
- Add purchase order create/release or explicitly keep purchases out of V1.
- Add basic finance posting design before expanding beyond sales validation.
- Replace `count + 1` document numbering with a tenant-scoped number series.
- Add failed-login access logs and revoke-current-session semantics.
- Add real Railway staging deployment automation or a verified manual runbook.

Medium:
- Add customer/item selector UI.
- Add pagination/filtering/sorting conventions.
- Add toasts and consistent API error rendering.
- Add CI artifact upload for Playwright traces.
- Add queue failure handling and operations visibility.
- Add additional indexes for notification, order date, customer/vendor, and outbox processing.

Low:
- Code split web bundle.
- Expand shared UI package into real components.
- Expand i18n coverage.
- Improve dashboard role-center UX.

## 15. Complete Pending Task List

### Backend Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Fix integration test imports | Correct relative imports in `test/helpers/create-integration-app.ts` and `tenant-isolation.integration-spec.ts`. | API tests | Low | 0.5 day | none | High |
| Critical | Prove V1 API flow green | Run migrate/seed and API integration tests against Postgres/Redis. | API, CI | Medium | 1 day | import fix | High |
| Critical | Extend tenant write isolation tests | Test cross-tenant customer/company/item connects and line/release attempts. | sales, inventory, parties | Medium | 1-2 days | test harness green | High |
| High | Number series service | Replace `count + 1` order numbers with tenant-scoped transactional sequence. | sales, database | Medium | 2-3 days | DB change | High |
| High | Stock availability guard | Prevent release when insufficient stock or document accepted limitation. | sales, inventory | Medium | 2-3 days | stock balance query | High |
| High | Sales line edit/remove | Allow correcting draft lines before release. | sales | Medium | 2-3 days | service pattern | Medium |
| High | Audit read endpoint | Expose tenant-scoped audit history for V1 flow. | audit | Medium | 1-2 days | RBAC | Medium |
| Medium | Failed login logging | Record failed attempts with reason/IP and add abuse controls. | auth | Medium | 1-2 days | auth service | Medium |
| Medium | Purchase MVP decision | Either implement PO create/release or document as out of V1. | purchases, product | Medium | 1-5 days | scope decision | Medium |

### Frontend Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Remove hardcoded demo IDs | Add customer/company/item selectors or seed-data bootstrap endpoint. | sales UI | Medium | 2-4 days | master data APIs | High |
| Critical | Run Playwright green | Execute V1 E2E against real API/staging and fix failures. | web, API | Medium | 1-2 days | integration green | High |
| High | Sales edit usability | Add line edit/remove, confirmation on release, clearer status messaging. | sales UI | Medium | 3-4 days | API endpoints | Medium |
| High | Inventory balance display | Show item balance/ledger effect after release. | inventory UI | Medium | 2-3 days | stock endpoint | Medium |
| High | API error presentation | Add reusable error banners/toasts and field-level server error mapping. | web, ui | Medium | 2-3 days | UI pattern | Medium |
| Medium | Remove raw session JSON | Replace dashboard raw JSON with user/tenant summary. | dashboard | Low | 0.5 day | none | Low |
| Medium | Accessibility pass | Focus states, mobile nav semantics, table captions, form validation announcements. | web | Medium | 2 days | page stability | Medium |

### Mobile Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Low | Keep mobile out of V1 | Preserve web-only V1 scope in release notes. | product, docs | Low | 0.5 day | none | Low |
| Medium | Mobile spike after V1 | Generate native projects and validate auth/nav on device later. | mobile | Medium | 2-4 days | V1 complete | Medium |

### Database Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| High | Tenant relation safeguards | Add service checks and consider DB-level composite constraints where possible. | all tenant writes | High | 3-5 days | schema design | High |
| High | Number series table | Store tenant-scoped document counters with transactional increments. | sales, purchases | Medium | 2-3 days | migration | High |
| High | Stock balance support | Add balance query/indexes or materialized stock summary strategy. | inventory | Medium | 3-5 days | ledger rules | High |
| High | Finance posting model | Add journal document/batch model and balanced line enforcement. | finance | High | 5-8 days | product accounting design | High |
| Medium | Index review | Add indexes for sales by tenant/customer/date, notifications, outbox, ledger document. | database | Medium | 1-2 days | query patterns | Medium |
| Medium | Soft delete policy | Standardize filtering and uniqueness behavior. | database/services | Medium | 2-3 days | service layer | Medium |

### DevOps Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Make CI integration green | Fix imports and verify GitHub Actions service setup end to end. | CI | Medium | 1-2 days | test fix | High |
| High | Staging deployment rehearsal | Deploy web/API/worker to staging and run V1 E2E against it. | Vercel, Railway | High | 2-4 days | green CI | High |
| High | Migration runbook execution | Actually execute `migrate deploy` in staging release path. | API deploy | Medium | 1 day | staging | High |
| High | Railway deploy implementation | Replace placeholder with Git integration or working CLI commands. | Railway | Medium | 2-3 days | service IDs | High |
| Medium | Observability baseline | Sentry releases, health monitor, queue failure alerts. | API, worker, web | Medium | 2-4 days | staging | Medium |
| Medium | E2E artifacts | Upload Playwright traces/screenshots/videos on failure. | CI | Low | 0.5 day | Playwright | Low |

### Security Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Token storage decision | Move refresh token to safer storage or record accepted internal-test risk. | web, auth | High | 2-5 days | product/security decision | High |
| Critical | Tenant write isolation | Automated tests for cross-tenant connect/write/release. | API tests | Medium | 2 days | integration green | High |
| High | Auth abuse controls | Failed login logs, lockout/slowdown, identity-aware throttling. | auth | Medium | 2-3 days | auth changes | Medium |
| High | Session management | Distinguish current-device logout from revoke-all, expose sessions later. | auth | Medium | 2 days | token model | Medium |
| Medium | CSP hardening | Add explicit CSP for web/API docs context. | web/API | Medium | 1-2 days | asset review | Medium |

### ERP Functional Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Define release semantics | Decide whether release means `OPEN` or `RELEASED` and update states/UI/tests. | sales, product | Low | 0.5-1 day | none | High |
| Critical | Stock rule for V1 | Decide whether V1 enforces stock availability. | sales, inventory | Medium | 1 day | product decision | High |
| High | Sales cancellation/reversal | Allow undoing released test orders with compensating ledger entries. | sales, inventory | High | 3-5 days | stock rules | High |
| High | Finance boundary statement | State finance is read-only for V1 or add minimal GL posting. | finance, product | Medium | 1-5 days | scope decision | High |
| Medium | Purchase scope statement | Clearly label purchases as out of V1 unless implemented. | purchases | Low | 0.5 day | product decision | Medium |

### UX Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Replace test-harness UX | Add real selectors and remove seed-ID dependency from normal user flow. | sales UI | Medium | 2-4 days | APIs | High |
| High | Release confirmation | Confirm irreversible inventory movement before release. | sales UI | Low | 0.5-1 day | release semantics | Medium |
| High | Operational feedback | Toasts, progress, server validation messages. | web | Medium | 2-3 days | UI pattern | Medium |
| Medium | Table ergonomics | Sorting/filtering/search and responsive table strategy. | sales, inventory | Medium | 2-3 days | data scale | Medium |

### Testing Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Fix Jest pathing | Make integration specs load app and Prisma service. | API tests | Low | 0.5 day | none | High |
| Critical | Run CI locally/in GitHub | Verify service DB/Redis, migrate, seed, API tests, web E2E. | CI | Medium | 1-2 days | path fix | High |
| High | Add negative-path tests | Invalid tenant connects, release without lines, release twice, bad permissions. | API | Medium | 2-3 days | test harness | High |
| High | Audit tests | Assert audit rows are written for V1 mutations. | audit, sales | Medium | 1-2 days | DB harness | Medium |
| Medium | Queue tests | Email processor success/failure/retry behavior. | notifications | Medium | 2 days | Redis harness | Medium |
| Medium | Accessibility E2E | Add axe or focused keyboard tests for login/sales/release. | web | Medium | 1-2 days | page stable | Medium |

## 16. MVP Readiness Scores

| Area | V1 score | V2 score |
|---|---:|---:|
| Architecture | 58 | 66 |
| Backend maturity | 32 | 48 |
| Frontend maturity | 24 | 42 |
| Mobile readiness | 12 | 18 |
| ERP readiness | 14 | 31 |
| Security readiness | 46 | 55 |
| Multi-tenant readiness | 38 | 48 |
| Production readiness | 22 | 30 |
| Testing readiness | 18 | 34 |
| UX maturity | 20 | 38 |
| DevOps maturity | 42 | 50 |

Overall readiness score: 45/100.

Estimated completion percentage toward first usable internal ERP testing release: 45-50%.

## 17. Recommended Next Sprints

Sprint 0 - Make the new testing foundation real:
- Fix API integration import paths.
- Run `test:integration` green.
- Run full GitHub Actions integration job.
- Run Playwright V1 scenario against local/staging API.
- Document any test data reset needs.

Sprint 1 - Make V1 usable by humans:
- Replace hardcoded demo IDs with selectors.
- Add line edit/remove.
- Add release confirmation and better error feedback.
- Remove raw session JSON from dashboard.
- Add stock balance endpoint and UI.

Sprint 2 - Make V1 safer:
- Add write-path tenant isolation tests.
- Add stock availability or explicit non-enforcement warning.
- Add number series.
- Add audit read endpoint and audit assertions.
- Add failed-login logging.

Sprint 3 - Staging release:
- Deploy API/web/worker staging.
- Run migrations via release path.
- Execute E2E against staging.
- Prepare internal test script and known-limits document.

## 18. MVP Release Recommendation

V2 should target a narrow internal web-only testing release:
- Login, refresh, logout.
- Demo tenant with seed master data.
- Sales order create/add-line/release.
- Inventory ledger visibility after release.
- Audit logging for V1 mutations.
- Tenant isolation tests green.
- Playwright V1 scenario green.
- Explicitly out of scope: mobile, purchases, real finance posting, fiscal invoicing, banking, offline PWA.

Do not label this as an ERP MVP beyond internal workflow validation. It is a sales/inventory technical MVP slice.

## 19. Production Risks

Dangerous today:
- Automated V1 tests are broken.
- Tenant isolation is improved but not proven.
- Financial integrity is still not implemented.
- Inventory release can overdraw stock.
- Tokens remain in browser storage.
- Deployment to Railway remains placeholder.
- Rollback and backup procedures are documented but not proven.
- Web flow relies on seed constants and cannot generalize to real tenants.

## 20. Final Verdict

First internal technical testing: close, once the integration import bug is fixed.

First internal ERP workflow testing: substantially closer than v1, but not ready today. The V1 sales flow exists, yet it needs green automated tests and removal of hardcoded demo IDs before business users test it.

Controlled customer demo: possible soon as a scripted sales/inventory prototype, not as a broad ERP demo. Needs green staging and careful scope language.

Production beta: still far. Finance, purchases, tenant guarantees, security posture, observability, rollback, and QA depth are not production-ready.

Bottom line: v2 moved the project from "ERP scaffold" to "early V1 sales-flow prototype." The next most valuable work is not more breadth; it is making this one flow reliable, testable, tenant-safe, and usable without seed-data shortcuts.
