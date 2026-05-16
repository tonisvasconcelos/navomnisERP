# Open Finance Brasil — arquitetura

Bounded context `banking/` na API NestJS (`apps/api/src/modules/banking`), dados em PostgreSQL via Prisma.

## Módulos

| Módulo | Responsabilidade |
|--------|------------------|
| `open-finance` | Cliente sandbox, catálogo de instituições |
| `bank-connections` | Conexão empresa ↔ instituição |
| `consent-management` | OAuth2 + PKCE, callback servidor, revogação |
| `bank-sync` | Jobs BullMQ, contas, saldos, transações |
| `reconciliation` | Matchers + ponte para `BankLedgerEntry` / AR / AP |
| `pix` | Filtro leitura Pix / E2E |
| `finance-bridge` | Lançamento em `BankLedgerEntry` após confirmação |

## Multi-tenant

Todas as entidades operacionais incluem `tenantId` e `companyId`. Tokens em `BankCredentialVault` (AES-256-GCM). **Nunca** expor tokens ao frontend.

## Feature flag

`OPEN_FINANCE_ENABLED=true` habilita rotas `/api/v1/banking/*`. Padrão: `false` até prova operacional V1 ([`v1-gate.md`](./v1-gate.md)).

## Filas (worker)

- `bank-sync` — sincronização
- `bank-consent` — expiração de consentimentos (repeatable 1h)
- `bank-reconciliation` — reservada para jobs assíncronos futuros

`PROCESS_ROLE=worker` no Railway/local para processadores.
