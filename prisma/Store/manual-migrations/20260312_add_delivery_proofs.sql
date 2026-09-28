ALTER TABLE "Shipment"
ADD COLUMN IF NOT EXISTS "deliveryConfirmationToken" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryConfirmationPin" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryConfirmationRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_deliveryConfirmationToken_key"
ON "Shipment"("deliveryConfirmationToken");

CREATE INDEX IF NOT EXISTS "Shipment_deliveryConfirmationRequestedAt_idx"
ON "Shipment"("deliveryConfirmationRequestedAt");

CREATE TABLE IF NOT EXISTS "DeliveryProof" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "shipmentId" INTEGER NOT NULL,
  "userId" TEXT,
  "tickReceived" BOOLEAN NOT NULL,
  "tickCorrectItems" BOOLEAN NOT NULL,
  "tickGoodCondition" BOOLEAN NOT NULL,
  "photoUrl" TEXT,
  "note" TEXT,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryProof_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryProof_shipmentId_key"
ON "DeliveryProof"("shipmentId");

CREATE INDEX IF NOT EXISTS "DeliveryProof_orderId_idx"
ON "DeliveryProof"("orderId");

CREATE INDEX IF NOT EXISTS "DeliveryProof_userId_idx"
ON "DeliveryProof"("userId");

CREATE INDEX IF NOT EXISTS "DeliveryProof_confirmedAt_idx"
ON "DeliveryProof"("confirmedAt");
