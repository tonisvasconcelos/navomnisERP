# Tax Reform Transition Guide

Date: 2026-05-16

This guide defines how Navomnis should support the coexistence of the current Brazilian tax system and the new consumption tax model.

## Official Transition Baseline

According to Receita Federal materials checked on 2026-05-16:

- CBS, IBS, and IS are the reform taxes.
- 2026 is a CBS/IBS test year, with fiscal documents carrying CBS/IBS highlights by operation.
- 2027 begins CBS operation and IS; PIS/COFINS are extinguished in the transition described by Receita guidance.
- 2029-2032 is the gradual ICMS/ISS to IBS transition.
- 2033 is the full new model target with ICMS and ISS extinction.

Sources are listed in `brazil-fiscal-architecture.md`.

## Architecture Strategy

Use the same `TaxDeterminationRule` table for old and new taxes:

- Current: ICMS, ICMS-ST, IPI, ISS, PIS, COFINS, DIFAL, FCP, retentions.
- Reform: IBS, CBS, IS.

Activation is controlled by:

- `effectiveFrom`;
- `effectiveTo`;
- `taxKind`;
- `fiscalRegime`;
- `operationTypeId`;
- `businessTaxGroupId`;
- `productTaxGroupId`;
- `originJurisdictionId`;
- `destinationJurisdictionId`;
- `formulaCode`;
- `parameters`.

## Coexistence Pattern

For a single operation, the engine may select several rules:

- current taxes for legal operation;
- CBS/IBS test display rules for 2026;
- dual current/new rules during transition;
- IS rules for selective-tax goods/services;
- reductions or coexistence factors stored in `parameters`.

The service must never branch by calendar year with hardcoded formulas. It should ask the rule table which rules apply on the document date.

## Data Loading Policy

Tax content is master data:

- loaded by migration only for structural seed/demo;
- maintained by fiscal administrators or import jobs;
- versioned through effective dates;
- auditable through setup-change logs in a future sprint.

## Required Future Tables

The current schema intentionally leaves room for:

- fiscal periods;
- official layout versions;
- tax obligation declarations;
- NF-e/NFS-e event logs;
- setup change approval workflow;
- official calculator integration snapshots.

