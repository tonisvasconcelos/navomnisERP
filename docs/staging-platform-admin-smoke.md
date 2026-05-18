# Platform admin — smoke de staging

Executar após deploy do **admin** (`navomnis-admin`) com `VITE_API_URL` apontando para a API de staging.

## URLs (2026-05-16)

| Componente | URL |
|------------|-----|
| API staging | https://api-staging-fa90.up.railway.app/api/v1 |
| Admin (alias produção Vercel) | https://navomnis-admin-oss365.vercel.app |
| Web tenant (alias produção Vercel) | https://web-oss365.vercel.app |

## Credenciais (seed)

| Contexto | Email | Password |
|----------|-------|----------|
| Platform | `admin@platform.navomnis.local` | `Platform123!` |
| Tenant demo | `admin@demo.navomnis.local` | `Admin123!` (tenant `demo`) |

## Passos

1. Abrir o URL do admin → página de login.
2. Login platform → dashboard com KPIs (`/platform/telemetry/metrics`).
3. Menu **Tenants** → lista carrega.
4. (Opcional) Com token tenant, `GET /platform/tenants` deve devolver **401** (isolamento).

## CRUD (UI)

### Tenants

1. **Tenants** → **Criar tenant** → preencher nome/slug → guardar → detalhe abre.
2. No detalhe: **Editar**, **Ativar/Suspender/Bloquear** (com confirmação).
3. Secção **Subscrição**: escolher plano → **Atribuir plano**.

### Utilizadores (convite)

1. **Users** → **Convidar utilizador** → e-mail, nome, tenant → enviar.
2. Copiar link de convite se e-mail não configurado (`RESEND_API_KEY`).
3. Abrir link no **web** tenant: `/invite/accept?token=...` → definir senha → redireciona para login.
4. **Ver** utilizador → **Atribuir tenant**, ações de segurança (bloquear, reset, revogar sessões).

### Planos

1. **Subscriptions** → lista de planos → **Criar plano** → **Ver** → desativar/arquivar.

## API-only (PowerShell)

```powershell
$base = "https://api-staging-fa90.up.railway.app/api/v1"
$body = @{ email = "admin@platform.navomnis.local"; password = "Platform123!" } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/platform/auth/login" -Method POST -Body $body -ContentType "application/json"
Invoke-RestMethod -Uri "$base/platform/telemetry/metrics" -Headers @{ Authorization = "Bearer $($r.data.accessToken)" }
```

## CORS

Na Railway (serviço `api`, env `staging`), `ADMIN_WEB_URL` deve incluir o domínio Vercel do admin (CSV se vários previews).
