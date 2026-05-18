# Railway — API + worker + dados

## Projeto ligado a este repositório

- **Projeto**: [patient-youth](https://railway.com/project/9d940007-4e9f-4d82-95e7-96aa44bff4e5) (`9d940007-4e9f-4d82-95e7-96aa44bff4e5`)
- **Ambiente staging**: duplicado a partir de production (Postgres + Redis com URLs internas)
- **MCP**: `railway setup agent -y` — reinicie o Cursor; se MCP falhar auth, use CLI (`railway login`)

## Serviços (staging)

| Serviço | ID | Estado | Notas |
|---------|-----|--------|-------|
| Postgres | (plugin) | Online | `DATABASE_PUBLIC_URL` para migrate local |
| Redis-o1_P | (plugin) | Online | `REDIS_URL` interno |
| **api** | `ca68752f-b002-4877-a988-324bfda022d0` | **Online** | https://api-staging-fa90.up.railway.app |
| **worker** | `a72ab94e-6b69-4165-8421-3b1b8424f20c` | **Online** | `node apps/api/dist/worker.main.js`, sem healthcheck HTTP |

## Imagem Docker (raiz)

- [`Dockerfile`](../Dockerfile) — `openssl` + `libc6-compat` para Prisma em Alpine
- [`railway.toml`](../railway.toml) — builder Dockerfile; healthcheck só no serviço `api` (config Railway)

```bash
railway link   # patient-youth
railway up -s api -e staging
railway up -s worker -e staging
```

## Variáveis (api, staging)

| Variável | Exemplo / notas |
|----------|-----------------|
| `DATABASE_URL` | Referência Postgres (interno) |
| `REDIS_URL` | Referência Redis (interno) |
| `NODE_ENV` | `production` |
| `PROCESS_ROLE` | `api` |
| `WEB_URL` | CSV Vercel web, ex. `https://web-oss365.vercel.app` |
| `ADMIN_WEB_URL` | CSV Vercel admin |
| `JWT_*` / `PLATFORM_JWT_*` | ≥32 chars, distintos entre tenant e platform |
| `SWAGGER_ENABLED` | `false` em staging público |

Worker: `PROCESS_ROLE=worker`, mesmas DB/Redis/JWT/WEB_URL, `RESEND_API_KEY` (placeholder aceite em staging).

## Migrações e seed

**Não** usar `railway run` para migrate a partir do PC (URL `*.railway.internal` não resolve).

1. Migrações locais com URL pública:

```powershell
cd apps/api
$env:DATABASE_URL="<DATABASE_PUBLIC_URL do Postgres staging>"
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

2. Ou pre-deploy na Railway (rede interna): `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`

> Ficheiro `20260515200000_init/migration.sql` foi corrigido (remoção de BOM UTF-8).

## Health

- `GET https://api-staging-fa90.up.railway.app/api/v1/health`
- `GET …/health/db` — Postgres
- `GET …/health/redis` — Redis

## Worker

- Start: `node apps/api/dist/worker.main.js`
- Sem listener HTTP → desativar `healthcheckPath` no serviço worker (config via `railway environment edit` JSON)
- Local: `pnpm --filter @navomnis/api dev:worker`

## Scripts CLI

Ver [scripts/railway/README.md](../scripts/railway/README.md).
