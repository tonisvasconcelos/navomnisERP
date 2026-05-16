# Vercel — `apps/web`

## Ligação local (`vercel link`)

Em `apps/web` pode executar `vercel link` para desenvolvimento local. O ficheiro `apps/web/.vercel/` está no **`.gitignore`** para não versionar metadados do projeto; no CI use `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (secrets).

## Definições do projeto

- **Root Directory**: `apps/web`
- **Install Command** (a partir da raiz do repositório, para resolver o workspace pnpm):

  ```bash
  cd ../.. && corepack enable && pnpm install --frozen-lockfile
  ```

- **Build Command**:

  ```bash
  cd ../.. && pnpm exec turbo build --filter=@navomnis/web
  ```

- **Output Directory**: `dist` (com *Root Directory* = `apps/web`, o artefacto fica em `apps/web/dist`).

## Variáveis de ambiente

Defina no painel Vercel (Production e Preview):

- `VITE_API_URL` — URL absoluta da API (ex.: `https://api.seudominio.com/api/v1`). Em build de produção o frontend falha se estiver em falta.
- Opcional: `VITE_SENTRY_DSN`, `VITE_APP_ENV`, chaves OAuth expostas ao cliente.

**Previews**: pode apontar todos os previews para uma API de *staging* partilhada (mais simples) ou configurar URLs distintas por ambiente.

## `vercel.json`

- **Rewrites**: fallback para `index.html` (SPA); ficheiros estáticos existentes continuam a ser servidos primeiro.
- **Headers**: `Cache-Control` para `index.html` / `sw.js`, `no-sniff`, `Referrer-Policy`, `Permissions-Policy`.

## MCP da Vercel no Cursor

Ver [mcp-vercel.md](./mcp-vercel.md).
