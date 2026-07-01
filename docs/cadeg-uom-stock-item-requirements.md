# CADEG UOM, Stock Item Detail, and Accounting Requirements

Date: 2026-07-01

## Executive summary

The current prototype already has the right architectural foundation for a Rio de Janeiro hortifruti ERP: React/Vite frontend in `apps/web`, NestJS/Prisma API in `apps/api`, PostgreSQL, tenant isolation, fiscal setup tables, item ledger, value entry foundations, UOM master data, purchase and sales order flows, and CADEG import scripts.

The main gap is not the absence of UOM data structures. The gap is enforcement and usability. Sales and purchase order line DTOs accept `transactionUomId`, but it is optional, and the current React forms do not let users choose UOM when adding or editing lines. Sales displays a UOM column after the fact; purchases does not. Inventory balances are calculated from ledger base quantities, but the stock view is not clickable and there is no item detail endpoint or page that shows product details, conversions, lots, ledger history, fiscal setup, costing, or image.

For the hortifruti rollout, every new purchase, receipt, sales order, and stock movement must capture both the transaction UOM and the base inventory UOM conversion snapshot. This is required for reliable stock, accounting, fiscal traceability, and a Business Central-like architecture.

## Repo scan findings

### Application architecture

- Monorepo root package: `navomnis-erp`.
- Frontend: `apps/web`, React 18, Vite, React Router, TanStack Query, React Hook Form, Tailwind.
- Backend: `apps/api`, NestJS 10, Prisma 5, PostgreSQL, Redis/BullMQ worker.
- Admin app: `apps/admin`.
- Shared packages: `packages/ui`, `packages/i18n`, `packages/config`.
- Data/import area: `CADEG DATA BASE/` and `data/cadeg/`.

### CADEG data inventory

- `CADEG DATA BASE/exportar vendas.csv`: 80,644 lines including a timestamp line and header. Contains Jan-May 2026 sales transaction history with customer, item, quantity, sales/cost amounts, NF, dates, CFOP, fiscal key, supplier, and `Unidade NF`.
- `CADEG DATA BASE/Exportar compras.csv`: 465 lines including a timestamp line and header. Contains monthly product cost/spend columns for Jan-May 2026 (`Valor Jan FOB/CIF` through `Valor Mai FOB/CIF`), not detailed purchase invoice lines.
- `data/cadeg/README.md` correctly documents that purchases are reconstructed from the monthly cost matrix, while sales can be imported/staged as transaction history.

### Existing UOM foundation

The Prisma schema already includes:

- `UnitOfMeasure`, `UnitOfMeasureAlias`, `ItemUomConversion`.
- `SupplierItemUom` and `CustomerItemUom`.
- `Item.baseUom` and nullable `Item.baseUomId`.
- `SalesOrderLine.transactionUomId`, `baseQuantity`, `baseUomId`, `conversionFactor`, `conversionTrace`.
- `PurchaseOrderLine.transactionUomId`, `baseQuantity`, `baseUomId`, `conversionFactor`, `conversionTrace`, plus gross/tare/net weight fields.
- `ItemLedgerEntry.transactionUomId`, `baseQuantity`, `baseUomId`, `conversionFactor`, `conversionTrace`.

`UomConversionService.convertItemQuantity()` converts transaction quantity to item base quantity and persists a traceable conversion path. `UomService.seedStandardUnits()` seeds KG, UN, CX, BDJ, MOL, DZ, SC, and PCT plus common legacy aliases.

### Current UOM behavior

- API line DTOs for sales and purchases make `transactionUomId` optional.
- `SalesService.resolveLineConversion()` and `PurchasesService.resolveLineConversion()` only block missing UOM when tenant feature flag `uom_enforcement` is enabled.
- If the flag is off, line creation falls back to legacy behavior: transaction quantity equals base quantity with conversion factor `1`.
- Sales order detail includes `transactionUom` in the response and displays a UOM column.
- Purchase order detail includes `transactionUom` in the response but does not display or edit it.
- Sales and purchases add/edit forms do not load UOM options and do not send `transactionUomId`.
- Purchase receiving can accept receipt-line `transactionUomId`, but the current UI modal only sends `lineId` and `quantity`.

### Current stock and item detail behavior

- `GET /api/v1/inventory/items` lists active items.
- `GET /api/v1/inventory/balances` groups `ItemLedgerEntry` by item and returns SKU, name, base UOM, and quantity on hand.
- `GET /api/v1/inventory/ledger` returns recent item ledger entries.
- `/inventory` frontend page shows balances and recent ledger, but rows are not clickable.
- There is no `GET /inventory/items/:id` item detail endpoint.
- There is no React item detail page.
- The Prisma `Attachment` model exists, but there is no item image relation, item media endpoint, or item photo upload/display workflow.

### Current accounting foundation

The repository already has an accounting/fiscal foundation close to Business Central concepts:

- Physical quantity ledger: `ItemLedgerEntry`.
- Inventory value layer: `InventoryValueEntry`.
- General ledger: `GlEntry`.
- Customer, supplier, bank, tax, and tax settlement ledgers.
- Posting setup tables: `PostingSetup`, `TaxPostingSetup`, `FiscalPostingSetup`.
- Posting journal tables: `PostingJournal`, `PostingJournalLine`.
- Fiscal document and fiscal tax snapshot tables.
- Existing docs: `docs/posting-engine-guide.md`, `docs/rj-fresh-produce-accounting-costing-guide.md`, `docs/brazil-fiscal-architecture.md`, `docs/rj-fresh-produce-erp-architecture.md`.

The current `PostingService.preview()` is still a structural sales-only preview. It creates a balanced customer debit and revenue credit, but it does not yet post inventory, COGS, supplier payable, purchase recoverable taxes, fiscal ledgers, or immutable posting journals.

## Functional requirements

### FR-01: UOM master data readiness

1. The tenant must have active UOM codes for at least KG, UN, CX, BDJ, MOL, DZ, SC, and PCT.
2. Each item must have a valid `baseUomId`; text-only `Item.baseUom` is legacy compatibility and cannot be the only source for new transactions.
3. Each item must have item-specific conversions from allowed transaction UOMs to base UOM where conversion is not identity.
4. Supplier-specific default purchase UOM must be maintained through `SupplierItemUom`.
5. Customer-specific default sales UOM should be maintained through `CustomerItemUom` when customer defaults differ from the item default.
6. Users must be able to see unresolved conversion exceptions in `/exceptions/uom` and resolve them before go-live.

### FR-02: Mandatory UOM on sales order lines

1. When adding or editing a sales order line, the user must select a transaction UOM.
2. The selected UOM must be valid for the selected item and customer context.
3. The default UOM should resolve in this order:
   - `CustomerItemUom.saleUomId` for customer + item.
   - Item default sales UOM if added to the item model.
   - Item base UOM.
4. On save, the system must store:
   - entered transaction quantity in `SalesOrderLine.quantity`;
   - `SalesOrderLine.transactionUomId`;
   - converted base quantity in `SalesOrderLine.baseQuantity`;
   - `SalesOrderLine.baseUomId`;
   - `SalesOrderLine.conversionFactor`;
   - `SalesOrderLine.conversionTrace`.
5. The line total must use the transaction quantity and transaction price UOM.
6. The sales release process must reject lines missing transaction UOM, base UOM, base quantity, or conversion trace.
7. Item ledger entries created by sales release must copy the UOM conversion snapshot from the source line.

### FR-03: Mandatory UOM on purchase order lines and receiving

1. When adding or editing a purchase order line, the user must select a transaction UOM.
2. The selected UOM must be valid for the item and vendor context.
3. The default UOM should resolve in this order:
   - `SupplierItemUom.purchaseUomId` for vendor + item.
   - Item default purchase UOM if added to the item model.
   - Item base UOM.
4. On save, the system must store the same conversion snapshot fields required for sales.
5. Purchase line cost must be explicitly understood as cost per transaction UOM.
6. Receipt lines must default to the purchase line UOM, but allow an override only when a valid conversion exists.
7. Receipt posting must store the receipt transaction UOM, base UOM, conversion factor, and trace on both receipt lines and item ledger entries.
8. For fresh produce, receiving must support gross weight, tare weight, net weight, package count, lot, expiration date, warehouse, zone, and optional quality inspection.

### FR-04: Stock view item drill-down

1. Every item row in `/inventory` balances must be clickable.
2. Clicking an item must navigate to `/inventory/items/:itemId`.
3. The stock view should display item base UOM beside quantity on hand.
4. The stock view should clearly distinguish physical base quantity from transaction quantities in ledger rows.

### FR-05: Item detail page with picture

The item detail page must show:

1. Primary product image.
2. SKU, name, status, base UOM, fiscal type, category/group when available.
3. Current quantity on hand in base UOM.
4. Recent item ledger entries with posting date, entry type, document type/id, transaction quantity/UOM, base quantity/UOM, warehouse/zone, and lot.
5. Open lots with quantity, expiration date, freshness/quality status, warehouse/zone, and FEFO ordering.
6. UOM conversions for the item.
7. Supplier purchase UOM links and customer sales UOM links.
8. Cost summary from `InventoryValueEntry`, including current value and average cost where available.
9. Fiscal/product profile summary, including NCM/CEST/tax group/CFOP defaults when available.
10. Attachments and audit metadata where available.

### FR-06: Product image handling

1. The system must support one primary image per item and optional secondary images.
2. Images must be tenant-scoped.
3. Accepted formats should include JPEG, PNG, and WebP.
4. Maximum file size should be configurable; initial recommendation is 5 MB per image.
5. The API must validate MIME type and extension.
6. Images must be stored through the existing attachment pattern or a new item media table.
7. The frontend must display a fallback placeholder when no image exists.
8. Future storage should be compatible with object storage such as S3/Railway volume/Vercel Blob; database rows should store metadata and URL/key, not large binary payloads.

### FR-07: Business Central-like inventory and accounting behavior

The system must follow these ERP principles:

1. Item master has a base UOM used for inventory.
2. Alternate item UOMs define how purchase, sales, warehouse, and fiscal transactions convert to base UOM.
3. Order lines snapshot the transaction UOM and conversion at the time of entry/posting.
4. Quantity ledger and value ledger are separate but reconcilable.
5. Posting groups/settings determine G/L accounts; business logic must not hardcode revenue, COGS, inventory, payable, receivable, or tax accounts.
6. Posting creates immutable ledger entries.
7. Reversal/correction must be by reversing entries or credit/debit documents, not by editing posted ledger entries.
8. Posting preview must be available before final posting.
9. Sales shipment/release must reduce physical inventory and create or prepare COGS/value entries.
10. Purchase receipt must increase physical inventory and create or prepare inventory value entries.
11. Purchase invoice and sales invoice posting must create balanced accounting entries.

### FR-08: Brazil accounting and fiscal principles

1. Inventory valuation must be based on reliable cost layers/value entries, not only physical quantity.
2. Purchase cost must support product cost, freight, handling, insurance, nonrecoverable taxes, and other directly attributable acquisition costs.
3. Recoverable and nonrecoverable taxes must be separated in fiscal/accounting posting.
4. Fiscal documents must preserve tax snapshots at posting time.
5. UOMs must support fiscal reporting and SPED/NF-e alignment, including commercial and inventory units.
6. For hortifruti/agricultural scenarios, tax rules such as ICMS exemptions, FUNRURAL, PIS/COFINS treatment, IBS/CBS transition, and RJ-specific rules must remain parameterized and dated.
7. Accounting entries must balance debit and credit totals per posting journal.
8. Posted documents and ledgers must be immutable except through controlled reversal/correction flows.

## Technical requirements

### TR-01: Prisma schema changes

Add or adjust:

1. Make `Item.baseUomId` required for new records. Existing records can be backfilled before enforcing database `NOT NULL`.
2. Add default purchase/sales UOM fields if needed:
   - `Item.salesUomId`
   - `Item.purchaseUomId`
3. Add item image support using one of these approaches:
   - Preferred: extend `Attachment` with `entityType`, `entityId`, `isPrimary`, `usage`, `storageKey`, `url`, `mimeType`, `sizeBytes`.
   - Alternative: create `ItemMedia` with tenant, item, URL/storage metadata, sort order, and primary flag.
4. Consider adding UOM code denormalization on posted lines/ledger if audit readability is required after UOM master changes.
5. Add indexes for item detail performance:
   - `ItemLedgerEntry(tenantId, itemId, postingDate)`;
   - `InventoryValueEntry(tenantId, itemId, postingDate or createdAt)`;
   - media/attachments by `tenantId`, `entityType`, `entityId`.

### TR-02: Backfill and data migration

1. Backfill `Item.baseUomId` from `Item.baseUom` and `UnitOfMeasure.code`.
2. For fresh produce items, default base UOM to KG when CADEG data or agricultural profile indicates weight-controlled items.
3. Backfill historical sales and reconstructed purchase lines:
   - if legacy line has UOM alias, resolve it using `UnitOfMeasureAlias`;
   - set `transactionUomId`;
   - compute `baseQuantity`, `baseUomId`, `conversionFactor`, `conversionTrace`;
   - mark trace source as `legacy_import` or `purchase_reconstruction`.
4. Historical rows that cannot be converted must create `UomConversionException`.
5. Produce an idempotent verification script reporting:
   - items without base UOM;
   - lines without transaction UOM;
   - ledger entries without base quantity;
   - conversion exceptions unresolved;
   - negative balances by SKU;
   - item balances where `quantity` and `baseQuantity` conflict.

### TR-03: API changes

Add endpoints:

1. `GET /api/v1/inventory/items/:id`
   - returns item detail aggregate.
2. `GET /api/v1/inventory/items/:id/balance`
   - optional if not embedded in detail.
3. `GET /api/v1/inventory/items/:id/ledger`
   - paginated, filterable by date/type/lot.
4. `GET /api/v1/inventory/items/:id/media`
5. `POST /api/v1/inventory/items/:id/media`
6. `PATCH /api/v1/inventory/items/:id/media/:mediaId/primary`
7. `DELETE /api/v1/inventory/items/:id/media/:mediaId`
8. `GET /api/v1/uom/items/:itemId/available?context=sales|purchase|receipt&partyId=...`
   - returns valid UOMs, defaults, conversion factors, and any warning.

Adjust endpoints:

1. `POST /sales/orders/:id/lines`: require `transactionUomId`.
2. `PATCH /sales/orders/:id/lines/:lineId`: require `transactionUomId`.
3. `POST /purchases/orders/:id/lines`: require `transactionUomId`.
4. `PATCH /purchases/orders/:id/lines/:lineId`: require `transactionUomId`.
5. `POST /purchases/orders/:id/receive`: require explicit or inherited transaction UOM and return the UOM snapshot.
6. `GET /inventory/balances`: include `baseUomId`, base UOM code/name, primary image thumbnail URL, and last movement date.
7. `GET /inventory/ledger`: include transaction UOM and base UOM display data.

### TR-04: Service-layer validation

1. Turn UOM enforcement on for the CADEG tenant before go-live. See [cadeg-uom-rollout.md](./cadeg-uom-rollout.md) for the safe rollout procedure (OPEN-only backfill, no POSTED history changes).
2. Treat missing `transactionUomId` as invalid for all new order lines, regardless of feature flag, once migration is complete.
3. Validate UOM belongs to the same tenant.
4. Validate item belongs to the same tenant and is active.
5. Validate conversion exists for item + from UOM + base UOM at document date.
6. Validate decimal precision according to UOM `decimalScale`.
7. Persist `conversionTrace` with path, conversion IDs, factor, rounding mode, source, and timestamp.
8. Block release/receive/posting if any line has incomplete UOM conversion data.
9. Log UOM changes to audit when line UOM changes after initial entry.

### TR-05: Frontend changes

Sales detail page:

1. Load available UOMs when an item is selected.
2. Add a UOM select to the add-line form.
3. Add a UOM select to edit-line mode.
4. Display transaction UOM and base quantity/UOM in the lines table.
5. Show conversion preview, for example: `2 CX = 24 KG`.
6. Surface missing conversion errors with a link to UOM exceptions or item conversions.

Purchases detail page:

1. Same add/edit UOM controls as sales.
2. Add UOM column to the purchase lines table.
3. Show package count, gross/tare/net kg fields where applicable.
4. Receipt modal must show and submit receipt UOM.
5. Receipt modal should default quantity and UOM from the PO line.
6. Display base quantity received versus ordered.

Inventory page:

1. Make balance rows keyboard and mouse navigable.
2. Show base UOM and image thumbnail.
3. Preserve accessible table semantics or use buttons/links inside the row.

New item detail page:

1. Route: `/inventory/items/:itemId`.
2. React Query detail fetch.
3. Product image area with fallback.
4. Tabs or sections for Overview, Stock/Lots, Ledger, UOM, Costing, Fiscal, Attachments.
5. Responsive layout for warehouse operators on mobile.

### TR-06: Accounting/posting changes

1. Extend posting preview beyond sales revenue:
   - sales receivable debit;
   - sales revenue credit;
   - tax payable/recoverable entries;
   - inventory credit;
   - COGS debit.
2. Add purchase receipt and purchase invoice posting strategies:
   - receipt increases item ledger and inventory value;
   - invoice posts supplier payable, recoverable/nonrecoverable taxes, freight/landed cost, and inventory adjustments.
3. Use `PostingSetup`, `TaxPostingSetup`, and `FiscalPostingSetup`; do not hardcode accounts.
4. Add `AccountingPeriod` or fiscal period controls before final posting.
5. Ensure each posting journal has balanced debit/credit totals.
6. Preserve posted source document status and audit log links.
7. Add reversal/correction requirements for posted sales shipment, purchase receipt, invoice, and inventory adjustment.

### TR-07: Security and permissions

1. Item detail read requires `inventory.read`.
2. Item image upload/update/delete requires `master.write` or a dedicated `inventory.media.write`.
3. UOM master changes require `master.write`.
4. Sales line UOM changes require `sales.write`.
5. Purchase line and receipt UOM changes require `purchases.write`.
6. Tenant isolation must be enforced in every new endpoint.
7. File upload endpoints must validate size, type, and ownership.

## Acceptance criteria

### UOM

1. A user cannot add a sales line without UOM.
2. A user cannot add a purchase line without UOM.
3. A user cannot receive a purchase line with an invalid or missing UOM.
4. A valid sales line stores transaction and base UOM fields plus conversion trace.
5. A valid purchase line stores transaction and base UOM fields plus conversion trace.
6. Sales release creates negative item ledger entries in base UOM with copied UOM snapshot.
7. Purchase receipt creates positive item ledger entries in base UOM with copied UOM snapshot.
8. Missing conversion creates a visible unresolved UOM exception.

### Stock and item detail

1. `/inventory` balance rows link to item detail.
2. Item detail displays product image or fallback.
3. Item detail displays current balance in base UOM.
4. Item detail displays recent ledger with transaction and base UOM.
5. Item detail displays lots, UOM conversions, and supplier/customer UOM defaults.
6. Image upload is tenant-scoped and visible after refresh.

### Accounting

1. Posting preview for a sales order is balanced.
2. Posting preview validates posting setup completeness.
3. Inventory value entries reconcile to item ledger quantities.
4. Posted ledgers are append-only.
5. Purchase receipt and sales release can be traced back to source document, line, lot, user, and posting date.

## Test requirements

### API unit tests

- UOM conversion direct, reverse, hub, identity, missing conversion, and rounding.
- UOM available endpoint default resolution by customer/supplier/item/base UOM.
- Item detail aggregation and tenant isolation.
- Media validation and primary image selection.

### API integration tests

- Update `sales-v1-flow.integration-spec.ts` to create line with UOM and assert line/ledger UOM fields.
- Update `purchases-create.integration-spec.ts` to create PO line with UOM.
- Update `purchases-receive.integration-spec.ts` to receive with inherited and overridden UOM.
- Add negative tests for missing UOM and missing conversion.
- Add item detail endpoint tests.
- Add posting preview tests for balanced entries and missing setup warnings.

### Frontend E2E tests

- Sales: select item, default UOM appears, add line, edit UOM, release, ledger shows base UOM movement.
- Purchases: select item, default vendor UOM appears, add line, release, receive with UOM, balance increases.
- Inventory: click balance row, item detail opens, product image or fallback is visible.
- UOM exception: invalid conversion shows actionable error.

## Implementation sequence

1. Backfill and verification scripts for item base UOM and historical transaction UOMs.
2. API UOM available/default endpoint.
3. Mandatory API validation for new sales and purchase lines.
4. React UOM selectors in sales and purchases.
5. Receipt UOM support in frontend.
6. Item detail API.
7. Item image/media model and endpoints.
8. Inventory row drill-down and item detail page.
9. Posting preview/accounting expansion.
10. Full test matrix and go-live data readiness report.

## Open decisions

1. Whether to enforce UOM globally or only for the CADEG tenant at first. Recommendation: enable for CADEG immediately after backfill, then make mandatory globally for all new tenants.
2. Whether item images are stored through extended `Attachment` or a dedicated `ItemMedia` table. Recommendation: dedicated `ItemMedia` if product image workflows will grow; extended `Attachment` if speed is more important.
3. Whether purchase reconstruction data should create synthetic PO lines with UOM `KG` only, or preserve any inferred purchase unit. Recommendation: preserve trace as `purchase_reconstruction` and do not invent supplier package UOM unless source evidence exists.
4. Whether sales release should remain the inventory shipment posting point or move to a separate shipment/posting document. Recommendation: keep release as shipment for prototype, then split into Business Central-like shipment/invoice posting before production accounting.

## External reference alignment

- Microsoft Business Central item UOM design: items have a base unit of measure for inventory, and alternate item units can be used for purchasing and sales. See [Set up item units of measure](https://learn.microsoft.com/en-us/dynamics365/business-central/inventory-how-setup-units-of-measure).
- Microsoft Business Central inventory valuation: inventory valuation is based on value entries and posting dates, not only physical balances. See [Design details - Inventory valuation](https://learn.microsoft.com/en-us/dynamics365/business-central/design-details-inventory-valuation).
- Microsoft Business Central posting groups: posting setup maps business/product posting groups to G/L accounts. See [Set up posting groups](https://learn.microsoft.com/en-gb/dynamics365/business-central/finance-posting-groups).
- Microsoft Business Central inventory posting: item ledger and value entries are created from posted inventory transactions and later reconcile to G/L. See [Design details - Inventory posting](https://learn.microsoft.com/ms-my/Dynamics365/business-central/design-details-inventory-posting).
- CFC lists NBC TG standards including the Conceptual Framework and NBC TG 16/CPC 16 inventory accounting alignment. See [Normas Completas - Conselho Federal de Contabilidade](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/normas-completas/).
- CPC 16 addresses inventory accounting and regulator approvals, including CFC/NBC TG 16 linkage. See [CPC 16 - Estoques](https://www.cpc.org.br/CPC/Documentos-emitidos/Pronunciamentos/Pronunciamento?Id=47).
- SPED EFD ICMS/IPI requires unit-of-measure identification records such as Registro 0190 and item/unit conversion concepts such as Registro 0220. See Receita Federal/SPED [Guia Pratico EFD ICMS/IPI](https://sped.rfb.gov.br/estatico/D3/E8079AF711D6FCC64E5890ECD756C90A2E9B74/GUIA_PRATICO_EFD_ICMS_IPI_Versao2.0.14.pdf) and [Perguntas Frequentes EFD ICMS/IPI](https://sped.rfb.gov.br/estatico/2A/0527AC1622CF15194D9A4AB4AFD25A4A84B34A/Perguntas%20Frequentes%20-%207.1.pdf).
