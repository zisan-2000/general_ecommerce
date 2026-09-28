-- Supplier ledger phase: invoices, payments, and immutable ledger entries

CREATE TYPE "SupplierInvoiceStatus" AS ENUM (
  'POSTED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED'
);

CREATE TYPE "SupplierPaymentMethod" AS ENUM (
  'CASH',
  'BANK_TRANSFER',
  'MOBILE_BANKING',
  'CHEQUE',
  'ADJUSTMENT'
);

CREATE TYPE "SupplierLedgerEntryType" AS ENUM (
  'INVOICE',
  'PAYMENT',
  'ADJUSTMENT'
);

CREATE TYPE "SupplierLedgerDirection" AS ENUM (
  'DEBIT',
  'CREDIT'
);

CREATE TABLE "SupplierInvoice" (
  "id" SERIAL NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "purchaseOrderId" INTEGER,
  "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'POSTED',
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key" ON "SupplierInvoice"("invoiceNumber");
CREATE INDEX "SupplierInvoice_supplierId_status_idx" ON "SupplierInvoice"("supplierId", "status");
CREATE INDEX "SupplierInvoice_purchaseOrderId_idx" ON "SupplierInvoice"("purchaseOrderId");
CREATE INDEX "SupplierInvoice_createdById_idx" ON "SupplierInvoice"("createdById");
CREATE INDEX "SupplierInvoice_issueDate_idx" ON "SupplierInvoice"("issueDate");
CREATE INDEX "SupplierInvoice_dueDate_idx" ON "SupplierInvoice"("dueDate");

CREATE TABLE "SupplierPayment" (
  "id" SERIAL NOT NULL,
  "paymentNumber" TEXT NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "supplierInvoiceId" INTEGER,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "method" "SupplierPaymentMethod" NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPayment_paymentNumber_key" ON "SupplierPayment"("paymentNumber");
CREATE INDEX "SupplierPayment_supplierId_paymentDate_idx" ON "SupplierPayment"("supplierId", "paymentDate");
CREATE INDEX "SupplierPayment_supplierInvoiceId_idx" ON "SupplierPayment"("supplierInvoiceId");
CREATE INDEX "SupplierPayment_createdById_idx" ON "SupplierPayment"("createdById");

CREATE TABLE "SupplierLedgerEntry" (
  "id" SERIAL NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entryType" "SupplierLedgerEntryType" NOT NULL,
  "direction" "SupplierLedgerDirection" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
  "note" TEXT,
  "referenceType" TEXT,
  "referenceNumber" TEXT,
  "purchaseOrderId" INTEGER,
  "supplierInvoiceId" INTEGER,
  "supplierPaymentId" INTEGER,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierLedgerEntry_supplierId_entryDate_idx" ON "SupplierLedgerEntry"("supplierId", "entryDate");
CREATE INDEX "SupplierLedgerEntry_supplierInvoiceId_idx" ON "SupplierLedgerEntry"("supplierInvoiceId");
CREATE INDEX "SupplierLedgerEntry_supplierPaymentId_idx" ON "SupplierLedgerEntry"("supplierPaymentId");
CREATE INDEX "SupplierLedgerEntry_purchaseOrderId_idx" ON "SupplierLedgerEntry"("purchaseOrderId");
CREATE INDEX "SupplierLedgerEntry_createdById_idx" ON "SupplierLedgerEntry"("createdById");

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierInvoice"
ADD CONSTRAINT "SupplierInvoice_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPayment"
ADD CONSTRAINT "SupplierPayment_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierPayment"
ADD CONSTRAINT "SupplierPayment_supplierInvoiceId_fkey"
FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPayment"
ADD CONSTRAINT "SupplierPayment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierLedgerEntry"
ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierLedgerEntry"
ADD CONSTRAINT "SupplierLedgerEntry_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierLedgerEntry"
ADD CONSTRAINT "SupplierLedgerEntry_supplierInvoiceId_fkey"
FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierLedgerEntry"
ADD CONSTRAINT "SupplierLedgerEntry_supplierPaymentId_fkey"
FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierLedgerEntry"
ADD CONSTRAINT "SupplierLedgerEntry_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
