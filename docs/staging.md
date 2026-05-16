# Staging e releases

## Objetivo

Ambiente de **staging** espelha produção o suficiente para validar migrações Prisma, variáveis e o cenário V1 ([v1-scenario.md](./v1-scenario.md)) antes de promover para produção.

**Runbook detalhado (reset, seed, worker, rollback drill):** [staging-reset.md](./staging-reset.md).

## Variáveis (API)

| Variável | Notas |
|----------|--------|
| `DATABASE_URL` | Postgres dedicado a staging (não partilhar credenciais com prod). |
| `REDIS_URL` | Instância Redis de staging. |
| `NODE_ENV` | `production` em staging real para validar CORS, secrets e gates (ex.: Swagger). |
| `WEB_URL` | Origem(s) do front de staging (CSV se várias), ex.: `https://staging.navomnis.example`. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Mínimo 32 caracteres quando `NODE_ENV=production`. |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Alinhar com política de sessão acordada. |
| `SWAGGER_ENABLED` | Manter `false` em staging público; se `true`, exigir também `SWAGGER_BASIC_USER` / `SWAGGER_BASIC_PASSWORD` (ver [security-ci.md](./security-ci.md)). |

## Migrações (release)

1. Correr `pnpm --filter @navomnis/api exec prisma migrate deploy` no **serviço API** antes ou no arranque do novo deploy (Railway: comando de release / Docker `CMD` em duas fases).
2. Correr `pnpm --filter @navomnis/api exec prisma db seed` apenas onde fizer sentido (nunca em produção com dados reais sem controlo).
3. Manter backups automáticos do Postgres de staging para rollback de schema.

## Web (Vercel) + API (Railway)

- Build do web com `VITE_API_URL` apontando para a URL pública da API de staging (`…/api/v1`).
- Garantir que `WEB_URL` na API inclui o domínio do preview Vercel se se testar PR previews.

## E2E Playwright (local ou CI)

1. Subir Postgres + Redis (`docker compose up -d` na raiz do repositório).
2. `DATABASE_URL=… pnpm --filter @navomnis/api exec prisma migrate deploy` e `prisma db seed`.
3. Arrancar a API (`pnpm --filter @navomnis/api dev` ou `start`) na porta esperada pelo `VITE_API_URL`.
4. `VITE_API_URL=http://127.0.0.1:4000/api/v1 pnpm --filter @navomnis/web build`
5. `pnpm --filter @navomnis/web exec playwright install` (primeira vez) e `pnpm --filter @navomnis/web run test:e2e`

O workflow `.github/workflows/ci.yml` executa estes passos (com portas fixas) no job `integration`. Em caso de falha do Playwright, o relatório HTML é publicado como **artifact** `playwright-report`. Em caso de falha dos testes Jest de integração da API, a saída completa é publicada como **artifact** `api-integration-log` (ver [ci-integration.md](./ci-integration.md)).

## Reset da base de dados de teste (CI / local)

Para E2E e integração com dados previsíveis (seed demo):

1. **CI:** cada job `integration` usa Postgres efémero; `migrate deploy` + `db seed` repõem o estado — não é necessário limpar manualmente.
2. **Local:** `docker compose down -v` (apaga volume Postgres) **ou** `pnpm --filter @navomnis/api exec prisma migrate reset` (recria schema e corre seed) antes de `test:integration` / E2E.

## E2E contra staging

1. Deploy API + web de staging (ver [staging-reset.md](./staging-reset.md) para reset/seed e decisão de worker).
2. Build do web com `VITE_API_URL=https://<api-staging>/api/v1`.
3. `pnpm --filter @navomnis/web run test:e2e` (ou workflow manual no GitHub que injete a URL).

## Railway (deploy)

Preferir **integração Git** da Railway com branch `develop` → staging e `main` → produção. O ficheiro [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) contém um gancho opcional por CLI; ajuste o serviço e o projeto antes de confiar no pipeline.
