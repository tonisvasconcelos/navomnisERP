# Checklist manual — cenário V1 (espelho do Playwright)

Use este guia para repetir o cenário [v1-scenario.md](./v1-scenario.md) sem automatização. Os passos alinham com `apps/web/e2e/sales-v1.spec.ts` e com `apps/api/test/sales-v1-flow.integration-spec.ts`.

## Pré-requisitos

- API e web configurados conforme [staging.md](./staging.md) (local ou ambiente de teste).
- Utilizador demo: `admin@demo.navomnis.local` / `Admin123!`, tenant `demo`.

## Staging (equipa)

Com API e web **já deployados** em staging e após aplicar [staging-reset.md](./staging-reset.md) quando necessário:

1. Confirmar `GET /api/v1/health` na API de staging e abrir o URL público do front.
2. Executar os **mesmos passos** abaixo no URL de staging (não apenas em localhost).
3. Anotar falhas e regressões (screenshots, hora UTC, utilizador).
4. Opcional: correr Playwright contra staging — ver [ci-integration.md](./ci-integration.md) e script `pnpm run test:e2e:staging` em `apps/web` (requer `PLAYWRIGHT_BASE_URL` no URL do front de staging e build do front com `VITE_API_URL` apontando para a API de staging).

## Passos

1. **Login** — Abrir `/login`, preencher e-mail, palavra-passe e tenant, entrar. Deve redirecionar para o painel.
2. **Novo pedido** — Ir a **Vendas**, criar novo pedido. Estado do pedido deve ser **DRAFT**.
3. **Linha** — Escolher artigo (ex.: ITEM-001), quantidade e preço, **Adicionar linha**. Opcional: **Editar** linha e guardar (PATCH).
4. **Libertar** — Clicar **Libertar pedido**, confirmar no **modal** (não deve aparecer `window.confirm` do browser). Estado passa a **OPEN**.
5. **Inventário** — Ir a **Estoque** / ledger e confirmar movimento **SALES_RELEASE** ligado ao pedido.
6. **Auditoria** — Ir a **Auditoria** (`/audit`) e verificar entradas recentes (`sales_order.create`, `sales_order.release`, etc.), se o utilizador tiver `audit.read`.
7. **Logout** — Sair da sessão e confirmar que refresh deixa de funcionar (revogação), como no teste de integração da API.

## Negativos (API ou Postman)

- Libertar com stock insuficiente → `400`.
- Segunda libertação no mesmo pedido → `400`.
- Criar pedido com empresa sem `UserCompany` para o utilizador → `403`.
