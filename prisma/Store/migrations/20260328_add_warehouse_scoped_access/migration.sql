-- Warehouse-scoped access control

CREATE TYPE "AccessScopeType" AS ENUM ('GLOBAL', 'WAREHOUSE');

ALTER TABLE "UserRole"
ADD COLUMN     "id" TEXT,
ADD COLUMN     "scopeType" "AccessScopeType" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "warehouseId" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "UserRole"
SET "id" = CONCAT('legacy_', MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text))
WHERE "id" IS NULL;

ALTER TABLE "UserRole"
ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_pkey";
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id");

ALTER TABLE "UserRole"
ADD CONSTRAINT "UserRole_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserRole_userId_roleId_scopeType_warehouseId_key"
ON "UserRole"("userId", "roleId", "scopeType", "warehouseId");

CREATE INDEX "UserRole_warehouseId_idx" ON "UserRole"("warehouseId");

CREATE TABLE "WarehouseMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseMembership_userId_warehouseId_key"
ON "WarehouseMembership"("userId", "warehouseId");

CREATE INDEX "WarehouseMembership_warehouseId_idx"
ON "WarehouseMembership"("warehouseId");

CREATE INDEX "WarehouseMembership_assignedById_idx"
ON "WarehouseMembership"("assignedById");

ALTER TABLE "WarehouseMembership"
ADD CONSTRAINT "WarehouseMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseMembership"
ADD CONSTRAINT "WarehouseMembership_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseMembership"
ADD CONSTRAINT "WarehouseMembership_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
