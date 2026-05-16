# Registo de prova — staging (V7 Sprint 0)

Preencher após deploy de **API + web** de staging e execução do [v1-internal-test-script.md](./v1-internal-test-script.md). Complementa [staging-rollback-log.md](./staging-rollback-log.md) (drill de restore).

## Pré-requisitos

- Migrações: `pnpm --filter @navomnis/api exec prisma migrate deploy`
- Seed (se ambiente de teste): `pnpm --filter @navomnis/api exec prisma db seed`
- `WEB_URL` na API inclui o domínio do front de staging
- Web build com `VITE_API_URL=https://<api-staging>/api/v1`

## Checklist operacional

| Passo | Feito | Notas |
|-------|:-----:|-------|
| `GET /api/v1/health` OK | ☐ | |
| Login demo no URL de staging | ☐ | |
| Script V1 completo (7 passos) | ☐ | |
| Playwright staging (`PLAYWRIGHT_BASE_URL`) | ☐ | Opcional |
| Defeitos registados no tracker | ☐ | |

## Tabela de execuções

| Data (UTC) | URL front | URL API | Script V1 | Playwright | Responsável | Resultado |
|------------|-----------|---------|-----------|------------|-------------|-----------|
| *—* | *https://…* | *https://…/api/v1* | *OK / FAIL* | *OK / skip* | *nome* | *resumo* |

**Nota (2026-05-16):** staging URL ainda não registado. Após deploy (Railway/Vercel ou equivalente), executar [v1-internal-test-script.md](./v1-internal-test-script.md) passo a passo e marcar o checklist acima. Não substituir por execução apenas local sem URL de staging.

## Referências

- [release-proof-runbook.md](./release-proof-runbook.md)
- [staging.md](./staging.md)
- [audit-v7-readiness.md](./audit-v7-readiness.md)
