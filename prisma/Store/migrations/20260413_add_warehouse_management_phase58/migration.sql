-- CreateEnum
CREATE TYPE "public"."InventoryItemClass" AS ENUM ('CONSUMABLE', 'PERMANENT');

-- CreateEnum
CREATE TYPE "public"."MaterialRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SUPERVISOR_ENDORSED', 'PROJECT_MANAGER_ENDORSED', 'ADMIN_APPROVED', 'PARTIALLY_RELEASED', 'RELEASED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MaterialRequestApprovalStage" AS ENUM ('SUBMISSION', 'SUPERVISOR_ENDORSEMENT', 'PROJECT_MANAGER_ENDORSEMENT', 'ADMIN_APPROVAL', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "public"."MaterialRequestApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MaterialReleaseStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AssetRegisterStatus" AS ENUM ('ACTIVE', 'RETIRED', 'LOST', 'DISPOSED');

-- AlterTable
ALTER TABLE "public"."Product"
ADD COLUMN "inventoryItemClass" "public"."InventoryItemClass" NOT NULL DEFAULT 'CONSUMABLE',
ADD COLUMN "requiresAssetTag" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."MaterialRequest" (
    "id" SERIAL NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "public"."MaterialRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "purpose" TEXT,
    "budgetCode" TEXT,
    "boqReference" TEXT,
    "specification" TEXT,
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "supervisorEndorsedAt" TIMESTAMP(3),
    "supervisorEndorsedById" TEXT,
    "projectManagerEndorsedAt" TIMESTAMP(3),
    "projectManagerEndorsedById" TEXT,
    "adminApprovedAt" TIMESTAMP(3),
    "adminApprovedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialRequestItem" (
    "id" SERIAL NOT NULL,
    "materialRequestId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityReleased" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialRequestAttachment" (
    "id" SERIAL NOT NULL,
    "materialRequestId" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialRequestApprovalEvent" (
    "id" SERIAL NOT NULL,
    "materialRequestId" INTEGER NOT NULL,
    "stage" "public"."MaterialRequestApprovalStage" NOT NULL,
    "decision" "public"."MaterialRequestApprovalDecision" NOT NULL,
    "note" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequestApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialReleaseNote" (
    "id" SERIAL NOT NULL,
    "releaseNumber" TEXT NOT NULL,
    "challanNumber" TEXT,
    "waybillNumber" TEXT,
    "materialRequestId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "public"."MaterialReleaseStatus" NOT NULL DEFAULT 'ISSUED',
    "note" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReleaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialReleaseNoteItem" (
    "id" SERIAL NOT NULL,
    "materialReleaseNoteId" INTEGER NOT NULL,
    "materialRequestItemId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "quantityReleased" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReleaseNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetRegister" (
    "id" SERIAL NOT NULL,
    "assetTag" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "materialRequestId" INTEGER,
    "materialReleaseNoteId" INTEGER,
    "materialReleaseItemId" INTEGER,
    "status" "public"."AssetRegisterStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedTo" TEXT,
    "note" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_requestNumber_key" ON "public"."MaterialRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "MaterialRequest_warehouseId_status_idx" ON "public"."MaterialRequest"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "MaterialRequest_createdById_requestedAt_idx" ON "public"."MaterialRequest"("createdById", "requestedAt");

-- CreateIndex
CREATE INDEX "MaterialRequest_adminApprovedById_idx" ON "public"."MaterialRequest"("adminApprovedById");

-- CreateIndex
CREATE INDEX "MaterialRequest_requestedAt_idx" ON "public"."MaterialRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_materialRequestId_idx" ON "public"."MaterialRequestItem"("materialRequestId");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_productVariantId_idx" ON "public"."MaterialRequestItem"("productVariantId");

-- CreateIndex
CREATE INDEX "MaterialRequestAttachment_materialRequestId_createdAt_idx" ON "public"."MaterialRequestAttachment"("materialRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialRequestAttachment_uploadedById_idx" ON "public"."MaterialRequestAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "MaterialRequestApprovalEvent_materialRequestId_stage_actedAt_idx" ON "public"."MaterialRequestApprovalEvent"("materialRequestId", "stage", "actedAt");

-- CreateIndex
CREATE INDEX "MaterialRequestApprovalEvent_actedById_actedAt_idx" ON "public"."MaterialRequestApprovalEvent"("actedById", "actedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReleaseNote_releaseNumber_key" ON "public"."MaterialReleaseNote"("releaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReleaseNote_challanNumber_key" ON "public"."MaterialReleaseNote"("challanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReleaseNote_waybillNumber_key" ON "public"."MaterialReleaseNote"("waybillNumber");

-- CreateIndex
CREATE INDEX "MaterialReleaseNote_warehouseId_releasedAt_idx" ON "public"."MaterialReleaseNote"("warehouseId", "releasedAt");

-- CreateIndex
CREATE INDEX "MaterialReleaseNote_materialRequestId_idx" ON "public"."MaterialReleaseNote"("materialRequestId");

-- CreateIndex
CREATE INDEX "MaterialReleaseNote_releasedById_idx" ON "public"."MaterialReleaseNote"("releasedById");

-- CreateIndex
CREATE INDEX "MaterialReleaseNoteItem_materialReleaseNoteId_idx" ON "public"."MaterialReleaseNoteItem"("materialReleaseNoteId");

-- CreateIndex
CREATE INDEX "MaterialReleaseNoteItem_materialRequestItemId_idx" ON "public"."MaterialReleaseNoteItem"("materialRequestItemId");

-- CreateIndex
CREATE INDEX "MaterialReleaseNoteItem_productVariantId_idx" ON "public"."MaterialReleaseNoteItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRegister_assetTag_key" ON "public"."AssetRegister"("assetTag");

-- CreateIndex
CREATE INDEX "AssetRegister_warehouseId_status_idx" ON "public"."AssetRegister"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "AssetRegister_productVariantId_status_idx" ON "public"."AssetRegister"("productVariantId", "status");

-- CreateIndex
CREATE INDEX "AssetRegister_materialRequestId_idx" ON "public"."AssetRegister"("materialRequestId");

-- CreateIndex
CREATE INDEX "AssetRegister_materialReleaseNoteId_idx" ON "public"."AssetRegister"("materialReleaseNoteId");

-- CreateIndex
CREATE INDEX "AssetRegister_materialReleaseItemId_idx" ON "public"."AssetRegister"("materialReleaseItemId");

-- CreateIndex
CREATE INDEX "AssetRegister_createdById_idx" ON "public"."AssetRegister"("createdById");

-- AddForeignKey
ALTER TABLE "public"."MaterialRequest" ADD CONSTRAINT "MaterialRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequest" ADD CONSTRAINT "MaterialRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequest" ADD CONSTRAINT "MaterialRequest_supervisorEndorsedById_fkey" FOREIGN KEY ("supervisorEndorsedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequest" ADD CONSTRAINT "MaterialRequest_projectManagerEndorsedById_fkey" FOREIGN KEY ("projectManagerEndorsedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequest" ADD CONSTRAINT "MaterialRequest_adminApprovedById_fkey" FOREIGN KEY ("adminApprovedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequest" ADD CONSTRAINT "MaterialRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "public"."MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequestAttachment" ADD CONSTRAINT "MaterialRequestAttachment_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "public"."MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequestAttachment" ADD CONSTRAINT "MaterialRequestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequestApprovalEvent" ADD CONSTRAINT "MaterialRequestApprovalEvent_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "public"."MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialRequestApprovalEvent" ADD CONSTRAINT "MaterialRequestApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialReleaseNote" ADD CONSTRAINT "MaterialReleaseNote_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "public"."MaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialReleaseNote" ADD CONSTRAINT "MaterialReleaseNote_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialReleaseNote" ADD CONSTRAINT "MaterialReleaseNote_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialReleaseNoteItem" ADD CONSTRAINT "MaterialReleaseNoteItem_materialReleaseNoteId_fkey" FOREIGN KEY ("materialReleaseNoteId") REFERENCES "public"."MaterialReleaseNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialReleaseNoteItem" ADD CONSTRAINT "MaterialReleaseNoteItem_materialRequestItemId_fkey" FOREIGN KEY ("materialRequestItemId") REFERENCES "public"."MaterialRequestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialReleaseNoteItem" ADD CONSTRAINT "MaterialReleaseNoteItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRegister" ADD CONSTRAINT "AssetRegister_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRegister" ADD CONSTRAINT "AssetRegister_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRegister" ADD CONSTRAINT "AssetRegister_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "public"."MaterialRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRegister" ADD CONSTRAINT "AssetRegister_materialReleaseNoteId_fkey" FOREIGN KEY ("materialReleaseNoteId") REFERENCES "public"."MaterialReleaseNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRegister" ADD CONSTRAINT "AssetRegister_materialReleaseItemId_fkey" FOREIGN KEY ("materialReleaseItemId") REFERENCES "public"."MaterialReleaseNoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetRegister" ADD CONSTRAINT "AssetRegister_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
