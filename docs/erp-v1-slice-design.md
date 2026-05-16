# Próximo slice ERP pós-V1 interno — decisão de produto (V7 Sprint 3)

Este documento **não** implementa código de rececionamento: fixa a decisão formal e critérios de aceite antes do desenvolvimento (auditoria V7 §17 Sprint 3).

## Regra

Escolher **exactamente um** eixo; não abrir faixas paralelas até o slice estar estável em staging.

## Decisão formal

| Campo | Valor |
|-------|--------|
| **Slice escolhido** | **B — Rececionamento de compras (PO → entrada de stock)** |
| **Data** | 2026-05-16 |
| **Responsável** | Equipa produto / engenharia (predefinição técnica V7; assinatura stakeholder pendente) |

## Critérios de aceite (mínimo para declarar slice concluído)

1. Utilizador com `purchases.write` cria ou selecciona PO em estado recebível e regista **receção** com quantidades por linha.
2. Receção gera movimentos **positivos** no `ItemLedgerEntry` na mesma transação DB que valida quantidades.
3. Listagem de stock/ledger reflecte a entrada; auditoria regista `purchase_order.receive` (ou equivalente).
4. Testes de integração HTTP cobrem fluxo feliz e negativos (quantidade inválida, segunda receção duplicada, RBAC).
5. Documentação de limites actualizada (sem reservas formais; concorrência baixa como V1 vendas).

## Fora deste slice

- Faturação fornecedor, AP, GL, impostos.
- Multi-armazém, lotes, séries, custo médio avançado.
- Opções A (fatura+AR/GL) e C (reservas/armazém) até conclusão de B.

## Referências

- [v1-scenario.md](./v1-scenario.md)
- [audit-v7-readiness.md](./audit-v7-readiness.md)
- [v1-known-limits.md](./v1-known-limits.md)
