import type { ScmSeedContext, ScmSeedPrisma } from "./types";
import { daysAgo, daysFromNow, decimal } from "./helpers";

function requireUser(ctx: ScmSeedContext, key: string) {
  const user = ctx.users[key];
  if (!user) throw new Error(`Missing SCM seed user: ${key}`);
  return user;
}

function requirePurchaseOrder(ctx: ScmSeedContext, key: string) {
  const purchaseOrder = ctx.purchaseOrders?.[key];
  if (!purchaseOrder) throw new Error(`Missing SCM seed purchase order: ${key}`);
  return purchaseOrder;
}

function requireGoodsReceipt(ctx: ScmSeedContext, key: string) {
  const goodsReceipt = ctx.goodsReceipts?.[key];
  if (!goodsReceipt) throw new Error(`Missing SCM seed goods receipt: ${key}`);
  return goodsReceipt;
}

function requireInvoice(ctx: ScmSeedContext, key: string) {
  const invoice = ctx.supplierInvoices?.[key];
  if (!invoice) throw new Error(`Missing SCM seed supplier invoice: ${key}`);
  return invoice;
}

async function upsertSupplierReturn(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    returnNumber: string;
    purchaseOrderKey: string;
    goodsReceiptKey: string;
    invoiceKey?: string;
    status: "SUBMITTED" | "APPROVED" | "DISPATCHED" | "CLOSED";
    requestedDaysAgo: number;
    quantityToReturn: number;
    reasonCode: string;
    note: string;
  },
) {
  const po = requirePurchaseOrder(ctx, input.purchaseOrderKey);
  const grn = requireGoodsReceipt(ctx, input.goodsReceiptKey);
  const invoice = input.invoiceKey ? requireInvoice(ctx, input.invoiceKey) : null;
  const returnManager = requireUser(ctx, "supplier_return_manager");
  const warehouseReceiver = requireUser(ctx, "warehouse_receiver");
  const finalApprover = requireUser(ctx, "final_approver");

  const supplierReturn = await prisma.supplierReturn.upsert({
    where: { returnNumber: input.returnNumber },
    update: {
      supplierId: po.supplierId,
      warehouseId: po.warehouseId,
      purchaseOrderId: po.id,
      goodsReceiptId: grn.id,
      supplierInvoiceId: invoice?.id ?? null,
      status: input.status,
      requestedAt: daysAgo(input.requestedDaysAgo),
      requiredBy: daysFromNow(5),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      approvedAt: ["APPROVED", "DISPATCHED", "CLOSED"].includes(input.status) ? daysAgo(input.requestedDaysAgo - 2) : null,
      dispatchedAt: ["DISPATCHED", "CLOSED"].includes(input.status) ? daysAgo(input.requestedDaysAgo - 3) : null,
      closedAt: input.status === "CLOSED" ? daysAgo(input.requestedDaysAgo - 4) : null,
      ledgerPostedAt: input.status === "CLOSED" ? daysAgo(input.requestedDaysAgo - 4) : null,
      createdById: returnManager.id,
      approvedById: finalApprover.id,
      dispatchedById: warehouseReceiver.id,
      closedById: returnManager.id,
      reasonCode: input.reasonCode,
      note: input.note,
    },
    create: {
      returnNumber: input.returnNumber,
      supplierId: po.supplierId,
      warehouseId: po.warehouseId,
      purchaseOrderId: po.id,
      goodsReceiptId: grn.id,
      supplierInvoiceId: invoice?.id ?? null,
      status: input.status,
      requestedAt: daysAgo(input.requestedDaysAgo),
      requiredBy: daysFromNow(5),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      approvedAt: ["APPROVED", "DISPATCHED", "CLOSED"].includes(input.status) ? daysAgo(input.requestedDaysAgo - 2) : null,
      dispatchedAt: ["DISPATCHED", "CLOSED"].includes(input.status) ? daysAgo(input.requestedDaysAgo - 3) : null,
      closedAt: input.status === "CLOSED" ? daysAgo(input.requestedDaysAgo - 4) : null,
      ledgerPostedAt: input.status === "CLOSED" ? daysAgo(input.requestedDaysAgo - 4) : null,
      createdById: returnManager.id,
      approvedById: finalApprover.id,
      dispatchedById: warehouseReceiver.id,
      closedById: returnManager.id,
      reasonCode: input.reasonCode,
      note: input.note,
    },
    select: { id: true, returnNumber: true, supplierId: true },
  });

  await prisma.supplierReturnItem.deleteMany({ where: { supplierReturnId: supplierReturn.id } });
  const receiptItems = await prisma.goodsReceiptItem.findMany({
    where: { goodsReceiptId: grn.id },
    orderBy: { id: "asc" },
    take: 1,
  });

  for (const item of receiptItems) {
    const qty = Math.min(input.quantityToReturn, item.quantityReceived);
    const unitCost = Number(item.unitCost);
    await prisma.supplierReturnItem.create({
      data: {
        supplierReturnId: supplierReturn.id,
        goodsReceiptItemId: item.id,
        purchaseOrderItemId: item.purchaseOrderItemId,
        productVariantId: item.productVariantId,
        description: "Seeded damaged/quality issue return item.",
        quantityRequested: qty,
        quantityDispatched: ["DISPATCHED", "CLOSED"].includes(input.status) ? qty : 0,
        unitCost: item.unitCost,
        lineTotal: decimal(qty * unitCost),
        reason: input.note,
      },
    });
  }

  const returnTotal = await prisma.supplierReturnItem.findMany({
    where: { supplierReturnId: supplierReturn.id },
    select: { lineTotal: true },
  });
  const amount = returnTotal.reduce((sum, row) => sum + Number(row.lineTotal), 0);

  await prisma.supplierLedgerEntry.deleteMany({
    where: { referenceType: "SUPPLIER_RETURN", referenceNumber: input.returnNumber },
  });

  if (input.status === "CLOSED" && amount > 0) {
    await prisma.supplierLedgerEntry.create({
      data: {
        supplierId: supplierReturn.supplierId,
        entryDate: daysAgo(input.requestedDaysAgo - 4),
        entryType: "ADJUSTMENT",
        direction: "DEBIT",
        amount: decimal(amount),
        currency: "BDT",
        note: "Seeded payable reduction from supplier return.",
        referenceType: "SUPPLIER_RETURN",
        referenceNumber: input.returnNumber,
        purchaseOrderId: po.id,
        supplierInvoiceId: invoice?.id ?? null,
        supplierReturnId: supplierReturn.id,
        createdById: returnManager.id,
      },
    });
  }

  return supplierReturn;
}

export async function seedScmReturnScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  await upsertSupplierReturn(prisma, ctx, {
    returnNumber: "RET-SCM-001",
    purchaseOrderKey: "returnFlow",
    goodsReceiptKey: "returnFlow",
    invoiceKey: "returnFlow",
    status: "CLOSED",
    requestedDaysAgo: 2,
    quantityToReturn: 6,
    reasonCode: "DAMAGED_GOODS",
    note: "Seeded closed supplier return for damaged goods.",
  });

  await upsertSupplierReturn(prisma, ctx, {
    returnNumber: "RET-SCM-002",
    purchaseOrderKey: "partialReceiving",
    goodsReceiptKey: "partialReceiving",
    invoiceKey: "partialReceiving",
    status: "SUBMITTED",
    requestedDaysAgo: 1,
    quantityToReturn: 1,
    reasonCode: "SHORT_SUPPLY_FOLLOWUP",
    note: "Seeded open return/follow-up case for exception screens.",
  });

  console.log("✅ SCM return scenarios ensured: closed and open supplier returns");
  return ctx;
}
