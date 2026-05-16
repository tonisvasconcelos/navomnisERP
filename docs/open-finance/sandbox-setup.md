# Sandbox Open Finance

## Variáveis (API)

```env
OPEN_FINANCE_ENABLED=true
ENCRYPTION_KEY=<32+ chars secret>
OF_DIRECTORY_URL=https://data.sandbox.directory.openbankingbrasil.org.br
OF_CLIENT_ID=<sandbox TPP client id>
OF_REDIRECT_URI=http://localhost:4000/api/v1/banking/oauth/callback
WEB_URL=http://localhost:5173
```

## Seed

`pnpm --filter @navomnis/api prisma db seed` cria instituições sandbox (Itaú, Bradesco, Nubank) e permissões `banking.*` no role Administrador.

## Cliente HTTP

Implementação atual: `SandboxOpenFinanceClient` (fixtures). Substituir por cliente mTLS/FAPI quando homologação BACEN avançar — mesma interface `OpenFinanceClient`.

## Teste local

1. Postgres + Redis (`docker compose up -d`)
2. Migração: `pnpm --filter @navomnis/api prisma migrate deploy`
3. API com `OPEN_FINANCE_ENABLED=true`
4. Worker: `PROCESS_ROLE=worker pnpm --filter @navomnis/api start:dev`
5. Web → Banking → Conectar banco
