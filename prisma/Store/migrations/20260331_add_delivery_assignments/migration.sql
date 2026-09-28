-- Delivery assignment operational flow

ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TYPE "DeliveryAssignmentStatus" AS ENUM (
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'PICKUP_CONFIRMED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED'
);

CREATE TYPE "PickupProofStatus" AS ENUM ('PENDING', 'CONFIRMED');

CREATE TABLE "DeliveryAssignment" (
  "id" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "shipmentId" INTEGER NOT NULL,
  "deliveryManProfileId" TEXT NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "assignedById" TEXT,
  "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "pickupProofStatus" "PickupProofStatus" NOT NULL DEFAULT 'PENDING',
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "rejectionReason" TEXT,
  "note" TEXT,
  "latestNote" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "pickupConfirmedAt" TIMESTAMP(3),
  "inTransitAt" TIMESTAMP(3),
  "outForDeliveryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryAssignmentLog" (
  "id" TEXT NOT NULL,
  "deliveryAssignmentId" TEXT NOT NULL,
  "fromStatus" "DeliveryAssignmentStatus",
  "toStatus" "DeliveryAssignmentStatus" NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryAssignmentLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehousePickupProof" (
  "id" TEXT NOT NULL,
  "deliveryAssignmentId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "status" "PickupProofStatus" NOT NULL DEFAULT 'PENDING',
  "productReceived" BOOLEAN NOT NULL,
  "packagingOk" BOOLEAN NOT NULL,
  "productInGoodCondition" BOOLEAN NOT NULL,
  "imageUrl" TEXT,
  "note" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WarehousePickupProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryAssignment_orderId_idx"
ON "DeliveryAssignment"("orderId");

CREATE INDEX "DeliveryAssignment_shipmentId_idx"
ON "DeliveryAssignment"("shipmentId");

CREATE INDEX "DeliveryAssignment_deliveryManProfileId_status_idx"
ON "DeliveryAssignment"("deliveryManProfileId", "status");

CREATE INDEX "DeliveryAssignment_deliveryManProfileId_isCurrent_idx"
ON "DeliveryAssignment"("deliveryManProfileId", "isCurrent");

CREATE INDEX "DeliveryAssignment_warehouseId_status_idx"
ON "DeliveryAssignment"("warehouseId", "status");

CREATE INDEX "DeliveryAssignment_assignedById_idx"
ON "DeliveryAssignment"("assignedById");

CREATE INDEX "DeliveryAssignment_shipmentId_isCurrent_idx"
ON "DeliveryAssignment"("shipmentId", "isCurrent");

CREATE INDEX "DeliveryAssignmentLog_deliveryAssignmentId_createdAt_idx"
ON "DeliveryAssignmentLog"("deliveryAssignmentId", "createdAt");

CREATE INDEX "DeliveryAssignmentLog_actorUserId_idx"
ON "DeliveryAssignmentLog"("actorUserId");

CREATE UNIQUE INDEX "WarehousePickupProof_deliveryAssignmentId_key"
ON "WarehousePickupProof"("deliveryAssignmentId");

CREATE INDEX "WarehousePickupProof_actorUserId_idx"
ON "WarehousePickupProof"("actorUserId");

CREATE INDEX "WarehousePickupProof_confirmedAt_idx"
ON "WarehousePickupProof"("confirmedAt");

ALTER TABLE "DeliveryAssignment"
ADD CONSTRAINT "DeliveryAssignment_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignment"
ADD CONSTRAINT "DeliveryAssignment_shipmentId_fkey"
FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignment"
ADD CONSTRAINT "DeliveryAssignment_deliveryManProfileId_fkey"
FOREIGN KEY ("deliveryManProfileId") REFERENCES "DeliveryManProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignment"
ADD CONSTRAINT "DeliveryAssignment_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignment"
ADD CONSTRAINT "DeliveryAssignment_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignmentLog"
ADD CONSTRAINT "DeliveryAssignmentLog_deliveryAssignmentId_fkey"
FOREIGN KEY ("deliveryAssignmentId") REFERENCES "DeliveryAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAssignmentLog"
ADD CONSTRAINT "DeliveryAssignmentLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehousePickupProof"
ADD CONSTRAINT "WarehousePickupProof_deliveryAssignmentId_fkey"
FOREIGN KEY ("deliveryAssignmentId") REFERENCES "DeliveryAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehousePickupProof"
ADD CONSTRAINT "WarehousePickupProof_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
