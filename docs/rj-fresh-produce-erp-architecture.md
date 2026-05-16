# Rio de Janeiro Fresh Produce ERP Architecture

Date: 2026-05-16

This architecture targets a Brazilian hortifruti company operating in Rio de Janeiro with CEASA-style buying, direct producer purchasing, B2B sales, retail/consumer sales, weighted products, perishable inventory, rapid turnover, freight cost, and agricultural tax exceptions.

## Business Reality

Fresh produce operations are not standard item-count inventory. The ERP must support:

- variable weight receiving and selling
- gross/tare/net weight
- producer and origin traceability
- lot creation at receipt
- shelf life and expiration dates
- FEFO picking
- quality inspection and grading
- shrinkage, spoilage, and weight variance
- freight and handling allocation into cost
- delivery routes and customer windows
- agricultural fiscal scenarios, including rural producer/FUNRURAL preparation

## Implemented Foundation

The repository now includes:

- `AgriculturalItemProfile`: per-item produce setup, category, group, variety, origin, shelf life, weight control, lot/FEFO requirements, CFOP defaults, agricultural exemption flags, FUNRURAL flag, IBS/CBS future categories.
- `PackagingType`: caixa, saca, pallet, returnable package, tare and capacity.
- `Warehouse` and `WarehouseZone`: branch-linked warehouses and zones such as cold room, receiving, picking, expedition, quarantine, and waste.
- `InventoryLot`: lot number, producer, warehouse/zone, harvest/receipt/expiration dates, quality grade, freshness, package count, and kg balance.
- `QualityInspection`: grade, freshness, temperature, brix, defects, accepted/rejected kg.
- `InventoryLossEvent`: spoilage, shrinkage, damage, reclassification, weight variance, cost impact.
- `InventoryValueEntry`: immutable cost/value layer to evolve toward average cost and landed cost posting.
- `LandedCostAllocation`: freight, handling, other cost, allocation basis.
- `DeliveryRoute`: planned routes, driver/vehicle, freight cost, customer windows, stops JSON.

## Operational Flow

1. Create packaging and warehouse zones.
2. Create agricultural item profile for each fresh item.
3. Receive lot with actual kg, producer/origin, shelf life, quality grade, and cost.
4. System posts positive item ledger and optional value entry.
5. Quality inspection approves, quarantines, or rejects quantities.
6. Sales allocation should pick lots by FEFO and available kg.
7. Spoilage/shrinkage posts a loss event, negative item ledger, and optional negative value entry.
8. Landed cost allocation feeds future inventory value adjustment.
9. Delivery route groups orders by window and freight cost.

## Fiscal Notes

The fiscal engine remains parameter driven. Do not hardcode agricultural exemptions, Rio de Janeiro ICMS treatment, or FUNRURAL rates. Keep them as dated tax rules and fiscal scenarios.

Official sources to keep current:

- CONFAZ Convenio ICM 44/75, hortifrutigranjeiros: https://www.confaz.fazenda.gov.br/legislacao/convenios/1975/CV044_75
- CONFAZ Convenio ICMS 218/23, changes to Conv. 44/75: https://www.confaz.fazenda.gov.br/legislacao/convenios/2023/CV218_23
- Receita Federal rural producer social contribution: https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/contribuicoes-previdenciarias-pf
- Receita Federal EFD-Reinf: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr
- Receita Federal tax reform portal: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo

## Remaining Critical Work

- Apply migrations in disposable Postgres.
- Add purchase receiving command that creates lots from purchase lines.
- Add FEFO reservation and picking against sales lines.
- Add average cost calculation and inventory value adjustment posting.
- Add RJ state fiscal setup data with legal review.
- Add vendor/producer classification and rural producer document workflow.
