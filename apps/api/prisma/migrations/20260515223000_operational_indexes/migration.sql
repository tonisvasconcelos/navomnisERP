-- Operational list/report indexes (V5 gap — audit §13 / database audit)
CREATE INDEX "SalesOrder_tenantId_companyId_orderDate_idx" ON "SalesOrder"("tenantId", "companyId", "orderDate");

CREATE INDEX "SalesOrder_tenantId_customerId_orderDate_idx" ON "SalesOrder"("tenantId", "customerId", "orderDate");

CREATE INDEX "PurchaseOrder_tenantId_vendorId_orderDate_idx" ON "PurchaseOrder"("tenantId", "vendorId", "orderDate");

CREATE INDEX "PurchaseOrder_tenantId_companyId_orderDate_idx" ON "PurchaseOrder"("tenantId", "companyId", "orderDate");

CREATE INDEX "Notification_tenantId_userId_createdAt_idx" ON "Notification"("tenantId", "userId", "createdAt");

CREATE INDEX "OutboxEvent_tenantId_publishedAt_type_idx" ON "OutboxEvent"("tenantId", "publishedAt", "type");
