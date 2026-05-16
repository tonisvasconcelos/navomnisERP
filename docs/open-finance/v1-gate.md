# Gate V1 antes de Open Finance “live”

Open Finance foundation pode ser desenvolvido em paralelo ao piloto V1, mas **habilitação em staging/produção** (`OPEN_FINANCE_ENABLED=true`) deve seguir a prova operacional V1:

1. Job CI `integration` verde — registar em [`../ci-verification-log.md`](../ci-verification-log.md)
2. Script staging V1 executado — registar em [`../staging-proof-log.md`](../staging-proof-log.md)
3. Runbook: [`../release-proof-runbook.md`](../release-proof-runbook.md)

**Estado:** placeholders nos logs até execução real (não inventar URLs/commits).

Após o gate: ativar sandbox OAuth, validar sync idempotente e conciliação com dados demo.
