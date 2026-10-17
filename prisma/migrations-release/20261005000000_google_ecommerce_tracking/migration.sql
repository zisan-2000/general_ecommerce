ALTER TABLE "sitesettings"
  ADD COLUMN "googleTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "googleTagManagerEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "googleTagManagerId" VARCHAR(64),
  ADD COLUMN "googleAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "googleAnalyticsMeasurementId" VARCHAR(32),
  ADD COLUMN "googleAnalyticsDebugMode" BOOLEAN NOT NULL DEFAULT false;
