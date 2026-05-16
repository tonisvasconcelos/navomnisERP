# Navomnis ERP Audit V6 - V1 Testing Readiness

Date: 2026-05-15

Scope: complete repository audit for first controlled internal V1 testing release. This V6 audit is based on direct inspection of the real repository, including code, schema, migrations, tests, CI/CD, deployment docs, frontend, mobile wrapper, security posture, ERP functional coverage, and local verification commands.

## 1. Executive Summary

V6 is another concrete hardening step over V5. It does not radically expand ERP functionality, but it closes several release-readiness gaps that matter for internal testing:

- `GET /auth/me` now returns user identity and sorted permission codes.
- The web shell uses `/auth/me` to show `Vendas`, `Estoque`, and `Auditoria` only when the user has matching permissions.
- API integration coverage now includes `/auth/me` permissions.
- Web E2E waits for permission-aware navigation before entering the sales flow.
- Route-level lazy loading was added, reducing page chunks, though the main bundle still warns at 595.03 kB.
- Operational indexes were added for sales, purchases, notifications, and outbox queries.
- Notification email jobs now carry `tenantId` and `userId`; the worker verifies notification ownership before sending/updating.
- `docs/v1-release-notes-internal.md` explicitly freezes V1 scope and accepted internal-only security compromises.
- `docs/staging-rollback-log.md` exists for rollback/restore drill evidence.
- Playwright was upgraded to `1.55.1`, removing the previous Playwright high advisory from full `pnpm audit`.

The biggest unresolved blocker remains the same: there is still no recorded green CI `integration` run in `docs/ci-verification-log.md`, and no staging/rollback drill execution is recorded. Locally, Docker is unavailable and Postgres/Redis are not listening, so full integration/E2E could not be run on this machine.

V6 readiness for controlled internal V1 testing: conditional go, very close, after green CI integration and staging proof.

V6 readiness for customer demo: limited demo only, web sales/inventory/audit slice.

V6 readiness for production beta: no.

## 2. What Changed Since V5

| Area | V6 change | Impact |
|---|---|---|
| Auth/RBAC | `/auth/me` returns `sub`, `email`, `displayName`, `tenantId`, sorted permissions | Enables role-aware UX and testable permission payload |
| Frontend | App shell filters module nav by permission | Closes V5 role-aware navigation gap for primary modules |
| Frontend | Routes are lazy loaded through `React.lazy`/`Suspense` | Improves chunking, but main bundle still large |
| API tests | Added `auth-me.integration-spec.ts` | Confirms admin permissions include `sales.write`, `sales.read`, `audit.read` |
| E2E | Playwright waits for `nav-sales` | Aligns web flow with permission-aware shell |
| Database | Added operational index migration | Improves query readiness for common lists/reporting |
| Notifications | Queue payload includes `tenantId`/`userId`; worker checks notification row | Reduces tenant-risk in background jobs |
| Security | Playwright upgraded to `1.55.1` | Full audit drops from 25 to 24 findings |
| Product | Internal release notes added | Scope and token/MFA decisions now explicit |
| DevOps | Rollback log template added | Evidence capture path exists, but no drill recorded |

## 3. Repository Analysis

The monorepo remains coherent and well organized:

- `apps/api`: NestJS API, Prisma, PostgreSQL, BullMQ, Redis, JWT, RBAC, tenant context.
- `apps/web`: React 18, Vite, Tailwind, React Query, Zustand, PWA, Playwright.
- `apps/mobile`: Capacitor wrapper over the web build.
- `packages/config`, `packages/i18n`, `packages/ui`: shared packages.
- `docs`: V1 scenario, release notes, known limits, staging, CI, security, audits.
- `.github/workflows`: CI, security, and deployment preparation.

Root tooling:

- pnpm workspace
- Turborepo
- Node `>=20`
- scripts for build, lint, typecheck, format

Remaining repo risk: all files still show as untracked in this workspace, so Git history cannot be used to verify provenance, review, or release state.

## 4. Backend Audit

### Architecture

The backend module structure is appropriate for an ERP SaaS foundation:

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

The implemented depth is uneven. Sales, inventory, auth, RBAC, tenant, and audit have real V1 behavior. Finance and purchases remain mostly read/seed-level. Notifications are technically plausible but not operationally proven.

### API Quality

Strengths:

- URI versioning under `/api/v1`
- global validation pipe
- global exception filter
- response envelope interceptor
- Helmet
- production CORS allowlist
- production secret validation
- Swagger disabled by default in production
- Pino redaction
- global throttling
- Sentry hooks for API/worker

Risks:

- throttling is global, not login-specific
- Swagger can be enabled in production by env flag without auth
- CSRF is installed but not wired; relevant if refresh moves to cookie
- no generated API client or shared contract typing

### Authentication And RBAC

Implemented:

- login
- refresh rotation
- hashed refresh token storage
- logout revokes refresh tokens
- public register disabled in production
- failed-password logging for existing users
- `/auth/me` profile and permissions
- permission-aware API guards
- role-aware frontend nav for primary modules

Remaining gaps:

- access and refresh tokens persist in localStorage
- no MFA
- no password reset
- no account lockout
- no session/device management UI
- no role management UI

Auth/RBAC verdict: good enough for trusted internal testing; not production-grade.

### Sales

Implemented:

- order list/detail
- create draft
- add/edit/remove line
- release order
- transactional document numbering through `DocumentNumberSeries`
- stock validation inside release transaction
- `SALES_RELEASE` inventory ledger entries
- audit logs for mutations
- company/customer/item tenant validation
- `UserCompany` enforcement on create/release

Tested:

- happy path
- edit line
- release
- ledger movement
- audit entries
- insufficient stock
- double release
- remove after release
- non-draft line update
- cross-tenant line update/delete attempts
- RBAC denials
- company authorization denial

Remaining ERP gaps:

- no quote
- no shipment/picking
- no invoice
- no tax/fiscal document
- no AR/GL posting
- no reservations or warehouse dimensions
- no production-grade concurrent stock control

Sales verdict: strongest module; testable for internal V1.

### Inventory

Implemented:

- item list/create
- ledger
- derived balance endpoint
- sales release movement

Missing:

- warehouses
- bins
- lots/serials
- reservations
- transfers
- physical counts
- cost layers/valuation

Inventory verdict: adequate only for the V1 sales validation slice.

### Finance

Implemented:

- chart of accounts read
- simple summary
- GL entry model

Missing:

- journal posting
- balanced journal enforcement
- posting periods
- AR/AP
- banking
- reports
- sales/purchase posting integration

Finance verdict: not operational.

### Purchases

Implemented:

- purchase order model
- purchase order list
- seeded data
- new operational indexes for purchase list patterns

Missing:

- create/edit/release PO
- goods receipt
- purchase invoice
- AP
- inventory receipt
- GL integration

Purchases verdict: not testable as a workflow.

### Notifications And Queues

V6 improves tenant safety:

- `EnqueueEmailPayload` includes `tenantId` and `userId`.
- Worker verifies notification exists for the tenant/user before sending.
- Notification list filters by both user and tenant.

Remaining risks:

- worker deployment is not proven
- no dead-letter/cleanup policy
- failed jobs retained indefinitely
- email templates are not mature
- delivery updates still key by `notificationId` after pre-check, which is acceptable for now but could be stricter

Notifications verdict: safer than V5, still not operationally proven.

## 5. Multi-Tenant Audit

Implemented controls:

- tenant id in JWT
- `TenantAccessGuard`
- AsyncLocalStorage tenant context
- Prisma tenant middleware for tenant-scoped models
- service-level validation for sales relations
- `UserCompany` checks
- tenant-scoped audit logs
- tenant-scoped notification list
- tenant-aware email job payload and worker pre-check
- integration tests for tenant list isolation, cross-tenant item rejection, cross-tenant line update/delete

Remaining risks:

- database does not enforce same-tenant foreign-key invariants
- Prisma middleware is a guardrail, not a formal isolation proof
- future relation connects still need explicit validation
- optional tenant fields (`AuditLog`, `OutboxEvent`) need strict policy as features expand
- cache key strategy is not yet relevant, but future Redis cache must include tenant ids

Multi-tenant readiness improved from V5, especially for jobs and frontend permissions, but it is still not enterprise-hardened.

## 6. Database Audit

V6 adds operational indexes:

- `SalesOrder(tenantId, companyId, orderDate)`
- `SalesOrder(tenantId, customerId, orderDate)`
- `PurchaseOrder(tenantId, vendorId, orderDate)`
- `PurchaseOrder(tenantId, companyId, orderDate)`
- `Notification(tenantId, userId, createdAt)`
- `OutboxEvent(tenantId, publishedAt, type)`

Strengths:

- schema is broad and ERP-shaped
- tenant id is consistently present on main business tables
- useful tenant-scoped unique constraints
- document number series is tenant-scoped
- indexes now better match expected list/report queries

Remaining risks:

- no same-tenant relational constraints
- no accounting integrity constraints
- no journal batch/posting model
- no immutable GL posting model
- no stock balance/reservation table
- no row-locking stock strategy
- soft delete is inconsistent
- `AccessLog` remains indexed by user/date, not tenant/success/reason

Database verdict: improved operational-readiness; still not a mature ERP ledger/database design.

## 7. Frontend UX Audit

Implemented:

- protected routes
- role-aware module navigation
- lazy-loaded route pages
- login
- dashboard
- sales order list/detail
- company/customer/item selectors
- add/edit/remove line
- release confirmation modal
- inventory ledger/balances
- audit log page
- API error display in key workflows

V6 improvements:

- module nav now respects permissions from `/auth/me`
- E2E waits for permission-aware navigation
- route chunks were split into separate files

Remaining issues:

- main bundle still warns at 595.03 kB
- mobile build replay still shows older 518.08 kB warning
- dashboard still links directly to sales/inventory without permission gating
- route access is not permission-guarded client-side; hidden nav helps but direct routes rely on API denial
- no broad accessibility pass
- no master-data management screens
- no ERP document timeline/action bar
- no offline workflow despite PWA setup

Frontend verdict: usable for internal V1 web testing; still thin for enterprise ERP UX.

## 8. Mobile Audit

Mobile is explicitly out of V1 scope in `docs/v1-scenario.md`.

Implemented:

- Capacitor config
- app id/name
- webDir points to web dist
- push notification plugin config
- build script copies web build

Missing:

- native project validation
- device/simulator testing
- secure token storage
- mobile-specific navigation QA
- offline behavior
- push registration workflow
- store packaging

Mobile verdict: wrapper only; not part of V1 internal release.

## 9. DevOps Audit

CI:

- quality job with install, critical-only audit, lint, typecheck, Prisma validate/format, build
- integration job with Postgres, Redis, migrate, seed, API integration tests, API build/start, web build, Playwright
- security workflow with Gitleaks

Docs:

- CI integration docs
- staging docs
- staging reset runbook
- rollback drill log template
- internal V1 release notes
- Vercel/Railway deployment docs

Still missing proof:

- no recorded green integration run in `docs/ci-verification-log.md`
- no staging environment verification recorded
- no rollback/restore drill recorded
- Railway deploy workflow remains placeholder/model
- worker deployment not proven

DevOps verdict: release process is well-documented and CI-designed, but not yet evidenced.

## 10. Security Audit

Strengths:

- Argon2 password hashing
- refresh token rotation and hashing
- logout revocation
- Helmet
- CORS production allowlist
- production secret validation
- Swagger off by default in production
- Pino auth redaction
- Gitleaks workflow
- critical-only dependency audit
- Playwright high advisory closed by upgrade
- internal release notes document accepted token/MFA/audit compromises

Verification:

- `pnpm audit --audit-level=critical` passed.
- Full `pnpm audit` reports 24 vulnerabilities: 12 high, 8 moderate, 4 low.

Remaining security risks:

- localStorage token persistence
- no MFA
- no password reset
- no account lockout
- high dependency findings remain, including `glob`, `tar` via Capacitor CLI, `multer`, and others
- no proven secret-scan run result in repository
- no session/device management

Security verdict: better than V5, acceptable only for controlled internal testing.

## 11. Testing Readiness

Automated tests now cover:

- V1 happy path
- seed fixture smoke
- tenant isolation
- cross-tenant item rejection
- cross-tenant line update/delete rejection
- RBAC denials
- UserCompany denial
- failed password logging
- non-draft line update rejection
- `/auth/me` permission payload
- web E2E sales path through permission-aware nav

Local V6 verification passed:

- `pnpm audit --audit-level=critical`
- `pnpm lint`
- `pnpm typecheck`
- Prisma validate
- Prisma format check
- `pnpm build`
- `pnpm --filter @navomnis/api test` passes with no unit tests found

Local V6 verification not runnable:

- Docker is unavailable
- Postgres on `127.0.0.1:5432` is unavailable
- Redis on `127.0.0.1:6379` is unavailable
- full API integration/E2E could not be run locally

Testing verdict: test design is strong for V1, but release proof still depends on GitHub Actions/staging.

## 12. ERP Functional Maturity

| Domain | Maturity | V1 testing status |
|---|---:|---|
| Authentication | Medium | Usable internally |
| RBAC | Medium-high | API and nav now permission-aware |
| Tenant isolation | Medium-high | Strong for V1 path |
| Sales orders | Medium | V1-testable |
| Sales quotes | None | Not ready |
| Invoicing | None | Not ready |
| Pricing | Low | Manual line price only |
| Customers | Low-medium | Basic API/listing |
| Inventory items | Low-medium | Basic item/ledger/balance |
| Warehousing | None | Not ready |
| Purchases | Low | Read-only/list only |
| Goods receipt | None | Not ready |
| Purchase invoices | None | Not ready |
| General ledger | Low | Schema/read only |
| Receivables | None | Not ready |
| Payables | None | Not ready |
| Banking | None | Not ready |
| Financial reports | Very low | Not ready |
| Notifications/email | Medium-low | Safer jobs, not proven in deploy |
| LGPD | Low-medium | Consent records only |
| Audit logs | Medium | Useful for V1 |

ERP verdict: still a focused sales/inventory/audit validation slice, not a complete ERP MVP.

## 13. Gap Analysis

### Critical

1. Record a green CI `integration` run.
   - `docs/ci-verification-log.md` remains unfilled.
   - This is the main release gate.

2. Verify staging end-to-end.
   - Stable URL, API, web, Postgres, Redis, migrations, seed, and manual V1 script must be proven.

3. Decide whether to require rollback drill before testers.
   - `staging-rollback-log.md` exists but is empty.
   - Release notes make it optional but recommended; I recommend doing it before more than a small internal pilot.

### High

1. Triage remaining high dependency vulnerabilities.
2. Add production-grade stock concurrency or keep single-writer/low-concurrency V1 constraint.
3. Prove worker deployment or explicitly keep it out of V1.
4. Add login-specific throttling/account lockout.
5. Continue bundle optimization; main chunk still over 500 kB.
6. Permission-guard dashboard cards and/or direct frontend routes for clearer UX.

### Medium

1. Add password reset/invite workflow.
2. Add role management UI.
3. Add master-data UI for customers/items/companies.
4. Add sales document action bar/timeline.
5. Add accessibility tests.
6. Add generated API contracts.
7. Strengthen same-tenant relation strategy.
8. Add queue cleanup/dead-letter policy.
9. Add mobile secure storage if mobile re-enters scope.

### Low

1. richer empty states
2. report/export actions
3. dashboard KPIs
4. PWA offline fallback
5. email template polish

## 14. Complete Pending Task List

| Area | Title | Description | Impacted modules | Complexity | Effort | Dependencies | Risk | Priority |
|---|---|---|---|---|---:|---|---|---|
| DevOps | Record green integration run | Fill CI verification log with branch, commit, run URL, and green status. | CI, docs | Low | 0.5 day | GitHub Actions | Critical | P0 |
| DevOps | Verify staging | Deploy API/web/Postgres/Redis, migrate, seed, run V1 script. | Railway, Vercel, DB | High | 2-4 days | CI green | Critical | P0 |
| QA | Execute manual V1 script | Run web checklist in staging and log findings. | QA, product | Low | 1 day | staging | Critical | P0 |
| DevOps | Run rollback drill | Execute reset/restore drill and fill rollback log. | staging, DB | Medium | 1 day | staging | High | P1 |
| Security | Triage high audit findings | Resolve or accept remaining high advisories. | dependencies | Medium | 1-3 days | compatibility review | High | P1 |
| Security | Login lockout/rate limit | Add login-specific throttling or lockout policy. | auth | Medium | 2-3 days | policy | High | P1 |
| Security | Token storage migration plan | Keep localStorage only for internal V1; plan HttpOnly refresh. | web, API | High | 2-5 days | auth design | High | P2 |
| Backend | Stock concurrency model | Add reservation/balance table/locking or explicitly enforce low-concurrency testing. | sales, inventory, DB | High | 4-8 days | domain design | High | P1 |
| Backend | Queue retention policy | Add failed job retention/dead-letter/cleanup policy. | notifications | Medium | 1-2 days | worker plan | Medium | P2 |
| Backend | Company policy abstraction | Extract reusable company authorization service. | sales, future purchases | Medium | 2-4 days | auth model | Medium | P2 |
| Database | Same-tenant constraints | Design composite constraints or invariant tests for cross-table tenant consistency. | Prisma, services | High | 3-6 days | schema design | High | P2 |
| Database | Accounting integrity model | Add journal batch and balanced posting controls. | finance | High | 5-10 days | finance roadmap | High | P3 |
| Frontend | Complete route permission UX | Gate dashboard cards and direct route UX using `/auth/me`. | web | Medium | 1-2 days | auth-me stable | Medium | P2 |
| Frontend | Further bundle split | Split vendor/query/router chunks to remove 595 kB warning. | web build | Medium | 1-2 days | build analysis | Medium | P2 |
| Frontend | Master data screens | Basic customer/item/company management. | web, API | Medium | 4-6 days | endpoints | Medium | P2 |
| UX | Sales document polish | Action bar, status timeline, better totals/validation. | sales UI | Medium | 3-5 days | V1 stable | Medium | P2 |
| Testing | Staging Playwright | Run Playwright against staging URL/API. | web E2E | Medium | 1-2 days | staging | High | P1 |
| Testing | Coverage reporting | Publish coverage/artifacts for API integration and E2E. | CI | Medium | 1-2 days | CI stable | Medium | P2 |
| Mobile | Keep mobile out of V1 | Maintain explicit scope exclusion until device validation exists. | docs, mobile | Low | 0.5 day | release notes | Medium | P0 |
| Mobile | Device smoke | If mobile returns to scope, run simulator/device smoke. | mobile | Medium | 1-3 days | web build | Medium | P3 |
| ERP | Invoice/GL roadmap | Define fiscal invoice, AR, and GL posting sequence. | sales, finance | High | 5-10 days design | after V1 | High | P3 |
| ERP | Purchase receipt roadmap | Define PO, receipt, vendor invoice workflow. | purchases, inventory | High | 5-10 days design | after V1 | High | P3 |

## 15. MVP Readiness Scores

| Category | Score |
|---|---:|
| Architecture | 75 |
| Backend maturity | 70 |
| Frontend maturity | 65 |
| Mobile readiness | 24 |
| ERP readiness | 39 |
| Security readiness | 56 |
| Multi-tenant readiness | 68 |
| Production readiness | 35 |
| Testing readiness | 72 |
| UX maturity | 60 |
| DevOps maturity | 64 |

Overall readiness score for first controlled internal V1 testing: 66/100.

Estimated completion toward first usable internal testing release:

- 76% if CI integration is green and staging is verified.
- 64% without recorded CI/staging proof.

Estimated completion toward production beta: 34-38%.

## 16. Recommended Next Sprints

### Sprint 1 - Operational Proof

- Run CI on target branch.
- Fill `docs/ci-verification-log.md`.
- Deploy staging.
- Run migrations and seed.
- Execute manual V1 script.
- Decide whether rollback drill is mandatory before testers.

### Sprint 2 - Internal Pilot Hardening

- Triage remaining high vulnerabilities.
- Run staging Playwright.
- Add login lockout/rate-limit policy.
- Prove or explicitly disable worker for V1.
- Continue bundle splitting.

### Sprint 3 - Usability Depth

- Permission-aware dashboard cards/direct route states.
- Master data screens.
- Sales action bar/timeline.
- Audit filters.
- Accessibility smoke tests.

### Sprint 4 - Next ERP Slice

Choose one:

- sales invoice + AR/GL
- purchasing + receipt
- inventory reservations/warehouse

Do not start all at once.

## 17. MVP Release Recommendation

V1 internal release should include:

- web only
- login/refresh/logout
- permission-aware shell
- sales draft/create/edit/release
- stock validation
- inventory ledger/balance
- audit log
- known limits
- internal release notes
- seed/reset runbooks

Explicitly exclude:

- invoice/tax/fiscal
- GL posting
- AR/AP/banking
- purchase operations
- warehouse/lot/serial
- mobile production testing
- public beta

## 18. Production Risks

Still dangerous beyond internal testing:

- refresh token in localStorage
- no MFA/account lockout/password reset
- high dependency vulnerabilities remain
- no production-grade stock concurrency
- no financial/accounting integrity
- no staging proof recorded
- no rollback drill recorded
- no worker deployment proof
- no same-tenant DB constraints
- no mobile secure storage

## 19. Final Verdict

V6 is a stronger internal V1 candidate than V5. It improves permission-aware UX, backend permission introspection, background-job tenant safety, database operational indexes, release notes, and dependency posture. These are not cosmetic changes; they make the system more testable and less surprising for internal users.

The release is still conditional. The codebase now has most of the machinery needed for a first internal V1 test, but the team still needs operational proof: green CI `integration`, staging verification, and ideally a rollback/reset drill.

Distance estimates:

- first internal testing: 1-2 focused days after green CI/staging proof
- controlled customer demo: 2-3 weeks if scoped to web sales/inventory/audit only
- production beta: 2-4 months depending on security, finance, inventory concurrency, tenant-hardening, and DevOps automation

Recommendation: prepare for internal V1, but do not announce "ready for testers" until `docs/ci-verification-log.md` has a green integration run and staging has passed the V1 script.
