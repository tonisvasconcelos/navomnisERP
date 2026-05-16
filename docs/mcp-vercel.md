# Cursor + Vercel MCP

O servidor MCP da Vercel ajuda a inspecionar **deployments**, **build logs**, **domínios** e **variáveis de ambiente** (com redacção) para o projeto alojado na Vercel (aqui: frontend `apps/web`).

## Configuração

1. Crie um token na Vercel: **Account Settings → Tokens**.
2. No Cursor, defina `VERCEL_API_TOKEN` (ou o nome que o seu `mcp.json` referenciar) no ambiente do MCP — **não** commite o token.
3. Copie o modelo em [`.cursor/mcp.json`](../.cursor/mcp.json) para o ficheiro real (ou funda com a configuração existente do projeto).

## Fluxo típico com IA

1. Ligar o projeto (`vercel link` localmente ou IDs `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` no CI).
2. Após um push, pedir ao assistente para listar o último deployment e o URL de preview.
3. Se o build falhar, abrir logs e procurar erros de **env** (`VITE_*`), **TypeScript** ou **caminho monorepo** (install a partir da raiz).

## Checklist de triagem

| Sintoma | Onde olhar |
|---------|------------|
| 404 em rotas do SPA | `vercel.json` rewrites, output `dist` |
| API errada / CORS | `VITE_API_URL` no build; `WEB_URL` na API (CSV) |
| Build OK, página em branco | consola do browser, `VITE_SENTRY_DSN` |
| Cache estranho no PWA | cabeçalhos `Cache-Control` para `sw.js` / `index.html` |

Documentação oficial: [Vercel MCP](https://vercel.com/docs/mcp/vercel-mcp).

## Railway MCP (Cursor global)

Se correu `railway setup agent -y` na raiz do repo, o CLI pode ter registado o **Railway MCP** no ficheiro global do Cursor (`%USERPROFILE%\.cursor\mcp.json`), em conjunto com o skill `use-railway`. **Reinicie o Cursor** para o servidor MCP aparecer. Isto é independente do [`.cursor/mcp.json`](../.cursor/mcp.json) do projeto (Vercel); o Cursor funde configurações de projeto e de utilizador.

Documentação: [Railway AI / MCP](https://docs.railway.com/ai).
