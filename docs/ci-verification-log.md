# Registo de verificação — job `integration` (GitHub Actions)

Este ficheiro é **manual**: após cada verificação importante do pipeline, atualize a tabela para o repositório refletir a prova operacional pedida nas auditorias V4/V6/V7 ([audit-v4-readiness.md](./audit-v4-readiness.md) §12, §18; [audit-v6-readiness.md](./audit-v6-readiness.md) §13; [audit-v7-readiness.md](./audit-v7-readiness.md) §13–17 Sprint 0).

## Como verificar no GitHub

1. Abrir **Actions** no repositório e selecionar o workflow **CI**.
2. Escolher o **run** mais recente na branch alvo (`main` / `develop` ou PR).
3. Confirmar que o job **`integration`** está **verde** (ícone de sucesso).
4. Jobs anteriores: **`quality`** deve também estar verde.
5. Em caso de falha, descarregar os artefactos:
   - **`api-integration-log`** — saída Jest (`apps/api/integration.log` no runner).
   - **`playwright-report`** — relatório HTML do Playwright.

## Verificação local (opcional)

Com Postgres e Redis acessíveis na `DATABASE_URL` / `REDIS_URL` (por exemplo `docker compose up -d` na raiz):

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm run test:integration
```

Depois, na raiz: build API, arrancar API, build web com `VITE_API_URL`, e `pnpm --filter @navomnis/web exec playwright test` — espelha o CI (ver [ci-integration.md](./ci-integration.md)).

## Tabela de registo

| Data (UTC) | Branch | Commit (curto) | integration | Notas / link run |
|--------------|--------|----------------|-------------|------------------|
| 2026-05-16 | main | d0a66fd | *aguardar confirmação* | [Actions CI](https://github.com/tonisvasconcelos/navomnisERP/actions/workflows/ci.yml) — push inicial `chore: initial monorepo…`; confirmar job **integration** verde e actualizar coluna para `verde`. |

Paridade local: [ci-integration.md](./ci-integration.md) (requer Docker ou Postgres/Redis locais; Docker não disponível na máquina de desenvolvimento que registou este commit).

**Nota (V6 Sprint 1):** o preenchimento da linha acima exige acesso ao GitHub Actions no repositório remoto. Em ambiente sem `gh` CLI, abrir o repositório no browser, copiar o URL do run verde e colar na coluna final. Paridade local opcional: secção “Verificação local” + [ci-integration.md](./ci-integration.md).

Após o primeiro run verde, alinhar também [v1-release-notes-internal.md](./v1-release-notes-internal.md) (prova operacional na secção final).

Runbook completo (CI + staging + Playwright + rollback): [release-proof-runbook.md](./release-proof-runbook.md).

**Open Finance:** só ativar `OPEN_FINANCE_ENABLED=true` em staging/produção após esta tabela + [staging-proof-log.md](./staging-proof-log.md) preenchidos (gate em [open-finance/v1-gate.md](./open-finance/v1-gate.md)).
