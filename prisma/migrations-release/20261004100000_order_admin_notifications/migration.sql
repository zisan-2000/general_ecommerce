CREATE TABLE "OrderAdminNotification" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "stage" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "navigationSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAdminNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderAdminNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderAdminNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrderAdminNotification_userId_readAt_createdAt_idx" ON "OrderAdminNotification"("userId", "readAt", "createdAt");
CREATE INDEX "OrderAdminNotification_userId_stage_navigationSeenAt_idx" ON "OrderAdminNotification"("userId", "stage", "navigationSeenAt");
CREATE INDEX "OrderAdminNotification_orderId_createdAt_idx" ON "OrderAdminNotification"("orderId", "createdAt");
