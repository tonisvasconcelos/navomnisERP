# Product and Service Fiscal Setup Guide

## Item Templates

Item fiscal templates centralize reusable product setup for Brazilian taxation. They are intended to be inherited by item registers and then refined only when a specific SKU needs an exception.

Core fields:

- Classification: NCM, CEST, EX TIPI, fiscal origin, fiscal category, SPED classification, benefit code.
- ICMS: CST, CSOSN, aliquot, reduction, deferment, exemption, base reduction, ST rule code, MVA, FCP, FCP-ST, DIFAL, interstate/internal rule codes.
- IPI: CST, enquadramento, rate, exemption.
- PIS/COFINS: CST, rates, monophase and substitution flags.
- Inventory controls: fiscal UOM, commercial UOM, conversion factor, lot fiscal controls, traceability.
- Reform fields: IBS category, CBS category, future VAT classification, effective dates.

## Service Templates

Service fiscal templates centralize setup for ISS, federal retentions, and future service tax reform classifications.

Core fields:

- Classification: CNAE, municipal service code, LC 116 service code, fiscal service category.
- ISS: rate, municipality, retention flag, responsible party, exemption.
- Retentions: IRRF, CSLL, PIS, COFINS, INSS.
- Incidence: municipality of incidence, tax municipality, service location rule, interstate rule, public agency rule.
- Reform fields: IBS service classification, CBS service classification, transition rule.

## Validation Flow

The API exposes `/api/v1/fiscal/validate-register` for CPF, CNPJ, NCM, CFOP, CST/CSOSN, and municipality code format checks. State registration remains intentionally marked as a later UF-specific validation task.

## Next Required Work

- Attach `Item.itemFiscalTemplateId` from the item maintenance screen.
- Add a service register entity if Navomnis separates services from inventory items.
- Add a tax setup matrix editor for product group x business group x jurisdiction x operation type.
- Add import/export of official classification tables where licensing allows it.
