# Fluxo de consentimento (OAuth servidor)

1. Web: `POST /banking/connections` com `companyId` + `institutionId` → recebe `authorizationUrl` (sem tokens).
2. Browser: redirect completo para o ASPSP sandbox.
3. ASPSP: redirect para `GET /api/v1/banking/oauth/callback?state=&code=` (rota pública, sem JWT).
4. API: valida `state`, troca `code` + PKCE, grava tokens cifrados em `BankCredentialVault`, atualiza `BankConsent` → `AUTHORISED`.
5. API: enfileira job `bank-sync` (contas/saldos).
6. Web: redirect para `/banking/connect?status=authorised`.

Revogação: `POST /banking/consents/:id/revoke` (autenticado, `banking.connect`).

**Distinção LGPD:** `ConsentRecord` = termos legais do ERP. `BankConsent` = consentimento Open Finance regulatório.
