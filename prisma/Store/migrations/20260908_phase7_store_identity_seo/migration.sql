-- Phase 7: additive store identity, localization and SEO configuration.
-- Legacy siteTitle/footerDescription remain available during compatibility rollout.
ALTER TABLE "sitesettings"
  ADD COLUMN "storeName" TEXT,
  ADD COLUMN "storeTagline" TEXT,
  ADD COLUMN "defaultSeoTitle" TEXT,
  ADD COLUMN "defaultSeoDescription" TEXT,
  ADD COLUMN "defaultSeoKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "defaultOgImage" TEXT,
  ADD COLUMN "favicon" TEXT,
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "currencyPosition" VARCHAR(8),
  ADD COLUMN "timezone" VARCHAR(64),
  ADD COLUMN "locale" VARCHAR(35),
  ADD COLUMN "storeType" VARCHAR(32);
