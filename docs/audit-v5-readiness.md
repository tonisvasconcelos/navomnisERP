# Navomnis ERP Audit V5 - V1 Testing Readiness

Date: 2026-05-15

Scope: full technical, functional, product, ERP, multi-tenant, database, frontend, mobile, DevOps, security, and testing audit for the first controlled internal V1 testing release.

This V5 audit is based on a fresh scan of the repository, including the new V5-era additions:

- `.github/workflows/security.yml`
- critical-only `pnpm audit` gate in `.github/workflows/ci.yml`
- `docs/security-ci.md`
- `docs/staging-reset.md`
- `docs/ci-verification-log.md`
- `apps/api/test/seed-smoke.integration-spec.ts`
- expanded sales negative/RBAC tests for cross-tenant line update/delete and non-draft update rejection

## 1. Executive Summary

V5 is a modest but important hardening release over V4. The core product surface is still the same V1 slice: authentication, RBAC, tenant-scoped sales orders, basic inventory ledger, audit logs, and a web UI for the happy path. What changed in V5 is mostly release discipline and test confidence.

Strong V5 improvements:

- CI now includes `pnpm audit --audit-level=critical`.
- A separate GitHub Actions security workflow runs Gitleaks.
- Seed smoke integration test now verifies that the demo tenant, admin user, company, `UserCompany`, item, number series, and key permissions exist after seed.
- Sales negative tests now cover foreign-tenant PATCH/DELETE line ids and PATCH on non-draft orders.
- Staging reset, seed, worker decision, and rollback drill runbooks now exist.
- CI verification logging is documented in `docs/ci-verification-log.md`.

Main unresolved issue:

- The operational proof is still not present in the repository. `docs/ci-verification-log.md` is a template with no green run recorded.

Local validation status:

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- Prisma validate passed.
- Prisma format check passed.
- `pnpm build` passed.
- `pnpm audit --audit-level=critical` passed, but full `pnpm audit` reports 25 vulnerabilities: 4 low, 8 moderate, 13 high.
- Local Docker is unavailable.
- Local Postgres and Redis are not listening.
- Full integration/E2E could not be run locally.

Verdict: V5 is closer to a first controlled internal V1 testing release than V4, but it remains a conditional go. The condition is a recorded green CI `integration` run or equivalent staging proof.

## 2. Technical Summary

The architecture remains coherent:

- pnpm workspace monorepo
- Turborepo
- NestJS API
- Prisma/PostgreSQL
- Redis/BullMQ
- React/Vite web app
- Capacitor mobile wrapper
- shared packages for config, i18n, and UI
- Docker Compose for local database services
- GitHub Actions for quality, integration, and security
- Vercel and Railway deployment preparation

The project is now moving from "prototype architecture" to "controlled test release candidate", but it is not production-ready. The codebase has a viable vertical slice for internal sales/inventory validation; it does not yet have mature finance, purchasing, warehouse, billing, mobile, or operational production controls.

## 3. Repository Analysis

### Monorepo

Observed workspaces:

- `apps/api`
- `apps/web`
- `apps/mobile`
- `packages/config`
- `packages/i18n`
- `packages/ui`

Root scripts:

- `build`: `turbo build`
- `dev`: `turbo dev`
- `lint`: `turbo lint`
- `typecheck`: API and web typecheck through Turbo
- formatting scripts

The repo is still entirely untracked from Git's perspective in this workspace (`??` for all folders/files), so commit history cannot be used to verify evolution or ownership. Audit conclusions are based on file contents only.

### Turborepo

`turbo.json` is simple and functional:

- build depends on upstream builds
- dev is persistent and uncached
- typecheck has no outputs
- test depends on upstream builds

Gaps:

- no explicit integration test task
- no remote cache config
- no affected-only strategy
- no deploy-specific pipeline tasks

### Shared Packages

The shared package structure is present, but still light. The frontend and API do not yet share generated contracts or DTO types, which leaves API/client drift possible.

## 4. Backend Audit

### Backend Structure

The API contains well-separated modules:

- auth
- tenant
- rbac
- audit
- health
- finance
- sales
- parties
- purchases
- inventory
- lgpd
- notifications
- queues
- prisma

This structure is appropriate for an ERP SaaS base. The maturity varies heavily by module.

### API Consistency

Strengths:

- global validation pipe with whitelist and transform
- global HTTP exception filter
- response envelope interceptor
- API versioning under `/api/v1`
- Helmet enabled
- CORS restricted in production from `WEB_URL`
- Swagger disabled in production unless explicitly enabled
- Pino logging with auth/cookie redaction
- global throttling

Risks:

- throttling is coarse and not login-specific
- Swagger can still be exposed in production with one env flag and no auth guard
- CSRF package is installed but not wired, which is fine for bearer-token mode but relevant if cookies replace refresh token storage
- no API contract generation for the frontend

### Authentication

Implemented:

- login
- tenant slug resolution
- JWT access token
- refresh token rotation
- refresh token hashing with Argon2
- logout revokes active refresh tokens
- production registration disabled
- wrong password for existing users creates `AccessLog`

Gaps:

- refresh token is still stored in web localStorage
- no MFA workflow
- no password reset
- no account lockout
- no session/device management UI
- nonexistent-email login attempts intentionally do not log, reducing enumeration but limiting threat analytics

Internal V1 readiness: acceptable for trusted testers.

Production readiness: insufficient.

### RBAC

Implemented:

- `RequirePermissions`
- `PermissionsGuard`
- seeded permissions
- sales read/write gates
- inventory/master data gates
- finance/purchases read gates
- audit read gate
- negative integration tests for sales write and audit read

Gaps:

- no role management UI
- permissions are broad
- no document-state-level permissions
- no company authorization policy abstraction, although sales now enforces `UserCompany`

### Sales

Implemented:

- list orders
- get order detail
- create draft order
- add line
- edit line
- remove line
- release order
- tenant-scoped number series through `DocumentNumberSeries`
- customer/company/item tenant validation
- `UserCompany` enforcement on create and release
- stock check inside the release transaction
- `SALES_RELEASE` ledger entries
- audit logging for mutations

V5 test improvements:

- insufficient stock
- double release
- remove after release
- create without `sales.write`
- audit without `audit.read`
- create for company without `UserCompany`
- failed password access log
- PATCH foreign-tenant line id
- DELETE foreign-tenant line id
- PATCH line on non-draft order

Remaining risks:

- no stock reservation
- no pessimistic locking or materialized stock balance
- no shipment, invoice, tax, AR, or GL posting
- `OPEN` is an internal release state only
- no sales quote workflow

Sales verdict: testable for V1 workflow validation. Not a complete ERP sales module.

### Inventory

Implemented:

- item list
- item creation
- ledger list
- balance endpoint derived from ledger groupBy
- seed stock
- sales release ledger movement

Gaps:

- no warehouse
- no bins
- no lots/serials
- no reservations
- no transfers
- no adjustments/counting
- no valuation/costing

Inventory verdict: adequate only for sales release validation.

### Finance

Implemented:

- chart of accounts read endpoint
- simple summary endpoint
- Prisma models for chart of accounts and GL entries

Missing:

- journal batches
- balanced posting enforcement
- posting periods
- AR/AP
- banking
- financial reports
- sales-to-GL integration
- purchases-to-GL integration

Finance verdict: not operational.

### Purchases

Implemented:

- purchase order model
- purchase order list endpoint
- seed purchase order

Missing:

- purchase order create/edit/release
- goods receipt
- purchase invoice
- vendor ledger
- inventory receipt ledger integration
- AP posting

Purchases verdict: read-only seed surface, not a testable workflow.

### Notifications And Queues

Implemented:

- BullMQ notifications queue
- worker entry point
- Resend send path
- retries with exponential backoff
- queue health endpoint

Risks:

- worker deployment not proven
- job payload does not carry tenantId as a first-class isolation field
- delivery update is by notification id, not tenant-scoped in worker
- failed job retention has no cleanup/dead-letter policy
- email templates model exists but is not a mature template system

## 5. Multi-Tenant Audit

Implemented tenant controls:

- JWT payload includes tenant id
- `TenantAccessGuard` verifies `UserTenant`
- AsyncLocalStorage tenant context
- Prisma middleware injects tenant filters into many tenant-scoped models
- service-level tenant validation for sales customer/company/item
- `UserCompany` enforcement for sales create/release
- audit log listing is tenant-scoped
- integration tests cover tenant list isolation and foreign item rejection
- V5 adds foreign sales line PATCH/DELETE protection tests

Remaining leakage/scaling risks:

- Prisma middleware is helpful but cannot replace explicit domain invariants
- relation connects require manual validation
- database does not enforce same-tenant relationship constraints across sales order/company/customer/item
- optional-tenant tables like `AuditLog` and `OutboxEvent` require strict policy before expansion
- background jobs still lack explicit tenant context
- future Redis caching must key by tenant

Multi-tenant verdict: strong for the current V1 sales path, still not enterprise-hardened.

## 6. Database Audit

### Schema Strengths

The schema is broad and ERP-shaped:

- tenants
- users
- companies
- roles/permissions
- parties
- items
- chart of accounts
- GL entries
- sales and purchase documents
- inventory ledger
- approvals
- notifications
- audit/access logs
- LGPD consent
- attachments
- outbox
- document number series

Useful constraints/indexes:

- unique tenant/order number
- unique tenant/item sku
- unique tenant/chart account code
- unique tenant/document series code
- index sales by tenant/status
- index item ledger by tenant/item/postingDate
- index audit logs by tenant/createdAt

V5 confidence improvement:

- seed smoke test now asserts required demo fixtures and permissions after seed.

### Database Risks

- no same-tenant FK/composite constraint strategy
- no balanced GL posting enforcement
- no immutable accounting journal model
- no materialized inventory balance table
- no stock locking/reservation model
- missing operational indexes for sales by customer/company/date
- missing purchase operational indexes
- missing notification user/read indexes
- outbox index is only `publishedAt`, not tenant/type/publish state
- soft delete is inconsistent

Database verdict: good prototype foundation, not mature ERP database control.

## 7. Frontend UX Audit

### Current Web Surface

Routes:

- `/login`
- `/`
- `/sales`
- `/sales/:id`
- `/inventory`
- `/audit`

Implemented UX:

- login with tenant slug
- protected app shell
- dashboard
- sales order list
- company/customer selectors
- sales detail with item selector
- add/edit/remove line
- release modal
- inventory ledger and balances
- audit log table
- logout

Strengths:

- the V1 flow is usable
- React Query is used consistently
- API errors are shown in sales screens
- empty/loading states exist on primary tables
- release confirmation is a proper modal
- Playwright covers the primary sales path

Gaps:

- no role-aware navigation
- finance and purchases are not operational
- no master data UI beyond limited selectors
- no ERP-style document command bar/timeline
- no broad accessibility test pass
- no offline workflow despite PWA setup
- main web bundle is large: build warning at 620.01 kB minified
- mobile build replay shows a 518.08 kB bundle warning

UX verdict: enough for internal V1 sales testing, still thin for enterprise ERP users.

## 8. Mobile Audit

Implemented:

- Capacitor config
- app id/name
- webDir points to web dist
- push notification plugin configuration
- build script runs web build and `cap copy`

Missing:

- native Android/iOS project verification
- simulator/device testing
- secure mobile token storage
- mobile-specific UX QA
- offline support
- push registration backend flow
- store packaging

Mobile verdict: wrapper readiness only. Not ready for mobile testing beyond smoke checks.

## 9. DevOps Audit

### CI

`quality` job:

- install
- critical-only dependency audit
- lint
- typecheck
- Prisma validate
- Prisma format check
- build

`integration` job:

- Postgres 16 service
- Redis 7 service
- migrate deploy
- seed
- API integration tests
- API build/start
- web build with CI API URL
- Playwright Chromium
- failure artifacts

`security` workflow:

- Gitleaks secret scan on push/PR to `main` and `develop`

V5 DevOps improvement:

- CI and security posture are materially better than V4.
- `docs/ci-verification-log.md` gives the team a place to record green release-gate proof.

Critical gap:

- verification log has no green run recorded.

### Deployment

Prepared:

- Dockerfile for API/worker image
- Docker Compose for local Postgres/Redis
- Vercel config for SPA
- Railway docs
- staging docs
- staging reset/rollback runbook

Not proven:

- Railway API service deployment
- Railway worker service deployment
- staging DB reset execution
- rollback drill
- production deploy workflow
- migration rollback/restore

DevOps verdict: close to internal release discipline, not production operations.

## 10. Security Audit

Strengths:

- Argon2 password hashes
- refresh token hashing and rotation
- logout revokes refresh tokens
- Helmet
- production CORS restriction
- production JWT secret length validation
- Swagger off by default in production
- Pino redaction
- global throttling
- Gitleaks workflow
- critical-only dependency audit in CI
- failed password logging for existing users

Findings:

- full `pnpm audit` reports 25 vulnerabilities: 13 high, 8 moderate, 4 low
- high findings include Playwright, glob, tar via Capacitor CLI, multer via Nest platform-express, and others
- CI only fails on critical vulnerabilities, so high vulnerabilities currently pass
- refresh and access tokens remain in localStorage
- no MFA
- no password reset
- no account lockout
- no dependency update policy
- no local Gitleaks proof in this audit

Security verdict: improved since V4, still acceptable only for controlled internal testing.

## 11. Testing Readiness

### Automated Coverage Now Present

API integration tests:

- happy sales V1 path
- line update
- release writes ledger
- audit assertions
- logout invalidates refresh
- insufficient stock
- double release
- remove after release
- sales write RBAC denial
- audit read RBAC denial
- user-company denial
- failed password log
- tenant isolation
- cross-tenant item rejection
- cross-tenant line PATCH denial
- cross-tenant line DELETE denial
- non-draft line PATCH denial
- seed smoke fixtures

Web E2E:

- login
- create order
- add line
- edit line
- release modal
- status `OPEN`
- audit page
- inventory ledger `SALES_RELEASE`

### Local Verification Performed In V5

Passed:

- `pnpm audit --audit-level=critical`
- `pnpm lint`
- `pnpm typecheck`
- Prisma validate
- Prisma format check
- `pnpm build`
- `pnpm --filter @navomnis/api test` passed because there are no unit tests

Failed/not runnable:

- full `pnpm audit` exits nonzero due non-critical vulnerabilities
- Docker command is unavailable
- Postgres on `127.0.0.1:5432` is unavailable
- Redis on `127.0.0.1:6379` is unavailable
- API integration/E2E not run locally because required services are unavailable

Testing verdict: automated test design is now strong for V1. Operational proof is still external to this workspace and must be recorded.

## 12. ERP Functional Maturity

| Domain | Maturity | V1 status |
|---|---:|---|
| Authentication | Medium | Usable internally |
| Refresh/session handling | Medium-low | Works, risky storage |
| RBAC | Medium | Usable for V1 |
| Tenant isolation | Medium-high | Stronger in V5 |
| Sales orders | Medium | V1-testable |
| Sales quotes | None | Not ready |
| Invoicing | None | Not ready |
| Pricing | Low | Manual line price only |
| Customers | Low-medium | Basic list/create API |
| Inventory items | Low-medium | Basic item/ledger/balance |
| Warehousing | None | Not ready |
| Purchasing | Low | Read-only seed surface |
| Goods receipt | None | Not ready |
| Purchase invoices | None | Not ready |
| General ledger | Low | Schema/read only |
| Receivables | None | Not ready |
| Payables | None | Not ready |
| Banking | None | Not ready |
| Financial reports | Very low | Not ready |
| Notifications/email | Low-medium | Queue exists, not proven |
| LGPD | Low-medium | Consent records only |
| Audit logs | Medium | Useful for V1 |

ERP verdict: still a sales/inventory validation slice, not an ERP MVP in the full business sense.

## 13. Gap Analysis

### Critical

Blocks or conditions internal V1 testing.

1. Record a green CI `integration` run.
   - `docs/ci-verification-log.md` exists but is empty.
   - This remains the release decision point.

2. Stand up and verify staging.
   - API, web, Postgres, Redis, migrations, seed, and V1 script must be proven.

3. Execute staging reset runbook once.
   - The runbook exists but has not been proven in this audit.

4. Decide whether localStorage token risk is accepted for this internal release.
   - The risk is documented, but it must be explicit in release notes.

### High

Major testing or enterprise confidence issues.

1. Resolve or formally accept high dependency vulnerabilities.
   - Full audit reports 13 high vulnerabilities.

2. Add stock concurrency control or freeze low-concurrency testing assumptions.
   - Transactional ledger check is not a production inventory lock.

3. Prove rollback/restore drill.
   - Runbook exists, execution proof does not.

4. Prove worker deployment or explicitly keep worker out of V1.
   - Staging docs recommend a decision, but no deployment proof exists.

5. Add role-aware frontend navigation.
   - Permissions exist on API but frontend does not adapt to them.

6. Split the web bundle.
   - Current Vite build warns at 620.01 kB.

### Medium

Should be addressed before broader internal or customer demos.

1. Password reset/invite flow.
2. MFA or documented deferral.
3. Master data screens.
4. Sales document timeline and action bar.
5. Audit filtering/search.
6. API generated client or shared DTO contracts.
7. More operational DB indexes.
8. Tenant-safe queue payloads.
9. Accessibility smoke tests.
10. Mobile secure storage and device smoke tests.

### Low

Polish/future.

1. richer empty states
2. dashboard KPIs from real data
3. exports
4. PWA offline fallback
5. email template editor/renderer
6. design-system consolidation

## 14. Complete Pending Task List

| Area | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk | Priority |
|---|---|---|---|---|---:|---|---|---|
| DevOps | Record green integration run | Fill `docs/ci-verification-log.md` with branch, commit, status, and run URL after green CI. | CI, docs | Low | 0.5 day | GitHub Actions run | Critical | P0 |
| DevOps | Verify staging deploy | Deploy API/web/Postgres/Redis and run V1 script. | Railway, Vercel, DB | High | 2-4 days | CI green | Critical | P0 |
| DevOps | Execute staging reset | Run `staging-reset.md` once and record outcome. | DB, staging | Medium | 1 day | staging | Critical | P0 |
| Security | Triage high audit findings | Upgrade or document Playwright, glob, tar, multer, file-type, and related audit findings. | dependencies | Medium | 1-3 days | package compatibility | High | P1 |
| Security | Token storage decision | Keep localStorage only for internal release or move refresh to HttpOnly cookie. | web, API auth | High | 2-5 days | product/security decision | High | P1 |
| Backend | Inventory concurrency | Add reservation/materialized balance/locking model or strict test assumption. | sales, inventory, DB | High | 4-8 days | domain design | High | P1 |
| Backend | Tenant-safe queue jobs | Add tenantId/userId to job payloads and tenant-scope worker writes. | notifications, queues | Medium | 1-2 days | queue policy | Medium | P1 |
| Backend | Company policy abstraction | Reuse `UserCompany` checks across future modules. | auth, sales, purchases | Medium | 2-4 days | authorization design | Medium | P1 |
| Backend | Login security policy | Add account lockout or login-specific throttling. | auth | Medium | 2-3 days | security policy | High | P1 |
| Backend | Password reset/invites | Add internal user provisioning and reset workflow. | auth, notifications | High | 4-7 days | email/worker decision | Medium | P2 |
| Database | Operational indexes | Add sales company/customer/date, purchase vendor/date, notification user/read, outbox tenant/status indexes. | Prisma | Medium | 1-2 days | query review | Medium | P1 |
| Database | Same-tenant relation strategy | Add composite keys/tests or service invariant helpers. | Prisma, services | High | 3-6 days | schema policy | High | P1 |
| Database | GL integrity model | Add journal batches and balanced posting guarantees. | finance | High | 5-10 days | finance roadmap | High | P3 |
| Frontend | Role-aware nav | Hide/disable routes based on user permissions. | web shell | Medium | 2-3 days | `/auth/me` permissions | Medium | P2 |
| Frontend | Route code splitting | Lazy-load routes/manual chunks to reduce 620 kB bundle. | web build | Low-medium | 1-2 days | none | Medium | P2 |
| Frontend | Master data UI | Customer/item/company management for testers. | web, API | Medium | 4-6 days | endpoints | Medium | P2 |
| Frontend | Sales document UX | Add action bar, timeline, totals panel, clearer validation. | sales UI | Medium | 3-5 days | sales API stable | Medium | P2 |
| UX | Accessibility smoke | Add keyboard/focus/table/modal checks. | web | Medium | 2-3 days | stable screens | Medium | P2 |
| Testing | Run V1 manual script | Execute `v1-internal-test-script.md` in staging and log defects. | QA, product | Low | 1 day | staging | High | P0 |
| Testing | Staging Playwright | Run Playwright against staging API/web. | web E2E | Medium | 1-2 days | staging | High | P1 |
| Testing | Add coverage reporting | Publish Jest/coverage and Playwright artifacts. | CI | Medium | 1-2 days | tests stable | Medium | P2 |
| Mobile | Device smoke | Run Capacitor app in simulator/device. | mobile | Medium | 1-3 days | web build | Medium | P2 |
| Mobile | Secure token storage | Use native secure storage for mobile auth. | mobile, auth | Medium | 2-4 days | auth storage decision | High | P2 |
| ERP | Freeze V1 release notes | Explicitly state no invoice/GL/purchases/mobile production. | product docs | Low | 0.5 day | stakeholder signoff | High | P0 |
| ERP | Sales invoice roadmap | Define invoice, fiscal, AR, and GL contracts. | sales, finance | High | 5-10 days design | after V1 | High | P3 |
| ERP | Purchase receipt roadmap | Define PO receipt, stock receipt, vendor invoice. | purchases, inventory | High | 5-10 days design | after V1 | High | P3 |

## 15. MVP Readiness Scores

| Category | Score |
|---|---:|
| Architecture | 74 |
| Backend maturity | 69 |
| Frontend maturity | 62 |
| Mobile readiness | 24 |
| ERP readiness | 38 |
| Security readiness | 54 |
| Multi-tenant readiness | 66 |
| Production readiness | 34 |
| Testing readiness | 70 |
| UX maturity | 58 |
| DevOps maturity | 62 |

Overall readiness score for first controlled internal V1 testing: 63/100.

Estimated completion toward first usable internal testing version:

- 72% if CI `integration` is green and staging is available.
- 60% without recorded CI/staging proof.

Estimated completion toward production beta: 32-36%.

## 16. Recommended Next Sprints

### Sprint 1 - Prove The Release Gate

- Run CI on target branch.
- Fill `docs/ci-verification-log.md`.
- Deploy staging.
- Run migrations and seed.
- Execute the manual V1 script.
- Decide worker on/off for V1.
- Record reset outcome.

Exit: internal tester can repeat the V1 flow on staging.

### Sprint 2 - Security And Stability

- Triage 13 high audit findings.
- Decide localStorage token acceptance or migration.
- Run rollback drill.
- Add route splitting.
- Add staging Playwright run.
- Add login lockout/rate-limit policy.

Exit: V1 test environment is reliable enough for multiple trusted testers.

### Sprint 3 - Product Usability

- Add master data screens.
- Improve sales order document UX.
- Add role-aware navigation.
- Add audit filters.
- Add accessibility smoke tests.

Exit: testers can validate without developer assistance.

### Sprint 4 - Choose Next ERP Slice

Pick one:

- sales invoice plus AR/GL
- purchasing plus receipt
- inventory warehouse/reservations

Do not expand all ERP domains at once.

## 17. MVP Release Recommendation

Recommended V1 internal release contents:

- login/logout/refresh
- demo tenant/admin seed
- company/customer selection
- sales order draft
- add/edit/remove line
- release order to `OPEN`
- stock validation
- `SALES_RELEASE` ledger movement
- inventory ledger/balance
- audit log page
- known limits and reset runbook

Explicitly exclude:

- invoices
- GL posting
- AR/AP
- banking
- purchase operations
- warehouse/lot/serial
- production mobile
- public beta

## 18. Production Risks

Dangerous today beyond controlled internal testing:

- localStorage token persistence
- unresolved high dependency vulnerabilities
- no MFA/account lockout/password reset
- no production-grade stock concurrency
- no financial integrity
- no invoice/fiscal flow
- no proven staging rollback
- no proven worker deployment
- no same-tenant DB constraints
- no mobile secure storage
- no full observability/alerting proof

## 19. Final Verdict

V5 is better than V4 because it adds release discipline: security workflow, critical audit gate, seed smoke test, stronger negative tests, and staging reset/rollback documentation. Those are the right moves.

The project is now close to an internal V1 test release, but the release should not be declared ready until there is a recorded green CI `integration` run and a staging environment has passed the V1 script.

Distance estimates:

- first internal testing: 1-2 focused days after green CI and staging proof
- controlled customer demo: 2-4 weeks, scoped strictly to sales/inventory/audit
- production beta: 2-4 months, depending on security, finance, inventory concurrency, tenant hardening, and deployment automation

Recommendation: conditional go for internal V1 only after CI verification log is filled with a green integration run and staging reset has been exercised.

## 20. Gap closure implemented in repository (post-V5)

The following items from §13 gap analysis were **addressed in code or docs** in this pass (operational proof such as a real green CI row or staging drill execution still requires the team):

| Gap theme | Change |
|-----------|--------|
| Role-aware navigation (§7 / §13 High) | Web shell loads `GET /auth/me` and shows **Vendas** / **Estoque** / **Auditoria** only when the user has `sales.read`, `inventory.read`, or `audit.read`. |
| `/auth/me` permissions | API returns sorted `permissions` plus `displayName`; integration test in `apps/api/test/auth-me.integration-spec.ts`. |
| Web bundle size warning (§7 / §13 High) | Route-level **lazy loading** + `Suspense` in `apps/web/src/app/App.tsx`. |
| High Playwright advisory (§10) | `@playwright/test` bumped to **1.55.1** in `apps/web/package.json`. |
| Operational DB indexes (§6 / §13 Medium) | Prisma `@@index` on sales/purchase/notification/outbox + migration `20260515223000_operational_indexes`. |
| Tenant-safe email jobs (§4 / §13 Medium) | `EnqueueEmailPayload` includes `tenantId` and `userId`; worker verifies notification row before Resend/update. |
| Notification list tenant scope | `GET /notifications` filters by `tenantId` + `userId`. |
| Stakeholder / release scope (§13 Critical) | [v1-release-notes-internal.md](./v1-release-notes-internal.md) freezes V1 include/exclude and token/MFA decisions. |
| Rollback drill record (§13 High) | [staging-rollback-log.md](./staging-rollback-log.md) template linked from [staging-reset.md](./staging-reset.md). |
| CI verification reminder | [ci-verification-log.md](./ci-verification-log.md) links to internal release notes after first green run. |

**Still human / environment blocked:** recording a green `integration` run in `ci-verification-log.md`, deploying and exercising staging, triaging remaining **high** `pnpm audit` findings (beyond Playwright), worker deploy proof, login lockout policy, and full high-vuln upgrades.
