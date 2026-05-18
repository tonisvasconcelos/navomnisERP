# Resolução de problemas — CI / deploy / runtime

## CI (GitHub Actions)

- **`pnpm install --frozen-lockfile` falha**: atualize o lockfile localmente com `pnpm install` e commit `pnpm-lock.yaml`.
- **`prisma format --check`**: execute `pnpm exec prisma format` em `apps/api` e volte a commitar.
- **`pnpm typecheck`**: corrija erros `tsc` em `apps/web` ou `apps/api`.

## Prisma / base de dados

- **`P1001` / connection refused**: `DATABASE_URL` incorreto ou Postgres inacessível na rede.
- **Migrações pendentes**: na Railway, execute `migrate:deploy` na fase de release antes de subir a nova versão.

## Redis / BullMQ

- **Jobs não processam**: confirme o serviço `worker` com `PROCESS_ROLE=worker` e o mesmo `REDIS_URL` que a API.
- **`ECONNREFUSED`**: URL Redis interna errada ou serviço Redis parado.

## Vercel (web e admin)

- **Página em branco / `Variáveis de ambiente do frontend inválidas`**: o bundle foi construído sem `VITE_API_URL`. Corra `pnpm run build:staging-front` (ou defina `VITE_API_URL` antes de `vite build`) e volte a fazer deploy prebuilt — ver [vercel.md](./vercel.md#deploy-prebuilt-cli).
- **Admin login 405 em `/api/v1/...`**: o front está a chamar a origem Vercel (fallback antigo). Rebuild com `VITE_API_URL` absoluto para a API Railway.
- **401 em `manifest.webmanifest` ou assets**: **Deployment Protection** (Vercel Authentication) ativo — desligar no painel ou usar Shareable Link.
- **Build sem `VITE_API_URL` em produção**: validação em `apps/web/src/env.ts` e `apps/admin/src/env.ts`.
- **CORS no browser**: origens do web em `WEB_URL` e do admin em `ADMIN_WEB_URL` (CSV) na API.

## Docker

- **`pnpm install` no build Docker falha**: confirme que existem `package.json` de todos os workspaces referenciados em `pnpm-workspace.yaml` (o `Dockerfile` copia `apps/web` e `apps/mobile` como stubs mínimos).

## Health checks

- `GET /api/v1/health/db` — Prisma `SELECT 1`
- `GET /api/v1/health/redis` — ping Redis
- `GET /api/v1/health/queues` — contagens da fila `notifications`

Use estes endpoints para distinguir falhas de API vs dados vs fila.
