# Observability — Open Finance (Railway)

## Secrets (API + worker)

| Variável | Uso |
|----------|-----|
| `OPEN_FINANCE_ENABLED` | `true` só pós-gate V1 |
| `ENCRYPTION_KEY` | Vault de tokens |
| `OF_CLIENT_ID`, `OF_REDIRECT_URI`, `OF_DIRECTORY_URL` | OAuth sandbox |
| `MTLS_CERT`, `MTLS_KEY` | Futuro: cliente HTTP mTLS (não usado no mock) |
| `REDIS_URL` | BullMQ |
| `PROCESS_ROLE` | `api` vs `worker` |

## Worker

Serviço Railway separado ou mesmo imagem com `PROCESS_ROLE=worker`:

- Processa `bank-sync`, `bank-consent` (expiração horária)
- Não expor portas HTTP

### Smoke local (após OAuth callback)

1. `docker compose up -d` e `OPEN_FINANCE_ENABLED=true` na API.
2. Terminal A: `pnpm --filter @navomnis/api start:dev` com `PROCESS_ROLE=api`.
3. Terminal B: `PROCESS_ROLE=worker pnpm --filter @navomnis/api start:dev`.
4. Completar fluxo connect no web; verificar `BankSyncJob` com `status=COMPLETED` e contas em `BankAccount`.

## Logs estruturados

Monitorizar:

- `BankSyncJob` com `status=FAILED` → `errorMessage`
- Consentimentos `EXPIRED` / `REVOKED`
- Backlog: transações sem `ReconciliationMatch` confirmado

## Rollback

1. `OPEN_FINANCE_ENABLED=false` — API retorna 404 em banking
2. Worker pode permanecer; filas drenam sem novos jobs
3. Dados banking permanecem no Postgres (migração aditiva)
