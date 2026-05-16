# Staging — reset, seed e worker (V1 interno)

Este documento complementa [staging.md](./staging.md) com decisões e **runbooks** para testes internos repetíveis (auditoria V4 §12, Sprint 1).

## Worker (BullMQ / e-mail)

| Opção | Quando usar |
|--------|----------------|
| **Worker desligado** em staging | V1 focado apenas em vendas/inventário/auditoria **sem** filas de e-mail; menos superfície de falha para testers. |
| **Worker ligado** | Quando quiser validar notificações/e-mail (Resend) e filas; exige `REDIS_URL`, segredos Resend e monitorização de jobs falhados. |

**Recomendação V1 interna:** começar com **API + web + Postgres + Redis** (Redis ainda necessário para throttler/sessões se aplicável); ativar o **worker** apenas quando o fluxo de e-mail for critério de teste.

Documente a decisão no repositório interno (wiki ou ticket) e alinhe variáveis em Railway/Vercel.

## Política de dados e seed

| Cenário | Ação |
|---------|------|
| **Primeiro deploy** de staging | `prisma migrate deploy` → opcional `prisma db seed` (utilizador demo, stock, séries). |
| **Reset completo** (dados corrompidos / testes não repetíveis) | `prisma migrate reset` **no ambiente de staging** (apaga dados) → seed. **Nunca** em produção com dados reais sem backup e aprovação. |
| **Reset leve** (só pedidos de teste) | Apagar manualmente `SalesOrder` / linhas / movimentos de teste via SQL ou script aprovado; ou `migrate reset` se o custo de apagar tudo for aceitável. |

Frequência sugerida: **reset completo** antes de cada ciclo de testes formais (ex. semanal) ou quando os números de série / stock deixarem de bater com o guião.

## Runbook — reset completo (staging)

1. Colocar API em **manutenção** ou parar tráfego (evitar escritas durante reset).
2. Backup opcional: snapshot Postgres (painel Railway / `pg_dump`).
3. No serviço API (ou container one-off):

   ```bash
   pnpm --filter @navomnis/api exec prisma migrate reset --force
   ```

   Confirme que `DATABASE_URL` aponta **só** para staging.

4. Verificar login demo (`admin@demo.navomnis.local` conforme seed) e executar [v1-internal-test-script.md](./v1-internal-test-script.md).
5. Voltar a expor a API.

## Runbook — drill de rollback / restore (Sprint 2)

Objetivo: provar que a equipa consegue **repor** staging após um deploy mau (V4 gap table).

1. **Antes:** snapshot ou backup automático do Postgres de staging (configuração no host).
2. **Simular falha:** deploy de uma build conhecida como má **ou** aplicar migração de teste numa cópia (não em prod).
3. **Restaurar:** restaurar o snapshot para a instância de staging **ou** recriar DB + `migrate deploy` + `db seed`.
4. **Validar:** health API + login + um pedido de venda rascunho.
5. **Documentar:** data, responsável, tempo de recuperação e lacunas em [staging-rollback-log.md](./staging-rollback-log.md) (e/ou ticket interno).

## E2E contra staging

Após deploy estável:

1. Build web com `VITE_API_URL=https://<api-staging>/api/v1`.
2. `pnpm --filter @navomnis/web exec playwright test` (ou workflow manual com secret da URL).

Ver [staging.md](./staging.md) secção homónima.

## Referências

- [staging.md](./staging.md) — variáveis, migrações, CI.
- [staging-rollback-log.md](./staging-rollback-log.md) — registo de drills de rollback/restore.
- [v1-internal-test-script.md](./v1-internal-test-script.md) — checklist manual.
- [deploy-overview.md](./deploy-overview.md) — ambientes.
