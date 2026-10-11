CREATE INDEX "Order_createdAt_serialNumber_idx" ON "Order"("createdAt", "serialNumber");
CREATE INDEX "Order_updatedAt_serialNumber_idx" ON "Order"("updatedAt", "serialNumber");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "FileRecord_orderId_idx" ON "FileRecord"("orderId");
