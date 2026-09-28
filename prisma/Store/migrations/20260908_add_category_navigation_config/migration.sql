-- Phase 6: configurable category navigation and homepage placement.
-- Additive only: no existing category field is renamed or removed.
ALTER TABLE "Category"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "showInHeader" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showInFooter" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Category_isActive_showInHeader_sortOrder_idx"
  ON "Category"("isActive", "showInHeader", "sortOrder");

CREATE INDEX "Category_isActive_showInFooter_sortOrder_idx"
  ON "Category"("isActive", "showInFooter", "sortOrder");

CREATE INDEX "Category_isActive_featured_sortOrder_idx"
  ON "Category"("isActive", "featured", "sortOrder");
