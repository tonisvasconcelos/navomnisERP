# Notas de release — V1 testes internos (controlo de âmbito)

Documento para **stakeholders** e equipa de QA: fixa o que o V1 **inclui** e **exclui**, e decisões de segurança aceites para testes internos (auditoria V5 §13 / §17).

## Incluído no V1 interno

- Autenticação (login, refresh, logout) e RBAC por permissões na API.
- Pedidos de venda: rascunho, linhas (incluir/editar/remover), libertação para `OPEN`, validação de stock por ledger, movimentos `SALES_RELEASE`.
- Inventário: artigos, saldos derivados do ledger, visualização do ledger.
- Auditoria: leitura de `AuditLog` para mutações do fluxo.
- CI: job `integration` (migração, seed, testes de integração, API, build web, Playwright) e workflows de qualidade + segurança (ver [security-ci.md](./security-ci.md)).

## Excluído (não posicionar como pronto)

- Faturação, impostos, envio físico, AR/AP, bancos, GL a partir de vendas.
- Compras operacionais completas (fatura fornecedor, AP). **Receção PO** (`POST /purchases/orders/:id/receive`) existe mas **fora do script V1** até alargamento explícito do piloto.
- Open Finance / Banking (`OPEN_FINANCE_ENABLED`) — **fora do script V1**; módulo disponível em sandbox após gate em [open-finance/v1-gate.md](./open-finance/v1-gate.md).
- Armazém por localização, lotes, séries, reservas formais.
- Mobile em produção (Capacitor = invólucro; sem validação de loja).
- Beta público em produção.

## Decisões explícitas de segurança (V1 interno)

| Tópico | Decisão |
|--------|---------|
| **Tokens no browser** | Aceite **localStorage** (access + refresh via Zustand persist) **apenas** para testes internos em ambientes de confiança. Ver [v1-known-limits.md](./v1-known-limits.md). Plano futuro: refresh em HttpOnly cookie. |
| **MFA** | **Fora do âmbito** do V1 interno; não é requisito para esta fase. |
| **Reset de palavra-passe / convites** | Fora do V1 mínimo; administrar utilizadores via seed/ops até haver fluxo. |
| **Vulnerabilidades `pnpm audit` (high)** | CI bloqueia apenas **critical**; triagem e upgrades de *high* são backlog P1 (ver [security-ci.md](./security-ci.md)). |
| **Worker BullMQ (e-mail / filas)** | **Desligado no âmbito V1 interno** por defeito: não é obrigatório deployar `start:worker` em staging nem em piloto controlado. As notificações assíncronas ficam em backlog até haver decisão explícita de ligar worker + prova de saúde (fila, Resend). Ver [staging-reset.md](./staging-reset.md) (nota sobre worker). |

## Prova operacional obrigatória antes de declarar “pronto para testers”

1. Job **`integration`** verde no GitHub na branch acordada.
2. Registar o run em [ci-verification-log.md](./ci-verification-log.md).
3. Staging com URL estável + execução do [v1-internal-test-script.md](./v1-internal-test-script.md).
4. Opcional mas recomendado: uma execução do runbook de reset em [staging-reset.md](./staging-reset.md) e registo em [staging-rollback-log.md](./staging-rollback-log.md).

## Referências

- [audit-v5-readiness.md](./audit-v5-readiness.md)
- [audit-v6-readiness.md](./audit-v6-readiness.md)
- [audit-v7-readiness.md](./audit-v7-readiness.md)
- [staging-proof-log.md](./staging-proof-log.md)
- [v1-scenario.md](./v1-scenario.md)
- [staging-reset.md](./staging-reset.md)
