ALTER TABLE "sitesettings"
  ADD COLUMN "homeFooterDescriptionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "homeFooterDescriptionTitle" TEXT,
  ADD COLUMN "homeFooterDescription" TEXT;
