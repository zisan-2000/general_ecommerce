-- Phase 6 hardening: new categories must opt into footer placement.
-- Existing values are preserved; the Phase 6 backfill owns legacy visibility.
ALTER TABLE "Category"
  ALTER COLUMN "showInFooter" SET DEFAULT false;
