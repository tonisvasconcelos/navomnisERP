# Platform administration architecture

Navomnis operates two isolated security contexts:

| Context | App | API prefix | JWT |
|---------|-----|------------|-----|
| Tenant ERP | `apps/web` | `/api/v1/*` | `ctx: tenant`, requires `tid` |
| Platform admin | `apps/admin` | `/api/v1/platform/*` | `ctx: platform`, no `tid` |

## Data access

- Tenant modules use `PrismaService` with AsyncLocalStorage tenant middleware.
- Platform modules use `PlatformPrismaService` without tenant auto-filtering.

## Threat model highlights

- Tenant JWTs are rejected on platform routes at the Passport strategy layer.
- Platform JWTs are rejected on tenant routes.
- Cross-tenant actions by operators are written to `AuditLog` with `scope: PLATFORM`.

See also: [saas-administration-guide.md](./saas-administration-guide.md)
