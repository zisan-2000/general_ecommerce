-- Forward-only Phase 8 safety repair.
--
-- The preceding migration may already be recorded in deployed databases, so
-- its checksum must remain untouched. This additive migration restores the
-- rollback-compatible representation. Data synchronization intentionally
-- lives in the idempotent backfill command, not in this migration.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "writerId" INTEGER,
  ADD COLUMN IF NOT EXISTS "publisherId" INTEGER;

CREATE INDEX IF NOT EXISTS "Product_writerId_deleted_available_idx"
  ON "Product"("writerId", "deleted", "available");
CREATE INDEX IF NOT EXISTS "Product_publisherId_deleted_available_idx"
  ON "Product"("publisherId", "deleted", "available");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_writerId_fkey'
      AND conrelid = '"Product"'::regclass
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_writerId_fkey"
      FOREIGN KEY ("writerId") REFERENCES "Writer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_publisherId_fkey'
      AND conrelid = '"Product"'::regclass
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_publisherId_fkey"
      FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
