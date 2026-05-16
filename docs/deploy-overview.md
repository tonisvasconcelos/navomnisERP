# Visão geral do deploy

Arquitetura alvo:

- **Vercel**: aplicação SPA em `apps/web` (build Vite, `vercel.json` com rewrites e cabeçalhos).
- **Railway**: `api` (HTTP Nest, `PROCESS_ROLE=api` ou omisso), `worker` (BullMQ, `PROCESS_ROLE=worker`), Postgres e Redis na mesma rede privada.

Fluxo de dados:

1. O browser fala HTTPS com a API pública na Railway (`VITE_API_URL` no build da web).
2. A API usa `DATABASE_URL` e `REDIS_URL` internos.
3. O worker consome a mesma fila Redis e envia e-mail (Resend) quando configurado.

## Matriz de variáveis (resumo)

| Variável | Onde | Notas |
|----------|------|--------|
| `DATABASE_URL` | API, worker | Postgres |
| `REDIS_URL` | API, worker | BullMQ |
| `WEB_URL` | API | CSV de origens CORS; em produção não pode ser só localhost |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | API | ≥32 caracteres em produção |
| `PROCESS_ROLE` | API vs worker | `api` (predefinido) ou `worker` |
| `RESEND_API_KEY` | Worker (prod) | Obrigatório se o worker envia e-mail |
| `VITE_API_URL` | Build web | Em produção é obrigatório (URL absoluta da API) |

## Secrets GitHub (workflow `deploy.yml`)

| Secret | Uso |
|--------|-----|
| `VERCEL_TOKEN` | Deploy via CLI (`npx vercel deploy`) |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Contexto do projeto na Vercel |
| `RAILWAY_TOKEN` | Opcional — preferir integração Git da Railway |

## CORS e previews

Em produção a API usa apenas as origens listadas em `WEB_URL` (CSV). Para aceitar previews da Vercel (`*.vercel.app`), inclua explicitamente esses padrões na lista **ou** use um subdomínio estável de *staging* apontado por todos os previews — avalie o risco de origens abertas.

Documentação detalhada: [vercel.md](./vercel.md), [railway.md](./railway.md), [mcp-vercel.md](./mcp-vercel.md), [troubleshooting.md](./troubleshooting.md).
