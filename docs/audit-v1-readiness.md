# Navomnis ERP - Complete V1 Testing Readiness Audit

Date: 2026-05-15
Scope: full repository scan excluding generated/vendor folders (`node_modules`, `dist`, `.turbo`, `.git`) plus targeted inspection of CI, Docker, docs, Prisma migration, and generated build outputs where relevant.

## 1. Executive Summary

Navomnis ERP is an early technical foundation, not yet a first operational ERP testing release. The repository has a coherent monorepo shape, a working NestJS/Prisma API skeleton, JWT authentication, RBAC scaffolding, tenant-context middleware, a Vite React shell, PWA setup, Capacitor wrapper configuration, Docker Compose for local data services, and CI/deployment scaffolding.

The system is much closer to a platform prototype than a usable ERP V1. The main ERP domains are mostly data models and read-only endpoints. There are no service-layer workflows for sales order creation/release/posting, purchase receipt, invoicing, receivables/payables, bank reconciliation, inventory costing, journal balancing, or approval execution. The web app only contains login, a shell, and a dashboard placeholder; the sidebar marks Finance, Sales, Purchases, and Inventory as unavailable.

Overall V1 testing readiness: internal technical smoke testing can start; ERP workflow validation cannot start until at least one complete end-to-end workflow is implemented.

## 2. Repository Analysis

Evidence:
- Root workspace: `package.json`, `pnpm-workspace.yaml`, `turbo.json`.
- Apps: `apps/api`, `apps/web`, `apps/mobile`.
- Packages: `packages/config`, `packages/i18n`, `packages/ui`.
- Non-generated source/config files scanned: about 105.
- API source: 48 files, compact implementation.
- Web source: 11 files, very small shell.

Strengths:
- Clear pnpm workspace and Turborepo setup.
- Strict TypeScript configs in shared config package.
- API and web typecheck pass.
- Build succeeds for all workspaces.
- Prisma schema validates when `DATABASE_URL` is supplied.
- CI includes lint, typecheck, Prisma validate, Prisma format check, and build.
- Docker Compose provides local Postgres and Redis.

Weaknesses:
- Shared packages are placeholders; `@navomnis/ui` exports only `cn`.
- Several package lint/build scripts are no-op placeholders.
- No tests exist; API Jest passes because of `--passWithNoTests`.
- Prisma format check currently fails.
- `apps/api/dist` and `apps/web/dist` are present in the workspace and appear untracked; generated artifacts should not be part of source review or commits.
- `.vercel/project.json` is present locally; not necessarily wrong, but it should be handled carefully to avoid leaking project metadata if this repository becomes public.

## 3. Technical Summary

Architecture quality is promising but shallow. The repository has the right large-scale shape for a SaaS ERP, but current implementation is mostly a scaffold:
- Backend modules exist, but domain services are absent.
- Controllers call Prisma directly, so business invariants are not centralized.
- DTO coverage is limited to auth and LGPD consent.
- Swagger exists but mostly documents thin endpoints.
- Global auth and throttling are present.
- RBAC exists but is manually attached to ERP controllers, not enforced globally by policy.
- Tenant enforcement exists through Prisma middleware and guards, but it is not strong enough for a high-confidence multi-tenant ERP yet.

## 4. Backend Audit

Implemented:
- Auth: login, refresh, dev-only register, `/auth/me`.
- Health: basic, db, Redis, queue checks.
- Finance: list chart of accounts, summary stub.
- Sales: list sales orders.
- Purchases: list purchase orders.
- Inventory: list items and ledger.
- LGPD: record/list user consent.
- Notifications: list in-app notifications and enqueue email helper.
- Worker: BullMQ email processor.

Major backend gaps:
- No service layer for Finance, Sales, Purchases, Inventory.
- No create/update/delete APIs for master data or documents.
- No posting engine, no transactional document lifecycle, no idempotency.
- No journal balancing checks.
- No sales quotes, invoices, receivables, payables, banking, goods receipt, purchase invoice, pricing, warehouses, stock reservations, lot/serial tracking, or valuation logic.
- No audit logging service wired into mutations.
- No integration tests around auth, RBAC, tenant isolation, or ERP workflows.

## 5. ERP Functional Maturity

Finance:
- Present: `ChartOfAccount`, `GlEntry` models and chart-of-accounts read endpoint.
- Missing: journal posting API, balanced debit/credit enforcement, fiscal periods, receivables, payables, cash/bank, reconciliation, reports, dimensions, reversal/correction flows.
- Maturity: very low.

Sales:
- Present: `SalesOrder`, `SalesOrderLine`, customer party model, order list endpoint, seed data.
- Missing: customer CRUD, quotes, order creation/editing/release, pricing, taxes, invoicing, shipment, credit control, posting to GL/receivables/inventory.
- Maturity: very low.

Purchases:
- Present: `PurchaseOrder`, `PurchaseOrderLine`, vendor party model, order list endpoint, seed data.
- Missing: vendor CRUD, PO creation/release, goods receipt, purchase invoices, landed costs, matching, posting to GL/payables/inventory.
- Maturity: very low.

Inventory:
- Present: `Item`, `ItemLedgerEntry`, item/ledger read endpoints, seed opening entry.
- Missing: item CRUD, warehouses/locations, UOM conversion, stock movements, reservations, adjustments, costing, availability checks, physical inventory, lot/serial tracking.
- Maturity: low.

Authentication/RBAC:
- Present: JWT access/refresh, Argon2 password hashing, hashed refresh tokens, token rotation, roles/permissions tables.
- Missing: logout/revoke endpoint, session management UI, MFA flow, password reset flow, company-level authorization, failed login logging, account lockout.
- Maturity: moderate scaffold.

Notifications:
- Present: notification models, queue, email processor, retry attempts, Resend integration.
- Missing: templates used at send time, tenant-aware job payloads, user preferences enforcement, push implementation, dead-letter/ops dashboard.
- Maturity: early scaffold.

LGPD:
- Present: legal document versions and consent records.
- Missing: data export, data deletion/anonymization, lawful basis tracking, retention jobs, privacy policy workflow, full audit trails.
- Maturity: early scaffold.

## 6. Multi-Tenant Audit

Positive:
- Access tokens include `tid`.
- `TenantAccessGuard` verifies user membership in the token tenant.
- Prisma middleware injects `tenantId` into many tenant-scoped model operations when AsyncLocalStorage context exists.
- Unique constraints use tenant scope for several business records.

Critical concerns:
- Prisma middleware silently bypasses tenant filtering when no context exists. This is useful for auth/admin/seed, but dangerous for future protected code paths because a missed guard or background job can leak data.
- Enforcement is application-level only. There is no database row-level security, no repository wrapper that requires tenant context, and no tests proving isolation.
- Relation traversal can still expose cross-tenant data if a foreign key points to another tenant's record. Example risk: `SalesOrder.tenantId` and `customerId` are separate; the database does not enforce that customer belongs to the same tenant as the order.
- Nested writes and relation connects are not tenant-validated. Injecting `tenantId` into top-level create data does not prove connected `companyId`, `customerId`, `vendorId`, `itemId`, or account IDs belong to the same tenant.
- Some tenant-related tables are not tenant-scoped directly, such as `SalesOrderLine`, `PurchaseOrderLine`, `ApprovalStep`, `ApprovalTask`, and `NotificationDelivery`. They depend on parent joins for isolation.
- Background jobs do not carry tenant context. The email processor updates `NotificationDelivery` by `notificationId` without tenant validation.
- Caching is not yet implemented, but future Redis keys must include tenant and environment names.

Multi-tenant verdict: usable for prototype demos with seed data, not safe enough for real multi-tenant customer testing until isolation tests and relation validation are added.

## 7. Database Audit

Strengths:
- Prisma schema covers many expected ERP domains.
- Decimal precision is used for financial and quantity fields.
- Several tenant-scoped unique constraints and indexes exist.
- Migration exists and schema validates.

Risks:
- No financial integrity constraints. `GlEntry` allows both debit and credit to be zero or both non-zero; no journal header groups balanced lines.
- No fiscal period/calendar model.
- No currency, tax, payment term, dimensions, posting groups, warehouses, item valuation, or document numbering tables.
- Soft delete is inconsistent and not globally filtered.
- Tenant consistency is not enforced across child relations.
- Many status fields are generic strings or simple enums without transition rules.
- Missing indexes for common lookups: sales/purchase by customer/vendor/date/company, notification by tenant/user/read status, delivery by status, outbox by tenant/publishedAt/type.
- Outbox exists but no publisher/consumer flow is implemented.
- Initial migration is large and acceptable for a prototype, but migration/rollback strategy is not mature.

## 8. Frontend UX Audit

Implemented:
- Login page with React Hook Form and Zod.
- Auth store with persisted tokens.
- Axios client with access token and refresh retry.
- App shell with sidebar, theme setting, and logout.
- Dashboard placeholder.
- React Query and i18n setup.
- PWA plugin and manifest.

UX gaps:
- No functional ERP modules in the UI.
- No module routes for Finance, Sales, Purchases, Inventory.
- No tables with sorting/filtering/pagination.
- No forms, validation summaries, optimistic/error states, empty states, skeletons, or confirmations for ERP work.
- Mobile layout hides the sidebar but does not provide mobile navigation, so authenticated mobile use is effectively blocked.
- Accessibility is partial: labels exist on login, but no skip links, no focus management, no landmark refinement, no command/menu behavior, no ARIA for navigation states beyond NavLink defaults.
- Auth errors are generic and not actionable.
- PWA is asset precache only; no offline data strategy.

Comparison to Business Central / enterprise SaaS:
- Current UI is a shell, not an ERP workspace. It lacks list pages, role centers, document pages, posting actions, audit/history, personalization, search, keyboard navigation, and dense operational layouts.

## 9. Mobile Audit

Implemented:
- Capacitor config with app id/name and `webDir: ../web/dist`.
- Android scheme set to https.
- Push notification dependency and presentation options.

Gaps:
- No native `android` or `ios` project folders committed.
- No mobile-specific auth storage strategy beyond web local storage.
- No deep links, push registration flow, offline strategy, safe-area handling verification, or responsive navigation.
- No mobile build verification on Android/iOS.
- Since web app has no mobile nav, mobile readiness is mostly theoretical.

## 10. DevOps Audit

Implemented:
- CI quality workflow.
- Deploy workflow with Vercel job and placeholder Railway job.
- Dockerfile for API/worker image.
- Docker Compose for local Postgres/Redis.
- Vercel SPA rewrites and security headers.
- Railway and Vercel docs.
- Health endpoints for DB/Redis/queues.
- Sentry DSNs supported in API/web.

Risks:
- Deploy workflow does not run tests because there are none.
- Railway deployment job does not actually deploy API/worker.
- No migration gating, no backup/rollback strategy, no release job, no canary/staging environment, no infra-as-code.
- API Docker image defaults to API role only; worker requires command override and env discipline.
- No observability dashboards, structured tracing, alerting, uptime checks, or queue failure alerting.
- Prisma format check fails locally, meaning CI likely fails unless formatting/environment differs.
- Web build has a chunk-size warning above 500 kB.

Can it be safely deployed?
- For a private technical environment: yes, with manual care.
- For controlled ERP testing: not safely until migrations, worker deployment, envs, and at least one workflow are verified end to end.
- For production: no.

## 11. Security Audit

Positive:
- Helmet enabled.
- CORS restricts origins in production.
- Throttler enabled globally.
- JWT auth guard global by default.
- Argon2 used for password and refresh token hashing.
- Refresh token rotation exists.
- Production env validation checks JWT secret length and worker email key.
- Pino redacts authorization and cookie headers.

Vulnerabilities / blockers:
- Refresh tokens are stored in Zustand localStorage through `persist`; XSS would expose both access and refresh tokens.
- No logout/revoke-all-sessions endpoint.
- Refresh token DB expiry is hardcoded to seven days and not derived from configured `JWT_REFRESH_EXPIRES`.
- Refresh does not check `expiresAt` from DB; it relies on JWT expiry and revocation.
- Swagger is always exposed at `/api/docs`, including production.
- Public registration is disabled in production, but no invite/provisioning flow exists.
- No account lockout, no failed-login `AccessLog`, no MFA implementation despite fields.
- No CSRF protection is relevant while using bearer tokens, but if cookies are adopted later it must be revisited.
- No CSP beyond Helmet defaults tuned for Vite assets.
- OAuth fields and account tokens exist but no encryption-at-rest for provider tokens.

## 12. Testing Readiness

Current validation results:
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm --filter @navomnis/api test`: passed only because no tests exist.
- `pnpm exec prisma validate` from `apps/api` with `DATABASE_URL`: passed.
- `pnpm exec prisma format --check`: failed; schema is not formatted according to Prisma.

Ready for:
- Technical smoke testing: yes.
- Auth happy-path testing: yes.
- Health endpoint testing: yes.
- ERP workflow testing: no.
- Alpha testing with business users: no.
- Controlled customer demo: only as a non-operational architecture demo.

## 13. Gap Analysis

Critical:
- Implement at least one complete ERP workflow end to end.
- Add tenant isolation tests and relation-level tenant validation.
- Add service-layer business invariants for document lifecycle and posting.
- Fix test strategy; remove false confidence from `--passWithNoTests`.
- Decide secure token storage/session strategy.
- Make mobile navigation usable or exclude mobile from V1.

High:
- Implement CRUD and list pages for core master data: customers/vendors/items/chart of accounts.
- Add sales order and purchase order create/edit/release flows.
- Add inventory movement logic and stock availability calculation.
- Add GL journal header/lines with balanced posting.
- Add audit logging for all mutations.
- Add migration/deploy runbook with staging and rollback.
- Lock down Swagger or make it environment-gated.
- Implement logout/revoke and refresh-token expiry alignment.
- Add CI integration tests with Postgres/Redis.

Medium:
- Add pagination/filtering/sorting conventions.
- Add empty/error/loading states and form patterns.
- Add queue failure visibility and dead-letter handling.
- Add missing indexes and cross-tenant relation constraints/guards.
- Add LGPD export/delete/retention tasks.
- Add PWA offline strategy or explicitly online-only mode.
- Add Sentry release/environment metadata.

Low:
- Improve shared UI package into real design system.
- Add command palette only after core nav exists.
- Code-split web bundle.
- Expand i18n coverage.
- Add theming/branding admin.

## 14. Complete Pending Task List

### Backend Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Domain service layer | Move Prisma calls from controllers into services with transactional boundaries and invariants. | finance, sales, purchases, inventory | High | 3-5 days | none | High |
| Critical | Sales order workflow | Create customer/item selection, order create/edit, totals, release/cancel rules. | sales, parties, inventory | High | 5-8 days | service layer, DTOs | High |
| Critical | Purchase order workflow | Create vendor PO, release, cancel, prepare receipt/invoice hooks. | purchases, parties, inventory | High | 5-8 days | service layer, DTOs | High |
| Critical | Journal posting foundation | Add journal batch/header/line model or equivalent, enforce balanced debit/credit transactions. | finance, database | High | 5-8 days | DB changes | High |
| High | Master data CRUD | Customers, vendors, items, chart of accounts CRUD with validation. | finance, sales, purchases, inventory | Medium | 4-6 days | service layer | Medium |
| High | Logout/session APIs | Revoke current/all refresh tokens, list sessions. | auth | Medium | 1-2 days | auth service | Medium |
| High | Audit logging service | Central mutation audit with actor, tenant, entity, before/after metadata. | common, all modules | Medium | 2-4 days | tenant context | High |
| Medium | Notification preferences | Enforce preferences before queueing email/push/in-app. | notifications | Medium | 1-2 days | user settings | Medium |
| Medium | Queue operations endpoints | Expose admin-safe queue stats/retry/failure visibility. | health, notifications | Medium | 2-3 days | RBAC | Medium |

### Frontend Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Usable module navigation | Replace disabled sidebar entries with real routes and mobile nav. | web shell | Medium | 2-3 days | route plan | High |
| Critical | Sales order UI | List/detail/create/edit/release sales orders with validation and API integration. | web sales | High | 5-8 days | backend sales | High |
| Critical | Purchase order UI | List/detail/create/edit/release purchase orders. | web purchases | High | 5-8 days | backend purchases | High |
| High | Master data UI | Customers, vendors, items, accounts list/form pages. | web ERP modules | Medium | 5-7 days | backend CRUD | Medium |
| High | Standard table/form system | Reusable table, form layout, field errors, confirm dialogs, toasts. | packages/ui, web | Medium | 3-5 days | design decisions | Medium |
| High | Auth UX hardening | Session expiry, logout feedback, refresh failure routing, no raw JSON session panel. | web auth | Low | 1-2 days | auth APIs | Medium |
| Medium | Loading/empty/error states | Add skeletons and recoverable errors for all data views. | web | Medium | 2-3 days | page implementations | Medium |
| Medium | Accessibility pass | Keyboard nav, focus management, landmarks, contrast, labels. | web | Medium | 2-4 days | UI system | Medium |

### Mobile Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Decide V1 mobile scope | Either exclude mobile from V1 or build minimum mobile navigation and smoke tests. | mobile, web | Low | 0.5 day | product decision | High |
| High | Add native projects | Generate and verify Android/iOS projects if mobile is in scope. | apps/mobile | Medium | 1-2 days | scope decision | Medium |
| High | Mobile auth/storage review | Avoid insecure assumptions; validate token storage and refresh on mobile. | mobile, web auth | Medium | 2-3 days | auth strategy | High |
| Medium | Push registration flow | Implement native push registration and tenant/user preference linkage. | mobile, notifications | Medium | 3-5 days | backend prefs | Medium |

### Database Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Cross-tenant relation validation | Ensure connected records belong to same tenant in all writes. | all tenant models | High | 3-5 days | service layer | High |
| Critical | Financial posting schema | Add journal documents, fiscal periods, balanced constraints/workflow. | finance | High | 5-10 days | finance design | High |
| High | Warehousing schema | Add warehouse/location, item availability, movement sources. | inventory | High | 4-7 days | inventory design | High |
| High | Receivables/payables schema | Add invoices, due dates, settlement/payment models. | finance, sales, purchases | High | 5-10 days | posting schema | High |
| Medium | Index review | Add indexes for operational filters and queues/outbox. | database | Medium | 1-2 days | query plan | Medium |
| Medium | Soft-delete policy | Standardize deletedAt filtering and uniqueness behavior. | database, services | Medium | 2-4 days | service layer | Medium |
| Low | Prisma format | Run `prisma format` and commit normalized schema. | prisma | Low | 0.5 day | none | Low |

### DevOps Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Staging environment | Create staging API, worker, DB, Redis, and web preview envs. | infra | Medium | 2-4 days | secrets | High |
| Critical | Migration release job | Run `prisma migrate deploy` in a controlled pre-deploy/release step. | API deploy | Medium | 1-2 days | staging | High |
| High | Railway deployment automation | Replace placeholder job with actual API/worker deployment or documented Git integration. | Railway | Medium | 2-4 days | Railway service config | High |
| High | Rollback/backups | Define DB backup, app rollback, migration recovery procedure. | infra, DB | High | 2-5 days | deploy flow | High |
| Medium | Observability | Add uptime checks, Sentry release tags, logs, queue alerts. | API, web, worker | Medium | 2-4 days | staging | Medium |
| Medium | CI test services | Add Postgres/Redis services and integration tests in GitHub Actions. | CI | Medium | 2-4 days | tests | Medium |

### Security Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | Token storage strategy | Move refresh token out of localStorage or explicitly accept risk for internal-only V1. | web, auth | High | 2-5 days | product/security decision | High |
| Critical | Tenant isolation tests | Prove users cannot read/write data across tenants, including relation connects. | API tests | High | 3-5 days | test harness | High |
| High | Swagger gate | Disable or protect Swagger in production. | API | Low | 0.5 day | env policy | Medium |
| High | Account abuse controls | Log failed login, add rate limits per identity/IP, optional lockout. | auth | Medium | 2-3 days | auth service | Medium |
| High | Session revoke | Implement logout/revoke-all and token expiry consistency. | auth | Medium | 1-2 days | auth service | Medium |
| Medium | Secrets and generated metadata review | Decide whether `.vercel/project.json` and local deploy metadata belong in repo. | repo, DevOps | Low | 0.5 day | team policy | Low |

### ERP Functional Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | V1 scenario definition | Pick one narrow operational scenario for testing, e.g. customer -> sales order -> release -> inventory check. | product | Medium | 1 day | stakeholders | High |
| Critical | Document lifecycle rules | Define draft/open/released/posted/cancelled transitions for sales and purchases. | sales, purchases | Medium | 2-3 days | scenario | High |
| High | Number series | Generate tenant-scoped document numbers safely. | sales, purchases, finance | Medium | 2-3 days | DB change | Medium |
| High | Basic financial report | Trial balance or GL summary from posted entries. | finance | Medium | 3-5 days | posting | High |
| Medium | Approval MVP | Define one approval workflow path or defer from V1. | workflow | Medium | 2-4 days | product decision | Medium |

### UX Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | ERP workspace IA | Define V1 navigation, role center, list/detail patterns. | web | Medium | 1-2 days | V1 scenario | High |
| High | Enterprise density pass | Replace placeholder cards with operational tables and task-oriented layouts. | web | Medium | 3-5 days | UI system | Medium |
| High | Feedback system | Toasts, inline errors, validation summaries, empty states. | web, ui | Medium | 2-3 days | UI system | Medium |
| Medium | Responsive validation | Verify desktop/tablet/mobile layouts for all V1 pages. | web, mobile | Medium | 2-3 days | V1 pages | Medium |

### Testing Tasks

| Priority | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk |
|---|---|---|---|---|---|---|---|
| Critical | API integration harness | Nest test module with Postgres/Redis test env and seeded tenants. | API | High | 3-5 days | CI services | High |
| Critical | Tenant leak test suite | Cross-tenant read/write/connect tests for every tenant model. | API | High | 3-5 days | harness | High |
| High | Auth/RBAC tests | Login, refresh rotation, revoked token, permissions, membership. | auth, RBAC | Medium | 2-3 days | harness | High |
| High | E2E V1 workflow tests | Browser/API tests for chosen V1 scenario. | web, API | High | 4-7 days | V1 workflow | High |
| Medium | Accessibility smoke tests | Add axe/playwright checks for key pages. | web | Medium | 1-2 days | pages | Medium |
| Medium | Queue tests | Email job success/failure/retry behavior. | worker, notifications | Medium | 2-3 days | Redis test env | Medium |

## 15. MVP Readiness Scores

| Area | Score |
|---|---:|
| Architecture | 58 |
| Backend maturity | 32 |
| Frontend maturity | 24 |
| Mobile readiness | 12 |
| ERP readiness | 14 |
| Security readiness | 46 |
| Multi-tenant readiness | 38 |
| Production readiness | 22 |
| Testing readiness | 18 |
| UX maturity | 20 |
| DevOps maturity | 42 |

Overall readiness score: 30/100.

Estimated completion percentage toward first usable internal ERP testing release: 25-30%.

## 16. Recommended Next Sprints

Sprint 0 - Hardening and scope lock:
- Define the exact V1 testing scenario.
- Decide whether mobile is excluded from V1.
- Fix Prisma formatting.
- Add staging env plan.
- Add test harness with Postgres/Redis.
- Add tenant isolation tests for existing read endpoints.

Sprint 1 - Core foundations:
- Add service layer and DTO pattern.
- Add master data CRUD for customers/vendors/items/chart of accounts.
- Add web routes, tables, forms, error/loading states.
- Add logout/session revocation.
- Gate Swagger by environment.

Sprint 2 - First workflow:
- Implement sales order create/edit/release.
- Add number series.
- Validate tenant ownership of all connected records.
- Build sales order list/detail UI.
- Add E2E happy-path and permission tests.

Sprint 3 - Operational ERP validation:
- Implement purchase order create/release and basic receipt or inventory movement.
- Implement GL journal posting foundation.
- Add audit logs for all mutations.
- Add queue observability and notification preferences.

Sprint 4 - Testing release:
- Deploy staging web/API/worker.
- Run migrations through release process.
- Run smoke, integration, E2E, and tenant isolation tests.
- Prepare V1 test script and known limitations.

## 17. MVP Release Recommendation

First testing version should include:
- Auth login/refresh/logout.
- One tenant-scoped demo company.
- Customers/vendors/items/chart of accounts CRUD.
- Sales order list/detail/create/edit/release.
- Purchase order list/detail/create/edit/release, or explicitly defer purchases if sales is the first validation flow.
- Basic inventory item availability and ledger movement for the chosen flow.
- Basic GL journal posting or clearly marked finance read-only mode; do not pretend finance is operational if posting is missing.
- Audit log for all changes in the V1 flow.
- Admin-readable health/status page.
- Web-only release unless mobile navigation is implemented and verified.

Do not include in V1:
- Production multi-customer beta.
- App Store/TestFlight scope unless mobile work is prioritized.
- Full invoicing/tax/banking unless finance scope is expanded.
- Broad ERP module claims unsupported by workflows.

## 18. Production Risks

Dangerous today:
- Tenant isolation is not proven and can be bypassed by missing context.
- Relation-level tenant leakage is possible without service validation.
- Financial data can be inconsistent because posting rules do not exist.
- Refresh tokens in localStorage increase XSS blast radius.
- No real tests protect auth/RBAC/tenant/ERP behavior.
- Deployment and migration rollback are not production-grade.
- Swagger is always exposed.
- ERP UI is not operational.

## 19. Final Verdict

First internal technical testing: close. You can test login, health, seed data, read-only module endpoints, build/deploy wiring, and basic shell behavior now.

First internal ERP workflow testing: not close enough yet. Estimate 3-5 focused sprints depending on team size and whether scope is limited to one workflow.

Controlled customer demo: possible only as an architecture/product preview, not as a working ERP demo. A real customer-facing controlled demo needs at least one complete workflow, tenant tests, and stable staging.

Production beta: far. Estimate 8-12+ focused sprints after V1 testing, mainly because finance integrity, tenant isolation, auditability, deployment safety, and QA coverage are not mature yet.

Bottom line: the project has a solid skeleton and sensible technology choices. It is not blocked by architecture choice; it is blocked by missing ERP workflows, missing tests, and unproven tenant/security controls.
