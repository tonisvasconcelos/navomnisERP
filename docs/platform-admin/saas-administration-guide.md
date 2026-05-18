# SaaS administration guide

## Bootstrap operator (seed)

- Email: `admin@platform.navomnis.local`
- Password: `Platform123!`

## Tenant lifecycle

Use `POST /api/v1/platform/tenants` to create, then lifecycle endpoints:

- `POST .../activate`
- `POST .../suspend`
- `POST .../block`
- `DELETE ...` (soft delete)
- `POST .../restore`

## Admin UI

Run `pnpm --filter @navomnis/admin dev` (port 5174). Set `VITE_API_URL` to the API base.

### Routes

| Recurso | Lista | Criar | Ver | Editar |
|---------|-------|-------|-----|--------|
| Tenants | `/tenants` | `/tenants/new` | `/tenants/:id` | `/tenants/:id/edit` |
| Users | `/users` | `/users/invite` | `/users/:id` | `/users/:id/edit` |
| Plans | `/subscriptions/plans` | `/subscriptions/plans/new` | `/subscriptions/plans/:id` | — |

Atribuição de plano a tenant: secção **Subscrição** no detalhe do tenant (`POST /platform/subscriptions/tenants/:tenantId/assign`).

## User invite flow

1. Platform admin: `POST /api/v1/platform/users/invite` com `email`, `displayName`, `tenantId`.
2. API cria utilizador sem senha, `UserTenant`, `UserInvite` (token SHA-256, validade 7 dias) e enfileira e-mail com link `{WEB_URL}/invite/accept?token=...`.
3. Resposta inclui `inviteUrl` e `token` (cópia manual se e-mail não enviado).
4. Utilizador: `GET /api/v1/auth/invite/validate?token=` → `POST /api/v1/auth/invite/accept` com `password` (mín. 8).
5. Login tenant normal com `tenantSlug` do convite.

Permissões: `platform.users.write` (convite/editar), `platform.users.security` (bloquear, reset, revogar).
