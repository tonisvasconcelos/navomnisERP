# Railway — API + worker + dados

## Projeto ligado a este repositório (CLI)

Na máquina local foi executado `railway init` nesta pasta e criado o projeto **patient-youth** (pode renomear no painel da Railway).

- **Painel**: [railway.com/project/9d940007-4e9f-4d82-95e7-96aa44bff4e5](https://railway.com/project/9d940007-4e9f-4d82-95e7-96aa44bff4e5)
- **Serviços criados**: `Postgres` (online), `Redis-o1_P` (Redis gerido), serviços vazios `api` e `worker` (ainda sem *build* / imagem).
- **MCP / skills**: foi corrido `railway setup agent -y`, que instala o skill `use-railway` e regista o **Railway MCP** no Cursor global (`%USERPROFILE%\.cursor\mcp.json`). Reinicie o Cursor para carregar o MCP.

**Próximos passos no painel**

1. No serviço **api**: ligar o repositório Git **ou** definir *Dockerfile path* = `Dockerfile` na raiz; comando de arranque `node apps/api/dist/main.js` após build; variáveis `DATABASE_URL`, `REDIS_URL`, `WEB_URL`, JWT, etc. (use as referências internas que a Railway injeta ao referenciar Postgres/Redis).
2. No serviço **worker**: mesma imagem ou mesmo repo; comando `node apps/api/dist/worker.main.js`; `PROCESS_ROLE=worker`; `RESEND_API_KEY` em produção.
3. **Release / Pre-deploy** no `api`: `pnpm --filter @navomnis/api migrate:deploy`.
4. Renomear o projeto e o serviço Redis no UI se preferir nomes estáveis (`navomnis-redis`, etc.).

## Serviços recomendados

| Serviço | Função |
|---------|--------|
| Postgres | `DATABASE_URL` |
| Redis | `REDIS_URL` (BullMQ) |
| `api` | HTTP Nest — comando `node apps/api/dist/main.js` (ou imagem Docker com o mesmo CMD) |
| `worker` | Fila de e-mails — `PROCESS_ROLE=worker` e `node apps/api/dist/worker.main.js` |

Use a rede privada da Railway para `DATABASE_URL` e `REDIS_URL` internos.

## Imagem Docker

Na raiz do repositório:

```bash
docker build -t navomnis-api .
```

- **API**: `CMD` predefinido `node apps/api/dist/main.js`
- **Worker**: sobrescreva o comando no serviço Railway, por exemplo:

  ```bash
  node apps/api/dist/worker.main.js
  ```

Defina `PROCESS_ROLE=worker` no serviço worker e `PROCESS_ROLE=api` (ou vazio) no serviço API.

## Migrações (release)

Execute na fase **Release** ou **Pre-deploy** de **ambos** os serviços que precisam de Prisma (normalmente só o `api` antes do arranque, ou um job dedicado):

```bash
cd apps/api && pnpm migrate:deploy
```

Ou a partir da raiz com filtro:

```bash
pnpm --filter @navomnis/api migrate:deploy
```

## Desenvolvimento local

- Terminal 1: `pnpm dev` (Turbo) ou `pnpm --filter @navomnis/api dev` para a API.
- Terminal 2: `pnpm --filter @navomnis/api dev:worker` para processar a fila de notificações.

Sem o worker, os jobs ficam em `waiting` na fila `notifications`.

## Escalar workers

- Aumente réplicas do serviço `worker` ou ajuste a concorrência por processo na configuração BullMQ.
- Evite múltiplos processos a competirem sem política clara de concorrência na mesma fila; prefira réplicas homogéneas com a mesma configuração.

## Scripts CLI

Ver [scripts/railway/README.md](../scripts/railway/README.md).
