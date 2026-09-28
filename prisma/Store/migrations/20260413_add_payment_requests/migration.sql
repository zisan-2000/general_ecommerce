-- Create enums
CREATE TYPE "PaymentRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'MANAGER_APPROVED',
  'FINANCE_APPROVED',
  'TREASURY_PROCESSING',
  'PAID',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "PaymentRequestApprovalStage" AS ENUM (
  'DRAFT',
  'SUBMISSION',
  'MANAGER_REVIEW',
  'FINANCE_REVIEW',
  'TREASURY',
  'PAID',
  'REJECTION',
  'CANCELLATION'
);

CREATE TYPE "PaymentRequestApprovalDecision" AS ENUM (
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'PAID'
);

-- Create payment request table
CREATE TABLE "PaymentRequest" (
  "id" SERIAL NOT NULL,
  "prfNumber" TEXT NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "warehouseId" INTEGER,
  "purchaseOrderId" INTEGER,
  "comparativeStatementId" INTEGER,
  "goodsReceiptId" INTEGER,
  "supplierInvoiceId" INTEGER,
  "supplierPaymentId" INTEGER,
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "approvalStage" "PaymentRequestApprovalStage" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "managerApprovedAt" TIMESTAMP(3),
  "financeApprovedAt" TIMESTAMP(3),
  "treasuryProcessedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdById" TEXT,
  "managerApprovedById" TEXT,
  "financeApprovedById" TEXT,
  "treasuryProcessedById" TEXT,
  "rejectedById" TEXT,
  "cancelledById" TEXT,
  "note" TEXT,
  "referenceNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_prfNumber_key" ON "PaymentRequest"("prfNumber");
CREATE INDEX "PaymentRequest_supplierId_status_idx" ON "PaymentRequest"("supplierId", "status");
CREATE INDEX "PaymentRequest_warehouseId_idx" ON "PaymentRequest"("warehouseId");
CREATE INDEX "PaymentRequest_purchaseOrderId_idx" ON "PaymentRequest"("purchaseOrderId");
CREATE INDEX "PaymentRequest_comparativeStatementId_idx" ON "PaymentRequest"("comparativeStatementId");
CREATE INDEX "PaymentRequest_goodsReceiptId_idx" ON "PaymentRequest"("goodsReceiptId");
CREATE INDEX "PaymentRequest_supplierInvoiceId_idx" ON "PaymentRequest"("supplierInvoiceId");
CREATE INDEX "PaymentRequest_supplierPaymentId_idx" ON "PaymentRequest"("supplierPaymentId");
CREATE INDEX "PaymentRequest_createdById_idx" ON "PaymentRequest"("createdById");
CREATE INDEX "PaymentRequest_managerApprovedById_idx" ON "PaymentRequest"("managerApprovedById");
CREATE INDEX "PaymentRequest_financeApprovedById_idx" ON "PaymentRequest"("financeApprovedById");
CREATE INDEX "PaymentRequest_treasuryProcessedById_idx" ON "PaymentRequest"("treasuryProcessedById");
CREATE INDEX "PaymentRequest_requestedAt_idx" ON "PaymentRequest"("requestedAt");
CREATE INDEX "PaymentRequest_approvalStage_idx" ON "PaymentRequest"("approvalStage");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_comparativeStatementId_fkey" FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_financeApprovedById_fkey" FOREIGN KEY ("financeApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_treasuryProcessedById_fkey" FOREIGN KEY ("treasuryProcessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Approval events
CREATE TABLE "PaymentRequestApprovalEvent" (
  "id" SERIAL NOT NULL,
  "paymentRequestId" INTEGER NOT NULL,
  "stage" "PaymentRequestApprovalStage" NOT NULL,
  "decision" "PaymentRequestApprovalDecision" NOT NULL,
  "note" TEXT,
  "actedById" TEXT,
  "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRequestApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRequestApprovalEvent_paymentRequestId_stage_idx" ON "PaymentRequestApprovalEvent"("paymentRequestId", "stage");
CREATE INDEX "PaymentRequestApprovalEvent_actedById_idx" ON "PaymentRequestApprovalEvent"("actedById");

ALTER TABLE "PaymentRequestApprovalEvent" ADD CONSTRAINT "PaymentRequestApprovalEvent_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestApprovalEvent" ADD CONSTRAINT "PaymentRequestApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notifications
CREATE TABLE "PaymentRequestNotification" (
  "id" SERIAL NOT NULL,
  "paymentRequestId" INTEGER NOT NULL,
  "stage" "PaymentRequestApprovalStage" NOT NULL,
  "channel" "WorkflowNotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipientUserId" TEXT,
  "recipientEmail" TEXT,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "PaymentRequestNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRequestNotification_paymentRequestId_stage_createdAt_idx" ON "PaymentRequestNotification"("paymentRequestId", "stage", "createdAt");
CREATE INDEX "PaymentRequestNotification_recipientUserId_idx" ON "PaymentRequestNotification"("recipientUserId");
CREATE INDEX "PaymentRequestNotification_status_channel_idx" ON "PaymentRequestNotification"("status", "channel");
CREATE INDEX "PaymentRequestNotification_createdById_idx" ON "PaymentRequestNotification"("createdById");

ALTER TABLE "PaymentRequestNotification" ADD CONSTRAINT "PaymentRequestNotification_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestNotification" ADD CONSTRAINT "PaymentRequestNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentRequestNotification" ADD CONSTRAINT "PaymentRequestNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
