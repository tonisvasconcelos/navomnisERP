# Fresh Produce Accounting And Costing Guide

## Costing Principles

Fresh produce costing needs more than item quantity. The ERP must preserve:

- purchase cost
- freight cost
- handling cost
- package/returnable cost
- spoilage and shrinkage cost
- reclassification impact
- expected vs actual cost

The new `InventoryValueEntry` table is the foundation for value ledger behavior. It is intentionally separate from `ItemLedgerEntry` so physical quantity and financial valuation can be reconciled but not confused.

## Posting Design

Future posting should create:

- item ledger entry for physical kg movement
- value entry for cost movement
- GL entry for inventory, COGS, freight, spoilage, and adjustments
- tax ledger entries for ICMS/PIS/COFINS/FUNRURAL/IBS/CBS scenarios
- audit log linking user, source document, lot, and posting batch

## Landed Cost

`LandedCostAllocation` stores freight, handling, and other cost with an allocation basis:

- weight
- value
- quantity
- manual

The next implementation step is applying landed costs to purchase lines and value entries, then posting inventory adjustment when final freight invoices arrive.

## Spoilage Accounting

Loss events should post:

- credit inventory value
- debit spoilage/shrinkage expense
- optional dimension by warehouse, product group, route, and supplier

Cost impact is currently captured on `InventoryLossEvent` and can already create negative `InventoryValueEntry` records.

## Financial Controls

For a real RJ hortifruti operation, add:

- supplier payment scheduling
- producer settlement
- freight payable invoices
- customer aging
- Pix/TED/CNAB payment files
- bank reconciliation
- daily cash forecast by seasonality and inventory turnover
