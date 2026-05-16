# Segurança e LGPD (banking)

| Requisito | Implementação |
|-----------|----------------|
| Tokens fora do browser | OAuth callback só na API; web recebe status opaco |
| Criptografia em repouso | `CredentialVaultService` AES-256-GCM, `ENCRYPTION_KEY` |
| Auditoria de acesso | `BankingAccessLog` + ações enum |
| Isolamento tenant | Guards + `tenantId` em todas as queries |
| Logs | Pino redact em `authorization`, `accessToken`, `refreshToken` |
| Revogação | `revokeConsent` + apaga vault |

Próximos passos produção: mTLS ICP-Brasil, PAR/JARM, rotação DEK por tenant, DPO review de finalidade no fluxo de connect.
