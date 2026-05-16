# Payroll Tax Master Data Guide

This foundation is not a payroll engine yet. It creates the fiscal and labor master data needed so payroll, accounting, and eSocial modules can be added without redesigning the ERP core.

## Employee Register

Captured fields:

- Employee identification: code, full name, CPF, PIS/PASEP.
- eSocial preparation: registration id, category, future event mapping.
- Labor classification: labor regime, department, cost center, company, branch, tax municipality.
- Lifecycle: hire date, termination date, active/inactive status.

## Employee Tax Profile

The schema supports time-versioned employee tax profiles with:

- INSS category
- FGTS category
- IRRF category
- union contribution flag
- RAT rate
- FAP rate
- payroll tax group
- eSocial event mapping
- labor obligations

## Posting Readiness

Payroll posting should eventually generate:

- GL entries by cost center and department
- supplier/payable entries for taxes and obligations
- employee liability entries
- immutable payroll tax ledger entries
- audit log references to calculation versions and eSocial event ids

## Compliance Notes

The eSocial layout and event rules change over time. Keep mappings versioned and cite the official portal when implementing event payloads: https://www.gov.br/esocial/pt-br
