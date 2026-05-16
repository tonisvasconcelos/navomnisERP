# Brazilian Fiscal Architecture

Date: 2026-05-16

This document defines the Navomnis ERP fiscal architecture for Brazilian operations. It is an engineering architecture, not legal advice. Production tax content must be validated and maintained by Brazilian tax specialists.

## Official Context Checked

- Receita Federal confirms CBS, IBS, and IS as the new reform taxes, with CBS federal, IBS state/municipal, and IS federal.
- Receita Federal states 2026 is the CBS/IBS test year, with electronic fiscal documents requiring CBS/IBS fields by operation.
- Receita Federal and Ministério da Fazenda identify LC 214/2025 as the general law for IBS, CBS, and IS, and EC 132/2023 as the constitutional reform basis.

References:

- Receita Federal, "Orientações da Reforma Tributária para 2026": https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026
- Receita Federal, "Entenda a Reforma Tributária do Consumo": https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda
- Receita Federal, "Principais Marcos Regulatórios": https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/marcos
- Ministério da Fazenda, "Reforma Tributária": https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria

## Design Principles

1. No hardcoded tax law in services.
2. Every fiscal rule is tenant-scoped, date-sensitive, and versionable.
3. Current taxes and reform taxes coexist in the same tax-kind model.
4. Fiscal documents store calculation snapshots, not only live references.
5. Fiscal postings are immutable ledger entries after posting.
6. Setup tables decide behavior; code only executes the calculation pipeline.
7. Future NF-e/NFS-e integration should attach to fiscal documents/events, not sales orders directly.

## Implemented Foundation

### Core Setup

- `FiscalJurisdiction`: federal/state/municipal/foreign jurisdictions, including UF, municipality, IBGE, effective dates.
- `FiscalRegimeSetup`: company fiscal regime by effective period, supporting Simples Nacional, Lucro Presumido, Lucro Real, MEI, rural producer, and exempt setups.
- `TaxArea`: origin/destination jurisdiction combinations.
- `TaxGroup`: business/product/jurisdiction-style grouping pattern inspired by enterprise ERP posting groups.
- `FiscalOperationType`: fiscal operation semantics, direction, CFOP, NF model, inventory and financial impact flags.

### Fiscal Master Data

- `ProductFiscalProfile`: NCM, CEST, fiscal origin, benefit code, product fiscal category, product tax group.
- `PartyFiscalProfile`: CNPJ, IE, IM, taxpayer type, fiscal regime, SUFRAMA, exemptions, business tax group.

### Rule Engine

- `TaxDeterminationRule`: current and reform taxes in one effective-dated table.
- `BrazilianTaxKind`: ICMS, ICMS-ST, IPI, ISS, PIS, COFINS, DIFAL, FCP, IRRF, CSLL, INSS, FUNRURAL, freight/import preparation, IBS, CBS, IS.
- `TaxRuleBaseStrategy`: line amount, document amount, customs value, freight amount, service amount, previous-tax amount, formula.
- `formulaCode` and `parameters`: allow new formulas/layout obligations without schema redesign.

### Fiscal Documents

- `FiscalDocument`: XML-ready document header with source document, series/number, access key, protocol, authorization/rejection/contingency fields.
- `FiscalDocumentLine`: product/service line snapshot with CFOP, NCM, CEST, CST fields, service code, freight/discount.
- `FiscalDocumentLineTax`: tax snapshot per line and tax kind, including rule id, jurisdiction, base, rate, amount, recoverable/withheld amounts, and calculation trace.

## Backend APIs

- `GET /api/v1/fiscal/setup/summary`: readiness counts and reform tax presence.
- `GET /api/v1/fiscal/tax-rules`: active/draft rule visibility.
- `POST /api/v1/fiscal/tax-preview`: parameter-driven preview using company, party, operation type, product profiles, effective-dated rules.

These endpoints require `fiscal.read` and tenant access.

## Frontend UX

The new `Fiscal Brasil` workspace exposes:

- setup summary counters;
- IBS/CBS/IS reform readiness indicators;
- preview form for company, customer, item, quantity, value;
- tax breakdown table by tax kind;
- tax rule table with formula and legal reference fields.

## Important Limits

- The seed creates zero-rate demo rules marked `DEMO_ZERO_RATE_NOT_LEGAL_TABLE`.
- No official tax rates, CST matrices, benefit rules, DIFAL formulas, ICMS-ST MVA rules, retention tables, or municipal ISS tables are embedded.
- Tax specialists must load validated setup data before real fiscal operation.
- NF-e/NFS-e authorization is prepared structurally, not implemented.

