# RJ Fresh Produce Implementation Backlog

## Critical

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Apply fresh-produce migration | Run `20260516143000_rj_fresh_produce_operations` in disposable Postgres | DB | 0.5 day | Critical |
| Integration tests | Cover lot receipt, loss posting, expiry risk, tenant isolation, RBAC | API | 1-2 days | High |
| FEFO sales enforcement | Reserve and release sales lines by lot expiration and kg balance | sales, inventory | 3-5 days | High |
| Purchase receiving | Convert purchase receipts into lots, quality checks, value entries | purchases, inventory | 5-8 days | High |
| RJ fiscal legal setup | Configure horticultural tax scenarios with Rio de Janeiro tax review | fiscal | 3-5 days | Critical |

## High

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Average costing engine | Calculate weighted average cost by item/lot and post value adjustments | inventory, finance | 5-10 days | High |
| Landed cost application | Allocate freight/handling to purchase lines and value ledger | purchases, finance | 3-5 days | High |
| Quality workflow | Quarantine, approve, reject, reclassify, and trigger loss events | inventory, web | 3-5 days | High |
| Mobile receiving | Capacitor receiving screen with offline event queue | mobile, web, API | 5-8 days | High |
| Producer register | Supplier classification for rural producer, CEASA supplier, distributor | parties, fiscal | 2-4 days | High |

## Medium

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Route planning | Assign orders to routes, vehicle, windows, loading sequence | logistics, web | 3-5 days | Medium |
| Spoilage dashboard | KPIs by item, supplier, lot, warehouse, reason | dashboard | 2-3 days | Medium |
| Returnable packaging | Track crates/pallets by customer/vendor and deposits | inventory, finance | 3-5 days | Medium |
| Scale integration adapter | Device abstraction for receiving and checkout scales | API, mobile | 3-5 days | Medium |
| Tax reform scenarios | IBS/CBS coexistence fields for agricultural operations | fiscal | 3-5 days | Medium |

## Low

| Task | Description | Modules | Effort | Risk |
|---|---|---|---:|---|
| Route proof of delivery | Capture delivery confirmation and exceptions | mobile | 2-4 days | Medium |
| Seasonality forecasting | Use sales/purchase history for pricing and cash forecast | analytics | 5-10 days | Medium |
| Cold chain telemetry | Temperature readings by zone/route | IoT/API | 5-10 days | Medium |
