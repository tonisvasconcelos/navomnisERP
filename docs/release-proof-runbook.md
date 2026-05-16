# Runbook — prova de release V1 interno (pós-auditoria V7)

Objectivo: registar **prova operacional** sem inventar resultados. Use os ficheiros de log indicados; deixe placeholders até executar em GitHub/staging.

Fluxo Git: integração contínua em **`develop`** (PRs); release para **`main`** — ver [git-workflow.md](./git-workflow.md).

## 1. CI — job `integration` (GitHub Actions)

| Passo | Comando / acção | Registo |
|-------|-----------------|--------|
| 1 | Push/merge na branch alvo (`main` / `develop` ou PR) | — |
| 2 | Actions → workflow **CI** → job **`integration`** verde | [ci-verification-log.md](./ci-verification-log.md) |
| 3 | Em falha: artefactos `api-integration-log`, `playwright-report` | Ticket interno |

Detalhe do job: [ci-integration.md](./ci-integration.md).

## 2. Integração API (local ou CI)

Pré-requisitos: Postgres + Redis (`docker compose up -d` na raiz).

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
# PowerShell:
$env:RUN_INTEGRATION=1; pnpm run test:integration
# bash:
RUN_INTEGRATION=1 pnpm run test:integration
```

Inclui: fluxo V1 vendas, RBAC, isolamento de tenant, `/auth/me`, throttle de login, **filtros de auditoria**.

## 3. Playwright (local, espelha CI)

```bash
docker compose up -d
cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma db seed
# Terminal 1 — API na porta 4000
pnpm --filter @navomnis/api start
# Terminal 2 — build + E2E
$env:VITE_API_URL="http://127.0.0.1:4000/api/v1"
pnpm --filter @navomnis/web build
pnpm --filter @navomnis/web run test:e2e
```

## 4. Playwright contra staging

1. Deploy API + web; `migrate deploy` + seed se aplicável.
2. Build web com `VITE_API_URL=https://<api-staging>/api/v1`.
3. `PLAYWRIGHT_BASE_URL=https://<front-staging> pnpm --filter @navomnis/web run test:e2e:staging`

Registar em [staging-proof-log.md](./staging-proof-log.md).

## 5. Script manual V1 em staging

Seguir [v1-internal-test-script.md](./v1-internal-test-script.md) no URL público do front de staging. Anotar resultado na mesma tabela de [staging-proof-log.md](./staging-proof-log.md).

## 6. Rollback / restore (recomendado antes de alargar piloto)

Runbook: [staging-reset.md](./staging-reset.md) (secção drill). Registo: [staging-rollback-log.md](./staging-rollback-log.md) — **só preencher após execução real**.

## Critérios go / no-go (V1 interno)

| Critério | Obrigatório |
|----------|-------------|
| Job `integration` verde + linha em `ci-verification-log.md` | Sim |
| Staging: health + script V1 | Sim |
| Rollback drill documentado | Recomendado |
| Playwright staging | Opcional |
| Worker BullMQ | Fora do âmbito por defeito ([v1-release-notes-internal.md](./v1-release-notes-internal.md)) |

## Referências

- [audit-v7-readiness.md](./audit-v7-readiness.md)
- [v1-release-notes-internal.md](./v1-release-notes-internal.md)
- [security-ci.md](./security-ci.md)
