# CI — job `integration`

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) inclui o job **`integration`** (após `quality`), que é o **release gate** operacional descrito nas auditorias V3/V4/V6.

## O que corre neste job

1. Serviços **Postgres 16** e **Redis 7** (containers do GitHub Actions).
2. `pnpm install --frozen-lockfile` na raiz do monorepo.
3. Em `apps/api`: `prisma migrate deploy` e `prisma db seed` (dados demo previsíveis).
4. **`pnpm run test:integration`** em `apps/api` — testes HTTP Jest contra a API (inclui fluxo V1, negativos, RBAC, isolamento de tenant).
5. Build da API e arranque de `node dist/main.js` com health-check em `API_PORT` (4010 no CI).
6. Build do web com `VITE_API_URL` apontando para a API local.
7. **Playwright** (Chromium) em `apps/web` contra o build estático do front.

## Artefactos em caso de falha

- **`playwright-report`** — relatório HTML do Playwright (já existente).
- **`api-integration-log`** — saída completa de `pnpm run test:integration` (`apps/api/integration.log`), útil para diagnóstico de timeouts, migrações ou asserções Jest.

## Estado esperado

Com `main` / `develop` saudáveis, o job **`integration`** deve ficar **verde** em cada push e PR. Qualquer regressão em migração, seed, permissões ou E2E deve ser corrigida antes de alargar testes manuais ou staging.

## Prova operacional (V4 / V6)

O **release gate** é o job `integration` verde no GitHub (ou um ambiente equivalente com os mesmos passos). Mantenha um registo datado em [ci-verification-log.md](./ci-verification-log.md) quando fechar marcos de release interna.

## Playwright contra staging (V6 Sprint 2)

Para repetir o E2E contra o **URL de staging** já deployado (sem `vite preview` local):

1. Garantir que o build do front foi feito com `VITE_API_URL` apontando para a API de staging (mesmo domínio ou CORS já permitido).
2. Na shell, definir `PLAYWRIGHT_BASE_URL` com o URL público do front (ex. `https://staging.example.com`).
3. A partir de `apps/web`: `pnpm run test:e2e:staging` (usa [playwright.config.cjs](../apps/web/playwright.config.cjs); com `PLAYWRIGHT_BASE_URL` o `webServer` local fica desligado).

Os specs em `e2e/` assumem dados demo alinhados com o seed; se staging tiver outro dataset, ajustar credenciais ou usar tenant dedicado de teste.

## Paridade local (Docker)

Na raiz do monorepo:

```bash
docker compose up -d
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
# Linux/macOS:
RUN_INTEGRATION=1 pnpm run test:integration
# Windows PowerShell:
$env:RUN_INTEGRATION='1'; pnpm run test:integration
```

Requisitos: Node 20+, pnpm, Docker com Postgres **5432** e Redis **6379** livres (ver [docker-compose.yml](../docker-compose.yml)). Banking nos testes de integração usa `OPEN_FINANCE_ENABLED=true` apenas no spec `banking-consent-flow`.

Worker BullMQ (opcional, Open Finance sync): segundo terminal com `PROCESS_ROLE=worker` e mesmas variáveis de ambiente — ver [open-finance/observability-runbook.md](./open-finance/observability-runbook.md).

## Registar prova (não inventar resultados)

| Prova | Ficheiro |
|-------|----------|
| CI `integration` verde | [ci-verification-log.md](./ci-verification-log.md) |
| Staging + script V1 + Playwright opcional | [staging-proof-log.md](./staging-proof-log.md) |
| Rollback drill (após execução real) | [staging-rollback-log.md](./staging-rollback-log.md) |
| Runbook unificado | [release-proof-runbook.md](./release-proof-runbook.md) |

## Outros controlos na CI

- [security-ci.md](./security-ci.md) — `pnpm audit --audit-level=critical` (job `quality`) e Gitleaks (`security.yml`).
