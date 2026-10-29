BEGIN;

-- Assignment membership and timestamps are independent of the production stage.
-- Preserve all status history verbatim, including historical ASSIGNED events.
UPDATE "Order"
SET "status" = 'MAKING', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'ASSIGNED';

-- Retain the enum value for OrderStatusHistory, but prohibit it on current orders.
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_not_assigned"
  CHECK ("status" <> 'ASSIGNED');

COMMIT;
