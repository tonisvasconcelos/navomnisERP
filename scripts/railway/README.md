# Scripts Railway (CLI)

Requisitos: [Railway CLI](https://docs.railway.app/develop/cli) e `RAILWAY_TOKEN` (ou login interativo).

## Ligação ao projeto

```bash
railway link
```

## Variáveis

```bash
railway variables
railway variables set KEY=value
```

## Correr migrações num shell com as variáveis do projeto

```bash
railway run --service api pnpm --filter @navomnis/api migrate:deploy
```

(Ajuste `--service` ao nome do serviço na Railway.)

## PowerShell (Windows)

Os mesmos comandos funcionam no PowerShell; use aspas para valores com espaços:

```powershell
railway variables set WEB_URL="https://app.exemplo.com"
```

## GitHub Actions vs integração Git

Para produção, a integração **Git** nativa da Railway costuma ser mais simples do que `railway redeploy` no CI. O workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deixa um gancho opcional com `RAILWAY_TOKEN`.
