# Registo — drill de rollback / restore (staging)

Use este ficheiro após executar o runbook em [staging-reset.md](./staging-reset.md) (secção “drill de rollback / restore”). O objectivo é **provar** que a equipa consegue repor staging sem adivinhar (gap V5 §13 High).

## Instruções

1. Planear a janela (avisar testers).
2. Seguir os passos do runbook de drill.
3. Preencher uma linha na tabela abaixo com resultado honesto (sucesso / falha parcial / bloqueado).

## Tabela de execuções

| Data (UTC) | Responsável | Ambiente (URL ou nome) | Método (snapshot / migrate reset / outro) | Duração aprox. | Resultado | Notas / link ticket |
|------------|----------------|-------------------------|---------------------------------------------|----------------|-----------|----------------------|
| *—* | *preencher após drill real em staging* | *staging* | *ex.: snapshot RDS restore* | *ex.: 25 min* | *OK / FAIL* | *lacunas encontradas* |

*(Opcional V6 §16 Sprint 1: executar o drill antes de alargar o piloto; até lá a linha pode ficar por preencher — não substitui o registo honesto após a execução.)*

## Critérios de sucesso mínimos

- API responde a `/api/v1/health`.
- Login demo funciona.
- É possível criar um pedido em rascunho e libertar (fluxo mínimo V1).
