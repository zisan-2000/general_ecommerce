-- Provider-specific uniqueness using existing Payment metadata; no schema/model rewrite.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE UNIQUE INDEX "Payment_aibl_bank_order_unique"
ON "Payment" (("paymentGatewayData"->>'bankOrderId'))
WHERE "provider" = 'AIBL_WALLET' AND "paymentGatewayData"->>'bankOrderId' IS NOT NULL;
CREATE UNIQUE INDEX "Payment_aibl_bank_transaction_unique"
ON "Payment" (("paymentGatewayData"->>'bankTransactionId'))
WHERE "provider" = 'AIBL_WALLET' AND "paymentGatewayData"->>'bankTransactionId' IS NOT NULL;
COMMIT;
