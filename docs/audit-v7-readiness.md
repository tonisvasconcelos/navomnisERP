# Navomnis ERP Audit V7 - V1 Testing Readiness

Date: 2026-05-16

Scope: complete repository audit for first controlled internal V1 testing release. This V7 audit is based on direct inspection of the real repository, including source code, schema, migrations, tests, CI/CD, deployment docs, frontend, mobile wrapper, security posture, ERP functional coverage, and local verification commands.

## 1. Executive Summary

V7 is a meaningful hardening pass over V6. It still does not turn Navomnis into a broad ERP MVP, but it improves the narrow internal V1 test slice in four practical ways:

- Login now has a route-specific throttle: `POST /auth/login` is limited to 15 attempts per 60 seconds.
- A new HTTP integration test verifies login throttling returns `429` and `Retry-After`.
- Audit logs now support filtering by action and entity type in both API and web UI.
- Web manual chunking now removes the prior large main bundle warning in direct web and mobile builds.
- A post-V1 ERP slice design document exists, recommending purchasing receipt as the next controlled ERP expansion path.

The largest unresolved issue remains operational proof. The repository still contains no recorded green GitHub Actions `integration` run in `docs/ci-verification-log.md`, and no real staging reset/rollback drill in `docs/staging-rollback-log.md`. On this local machine, Docker is unavailable and local Postgres/Redis are not listening, so full database-backed integration and Playwright E2E could not be executed locally.

V7 readiness for controlled internal V1 testing: conditional go, provided CI integration and staging proof are green.

V7 readiness for customer demo: acceptable only for a narrow, guided web demo of login, sales order, ledger, and audit.

V7 readiness for production beta: no.

Overall V7 readiness score: 68/100.

Estimated completion toward first internal V1 testing: 78 percent if CI/staging are proven; 67 percent without that proof.

## 2. What Changed Since V6

| Area | V7 change | Impact |
|---|---|---|
| Auth security | `@Throttle({ default: { limit: 15, ttl: 60000 } })` on login | Closes V6 "global only" throttle gap for credential stuffing basics |
| API tests | Added `auth-login-throttle.integration-spec.ts` | Covers HTTP 429 behavior and `Retry-After` header |
| Audit API | `GET /audit/logs` accepts `take`, `action`, `entityType` | Makes audit review more usable for internal testers |
| Audit web | Audit page added filter form, apply/clear/refresh controls | Better QA and support workflow during V1 testing |
| Web build | `manualChunks` added in `apps/web/vite.config.ts` | Direct web build chunks largest JS to 142.93 kB, no warning |
| Mobile build | Direct `@navomnis/mobile build` now reuses chunked web output | Capacitor copy path builds cleanly with no large chunk warning |
| Product roadmap | `docs/erp-v1-slice-design.md` added | Establishes design-before-build process for next ERP slice |
| Staging E2E | `test:e2e:staging` script and docs clarify `PLAYWRIGHT_BASE_URL` | Better path to prove staging, but not yet executed |

## 3. Verification Performed

| Check | Result | Notes |
|---|---:|---|
| `pnpm audit --audit-level=critical` | Pass | No critical advisories; still 24 non-critical findings |
| `pnpm lint` | Pass | API and web ESLint passed; package placeholder lints passed |
| `pnpm typecheck` | Pass | API and web TypeScript passed |
| `prisma validate` | Pass | Schema valid |
| `prisma format --check` | Pass | Schema formatted |
| `pnpm build` | Pass | Turbo build passed |
| `pnpm --filter @navomnis/mobile run build` | Pass | Direct mobile build copied chunked web dist |
| `pnpm --filter @navomnis/api test` | Pass but weak | No unit tests found; integration tests live under `test:integration` |
| `pnpm audit` | Fail | 24 findings: 12 high, 8 moderate, 4 low |
| Local Postgres 5432 | Fail | Port not listening |
| Local Redis 6379 | Fail | Port not listening |
| Docker CLI | Fail | `docker` command not available |
| Local DB integration tests | Not run | Blocked by missing Postgres/Redis |
| Local Playwright E2E | Not run | Requires API, DB, Redis, seeded data |

## 4. Repository Analysis

The repository remains a coherent monorepo:

- `apps/api`: NestJS API, Prisma, PostgreSQL, Redis, BullMQ, JWT, RBAC, AsyncLocalStorage tenant context.
- `apps/web`: React 18, Vite, Tailwind, React Query, Zustand, PWA, Framer Motion, Playwright.
- `apps/mobile`: Capacitor wrapper over `apps/web/dist`.
- `packages/config`, `packages/i18n`, `packages/ui`: shared workspace packages.
- `.github/workflows`: quality, integration, security, and deployment preparation.
- `docs`: increasingly mature release, staging, known-limits, CI, security, audit, and roadmap documentation.

Root tooling is appropriate: pnpm workspace, Turborepo, Node `>=20`, root `build`, `lint`, `typecheck`, and `format` scripts.

Repository risk remains: this workspace still appears as untracked from Git's perspective, so provenance, review state, branch state, and release history cannot be verified from local Git metadata.

## 5. Backend Audit

The backend structure is credible for a V1 internal ERP validation:

- `auth`
- `tenant`
- `rbac`
- `audit`
- `health`
- `finance`
- `parties`
- `sales`
- `purchases`
- `inventory`
- `lgpd`
- `notifications`
- `queues`
- `prisma`

Strengths:

- URI versioning under `/api/v1`.
- Global validation pipe with whitelist and transform.
- Global exception filter and response envelope.
- Helmet.
- Production CORS allowlist behavior.
- Swagger disabled by default in production.
- Pino log redaction for auth and cookies.
- Sentry initialization path.
- JWT access tokens with tenant id.
- Refresh token rotation with argon2 hash storage.
- Logout revokes all active refresh tokens.
- Public register is disabled in production.
- Login throttling now has a specific short-window cap.
- RBAC guard checks permissions per tenant role.
- Sales writes validate customer, company, item, and `UserCompany`.
- Sales release posts stock ledger entries in the same DB transaction as stock validation.

Remaining backend risks:

- Finance and purchases are read/stub-level, not operational workflows.
- `pnpm --filter @navomnis/api test` finds no unit tests; meaningful coverage depends on `test:integration`.
- No local or recorded CI proof that the integration suite is green after V7.
- No account lockout or progressive risk controls beyond throttling.
- No password reset, invite/provisioning flow, or MFA.
- Swagger can still be enabled in production via env without an additional auth gate.
- No generated API client or shared contract tests.

## 6. Frontend Audit

Strengths:

- Route-level lazy loading exists for dashboard, sales, inventory, and audit pages.
- V7 manual chunking splits React, router, TanStack, i18n, Sentry, Framer Motion, and vendor code.
- Direct web build now has no chunk warning; largest chunk observed was `react-vendor` at 142.93 kB.
- Login form has basic validation.
- Sales page supports create, line add/edit/remove, and release confirmation modal.
- Audit page now has practical filters.
- App shell queries `/auth/me` and hides module navigation by permission.
- Playwright scenario covers the core V1 happy path.
- PWA output is generated.

Risks:

- Tokens remain persisted in Zustand `localStorage`.
- UX remains thin for enterprise ERP standards: limited search, no dense grids, no column controls, no keyboard-driven entry, no record history panel, no bulk actions.
- Error states are basic and sometimes page-level.
- Offline readiness is PWA caching only; no ERP-safe offline writes or conflict handling.
- Accessibility is better than a prototype but not audited to WCAG standard.
- Mobile layout exists through responsive web plus Capacitor, not a native mobile ERP experience.

## 7. Mobile Audit

Capacitor setup is minimal but buildable:

- `appId`: `br.com.navomnis.erp`
- `appName`: `Navomnis ERP`
- `webDir`: `../web/dist`
- Push notifications plugin configured
- Preferences plugin installed
- Direct mobile build ran successfully and copied the web dist

Mobile is not ready for serious validation beyond "wrapper launches the web app":

- No native auth/session review.
- No app store build pipeline.
- No device testing evidence.
- No mobile-specific navigation audit.
- No offline write model.
- No push notification end-to-end proof.

Mobile readiness remains explicitly out of V1 internal scope.

## 8. Infrastructure And DevOps Audit

Strengths:

- `docker-compose.yml` defines Postgres 16 and Redis 7 with health checks.
- `Dockerfile` builds the API service.
- API and worker have separate runtime entry points.
- CI has `quality` and `integration` jobs.
- Integration job provisions Postgres and Redis, runs migration, seed, API integration tests, API build/start, web build, and Playwright.
- Security workflow runs Gitleaks.
- Deploy workflow has Vercel and Railway placeholders.
- Docs now explain staging E2E and `PLAYWRIGHT_BASE_URL`.

Risks:

- Deployment workflow remains mostly a template, especially Railway.
- No real staging URL recorded.
- No green CI integration run recorded.
- No rollback or restore drill recorded.
- No migration rollback automation.
- No release promotion process with artifact immutability.
- No observability dashboard or alert runbook.
- Local reproducibility is blocked on this machine because Docker is absent.

## 9. ERP Functional Analysis

### Finance

Maturity: low.

Implemented:

- Chart of accounts model and read endpoint.
- GL entry model.
- Finance summary stub.

Missing:

- Journal posting workflow.
- Balanced debit/credit enforcement at service level.
- Period close.
- AR/AP.
- Banking.
- Tax/fiscal logic.
- Financial reports.
- Posting from sales release.

### Sales

Maturity: medium for the narrow V1 slice.

Implemented:

- Customers via party model and seed.
- Sales orders.
- Draft status.
- Add/edit/remove lines while draft.
- Tenant-scoped numbering through `DocumentNumberSeries`.
- Release from `DRAFT` to `OPEN`.
- Stock ledger posting on release.
- Audit logs.
- Negative tests for insufficient stock, double release, RBAC, `UserCompany`, cross-tenant lines.

Missing:

- Quotes.
- Pricing engine.
- Discounts, taxes, shipping, approvals.
- Shipment/picking.
- Invoicing.
- Returns/credit notes.
- Full lifecycle beyond `OPEN`.

### Purchases

Maturity: low.

Implemented:

- Purchase order model.
- Purchase order list endpoint.
- Seed data.
- Operational indexes.

Missing:

- Vendor workflow beyond party model.
- Create/edit purchase order endpoints.
- Goods receipt.
- Purchase invoice.
- Landed cost.
- Payables integration.

### Inventory

Maturity: low-to-medium for V1 validation.

Implemented:

- Item list and create.
- Ledger list.
- Balance derived from ledger.
- Sales release posts negative ledger movements.
- Seed stock.

Missing:

- Warehouses/locations.
- Reservations.
- Lots/serials.
- Transfer orders.
- Cycle counting.
- Costing method.
- Concurrent stock control.
- Inventory close/revaluation.

### Authentication And RBAC

Maturity: medium for internal testing.

Implemented:

- Login.
- Refresh rotation.
- Logout revoke.
- `/auth/me`.
- RBAC permissions.
- Tenant access guard.
- Failed password logging for known users.
- Login throttling.

Missing:

- MFA.
- Password reset.
- Account lockout.
- Session list/revoke individual session.
- Invite/provisioning workflow.
- Strong browser token storage.

### Notifications

Maturity: technical foundation only.

Implemented:

- In-app notifications table.
- Email job enqueue with retries/backoff.
- Worker validates notification by `tenantId` and `userId`.
- Delivery status updates.

Missing:

- Operational worker deployment proof.
- Email template system.
- Resend domain setup proof.
- Dead-letter/retry dashboard.
- User preference UI.

### LGPD

Maturity: model-level foundation.

Implemented:

- Consent endpoint and model.
- Audit model.

Missing:

- Data export.
- Data erasure/anonymization workflow.
- Retention policies.
- Consent UI.
- Legal policy acceptance flow.

## 10. Multi-Tenant Audit

Tenant enforcement has improved enough for the internal V1 sales slice, but it is not yet enterprise-grade.

Strengths:

- JWT carries tenant id.
- `TenantAccessGuard` verifies `UserTenant`.
- AsyncLocalStorage context is set for guarded tenant routes.
- Prisma middleware injects tenant filters for many tenant-scoped models.
- Sales service explicitly validates tenant ownership of customer, company, and item.
- Sales create/release enforces `UserCompany`.
- Notification jobs now carry and validate tenant/user context.
- Integration tests cover tenant isolation for sales orders and foreign item/line misuse.

Dangerous patterns and scaling risks:

- Prisma middleware is a guardrail, not a database-enforced row-level security policy.
- Some models have optional `tenantId` (`AuditLog`, `OutboxEvent`) by design, which needs strict conventions.
- Direct Prisma calls outside tenant context can bypass middleware.
- Nested writes and relation connects are not universally tenant-validated outside the sales slice.
- Caches are not a major current surface, but future Redis caches must include tenant id in keys.
- Queue payloads must continue to include tenant id for every future job type.
- Database foreign keys do not enforce same-tenant relations between order and customer/company/item.

Tenant leakage verdict: acceptable for controlled V1 sales testing if CI isolation tests are green; not acceptable as a general platform guarantee for production beta.

## 11. Database Audit

Strengths:

- Schema covers many ERP building blocks.
- Tenant id exists on core tenant-scoped entities.
- Unique constraints exist for tenant-number, tenant-sku, tenant-account-code, tenant-role-name.
- Operational indexes exist for sales, purchases, notifications, outbox, audit, ledger, and GL date queries.
- `DocumentNumberSeries` avoids `count + 1` numbering collisions.
- Refresh tokens and access logs exist.
- Audit logs exist.

Risks:

- Initial migration is very large; later migrations are small, but no migration history proof exists in staging.
- Financial integrity is not enforced at workflow level.
- No database-level same-tenant composite foreign keys.
- Soft delete is inconsistent across models.
- Audit and outbox tenant ids are nullable.
- Stock balance is derived by aggregation and lacks reservation/locking semantics.
- No materialized balance table or inventory period model.
- No explicit decimal/currency policy document for financial posting.

Database verdict: structurally promising, but ERP financial and inventory integrity are not mature enough for production.

## 12. Security Audit

Improvements in V7:

- Login-specific throttling added.
- Integration test for throttle behavior added.
- Critical dependency audit gate passes.

Current strengths:

- Argon2 password hashing.
- Argon2-hashed refresh token storage.
- Refresh rotation.
- Logout revoke.
- Helmet.
- CORS allowlist in production.
- Production minimum JWT secret validation.
- Swagger disabled by default in production.
- Gitleaks workflow.
- Pino redaction.

Current blockers/risks:

- Full `pnpm audit` still reports 24 findings: 12 high, 8 moderate, 4 low.
- Refresh token remains in `localStorage`.
- No MFA.
- No password reset.
- No account lockout.
- No CSRF design for future cookie refresh.
- Swagger can be exposed by env flag.
- Rate limit storage appears in-memory/default rather than proven Redis-backed distributed limiting.
- Register endpoint exists publicly in non-production.

Security verdict: acceptable only for trusted internal testing with explicit limitations; not ready for public beta.

## 13. Testing Readiness

The test strategy is now much stronger on paper:

- API integration tests cover V1 sales flow, negative sales/RBAC cases, tenant isolation, seed smoke, `/auth/me`, and login throttling.
- Web Playwright covers login, new order, line edit, release modal, audit route, and inventory ledger.
- CI integration job wires DB, Redis, seed, API, web build, and Playwright.
- Staging E2E script exists.

The blocking issue is proof:

- No recorded CI `integration` success exists in `docs/ci-verification-log.md`.
- Local integration tests were not runnable because Docker/Postgres/Redis are absent.
- No staging run of Playwright or manual V1 script is recorded.

Internal testing readiness: yes, after one green CI integration run and one staging smoke run.

Alpha testing readiness: not yet.

Controlled customer demo readiness: yes only for a guided narrow demo.

## 14. Gap Analysis

### Critical

| Gap | Why it blocks | Status |
|---|---|---|
| No recorded green CI integration run | Cannot prove migration, seed, API integration, API start, web build, and Playwright are green together | Open |
| No staging V1 proof | Cannot prove environment variables, CORS, URLs, migrations, and deployed artifacts work | Open |
| No local DB/Redis/Docker on this machine | Prevents local full-stack verification by auditor | Open |

### High

| Gap | Risk | Status |
|---|---|---|
| Full audit has 12 high findings | Security posture is not clean enough for beta | Open |
| Refresh token in localStorage | XSS exposes long-lived session | Accepted only for internal V1 |
| No rollback/restore drill record | Recovery capability is unproven | Open |
| Stock concurrency still weak | Parallel releases can oversell | Documented V1 limit |
| Finance is not operational | ERP validation cannot cover accounting | Open |
| Purchases are read-only | ERP procurement validation cannot happen | Open |
| Worker deployment unproven | Email/queue behavior cannot be trusted | Accepted out of V1 by default |
| No password reset/invites | User ops depend on seed/manual ops | Open |

### Medium

| Gap | Risk | Status |
|---|---|---|
| UX still prototype-like for ERP | Testers can validate flow, not efficiency | Open |
| No generated API client | Contract drift risk | Open |
| No unit tests found in API default test script | Fast feedback is weak | Open |
| No accessibility audit | Compliance and usability risk | Open |
| Optional tenant ids on audit/outbox | Convention risk for future features | Open |
| No observability dashboards | Incident diagnosis is manual | Open |
| No mobile device proof | Capacitor build does not prove mobile UX | Open |

### Low

| Gap | Risk | Status |
|---|---|---|
| Placeholder deploy workflow text | Usable as documentation, not automation | Open |
| Shared UI package still thin | More duplication likely | Open |
| Dashboard is shallow | Lower perceived product maturity | Open |
| Audit filter UX is functional but basic | Needs saved filters/export later | Open |

## 15. Complete Pending Task List

| Area | Task | Description | Impacted modules | Complexity | Effort | Dependency chain | Risk | Priority |
|---|---|---|---|---|---:|---|---|---|
| DevOps | Record green CI integration | Run GitHub Actions CI and fill `docs/ci-verification-log.md` | CI, docs | Low | 0.5 day | GitHub access | Critical | P0 |
| DevOps | Execute staging smoke | Deploy API/web, migrate/seed, run V1 script, record URL/result | API, web, DB | Medium | 1 day | CI green | Critical | P0 |
| DevOps | Fix local reproducibility | Ensure Docker Desktop or documented alternative is available | local dev | Low | 0.5 day | none | High | P0 |
| Security | Triage high audit findings | Upgrade or override `glob`, `tar`, `multer`, `file-type`, Nest packages where possible | deps | Medium | 1-3 days | compatibility review | High | P1 |
| Security | Token storage plan | Move refresh to HttpOnly cookie or keep documented internal-only exception | API, web | High | 2-5 days | auth design | High | P2 |
| Security | Add account lockout policy | Add lockout/risk policy over failed login logs and throttle | auth | Medium | 1-2 days | product decision | Medium | P2 |
| Backend | Add API unit tests | Cover auth service, sales service, guards, number series | API | Medium | 2-4 days | test fixtures | Medium | P2 |
| Backend | Contract typing | Generate OpenAPI client or shared Zod contract | API, web | Medium | 2-4 days | stable API | Medium | P2 |
| Backend | Harden Swagger exposure | Add auth/IP gate or keep disabled in deployed environments | API | Low | 0.5-1 day | env decision | Medium | P1 |
| Backend | Distributed rate limiting | Prove throttler storage works across API replicas | API, Redis | Medium | 1-2 days | scaling plan | Medium | P2 |
| Multi-tenant | Same-tenant relation enforcement | Add service helpers and tests for every connect/relation path | API, Prisma | High | 3-7 days | module scope | High | P1 |
| Multi-tenant | Queue tenant contract | Require tenant id in all future job payloads and add tests | queues | Medium | 1-2 days | worker decision | Medium | P2 |
| Database | Rollback drill | Execute restore/reset drill and fill rollback log | DB, docs | Medium | 1 day | staging | High | P1 |
| Database | Financial posting constraints | Design GL posting engine with balanced entries and periods | finance | High | 5-10 days | product/accounting rules | High | P3 |
| Database | Inventory concurrency spike | Prototype reservation or locked stock balance strategy | inventory | High | 3-7 days | load scenario | High | P2 |
| ERP | Choose next ERP slice | Fill `erp-v1-slice-design.md` decision fields | product | Low | 0.5 day | stakeholder decision | Medium | P1 |
| ERP | Implement purchasing receipt | If option B is chosen, add PO receive and positive ledger posting | purchases, inventory | High | 5-10 days | slice decision | High | P3 |
| ERP | Sales invoice design | Define invoice/AR/GL minimum before coding | sales, finance | High | 3-5 days | accounting decisions | High | P3 |
| Frontend | Improve sales grid UX | Search, sorting, better empty/error/loading states | web sales | Medium | 2-4 days | API pagination | Medium | P2 |
| Frontend | Improve audit UX | Add exact action/entity dropdowns, date range, export | web audit, API | Medium | 2-4 days | audit API | Medium | P2 |
| Frontend | Error boundary | Add app-level recoverable error UX | web | Low | 1 day | none | Medium | P2 |
| Frontend | Accessibility pass | Keyboard paths, focus states, labels, contrast | web | Medium | 2-4 days | stable UI | Medium | P2 |
| Mobile | Device smoke | Run Android/iOS build and login/sales smoke on device/emulator | mobile | Medium | 1-3 days | API URL/staging | Medium | P3 |
| Mobile | Mobile navigation review | Decide if mobile is web-responsive only or native shell | mobile, web | Medium | 2-3 days | product scope | Medium | P3 |
| Testing | Run integration suite locally or in CI | Execute `pnpm run test:integration` with DB/Redis | API | Low | 0.5 day | infra | Critical | P0 |
| Testing | Run Playwright against staging | Use `PLAYWRIGHT_BASE_URL` and record result | web, staging | Low | 0.5 day | staging | Critical | P0 |
| Testing | Add audit filter tests | Cover action/entity filters in API and UI | API, web | Low | 1 day | V7 filters | Medium | P2 |
| UX | Internal tester script results | Capture tester findings against V1 script | docs, product | Low | 1 day | staging | High | P1 |

## 16. MVP Readiness Score

| Dimension | Score |
|---|---:|
| Architecture | 76 |
| Backend maturity | 72 |
| Frontend maturity | 68 |
| Mobile readiness | 24 |
| ERP readiness | 42 |
| Security readiness | 59 |
| Multi-tenant readiness | 68 |
| Production readiness | 36 |
| Testing readiness | 74 |
| UX maturity | 63 |
| DevOps maturity | 65 |

Overall readiness score: 68/100.

Internal V1 testing completion estimate: 78 percent with green CI/staging proof; 67 percent without it.

## 17. Recommended Next Sprints

### Sprint 0 - Release Proof

1. Run GitHub Actions `integration`.
2. Fill `docs/ci-verification-log.md`.
3. Deploy staging API/web.
4. Run manual V1 script.
5. Run Playwright against staging.
6. Decide whether rollback drill is mandatory before testers.

### Sprint 1 - Security And Operational Cleanup

1. Triage `pnpm audit` high findings.
2. Lock Swagger down in deployed environments.
3. Document or implement distributed rate limiting.
4. Add API unit tests for auth, guards, and sales service.
5. Add audit filter integration tests.

### Sprint 2 - Tester UX

1. Improve sales list and order error/loading/empty states.
2. Add audit date range and exact filter controls.
3. Add an app-level error boundary.
4. Run accessibility pass on login, shell, sales, inventory, audit.

### Sprint 3 - Next ERP Slice

1. Fill the formal decision in `erp-v1-slice-design.md`.
2. Prefer option B: purchasing receipt.
3. Define acceptance criteria and out-of-scope.
4. Add tests before expanding financial scope.

## 18. MVP Release Recommendation

First internal testing version should include only:

- Login, refresh, logout.
- Role-aware web shell.
- Sales order draft.
- Add/edit/remove sales lines.
- Release to `OPEN`.
- Ledger movement for `SALES_RELEASE`.
- Inventory item list, balance, ledger.
- Audit log reading with filters.
- Known-limits documentation.
- CI integration proof.
- Staging proof.

It should explicitly exclude:

- Production beta.
- Mobile release.
- Finance/GL validation.
- Invoicing.
- Procurement operations.
- Warehouse operations.
- Email/worker validation unless separately enabled.

## 19. Production Risks

The following are dangerous today:

- Browser refresh tokens in `localStorage`.
- High dependency advisories remain.
- No public beta security posture.
- No proven staging rollback/restore.
- No proven worker deployment.
- No production-grade stock concurrency.
- No financial posting integrity.
- No operational observability proof.
- No real customer data governance flows.
- No mobile device certification.

## 20. Final Verdict

Navomnis ERP V7 is close to a first controlled internal V1 testing release, but the release gate is operational, not architectural. The codebase now has a plausible narrow V1 slice, stronger auth throttling, better audit usability, better web chunking, and stronger documentation.

First internal testing: close, conditional go after green CI integration and staging smoke.

Customer demo: possible as a guided sales/inventory/audit demo with clear disclaimers.

Production beta: not close. Finance, procurement, warehouse, tenant guarantees, security posture, rollback, observability, and mobile readiness are still below production expectations.
