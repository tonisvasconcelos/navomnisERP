# Navomnis ERP Audit V4 - V1 Testing Readiness

Date: 2026-05-15

Scope: complete repository audit for first internal testing release readiness. This audit is based on direct inspection of the monorepo, API, web app, mobile shell, Prisma schema/migrations, CI, deployment docs, tests, and V1 release documentation.

## 1. Executive Summary

V4 is a meaningful step forward from V3. The repository now looks like it is being shaped around a controlled internal V1 release, not just an architectural prototype. The strongest improvements are:

- CI now has a dedicated integration job with Postgres, Redis, API integration tests, built API startup, built web app, and Playwright.
- Sales V1 now supports create draft, add line, edit line, remove line, release, stock ledger output, audit visibility, and negative/RBAC tests.
- Company-level authorization is now enforced for sales create/release through `UserCompany`.
- Sales release now performs stock validation and ledger writes inside the same Prisma transaction.
- The web client removed the browser `window.confirm` release flow and uses a real confirmation dialog.
- V1 scope and known limits are documented in `docs/v1-known-limits.md` and `docs/v1-internal-test-script.md`.

The system is close to a first internal testing release, but not fully proven yet. The most important blocker is operational proof: the full integration/E2E gate must be green in GitHub Actions or staging. Locally, Docker is unavailable, Postgres/Redis are not listening, and `pnpm run test:integration` timed out after 124 seconds, so the full gate could not be validated on this workstation.

V4 readiness for controlled internal V1 testing: conditional go after CI integration/E2E is green.

V4 readiness for customer demo: limited demo only, with explicit disclosure that finance, purchases, mobile, and production operations are incomplete.

V4 readiness for production beta: no.

## 2. Repository Analysis

### Monorepo And Build System

Observed structure:

- `apps/api`: NestJS API, Prisma, BullMQ, JWT, RBAC, tenant context.
- `apps/web`: React 18, Vite, Tailwind, React Query, Zustand, PWA, Playwright.
- `apps/mobile`: Capacitor wrapper over the web build.
- `packages/config`, `packages/i18n`, `packages/ui`: shared packages.
- `docs`: deployment, staging, CI, V1 scenario, known limits, audit history.
- `.github/workflows`: CI and deployment placeholders.

Repository file count from `rg --files`: 140 files.

Root tooling:

- `pnpm@10.19.0`
- `turbo@2.3.3`
- Node engine `>=20`
- root scripts for `build`, `dev`, `lint`, `typecheck`, formatting.

Turborepo is valid but basic. It defines build outputs and disables cache for dev. It does not yet include advanced affected-build strategy, remote cache, deployment-specific task boundaries, or integration-test orchestration at Turbo level.

### Package Dependencies

Backend dependencies are appropriate for the current architecture:

- NestJS 10
- Prisma 5.22
- BullMQ 5
- ioredis
- argon2
- helmet
- cookie-parser
- @nestjs/throttler
- nestjs-pino
- Sentry
- Resend

Frontend dependencies are appropriate:

- React 18
- Vite 6
- React Query 5
- Zustand 5
- React Hook Form
- Tailwind
- Framer Motion
- vite-plugin-pwa
- Playwright

Mobile dependencies are minimal:

- Capacitor 6
- Android/iOS platforms
- Preferences
- Push notifications

Dependency verdict: coherent for a modern SaaS monorepo. The mobile app is still a wrapper, not a mature mobile product.

### TypeScript Consistency

The repository typechecks. Shared packages are present and used. The API and web have separate typecheck scripts. There is still limited shared domain typing between API contracts and frontend DTOs, so API/client drift is possible.

## 3. Backend Technical Audit

### Module Structure

Observed API modules:

- `auth`
- `tenant`
- `rbac`
- `audit`
- `health`
- `finance`
- `sales`
- `parties`
- `purchases`
- `inventory`
- `lgpd`
- `notifications`
- `queues`
- `prisma`

This module structure is appropriate for an ERP SaaS base. The sales, inventory, auth, audit, and tenant paths have the most real implementation. Finance and purchases remain mostly read-oriented. Approval workflows, CRM, attachments, and outbox are modeled but not product-ready workflows.

### API Patterns

Strengths:

- Global `ValidationPipe` uses whitelist, transform, and forbidden unknown values.
- Global HTTP exception filter and response transform exist.
- Helmet is enabled.
- CORS is production-gated through `WEB_URL`.
- Swagger is disabled by default in production unless `SWAGGER_ENABLED=true`.
- Pino logging redacts authorization and cookie headers.
- Global throttling is enabled.

Risks:

- Rate limit is global and coarse, not login-specific or tenant-aware.
- Swagger production enablement is a manual env switch, not protected by auth.
- CSRF package is installed but not wired; this is acceptable while bearer tokens are used, but relevant if cookies are introduced.

### Authentication

Implemented:

- Login with tenant slug resolution.
- JWT access token and refresh token.
- Refresh token rotation with hashed stored token.
- Logout revokes all refresh tokens for current user.
- Public registration disabled in production.
- Argon2 for password hashing and token hash verification.
- Failed password attempts for existing users now create `AccessLog` rows with `success:false` and `reason:'invalid_password'`.

Remaining risks:

- Access and refresh tokens are persisted in web localStorage through Zustand persist.
- No MFA despite fields suggesting future support.
- No password reset workflow.
- No invite/provisioning flow.
- No account lockout or progressive login throttling.
- Nonexistent user login attempts intentionally do not create access logs to reduce enumeration risk; this is documented but means security analytics are incomplete.

Auth verdict: good enough for tightly controlled internal testing, not production-grade.

### RBAC

Implemented:

- `RequirePermissions` decorator.
- `PermissionsGuard`.
- Seeded permissions include sales, finance, purchases, inventory, master data, LGPD, and audit.
- Sales write endpoints require `sales.write`.
- Audit logs require `audit.read`.
- Negative RBAC tests exist for sales and audit.

Remaining risks:

- Permissions are still coarse.
- No role management UI.
- No field-level or document-state permissions.
- Company-level authorization is now enforced for sales create/release, but not yet generalized as a platform policy.

RBAC verdict: viable for V1 controlled testing, still immature for enterprise deployment.

### Sales Domain

Implemented V4 flow:

- List orders.
- Get order detail.
- Create draft order.
- Add line.
- Edit line.
- Remove line while draft.
- Release order.
- Generate tenant-scoped sales order numbers through `DocumentNumberSeries`.
- Validate customer/company/item tenant ownership.
- Enforce `UserCompany` on create and release.
- Validate stock before release.
- Write negative `SALES_RELEASE` item ledger entries.
- Audit create, line add/update/remove, and release actions.

Important V4 improvement: release now checks order state, line existence, user-company access, stock balance, ledger writes, and status update inside one `$transaction`.

Remaining risks:

- No stock reservation.
- No row-level pessimistic locking.
- No warehouse/bin/lot/serial dimensions.
- No invoice, shipment, tax, payment, or GL posting.
- `OPEN` is documented as "released for internal operation test", not an accounting state.
- Concurrency risk remains under simultaneous releases because balance is derived from ledger aggregation rather than a locked stock table.

Sales verdict: the strongest functional slice in the product. It is testable for internal workflow validation, not complete ERP sales.

### Inventory Domain

Implemented:

- Item list.
- Create item.
- Ledger list.
- Balance endpoint calculated from item ledger grouped by item.
- Seed stock entry.
- Sales release writes ledger movements.

Remaining risks:

- No item variants, UOM conversion, warehouse locations, bins, lots, serials, cost layers, reservations, adjustments, transfers, or physical counts.
- Balance is computed, not stored/locked.
- No inventory valuation.

Inventory verdict: adequate for V1 sales validation only.

### Finance Domain

Implemented:

- Chart of accounts read endpoint.
- Simple finance summary.
- Prisma models for chart of accounts and GL entries.

Missing:

- Journal posting workflow.
- Balanced debit/credit enforcement.
- Posting periods.
- Fiscal year close.
- AR/AP subledger.
- Bank reconciliation.
- Financial reports.
- Sales release to GL.
- Purchase invoice to GL.

Finance verdict: schema seed and read surface only. Not an operational finance module.

### Purchases Domain

Implemented:

- Purchase order model.
- Purchase order list endpoint.
- Seeded purchase order.

Missing:

- Vendor creation workflow beyond generic parties.
- Purchase order create/edit/release.
- Goods receipt.
- Purchase invoice.
- AP posting.
- Inventory receipt ledger integration.

Purchases verdict: not testable as a working ERP module yet.

### Notifications And Email

Implemented:

- In-app notification creation.
- Email queue enqueue with BullMQ.
- Worker process for Resend delivery.
- Retry attempts and exponential backoff.
- Queue health endpoint.

Risks:

- Worker production deployment is documented but not proven.
- Email templates are modeled but not really used as a mature template system.
- Job payload has no tenant context field; delivery updates are by notification id. This can work, but multi-tenant observability and worker safety would be stronger if every job carried tenantId and worker writes were explicitly tenant-scoped.
- `removeOnFail:false` can grow failed job retention without a cleanup policy.

Notifications verdict: technically plausible, not operationally mature.

## 4. Multi-Tenant Audit

### Tenant Enforcement

Implemented:

- JWT payload contains `tid`.
- `TenantAccessGuard` checks `UserTenant`.
- AsyncLocalStorage stores `tenantId` and `userId`.
- Prisma middleware injects tenant filters into tenant-scoped models.
- Sales service manually validates connected customer/company/item tenant ownership.
- Sales service now validates `UserCompany` for create and release.
- Tests cover list isolation and cross-tenant item rejection.

Tenant-scoped models include:

- `TenantBranding`
- `UserTenant`
- `Company`
- `Party`
- `Item`
- `Role`
- `Notification`
- `AuditLog`
- `SalesOrder`
- `PurchaseOrder`
- `ItemLedgerEntry`
- `ChartOfAccount`
- `GlEntry`
- `ApprovalWorkflow`
- `Opportunity`
- `OutboxEvent`
- `Attachment`
- `NotificationPreference`

### Leakage Risks

Reduced in V4:

- Company access for sales create/release is now checked.
- Document numbering is tenant-scoped.
- Audit log list is tenant-scoped and permission-protected.
- Negative RBAC/UserCompany tests exist.

Still risky:

- Prisma middleware is a safety net, not a complete proof of tenant isolation.
- Relation connects still require manual service validation.
- Some models with optional tenant fields (`AuditLog`, `OutboxEvent`) can intentionally be cross-tenant/global; they need documented access policy.
- Background jobs do not carry tenantId as a first-class safety field.
- Cache isolation is not a current issue because no app-level Redis cache was found, but future caching must include tenant keys by design.
- Database constraints do not enforce "same tenant" across relations such as sales order -> customer/company or sales line -> item.

Multi-tenant verdict: strong enough for a controlled single-demo-tenant or carefully seeded internal V1. Not yet enough to call the platform enterprise multi-tenant hardened.

## 5. Database Audit

### Schema Maturity

The Prisma schema is broad and ERP-shaped. It includes tenants, users, roles, permissions, companies, parties, items, chart of accounts, GL entries, sales, purchases, inventory ledger, approval workflows, CRM opportunities, notifications, LGPD consent, attachments, outbox, audit logs, access logs, and document number series.

V4 database improvements:

- Added `DocumentNumberSeries`.
- Migration `20260515210000_document_number_series` creates a tenant/code unique series.
- Seed backfills sales order number series per tenant.

Strengths:

- Consistent `tenantId` usage on major business tables.
- `createdAt`/`updatedAt` present on many core tables.
- Soft delete exists on Tenant, User, Company, Party, and Item.
- Useful unique constraints: tenant/number, tenant/sku, tenant/code.
- Useful indexes: sales status, item ledger item/posting date, audit createdAt, access log user/createdAt.

Risks:

- Financial integrity is not enforced at DB level.
- No balanced journal constraints.
- No immutable posting ledger pattern for GL.
- No same-tenant FK constraints across business relationships.
- Soft delete is inconsistent across all ERP tables.
- Missing indexes for common operational queries such as sales by customer/company/date, purchases by vendor/company/date, notifications by tenant/user/read state, outbox by tenant/published status/type.
- `AccessLog` index is by user/createdAt, not tenant or success/reason. That may limit security analytics.
- Inventory balance uses ledger aggregation; this can become slow and concurrency-sensitive without materialized balances or locking strategy.

Database verdict: solid prototype schema, not yet a mature ERP accounting database.

## 6. Frontend UX Audit

### Routing And State

Implemented routes:

- `/login`
- `/`
- `/sales`
- `/sales/:id`
- `/inventory`
- `/audit`

State/data:

- React Query for server data.
- Zustand persist for auth and shell UI.
- Axios client with automatic refresh.
- Tenant header from auth store.

V4 UX improvements:

- Sales order creation uses company/customer selectors from the API.
- Sales detail uses item selector from the API.
- Sales line edit exists.
- Release uses a real `ConfirmDialog`.
- Audit page exists.
- Inventory page shows ledger and balances.
- API errors are surfaced in sales screens.
- Playwright scenario now includes edit line, modal release, audit, and inventory ledger.

Remaining UX gaps:

- Finance and purchases navigation are disabled/read-only.
- No master data management screens beyond the minimal sales selectors and customer create endpoint.
- Accessibility is improved by the modal, but the app does not yet have a comprehensive a11y pass.
- Empty/loading/error states are present in core pages but still basic.
- No optimistic conflict handling.
- No form-level schema resolver in many screens.
- No workflow status timeline, posting preview, or ERP-style document action bar.
- Bundle size warning remains for web build (>500 kB main chunk).

Frontend verdict: usable for the V1 sales workflow test, still thin compared with Business Central or mature ERP SaaS UX.

## 7. Mobile Audit

Implemented:

- Capacitor config.
- App id and app name.
- Uses `../web/dist` as webDir.
- Android/iOS dependencies.
- Push notification plugin configured.
- Mobile build script builds web and runs `cap copy`.

Missing:

- Native project readiness proof.
- Device testing.
- Secure token storage through Capacitor Preferences or native secure storage.
- Mobile-specific navigation/layout QA.
- Offline-first behavior.
- Push registration workflow.
- App Store / Play Store packaging.

Mobile verdict: mobile shell only. Not ready for meaningful mobile testing except smoke-level wrapper validation.

## 8. Infrastructure And DevOps Audit

### Docker

Implemented:

- `docker-compose.yml` for local Postgres 16 and Redis 7.
- Root `Dockerfile` for API/worker image.
- Dockerfile builds API through Turbo.

Risks:

- Docker CLI is not available on this workstation, so local compose could not be validated.
- Dockerfile includes only API build, not a complete multi-service runtime plan.
- No container healthcheck in Dockerfile.

### CI/CD

Implemented:

- CI quality job: install, lint, typecheck, Prisma validate, Prisma format check, build.
- CI integration job: Postgres service, Redis service, migrate deploy, seed, API integration tests, API build/start, web build, Playwright Chromium test.
- Failure artifacts for API integration log and Playwright report.

Remaining risks:

- Need proof that the integration job is green on the target branch.
- CI does not publish coverage.
- CI does not test mobile native build.
- Deploy workflow contains real Vercel command but Railway remains placeholder/model.

### Deployment

Implemented docs:

- `docs/staging.md`
- `docs/railway.md`
- `docs/vercel.md`
- `docs/deploy-overview.md`
- `docs/ci-integration.md`

Risks:

- Railway deploy is documented but not automated end-to-end.
- Rollback procedure is not proven.
- Prisma migration rollback/restore plan is documented conceptually, not exercised.
- Worker deployment is not proven.
- Environment variables require manual setup.

DevOps verdict: CI is now close to a real V1 gate. Deployment is still preparation-level.

## 9. Security Audit

Strengths:

- Argon2 password hashing.
- Refresh token hashing and rotation.
- Refresh revoke on logout.
- Helmet enabled.
- CORS restricted in production.
- Swagger disabled in production by default.
- Production secret length validation.
- Global throttling.
- Pino redaction for auth/cookie headers.
- Public registration disabled in production.
- Access logs now include wrong-password attempts for existing users.

Blockers/risks:

- Refresh tokens are stored in localStorage.
- No MFA.
- No account lockout.
- No password reset.
- No device/session management UI.
- No security headers validation in CI.
- No dependency vulnerability scan.
- No secret scanning workflow.
- No object storage security model for attachments.
- OAuth secret encryption is only planned through `ENCRYPTION_KEY`, not implemented as a launched feature.

Security verdict: acceptable for a controlled internal test on trusted machines, not acceptable for production beta.

## 10. Testing Readiness

### Automated Tests

API integration tests now cover:

- V1 happy path: login, create order, add line, edit line, release, ledger, audit, refresh/logout behavior.
- Insufficient stock release returns 400.
- Double release returns 400.
- Remove line after release returns error.
- Sales write denied without `sales.write`.
- Audit denied without `audit.read`.
- Sales create denied without `UserCompany`.
- Failed password attempt logged.
- Tenant list isolation and cross-tenant item rejection.

Web E2E now covers:

- Login.
- New sales order.
- Add line.
- Edit line.
- Release through modal.
- Status becomes `OPEN`.
- Audit page visible.
- Inventory ledger contains `SALES_RELEASE`.

### Local Validation Results

Passed earlier during this V4 audit:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @navomnis/api exec prisma validate`
- `pnpm --filter @navomnis/api exec prisma format --check`
- `pnpm build`
- `pnpm --filter @navomnis/api test` passed with no unit tests found.

Not locally proven:

- `pnpm run test:integration` timed out after 124 seconds.
- `127.0.0.1:5432` was not accepting TCP connections.
- `127.0.0.1:6379` was not accepting TCP connections.
- `docker --version` failed because Docker is not installed/available in PATH.

Testing verdict: the repository now has the right V1 release gate, but this workstation could not prove it. A green GitHub Actions `integration` job or staging run is the release decision point.

## 11. ERP Functional Maturity

| Domain | Current maturity | V1 testing status |
|---|---:|---|
| Authentication | Medium | Usable for internal testing |
| RBAC | Medium | Usable for sales/audit permission checks |
| Tenant isolation | Medium-high for V1 slice | Conditionally usable |
| Sales quotes | None | Not ready |
| Sales orders | Medium | Usable for V1 workflow validation |
| Invoicing | None | Not ready |
| Pricing | Low | Static line price only |
| Customers | Low-medium | Basic list/create support |
| Inventory items | Low-medium | Basic item/ledger/balance |
| Warehousing | None | Not ready |
| Purchasing | Low | Read/seed only |
| Goods receipt | None | Not ready |
| Purchase invoices | None | Not ready |
| General ledger | Low | Schema/read only |
| Receivables | None | Not ready |
| Payables | None | Not ready |
| Banking | None | Not ready |
| Financial reports | Very low | Not ready |
| Notifications/email | Low-medium | Technically plausible, not proven |
| LGPD | Low-medium | Consent records only |
| Audit logs | Medium | Useful for V1 mutations |

ERP verdict: V4 is a sales/inventory/audit/auth validation release, not a full ERP MVP.

## 12. Gap Analysis

### Critical

Blocks internal V1 release unless resolved or explicitly accepted.

1. Prove CI integration/E2E green.
   - The repo contains the right gate, but local execution could not validate it.
   - Required proof: green `.github/workflows/ci.yml` `integration` job on target branch or equivalent staging run.

2. Establish staging environment with API, web, Postgres, Redis, and worker decision.
   - Internal testers need a stable URL and database lifecycle.
   - Current Railway deployment remains partially manual/placeholder.

3. Define V1 data reset and seed policy.
   - Sales/inventory testing depends on known stock quantities and demo users.
   - Without reset rules, test results will become non-repeatable quickly.

4. Accept or mitigate localStorage token risk for internal testing.
   - This is acceptable only for trusted internal V1 devices.
   - Wider testing requires safer refresh-token storage.

### High

Major issue for testing quality or enterprise confidence.

1. Add production-grade inventory concurrency strategy.
   - Current transactional ledger check reduces risk but does not eliminate simultaneous-release oversell.

2. Add complete negative tests for sales line update/remove cross-tenant and invalid document state.
   - Current tests cover many critical cases but can be expanded.

3. Add RBAC/role management UI or freeze roles explicitly for V1.
   - Internal admins cannot manage permissions from the product.

4. Add observability around release flow, worker, queue failures, and auth failures.
   - Sentry exists but dashboards/alerts are not proven.

5. Add staging rollback/restore runbook and test it once.
   - Prisma migrations are one-way operationally unless backups and restore are proven.

6. Improve bundle splitting.
   - Web build emits >500 kB chunk warning.

### Medium

Should be done before broader internal rollout or customer-facing demos.

1. Add password reset/invite flow.
2. Add MFA or explicitly remove from V1.
3. Add sales order timeline/history UI.
4. Add master data screens for customers, items, companies.
5. Add purchase create/receive basics if purchasing is part of demo.
6. Add GL posting preview or explicitly exclude finance from V1.
7. Add dependency/security scanning.
8. Add mobile secure storage and device smoke tests.
9. Add accessibility review on modal, navigation, forms, and tables.
10. Add API contract typing or generated client.

### Low

Polish/future improvements.

1. Improve empty states and skeletons.
2. Add advanced filters/search on list pages.
3. Add export/download actions.
4. Add dashboard KPI cards based on real V1 data.
5. Add visual refinements to ERP document pages.
6. Add PWA offline fallback page.
7. Add richer email templates.

## 13. Complete Pending Task List

| Area | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk | Priority |
|---|---|---|---|---|---:|---|---|---|
| DevOps | Prove CI integration gate | Run and verify CI `integration` job green with Postgres, Redis, API tests, API start, web build, Playwright. | CI, API, web | Medium | 0.5-1 day | GitHub Actions secrets not required for CI | Critical | P0 |
| DevOps | Create staging release | Deploy API, web, Postgres, Redis; apply migrations; seed internal data. | Railway, Vercel, DB | High | 2-4 days | CI green | Critical | P0 |
| DevOps | Define test reset workflow | Add documented command/runbook for resetting staging test data. | DB, seed, docs | Medium | 1-2 days | staging | High | P0 |
| Backend | Inventory concurrency hardening | Introduce stock balance table with transactional update/locking or reservation pattern. | sales, inventory, Prisma | High | 4-8 days | product decision | High | P1 |
| Backend | Expand negative sales tests | Add update/remove cross-tenant, invalid customer/company, invalid state transitions, no-stock race simulation. | sales tests | Medium | 2-3 days | DB harness | High | P1 |
| Backend | Generalize company authorization | Move `UserCompany` checks into reusable policy/service and apply to future modules. | sales, purchases, inventory | Medium | 2-4 days | company policy | High | P1 |
| Backend | Add document status transitions | Centralize allowed transitions for sales/purchase docs. | sales, purchases | Medium | 2-3 days | domain decisions | Medium | P1 |
| Backend | Add login lockout policy | Add progressive lockout or login-specific throttling and tests. | auth | Medium | 2-3 days | security policy | High | P1 |
| Backend | Add password reset/invite | Implement invite and reset flows with email tokens. | auth, notifications | High | 4-7 days | email worker proven | Medium | P2 |
| Backend | Tenant-safe queue payloads | Include tenantId/userId in jobs and tenant-scope worker updates where relevant. | notifications, queues | Medium | 1-2 days | queue policy | Medium | P1 |
| Backend | Queue retention policy | Configure failed job retention, dead-letter review, and cleanup docs. | BullMQ | Low | 1 day | worker deploy | Medium | P2 |
| Backend | Audit coverage expansion | Audit sensitive auth/admin actions and failed business actions where useful. | audit, auth, RBAC | Medium | 2-3 days | event taxonomy | Medium | P2 |
| Frontend | Safer auth storage decision | Move refresh token to HttpOnly cookie or explicitly freeze localStorage as internal-only. | web auth, API auth | High | 3-5 days | CORS/CSRF decision | High | P1 |
| Frontend | Add master data screens | Basic customer, item, company management for test operators. | web, parties, inventory | Medium | 4-6 days | API endpoints | Medium | P2 |
| Frontend | Improve document UX | Add action bar, status timeline, totals panel, and clearer validation feedback. | sales UI | Medium | 3-5 days | sales API stable | Medium | P2 |
| Frontend | Add role-aware navigation | Hide/disable routes based on `/auth/me` permissions. | app shell, auth | Medium | 2-3 days | permission payload | Medium | P2 |
| Frontend | Split bundle | Route-level lazy loading and dependency review to remove build warning. | web build | Low-medium | 1-2 days | no blocker | Low | P2 |
| Frontend | Accessibility pass | Keyboard/focus/labels/table/modal checks. | web UI | Medium | 2-3 days | screens stable | Medium | P2 |
| Mobile | Device smoke test | Build/copy Capacitor app and run on Android/iOS simulator/device. | mobile | Medium | 1-3 days | web build | Medium | P2 |
| Mobile | Secure mobile tokens | Use native secure storage or mobile-specific auth storage. | mobile, auth | Medium | 2-4 days | auth storage decision | High | P2 |
| Mobile | Push registration flow | Implement push opt-in, token registration, and backend persistence. | mobile, notifications | High | 3-6 days | notification policy | Medium | P3 |
| Database | Add operational indexes | Sales by customer/company/date, purchases by vendor/date, notifications by user/read, outbox by tenant/status. | Prisma schema | Medium | 1-2 days | query review | Medium | P1 |
| Database | Same-tenant integrity strategy | Add composite keys or service-level invariant tests for same-tenant relations. | Prisma, services | High | 3-6 days | schema policy | High | P1 |
| Database | GL integrity model | Add journal batch/posting model with balanced entry enforcement. | finance | High | 5-10 days | finance scope | High | P3 |
| DevOps | Railway deploy automation | Replace placeholder deploy with real service IDs or native Git integration docs. | deploy workflow | Medium | 1-3 days | Railway project | High | P1 |
| DevOps | Rollback drill | Prove backup restore and app rollback path in staging. | DB, deploy | Medium | 1-2 days | staging | High | P1 |
| DevOps | Worker health/alerting | Add alerts for failed jobs and queue depth. | worker, Redis, Sentry | Medium | 2-3 days | worker deployed | Medium | P2 |
| Security | Dependency scanning | Add npm audit/Snyk/Dependabot or equivalent. | repo | Low | 1 day | CI | Medium | P1 |
| Security | Secret scanning | Add GitHub secret scanning or gitleaks workflow. | repo, CI | Low | 1 day | CI | Medium | P1 |
| Security | Session management UI | Show active refresh sessions and allow revoke. | auth, web | Medium | 3-5 days | auth schema | Medium | P2 |
| ERP | Define V1 business scope | Freeze "sales release creates stock ledger only" and exclude invoice/GL in release notes. | product, docs | Low | 0.5 day | stakeholder approval | High | P0 |
| ERP | Sales invoice design | Define invoice, tax, AR, GL posting contract. | sales, finance | High | 5-10 days design | V1 after testing | High | P3 |
| ERP | Purchase receipt design | Define PO receipt, stock receipt, vendor invoice flow. | purchases, inventory | High | 5-10 days design | purchasing scope | High | P3 |
| ERP | Warehouse dimensions | Define warehouse/bin/lot/serial requirements. | inventory | High | 5-10 days design | inventory strategy | Medium | P3 |
| UX | Internal test script execution | Run `docs/v1-internal-test-script.md` with testers and log findings. | product, QA | Low | 1 day | staging | High | P0 |
| UX | Error copy review | Normalize Portuguese error messages and API validation display. | web, API | Low | 1-2 days | screens stable | Low | P2 |
| Testing | Add coverage reporting | Publish Jest/Playwright artifacts and coverage summary. | CI | Medium | 1-2 days | tests stable | Medium | P2 |
| Testing | Add seed data assertions | Test that required demo tenant/user/company/item/stock exist after seed. | API tests, seed | Low | 1 day | CI DB | Medium | P1 |
| Testing | Add a11y smoke tests | Add Playwright/axe for login/sales/inventory/audit. | web tests | Medium | 2-3 days | test infra | Medium | P2 |
| Testing | Add mobile build CI | Validate Capacitor copy/build at least on Android. | mobile CI | Medium | 2-4 days | CI runners | Medium | P3 |

## 14. MVP Readiness Scores

| Category | Score |
|---|---:|
| Architecture | 73 |
| Backend maturity | 67 |
| Frontend maturity | 62 |
| Mobile readiness | 24 |
| ERP readiness | 37 |
| Security readiness | 52 |
| Multi-tenant readiness | 64 |
| Production readiness | 32 |
| Testing readiness | 66 |
| UX maturity | 57 |
| DevOps maturity | 58 |

Overall readiness score for first internal V1 testing: 61/100.

Estimated completion toward first usable internal testing version: 68%, assuming the CI integration job is green. Without that proof, practical readiness is closer to 58%.

Estimated completion toward production beta: 30-35%.

## 15. Recommended Next Sprints

### Sprint 1 - Release Gate And Staging

Goal: make V1 testable by real internal users.

- Get CI `integration` green.
- Deploy staging API/web/DB/Redis.
- Apply migrations and seed.
- Run `docs/v1-internal-test-script.md`.
- Document reset process.
- Confirm known limits with stakeholders.

Exit criteria: a tester can log in, create/edit/release a sales order, see audit and inventory ledger, and repeat the test after reset.

### Sprint 2 - Hardening

Goal: reduce test instability and security risk.

- Expand negative integration tests.
- Add dependency and secret scanning.
- Add queue/worker deployment decision.
- Improve inventory concurrency or explicitly limit simultaneous testing.
- Add rollback/restore drill.
- Add route-level bundle splitting.

Exit criteria: the V1 path is reliable enough for multiple internal testers.

### Sprint 3 - Product Depth

Goal: make the ERP workflow feel less like a technical test and more like an operational validation.

- Add master data screens.
- Improve sales document UX.
- Add role-aware navigation.
- Add basic audit filters.
- Add dashboard metrics based on real data.
- Add a11y smoke tests.

Exit criteria: internal testers can validate workflows without developer intervention.

### Sprint 4 - ERP Expansion Decision

Goal: choose next ERP slice.

Options:

- Sales invoice + AR + GL posting.
- Purchase order + receipt + inventory receipt.
- Inventory warehouse dimensions.

Do not attempt all three simultaneously.

## 16. MVP Release Recommendation

First internal testing release should include only:

- Login/logout/refresh.
- Demo tenant and seeded admin.
- Sales order draft creation.
- Company/customer selectors.
- Item selector.
- Add/edit/remove sales lines.
- Release sales order to `OPEN`.
- Stock validation.
- `SALES_RELEASE` ledger entries.
- Inventory ledger and balance views.
- Audit log view.
- Known limits page/script for testers.

Explicitly exclude:

- Invoicing.
- GL posting.
- AR/AP.
- Banking.
- Purchase operations.
- Warehouse/lot/serial.
- Production mobile use.
- Public customer beta.

## 17. Production Risks

Dangerous today if used beyond controlled testing:

- Token persistence in localStorage.
- No MFA/account lockout/password reset.
- No proven staging/production rollback.
- No proven worker deployment/monitoring.
- No production-grade stock concurrency.
- No accounting integrity.
- No invoice/tax/legal document workflow.
- No tenant-safe DB constraints across relations.
- No complete observability/alerting.
- No mobile secure storage.

## 18. Final Verdict

V4 is the first version that looks close to a realistic internal V1 test release. The sales/inventory/audit path is no longer just scaffolding; it has meaningful implementation, negative tests, documented known limits, and a CI design that can act as a release gate.

However, the release is still conditional. The repository cannot be called test-release ready until the full integration/E2E job is proven green in CI or staging. Locally, this audit could not prove it because Docker is unavailable and Postgres/Redis were not running.

How close:

- First internal testing: 1-3 focused days after green CI/staging proof.
- Controlled customer demo: 2-4 weeks, if positioned as sales/inventory workflow preview only.
- Production beta: 2-4 months depending on finance, security, tenant hardening, deployment automation, and inventory concurrency decisions.

Recommended decision: proceed to a controlled internal V1 release only after the GitHub Actions integration job is green and a staging reset runbook is in place.

## 19. Operational verification (post-audit)

- **CI gate:** confirmar o job **`integration`** em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) **verde** na branch alvo; usar artefactos `api-integration-log` e `playwright-report` em caso de falha.
- **Registo manual:** atualizar [docs/ci-verification-log.md](./ci-verification-log.md) com data, branch, commit e link do run.
- **Staging e reset:** seguir [docs/staging-reset.md](./staging-reset.md) para deploy, política de seed/reset e checklist de rollback (drill documentado).
- **CI de segurança:** [docs/security-ci.md](./security-ci.md) — `pnpm audit --audit-level=critical` no job `quality` e Gitleaks no workflow `security.yml`.
