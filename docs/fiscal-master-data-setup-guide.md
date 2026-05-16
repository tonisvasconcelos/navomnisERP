# Brazilian Fiscal Master Data Setup Guide

Navomnis now has a fiscal master-data foundation for Brazilian ERP operations. The design is parameter-driven and intentionally separates legal setup from document posting, so tax law changes can be added through versioned setup instead of schema rewrites.

## Scope

Implemented setup families:

- Item fiscal templates: product classifications, NCM/CEST, ICMS/IPI/PIS/COFINS setup, fiscal units, traceability, and IBS/CBS future categories.
- Service fiscal templates: CNAE, LC 116 service code, municipal service code, ISS setup, federal retentions, and IBS/CBS service classifications.
- Company fiscal profiles: legal registration, fiscal regime, default tax groups, obligations, SPED/NF-e/NFS-e readiness, and future reform identifiers.
- Branch fiscal setup: branch CNPJ/IE/IM, fiscal jurisdiction, municipality, local obligations, and branch-level posting defaults.
- Customer/vendor fiscal profiles: CPF/CNPJ, IE/IM, SUFRAMA, taxpayer type, fiscal regime, retention policies, recoverability, and default operations.
- Employee fiscal registers: CPF, PIS/PASEP, eSocial identifiers, labor regime, department/cost center, and payroll tax profile support.

## Operating Model

1. Configure jurisdictions, tax groups, fiscal operation types, and tax rules.
2. Configure company profile and branch setup for each legal establishment.
3. Configure item and service templates with fiscal classification and future reform categories.
4. Attach templates to operational item/service registers.
5. Configure customer/vendor fiscal profiles for taxpayer, consumer final, interstate, SUFRAMA, and retention behavior.
6. Configure employee fiscal data before payroll/eSocial integration work.
7. Use fiscal preview and posting preview as validation gates before fiscal document authorization.

## Tax Reform Readiness

The schema supports coexistence by effective dates and dedicated IBS, CBS, and IS fields in tax rules and fiscal templates. Current taxes and reform taxes can be active for the same fiscal date range with different priorities, formulas, and legal references.

Official context to keep current:

- Receita Federal Reforma Tributaria do Consumo: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo
- Ministerio da Fazenda Reforma Tributaria: https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria
- eSocial portal: https://www.gov.br/esocial/pt-br

## Safety Rules

- Do not hardcode rates or CST/CFOP decisions in services.
- Use effective dates for all legal setup changes.
- Keep posted fiscal entries immutable.
- Treat IE validation as UF-specific work; the current validator only covers document and format checks.
- All setup tables are tenant-scoped and included in Prisma tenant enforcement.
