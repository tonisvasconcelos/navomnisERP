# Navomnis ERP

Monorepo enterprise: **React + Vite** (`apps/web`), **NestJS + Prisma** (`apps/api`), **Capacitor** (`apps/mobile`), PostgreSQL, Redis (BullMQ).

## Git workflow

Day-to-day development uses **`develop`** and pull requests; **`main`** is for production releases.

- Branch from `develop`: `git checkout develop && git pull && git checkout -b feature/my-change`
- Open PR **into `develop`** (CI must pass: `quality` + `integration`)
- Release: PR **`develop` → `main`** after staging proof

Full guide: [docs/git-workflow.md](docs/git-workflow.md)

## Pré-requisitos

- Node 20+
- pnpm 9+
- Docker (Postgres + Redis locais)

## Primeiros passos

```bash
cp .env.example .env
docker compose up -d
cd apps/api && pnpm prisma migrate dev && pnpm prisma db seed
```

Na raiz:

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:5173 (proxy `/api` → API)
- API: http://localhost:4000 — Swagger: http://localhost:4000/api/docs

Para processar a fila de e-mails (BullMQ) em desenvolvimento, num segundo terminal:

```bash
pnpm --filter @navomnis/api dev:worker
```

**Demo:** tenant `demo`, usuário `admin@demo.navomnis.local`, senha `Admin123!`

## Testes de integração (local, espelha CI)

Requer **Postgres** e **Redis** (via Docker):

```bash
docker compose up -d
# Aguardar healthchecks; depois na raiz:
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
set RUN_INTEGRATION=1
pnpm run test:integration
```

Em PowerShell use `$env:RUN_INTEGRATION=1` em vez de `set`. Sem Docker, os testes em `apps/api/test/*.integration-spec.ts` são ignorados excepto em CI (`CI=true`).

Prova operacional: ver [docs/release-proof-runbook.md](docs/release-proof-runbook.md) — registo CI em [docs/ci-verification-log.md](docs/ci-verification-log.md), staging em [docs/staging-proof-log.md](docs/staging-proof-log.md) e [docs/v1-internal-test-script.md](docs/v1-internal-test-script.md).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Turbo: web + api em watch |
| `pnpm build` | Build de todos os pacotes |
| `pnpm lint` | ESLint em workspaces |
| `pnpm typecheck` | `tsc --noEmit` em web + api |

## Deploy e nuvem

- **Visão geral**: [docs/deploy-overview.md](docs/deploy-overview.md)
- **Vercel (web)**: [docs/vercel.md](docs/vercel.md)
- **Railway (API + worker)**: [docs/railway.md](docs/railway.md)
- **Cursor + Vercel MCP**: [docs/mcp-vercel.md](docs/mcp-vercel.md)
- **Resolução de problemas**: [docs/troubleshooting.md](docs/troubleshooting.md)

Resumo: frontend na Vercel (`apps/web`); API e worker BullMQ na Railway (mesma imagem Docker ou build Nest; ver `PROCESS_ROLE` e `docs/railway.md`).

## Mobile

Após `pnpm build` na web: `cd apps/mobile && npx cap add ios && npx cap add android` (uma vez), depois `pnpm sync`.

## LGPD e segurança

Fluxo de consentimento e exportação de dados estão modelados na API (`/lgpd/*`). Revise textos legais antes de produção.
