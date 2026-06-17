# GAP Analysis - CADEG Food Distribution ERP

Date: 2026-06-17

## Executive Summary

The current repository is a solid SaaS multi-tenant foundation for a Brazilian food distribution ERP. It already has tenant isolation, RBAC, audit logs, companies, customers/suppliers, items, sales orders, purchase orders, inventory ledger, fiscal foundation, and a fresh-produce operational model with lots, FEFO, quality, losses, warehouses, packaging, landed cost, and delivery routes.

However, it does not yet fully support the attached purchase/sales base for a CADEG-style operation where products are bought and sold in different commercial units. The critical gap is unit-of-measure conversion. Purchase, sales, and inventory ledger quantities are currently stored as plain decimals without the transactional UOM, conversion factor, base quantity, or conversion snapshot needed to reconcile buying, selling, costing, stock, and fiscal documents.

The client concern about Purchase Orders is partially true. A PurchaseOrder entity and basic draft -> open -> receive flow exist, but there is no usable approval workflow tied to purchase orders. The generic ApprovalWorkflow model is not connected to PurchaseOrder, has no approver assignment, no approval instance/action history, no rules, and no approve/reject APIs or UI.

Dashboards are still basic. The app has a general dashboard and a produce operations page, but it lacks the operational dashboards this market needs: margin by product/customer/supplier, purchase price variance, FEFO risk, shrinkage, aging stock, route performance, quality rejection, and unit conversion exceptions.

## Attached Data Review

### Purchase Export

File: `C:/Users/tonis/Downloads/Exportar compras.csv`

Observed structure:

- Export timestamp row: `11/06/2026 14:57`
- 463 product rows
- 14 columns
- Columns: product code, product name, monthly FOB/CIF values from Jan to May, total FOB, total CIF
- Examples: Polpa de Abacaxi, Polpa de Acerola, Polpa de Caju, Polpa de Graviola, Polpa de Manga

Important limitation:

- This purchase export is aggregated by product/month/value.
- It does not include supplier, quantity, purchase UOM, invoice number, received quantity, net weight, gross weight, package count, or lot information.
- It is useful for historical value analysis, but not enough by itself to validate UOM conversion or receiving workflow.

### Sales Export

File: `C:/Users/tonis/Downloads/exportar vendas.csv`

Observed structure:

- Export timestamp row: `11/06/2026 15:10`
- 80,642 transactional sales rows
- 109 columns
- Duplicate header found: `Local` appears more than once
- Key columns include customer, product, quantity, sales price, cost, FOB cost, warehouse/local, month/year, product group, customer classification, supplier, NF, emission/shipping/payment dates, CFOP, tax values, order identifiers, NFe key, `Unidade NF`, operator, team, route, neighborhood, and expense.

Main totals in the sample:

- Total venda: 4,055,056.86
- Total custo: 2,809,581.55
- Total custo FOB: 3,081,191.74
- Total quantidade: 592,297.25
- Approx. gross margin on `Total Custo`: 30.71%

Observed `Unidade NF` distribution:

| Unidade NF | Rows |
|---|---:|
| Kg | 46,954 |
| Un | 17,064 |
| Mol | 8,148 |
| Bdj | 4,489 |
| Dz | 1,965 |
| Cx | 1,148 |
| Sc | 479 |
| Pct | 300 |
| Und | 60 |
| Crt | 18 |
| Car | 11 |
| Bd | 6 |

Data insight:

- No single `Cod. Prod` in the sales sample was observed with multiple `Unidade NF` values.
- But similar commercial product names appear under different codes and units. Example in the sample: `Hortela` appears as `Mol` under one product code and `Kg` under another product code.
- This suggests the current/legacy ERP may be solving UOM issues through duplicated product records instead of a normalized product/UOM conversion model.

## Current Repository Assessment

### Technology Fit

The stack is appropriate for this product:

- Frontend: React + Vite in `apps/web`
- Backend: NestJS + Prisma in `apps/api`
- Database: PostgreSQL
- Queue/worker foundation: BullMQ/Redis
- SaaS foundation: tenants, companies, users, roles, subscriptions, platform admin

This is a reasonable architecture for a multi-tenant SaaS ERP.

### Multi-Tenant Foundation

The repository supports multi-tenancy structurally:

- Most business models include `tenantId`.
- Tenant access is enforced via guards/context in API modules.
- RBAC permissions exist.
- Audit mutation logging exists for sales/purchases/inventory.
- Platform admin area exists for tenants, users, plans, subscriptions, audit, telemetry, LGPD.

Assessment: good foundation.

Gap: the import/reconciliation pipeline for legacy ERP data must preserve tenant, company, source document IDs, source row IDs, and idempotency keys.

### Item and UOM Model

Current model:

- `Item` has `baseUom String @default("UN")`.
- `SalesOrderLine` has `quantity`, `unitPrice`, `lineTotal`.
- `PurchaseOrderLine` has `quantity`, `unitCost`, `lineTotal`.
- `ItemLedgerEntry` has only `quantity`.
- Produce-specific models store many quantities in kg, such as `InventoryLot.quantityOnHandKg`.

Assessment: insufficient for attached sales base and reported client pain.

Critical gaps:

- No `UnitOfMeasure` master.
- No item-specific conversion table.
- No purchase UOM vs sales UOM.
- No transaction-level UOM fields.
- No stored conversion factor snapshot on order lines/ledger lines.
- No fiscal/commercial UOM distinction.
- No rounding policy by UOM.
- No supplier item pack/case/carton mapping.
- No support for sale of one item in `Kg`, `Cx`, `Bdj`, `Mol`, `Dz`, `Sc`, `Pct`, etc. while maintaining one canonical stock balance.
- No exception flow when a conversion is missing or ambiguous.

Impact:

- Stock may be overstated or understated.
- Gross margin may be wrong when cost is carried in one unit and sale in another.
- Purchase receiving cannot reliably feed sellable inventory.
- Fiscal documents may use a different unit than stock valuation.
- Duplicate products may continue accumulating.

### Purchases

Current implementation:

- `PurchaseOrder` and `PurchaseOrderLine` exist.
- UI can create a draft PO, add lines, release it, and receive quantities.
- Receiving posts `ItemLedgerEntry` with `entryType = PURCHASE_RECEIVE`.

Assessment: basic PO exists, but not enough for the requested process.

Gaps:

- No approval workflow for POs.
- No pending approval status.
- No approver assignment or delegation.
- No amount/category/vendor-based approval rules.
- No approved/rejected action history.
- No buyer notes, delivery date, payment terms, freight terms, expected receipt date, or supplier item code on PO header/line.
- No purchase UOM, base UOM quantity, package type, gross/tare/net weight on the active API DTOs.
- Receiving does not create `InventoryLot` even though produce lot models exist.
- Receiving does not connect to quality inspection/quarantine.
- Receiving does not create inventory value entry for purchase cost in the current purchases service.
- Landed cost is modeled but not applied to PO lines/value ledger.
- Partial receipt is quantity-based only and not lot/warehouse/zone aware.

### Sales

Current implementation:

- `SalesOrder` and `SalesOrderLine` exist.
- Release checks available ledger balance and posts negative ledger movements.

Assessment: basic sales flow exists, but not enough for the attached sales export.

Gaps:

- Sales import fields are much richer than current order model.
- No sale UOM on line.
- No customer product code or commercial unit preference.
- No NFe/NF fields on SalesOrder.
- No route, attendant, team, neighborhood, delivery dates, shipping/expedition timestamps.
- No FEFO lot allocation in sales release.
- No margin analytics by last entry cost, FOB cost, taxed cost, supplier, route, product group, customer segment.
- No order-to-invoice lifecycle using `FiscalDocument` for the sales export columns.

### Fresh Produce / Perishable Operations

Current foundation is good:

- `AgriculturalItemProfile`
- `PackagingType`
- `Warehouse` and `WarehouseZone`
- `InventoryLot`
- `QualityInspection`
- `InventoryLossEvent`
- `InventoryValueEntry`
- `LandedCostAllocation`
- `DeliveryRoute`

Gap: the core purchase/sales flows are not yet integrated with these models. Today they are more like parallel capabilities than one operational workflow.

Needed integration:

- PO receipt creates lots.
- Receipt captures package count, package type, gross/tare/net kg, warehouse/zone, validity, origin, supplier/producer.
- Quality inspection can approve, partially approve, reject, or quarantine received lots.
- Sales release reserves lots by FEFO.
- Picking reduces lot balance.
- Loss events reduce lot/ledger/value.
- Landed cost updates inventory value.

### Dashboards

Current:

- General dashboard has simple module shortcuts and finance count.
- Produce operations page has metrics for profiles, lots, expiring lots, quarantine, pending inspections, and losses.

Assessment: useful start, but not enough for CADEG operations.

Missing dashboards:

- Daily sales: revenue, gross margin, margin %, orders, average ticket.
- Margin by product, group, supplier, customer, route, team, neighborhood.
- Purchase price variance: current cost vs last entry cost vs FOB/CIF.
- UOM conversion exceptions: products sold or purchased without conversion, duplicated products by name/unit, suspicious unit prices.
- FEFO/expiration risk: kg/value expiring in 1/3/7 days.
- Shrinkage/spoilage: kg and cost by reason, item, warehouse, supplier, lot.
- Receiving productivity: open POs, pending receipts, pending quality inspection, rejected kg.
- Inventory aging and stockout risk.
- Route/logistics: route revenue, stops, freight cost, delivery exceptions.
- Customer concentration and inactive customers.

## Required UOM Conversion Design

### Recommended Domain Model

Add master data:

- `UnitOfMeasure`
  - `tenantId`
  - `code` such as `KG`, `UN`, `CX`, `BDJ`, `MOL`, `DZ`, `SC`, `PCT`
  - `name`
  - `kind`: weight, count, package, bunch, tray, sack, dozen
  - `decimalScale`
  - `isFiscalAllowed`
  - `isActive`

- `ItemUomConversion`
  - `tenantId`
  - `itemId`
  - `fromUomId`
  - `toUomId`
  - `factor`
  - `roundingMode`
  - `validFrom`
  - `validTo`
  - `source`: manual, supplier, scale, legacy import
  - unique by item/from/to/validFrom

- `SupplierItemUom`
  - supplier-specific product code
  - purchase UOM
  - case/pack conversion
  - minimum order quantity
  - lead time
  - preferred cost UOM

- Optional `CustomerItemUom`
  - customer preferred sale UOM
  - customer product alias
  - price UOM

### Transaction Fields

Add to sales/purchase lines and inventory ledger:

- `transactionQuantity`
- `transactionUomId`
- `baseQuantity`
- `baseUomId`
- `conversionFactor`
- `conversionTrace`
- `priceUomId` or `costUomId`
- `unitPriceTransactionUom`
- `unitPriceBaseUom`
- `grossWeightKg`
- `tareWeightKg`
- `netWeightKg`
- `packageTypeId`
- `packageCount`

Important rule:

Do not calculate historical stock or margin from today's conversion table only. Store the conversion factor used at the transaction time.

### Conversion Service

Implement an API/domain service with:

- `convertItemQuantity(itemId, quantity, fromUom, toUom, date)`
- deterministic Decimal arithmetic
- strict missing-conversion errors
- rounding by UOM policy
- conversion trace/audit payload
- tests for Kg, Cx, Bdj, Mol, Dz, Sc, Pct, Un/Und aliases

### Import Mapping From Attached Sales CSV

Map:

- `Cod. Prod` -> `Item.sku` or legacy external product code
- `Produto` -> `Item.name`
- `Qtd` -> `transactionQuantity`
- `Unidade NF` -> `transactionUom`
- `Valor Venda` -> `unitPriceTransactionUom`
- `Total Venda` or `Total Prod` -> line totals
- `Valor Custo`, `Valor Custo FOB`, `Ultimo Custo Entrada...` -> cost history / margin snapshots
- `Fornecedor` -> supplier party link or last supplier attribution
- `Grupo Produto` and segment columns -> item category/group
- `NF`, `Chave NFE`, `Cfop`, tax columns -> fiscal document import
- route/team/neighborhood columns -> logistics/customer analytics dimensions

## Purchase Approval Workflow Design

### Recommended PO Status Flow

Replace or extend generic `DocumentStatus` for purchase lifecycle:

1. `DRAFT`
2. `PENDING_APPROVAL`
3. `APPROVED`
4. `REJECTED`
5. `OPEN` or `RELEASED`
6. `PARTIALLY_RECEIVED`
7. `RECEIVED`
8. `POSTED`
9. `CANCELLED`

### Approval Models

Add or refactor:

- `ApprovalPolicy`
  - module/document type
  - active dates
  - company/vendor/category/amount filters
  - tenant-specific rules

- `ApprovalPolicyStep`
  - sequence
  - role/user/team approver
  - minimum approvals required
  - escalation hours

- `ApprovalInstance`
  - document type
  - document id
  - current step
  - status
  - requested by
  - requested at

- `ApprovalAction`
  - approve/reject/request changes
  - actor
  - comment
  - timestamp
  - previous/next status

### API and UI

Needed endpoints:

- `POST /purchases/orders/:id/submit-approval`
- `POST /purchases/orders/:id/approve`
- `POST /purchases/orders/:id/reject`
- `POST /purchases/orders/:id/request-changes`
- `GET /approvals/inbox`
- `GET /approvals/history?documentType=PURCHASE_ORDER&documentId=...`

Needed UI:

- PO approval status banner
- submit for approval button
- approver inbox
- approve/reject modal with comments
- approval timeline
- rule setup screen for admins

Permissions:

- `purchases.submit_approval`
- `purchases.approve`
- `purchases.override_approval`
- `approvals.read`
- `approvals.configure`

## Priority Backlog

### P0 - Must Fix Before Real Client Data Go-Live

| Area | Work | Why |
|---|---|---|
| UOM | Add UOM master, aliases, item conversion table, transaction UOM/base quantity fields | Prevent stock/cost/margin corruption |
| UOM | Implement conversion service with Decimal and tests | Centralize rules and avoid duplicated math |
| Imports | Build robust CSV import staging for cp1252, semicolon delimiter, duplicate headers, decimal comma | Attached files cannot be safely imported by naive parsers |
| Purchases | Add PO approval instance/action workflow | Required client process |
| Purchases | Add purchase line UOM, supplier item code, expected delivery, package/weight fields | Required for CADEG buying |
| Inventory | Make purchase receipt create lots/value entries and warehouse/zone ledger | Needed for perishables and costing |
| Sales | Add sales line UOM/base quantity/conversion snapshot | Required for different selling units |

### P1 - High Value Operational Fit

| Area | Work | Why |
|---|---|---|
| Sales | FEFO allocation/reservation by lot during sales release | Prevent selling expired/wrong lots |
| Costing | Weighted average or lot costing with landed cost | Margin and valuation accuracy |
| Quality | Receipt-to-quality-to-quarantine workflow | Perishable control |
| Dashboards | Sales margin, purchase variance, FEFO risk, losses, conversion exceptions | Management visibility |
| Fiscal | Link sales/purchases to fiscal document/import fields | NF/NFe/tax reporting |

### P2 - Scale and Differentiation

| Area | Work | Why |
|---|---|---|
| Mobile | Receiving, weighing, picking, route loading | Warehouse productivity |
| Devices | Scale integration adapter | Reduces manual weight errors |
| Logistics | Route dashboard and proof of delivery | CADEG delivery operations |
| Analytics | Seasonality and demand forecast | Better buying decisions |

## Go/No-Go Assessment

Current repository can support the client as a starting platform, but not yet as a production ERP for the attached operation without the P0 work.

Go for discovery/prototype:

- Multi-tenant SaaS base is adequate.
- Core modules exist.
- Fresh produce models are already started.
- Basic purchase/sales flows are demonstrable.

No-go for production migration today:

- Unit conversion is not reliable enough.
- PO approval workflow is not implemented.
- Purchase receiving is not integrated with lots/quality/costing.
- Dashboards do not yet answer the daily management questions of this business.
- CSV import/reconciliation layer is missing.

## Recommended Next Sprint

1. Implement UOM master and conversion model.
2. Add transaction UOM/base quantity/conversion snapshot to sales, purchases, and ledger.
3. Build import staging for the attached sales CSV and validate UOM/product mapping.
4. Implement PO submit/approve/reject workflow and approval inbox.
5. Change purchase receiving to create lots and inventory value entries.
6. Add dashboard endpoints for sales margin, FEFO risk, purchase variance, and UOM exceptions.

Definition of done for the UOM sprint:

- A product can be bought in `Cx` or `Sc`, stocked in `Kg`, and sold in `Kg`, `Un`, `Mol`, `Bdj`, or `Dz` using audited conversion factors.
- Stock balance is always queryable in base UOM.
- Transaction documents preserve original commercial UOM.
- Margin calculations can be reproduced from historical conversion and cost snapshots.
- Missing conversions block release/receipt and appear in a dashboard exception queue.
