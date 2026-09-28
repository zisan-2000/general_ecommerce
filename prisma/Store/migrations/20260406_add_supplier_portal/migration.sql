CREATE TYPE "SupplierPortalAccessStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
);

CREATE TABLE "SupplierPortalAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "status" "SupplierPortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "SupplierPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPortalAccess_userId_key" ON "SupplierPortalAccess"("userId");
CREATE INDEX "SupplierPortalAccess_supplierId_status_idx" ON "SupplierPortalAccess"("supplierId", "status");
CREATE INDEX "SupplierPortalAccess_createdById_idx" ON "SupplierPortalAccess"("createdById");

ALTER TABLE "SupplierPortalAccess"
  ADD CONSTRAINT "SupplierPortalAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPortalAccess"
  ADD CONSTRAINT "SupplierPortalAccess_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPortalAccess"
  ADD CONSTRAINT "SupplierPortalAccess_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
