-- Phase 2 is additive. Defaults are inserted by the idempotent backfill command
-- after this migration is deployed.
CREATE TYPE "StoreFeatureKey" AS ENUM (
  'PC_BUILDER',
  'BOOKS',
  'AUTHORS',
  'COMPARE',
  'DIGITAL_PRODUCTS',
  'SERVICE_PRODUCTS',
  'BUNDLES'
);

CREATE TABLE "StoreFeature" (
  "id" SERIAL NOT NULL,
  "key" "StoreFeatureKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StoreFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreFeature_key_key" ON "StoreFeature"("key");
