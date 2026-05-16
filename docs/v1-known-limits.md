# V1 — limites conhecidos (produto e técnica)

Este documento fixa o que **não** está coberto no slice V1 de vendas/inventário, para alinhar testes internos e auditoria ([audit-v3-readiness.md](./audit-v3-readiness.md), [audit-v4-readiness.md](./audit-v4-readiness.md)).

## Estados e semântica `OPEN`

- Após **libertação** (`POST .../release`), o pedido fica em estado **`OPEN`**: significa “documento libertado para operação interna de teste”, **não** faturado nem expedido.
- Não existe nesta versão transição automática para envio, picking, fatura ou contabilidade (GL).

## Stock e concorrência

- O saldo validado na libertação é a **soma de `ItemLedgerEntry`** por artigo (ledger “simples”), **sem** reservas nem locks pessimistas entre utilizadores.
- A libertação corre **numa única transação** de base de dados: o saldo é relido **dentro dessa transação** antes dos movimentos, o que **reduz** a janela de corrida entre dois libertadores, mas **não a elimina**: dois pedidos concorrentes ainda podem passar em cenários de carga se ambos lerem o mesmo saldo antes de qualquer escrita.
- **Postura V1:** validação interna e equipas pequenas; tratar o ambiente como **baixa concorrência** (idealmente **um escritor de cada vez** por artigo crítico em demos formais). Não posicionar como controlo de stock concorrente de produção nem usar libertações paralelas no mesmo artigo como prova de produção.
- **Piloto interno (V6):** manter a coorte pequena e evitar dois utilizadores a libertar o mesmo artigo em simultâneo em demos formais; qualquer cenário de carga paralela fica **fora** da prova de prontidão até haver spike de reservas ou política explícita em [erp-v1-slice-design.md](./erp-v1-slice-design.md).

## `UserCompany`

- A criação de pedidos e a libertação exigem que o utilizador tenha ligação **`UserCompany`** à empresa do pedido. Utilizadores sem essa ligação recebem `403` mesmo que a empresa pertença ao tenant.

## Autenticação

- Tentativas de login com **palavra-passe errada** para um utilizador existente são registadas em **`AccessLog`** com `success: false` e `reason: 'invalid_password'`. E-mails inexistentes **não** geram linha (evita enumeração trivial de contas).

### Decisão V1 interna — armazenamento de tokens (web)

- O cliente web persiste **access** e **refresh** tokens no **localStorage** (via Zustand persist), o que é **aceitável apenas** para **testes internos controlados** em máquinas e redes de confiança (posição V4: aceitar o risco ou planear mitigação).
- **Não** adequado para beta público em produção sem substituir o refresh por **HttpOnly cookie** (ou equivalente) e rever CORS/CSRF.
- **Próximo passo de produto (fora do V1 mínimo):** planear migração para refresh em cookie + política de sessão; até lá, documentar nos release notes que o V1 interno assume este compromisso.

## Fora de escopo explícito

- Sem documento de transporte, fatura, integração fiscal ou lançamentos GL a partir da libertação.
- Sem motor financeiro completo, fatura de fornecedor, armazéns múltiplos com regras avançadas.
- **Receção de compras (slice B):** `POST /purchases/orders/:id/receive` regista entrada positiva no ledger por linha; **sem** lotes/FEFO, custo médio ou fatura; segunda receção além da quantidade pedida é rejeitada.
- **MFA:** explicitamente **fora do âmbito** do V1 interno actual; pode entrar no roadmap pós-validação (ver [v1-release-notes-internal.md](./v1-release-notes-internal.md)).

## Referências

- [v1-scenario.md](./v1-scenario.md) — fluxo feliz congelado.
- [staging.md](./staging.md) — E2E e CI.
- [staging-reset.md](./staging-reset.md) — reset, seed, worker, rollback drill.
- [ci-integration.md](./ci-integration.md) — job `integration` no GitHub Actions.
- [security-ci.md](./security-ci.md) — auditoria de dependências e Gitleaks na CI.
- [v1-release-notes-internal.md](./v1-release-notes-internal.md) — âmbito e decisões de release V1 interno.
