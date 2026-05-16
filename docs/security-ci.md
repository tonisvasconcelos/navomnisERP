# Segurança na CI (V4 Sprint 2)

## Dependências

O job **`quality`** em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) executa:

```bash
pnpm audit --audit-level=critical
```

Isto falha apenas com vulnerabilidades **críticas** reportadas pelo ecossistema npm/pnpm. Vulnerabilidades *high* transitivas (ex. `glob`/`tar` via Capacitor CLI, `multer` via Nest) continuam visíveis com `pnpm audit` local e devem ser tratadas em atualizações planeadas. O cliente **Playwright** em `apps/web` foi actualizado para **≥1.55.1** para fechar o advisory GHSA de SSL no download de browsers.

## Segredos no repositório

O workflow [`.github/workflows/security.yml`](../.github/workflows/security.yml) corre **Gitleaks** em push/PR às branches `main` e `develop`, para detetar segredos acidentalmente commitados.

Recomendação: ativar também **GitHub Advanced Security / secret scanning** no repositório (se disponível na organização), em complemento ao Gitleaks.

## Triagem `pnpm audit` — *high* (V6 Sprint 2)

O job `quality` **não** falha com *high*; a mesma execução local `pnpm audit --audit-level=high` pode ainda listar cadeias transitivas. Estado típico do monorepo (revisão manual):

| Pacote / cadeia | Âmbito | Postura |
|-----------------|--------|---------|
| `glob` (CLI injection) via `@nestjs/cli` | DevDependency (build) | Aceite risco de **dev** até upgrade do ecossistema Nest CLI; não afecta runtime da API em produção. |
| `tar` via `@capacitor/cli` | `apps/mobile` | Risco em ferramentas de build/sync; actualizar Capacitor CLI quando houver release com `tar` ≥ 7.5.8. |
| `multer` via `@nestjs/platform-express` | Runtime API (uploads) | Override raiz `multer@^2.1.1` em `package.json` (pnpm); validar com `pnpm build` e testes após `pnpm install`. |

Registar upgrades efectivos nas notas de release quando fechar itens.

## Revisão 2026-05-16 (pós-scan V8)

- `multer` — override raiz `^2.1.1` mantido; validar após cada `pnpm install`.
- `glob` / `@nestjs/cli` — permanece *high* em devDependencies; sem impacto runtime API.
- `tar` / `@capacitor/cli` — permanece *high* em `apps/mobile`; actualizar Capacitor CLI quando release estável incluir `tar` ≥ 7.5.8.
- CI continua a bloquear apenas **critical**; contagem *high* local deve ser revalidada após push (job `quality`).

## Login e rate limiting (V7)

- **`POST /api/v1/auth/login`:** `@Throttle({ default: { limit: 15, ttl: 60_000 } })` — 15 tentativas por minuto por IP (comportamento global do `ThrottlerGuard` do Nest).
- **Armazenamento:** o throttler usa armazenamento **em memória por instância** (predefinição `@nestjs/throttler`). Em deploy com **várias réplicas** da API, o limite efectivo é por réplica, não global — aceitável para V1 interno; para beta, planear storage Redis partilhado.
- **Teste HTTP:** `apps/api/test/auth-login-throttle.integration-spec.ts` (429 + `Retry-After`).

## Swagger em produção (V7 Sprint 1)

Em `NODE_ENV=production`, OpenAPI só é exposto quando **`SWAGGER_ENABLED=true`** e **`SWAGGER_BASIC_USER`** + **`SWAGGER_BASIC_PASSWORD`** estão definidos (Basic Auth em `/api/docs`). Em desenvolvimento, Swagger fica activo por defeito excepto se `SWAGGER_ENABLED=false`.

## Referências

- [audit-v4-readiness.md](./audit-v4-readiness.md) — matriz de riscos e prioridades.
- [ci-integration.md](./ci-integration.md) — gate `integration`.
