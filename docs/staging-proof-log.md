# Registo de prova — staging (V7 Sprint 0)

Preencher após deploy de **API + web + admin** de staging e execução do [v1-internal-test-script.md](./v1-internal-test-script.md). Complementa [staging-rollback-log.md](./staging-rollback-log.md) (drill de restore).

## Pré-requisitos

- Migrações: `pnpm --filter @navomnis/api exec prisma migrate deploy` (via `DATABASE_PUBLIC_URL` ou pre-deploy na Railway)
- Seed (staging): `pnpm --filter @navomnis/api exec prisma db seed`
- `WEB_URL` + `ADMIN_WEB_URL` na API incluem domínios Vercel de staging
- Web/admin build com `VITE_API_URL=https://api-staging-fa90.up.railway.app/api/v1` **antes** de `vite build` / deploy prebuilt

## Checklist operacional

| Passo | Feito | Notas |
|-------|:-----:|-------|
| `GET /api/v1/health` OK | ☑ | |
| `GET /api/v1/health/db` OK | ☑ | |
| Login demo (API) | ☑ | `admin@demo.navomnis.local` / tenant `demo` |
| Platform login (API) | ☑ | `admin@platform.navomnis.local` |
| Platform metrics (API) | ☑ | |
| Tenant JWT → `/platform/tenants` bloqueado | ☑ | 401 |
| Railway worker online | ☑ | |
| Frontends rebuild com `VITE_API_URL` | ☑ | Prebuilt deploy 2026-05-18 |
| **Deployment Protection desligado** | ☑ | Confirmado 2026-05-18 em `web` e `navomnis-admin` (Require Log In OFF) |
| Login demo no URL Vercel web | ☐ | Após desligar protection |
| Login admin no URL Vercel admin | ☐ | Após desligar protection |
| Script V1 completo (7 passos) | ☐ | Browser |
| Playwright staging | ☐ | Opcional |

## URLs (2026-05-18)

| App | URL |
|-----|-----|
| API | https://api-staging-fa90.up.railway.app/api/v1 |
| Web | https://web-oss365.vercel.app |
| Admin | https://navomnis-admin-oss365.vercel.app |

Últimos deploys prebuilt: `web` F3Lq19yRU7HkEzeqD5TSN8F5RSAe, `navomnis-admin` 3gLJrXbGS8mvwqvRnHrkmiRa9x58.

## Railway CORS (se login browser falhar por CORS)

Com `railway login`, no serviço `api` / env `staging`:

```text
WEB_URL=https://web-oss365.vercel.app
ADMIN_WEB_URL=https://navomnis-admin-oss365.vercel.app,https://navomnis-admin.vercel.app
```

(CSV; inclua URLs de deployment extra se necessário.)

## Tabela de execuções

| Data (UTC) | URL front | URL admin | URL API | Script V1 | Platform smoke | Responsável | Resultado |
|------------|-----------|-----------|---------|-----------|----------------|-------------|-----------|
| 2026-05-18 | https://web-oss365.vercel.app (prebuilt + API URL no bundle) | https://navomnis-admin-oss365.vercel.app (idem) | https://api-staging-fa90.up.railway.app/api/v1 | Pendente (browser) | API OK | Toni Vasconcelos | **Bundles corrigidos**; desligar Vercel Authentication para teste UI |

## GitHub secrets (CI deploy)

| Secret | Valor / origem |
|--------|----------------|
| `VERCEL_ORG_ID` | `team_VTLR2O8dPIC8E0ogQi93uCk9` |
| `VERCEL_PROJECT_ID` | `prj_lB9fMjqKg7uj2CMaSh0slXuUR3XP` (web) |
| `VERCEL_ADMIN_PROJECT_ID` | `prj_tCK7lc0TV4fHOMnK4tpfkSrQD4Ax` (admin) |
| `VERCEL_TOKEN` | Token pessoal Vercel |
| `RAILWAY_TOKEN` | Token Railway (opcional) |

## Referências

- [staging.md](./staging.md) — Deployment Protection + prebuilt
- [vercel.md](./vercel.md#deploy-prebuilt-cli)
- [staging-platform-admin-smoke.md](./staging-platform-admin-smoke.md)
- [railway.md](./railway.md)
