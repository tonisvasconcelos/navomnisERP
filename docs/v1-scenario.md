# V1 cenário de testes internos (congelado)

**Data de congelamento:** 2026-05-15  
**Mobile V1:** **fora de escopo** — a release de testes internos é **web apenas** até existir navegação móvel utilizável e validação em dispositivo.

## Objetivo

Um único fluxo operacional ponta-a-ponta que equipa de produto e engenharia possam executar na web, contra API real, sem “gymnastics” em Postman.

## Fluxo feliz (MVP de teste)

1. **Autenticação** — login com utilizador do tenant demo; refresh; **logout** (revogação de sessão quando o endpoint existir).
2. **Dados mestres (mínimo)** — cliente (Party/Customer) e artigo (Item) utilizáveis pelo pedido; contas do plano já seedadas.
3. **Pedido de venda** — criar rascunho → editar linhas (quantidade/preço) → **liberar** (`release`) com regras de estado definidas na API.
4. **Inventário** — após libertação, verificar movimento no **ledger** (ou saldo disponível exposto pela API) para o artigo e quantidade do pedido.
5. **Auditoria** — `GET /api/v1/audit/logs` (permissão `audit.read`) e registos `AuditLog` por mutação do fluxo.

## Decisões de produto (audit V2)

- **Estado após libertação:** o pedido passa a `OPEN` (documento operacional libertado). Não existe ainda estado `RELEASED`/`POSTED` nem faturação a partir do pedido.
- **Stock na libertação:** a API **valida saldo** (soma do `ItemLedgerEntry` por artigo) **na mesma transação** que grava os movimentos `SALES_RELEASE`. Stock insuficiente → `400` com mensagem clara.
- **Numeração:** números `PV-####` vêm de série **tenant + código** (`DocumentNumberSeries`), incrementada em transação com a criação do pedido (evita colisão por `count + 1`).

## Fora de escopo V1

- Compras completas, faturação fiscal, bancos, multi-moeda plena.
- App Store / TestFlight / Capacitor além do que já existe como wrapper.
- Offline PWA para mutações.
- Beta multi-cliente em produção.

## Critérios de aceitação

- O cenário está descrito em testes automatizados (API e/ou E2E) ou checklist manual versionado junto com o PR de fecho do fluxo.
- Não há acesso a dados de outro tenant nos passos acima (coberto por testes de isolamento).

## Referências

- [v1-known-limits.md](./v1-known-limits.md) — limites técnicos e de produto (concorrência, `OPEN`, GL, `UserCompany`).
- [v1-release-notes-internal.md](./v1-release-notes-internal.md) — âmbito e decisões do V1 interno (stakeholders).
- [v1-internal-test-script.md](./v1-internal-test-script.md) — checklist manual alinhada ao Playwright.
- [ci-integration.md](./ci-integration.md) — job `integration` no GitHub Actions.
- [audit-v1-readiness.md](./audit-v1-readiness.md) — matriz de lacunas e riscos.
- [audit-v2-readiness.md](./audit-v2-readiness.md) — re-auditoria pós-V1 slice.
- [audit-v5-readiness.md](./audit-v5-readiness.md) — auditoria V5 (readiness e lacunas).
- [staging.md](./staging.md) — staging, migrações e E2E em CI.
- [deploy-overview.md](./deploy-overview.md) — ambientes e variáveis.
