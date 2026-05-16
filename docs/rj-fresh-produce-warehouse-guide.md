# Fresh Produce Warehouse Guide

## Warehouse Model

Use `Warehouse` for physical establishments or operational depots. Link to `Branch` when the warehouse belongs to a fiscal establishment.

Use `WarehouseZone` for operational control:

- `RECEIVING`: inbound weighing and inspection
- `QUARANTINE`: blocked lots awaiting quality/fiscal validation
- `COLD_ROOM`: refrigerated storage
- `RIPENING`: banana, avocado, mango, and similar controlled ripening
- `PICKING`: separation area
- `EXPEDITION`: loaded or ready-to-load goods
- `WASTE`: discarded/spoilage flow

## FEFO

Fresh produce picking should use FEFO: earliest expiration first. Current implementation exposes `/api/v1/produce/expiration-risk`; the next step is enforcing FEFO during sales release and mobile picking.

## Weighted Receiving

Receiving must capture:

- gross weight
- package type and tare
- net kg
- package count
- producer/origin
- harvest date
- received date
- expiration date or shelf-life days
- quality grade

The current lot receipt API records kg and creates stock/value entries. Scale integration is prepared through `AgriculturalItemProfile.scaleIntegrationCode`.

## Loss Control

Spoilage, shrinkage, damage, reclassification, and weight variance are posted as `InventoryLossEvent`. When a lot is provided, the lot kg balance is reduced and a negative item ledger entry is generated.

## Mobile Readiness

Capacitor can reuse the web app. Mobile workflows should be split into:

- receiving and weighing
- quality inspection
- FEFO picking
- route loading
- delivery confirmation

Offline mode must queue local events and replay them with idempotency keys before customer use.
