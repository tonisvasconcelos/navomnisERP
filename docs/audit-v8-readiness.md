# Navomnis ERP — post-V7 scan delta (2026-05-16)

Complementa [audit-v7-readiness.md](./audit-v7-readiness.md) sem substituir a auditoria V7. Regista o que entrou no repositório **depois** do relatório V7.

## Entregas desde V7

| Área | Estado |
|------|--------|
| **Open Finance Brasil** | Módulo `banking/` (schema, API, vault, OAuth sandbox, sync, reconciliação, web). Flag `OPEN_FINANCE_ENABLED` (predefinição `false`). Docs em [open-finance/](./open-finance/). |
| **Testes unitários API** | 6 suites Jest: auth, audit, sales, banking (vault, consent FSM, reconciliation matcher). |
| **Testes integração** | + `audit-filters`, `purchases-receive`, `banking-consent-flow` (além dos fluxos V1 existentes). |
| **Slice ERP B** | Decisão formal em [erp-v1-slice-design.md](./erp-v1-slice-design.md); implementação `POST /purchases/orders/:id/receive` + permissão `purchases.write`. |
| **Swagger produção** | Basic Auth + `SWAGGER_ENABLED` (ver [security-ci.md](./security-ci.md)). |

## Ainda em aberto (inalterado vs V7)

- Prova CI `integration` registada em [ci-verification-log.md](./ci-verification-log.md).
- Prova staging em [staging-proof-log.md](./staging-proof-log.md).
- Drill rollback em [staging-rollback-log.md](./staging-rollback-log.md).
- Proveniência Git: primeiro commit/push para remote com SHA rastreável.
- Beta produção / mobile certificado / GL completo.

## Gates

| Gate | Regra |
|------|--------|
| V1 testers | CI + staging V1 script ([release-proof-runbook.md](./release-proof-runbook.md)) |
| Open Finance em staging | [open-finance/v1-gate.md](./open-finance/v1-gate.md) |

## Veredito

**V1 interno:** condicional GO após prova operacional (sem mudança de veredito V7).  
**Código:** mais maduro que o texto V7 §15 (unit tests, OF, receção PO); **release gate continua operacional.**
