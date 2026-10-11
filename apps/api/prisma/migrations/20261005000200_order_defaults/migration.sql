ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NEW';
CREATE INDEX "OrderAssignment_userId_idx" ON "OrderAssignment"("userId");
