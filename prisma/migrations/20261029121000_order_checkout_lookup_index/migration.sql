-- Restore the missing lookup index identified by the payment/idempotency audit.
-- This is a performance index; the existing order-claim advisory lock continues
-- to provide serialization. No financial rows are changed or deduplicated.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE INDEX IF NOT EXISTS "Order_checkoutIdempotency_key_idx"
  ON "Order" (("commercialContext" #>> '{checkoutIdempotency,key}'));
COMMIT;
