import type { PrismaClient } from "../../../generated/prisma";

export type ScmSeedUserRef = {
  id: string;
  email: string;
  name: string;
  roleName: string;
};

export type ScmSeedWarehouseRef = {
  id: number;
  code: string;
  name: string;
  primaryBinId: number | null;
};

export type ScmSeedSupplierRef = {
  id: number;
  code: string;
  name: string;
};

export type ScmSeedVariantRef = {
  id: number;
  sku: string;
  productId: number;
  productName: string;
};

export type ScmSeedPurchaseOrderRef = {
  id: number;
  poNumber: string;
  supplierId: number;
  warehouseId: number;
};

export type ScmSeedGoodsReceiptRef = {
  id: number;
  receiptNumber: string;
  purchaseOrderId: number;
  warehouseId: number;
};

export type ScmSeedSupplierInvoiceRef = {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  purchaseOrderId: number | null;
};

export type ScmSeedMaterialRequestRef = {
  id: number;
  requestNumber: string;
  warehouseId: number;
};

export type ScmSeedMaterialReleaseRef = {
  id: number;
  releaseNumber: string;
  materialRequestId: number;
  warehouseId: number;
};

export type ScmSeedWarehouseTransferRef = {
  id: number;
  transferNumber: string;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
};

export type ScmSeedContext = {
  adminUserId: string | null;
  users: Record<string, ScmSeedUserRef>;
  warehouses: Record<string, ScmSeedWarehouseRef>;
  suppliers: Record<string, ScmSeedSupplierRef>;
  variants: Record<string, ScmSeedVariantRef>;
  purchaseOrders?: Record<string, ScmSeedPurchaseOrderRef>;
  goodsReceipts?: Record<string, ScmSeedGoodsReceiptRef>;
  supplierInvoices?: Record<string, ScmSeedSupplierInvoiceRef>;
  materialRequests?: Record<string, ScmSeedMaterialRequestRef>;
  materialReleases?: Record<string, ScmSeedMaterialReleaseRef>;
  warehouseTransfers?: Record<string, ScmSeedWarehouseTransferRef>;
};

export type ScmSeedPrisma = PrismaClient;
