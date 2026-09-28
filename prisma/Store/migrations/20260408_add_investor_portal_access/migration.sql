CREATE TYPE "InvestorPortalAccessStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
);

CREATE TABLE "InvestorPortalAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "investorId" INTEGER NOT NULL,
  "status" "InvestorPortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "InvestorPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvestorPortalAccess_userId_key" ON "InvestorPortalAccess"("userId");
CREATE INDEX "InvestorPortalAccess_investorId_status_idx" ON "InvestorPortalAccess"("investorId", "status");
CREATE INDEX "InvestorPortalAccess_createdById_idx" ON "InvestorPortalAccess"("createdById");

ALTER TABLE "InvestorPortalAccess"
  ADD CONSTRAINT "InvestorPortalAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorPortalAccess"
  ADD CONSTRAINT "InvestorPortalAccess_investorId_fkey"
  FOREIGN KEY ("investorId") REFERENCES "Investor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvestorPortalAccess"
  ADD CONSTRAINT "InvestorPortalAccess_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
