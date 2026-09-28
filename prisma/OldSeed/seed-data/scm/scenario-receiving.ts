import type { ScmSeedContext, ScmSeedPrisma } from "./types";
import { daysAgo, decimal } from "./helpers";

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

async function upsertGoodsReceipt(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    key: string;
    receiptNumber: string;
    purchaseOrderKey: string;
    receivedDaysAgo: number;
    receiptMode: "FULL" | "PARTIAL" | "DAMAGED_RETURN_BASE";
    note: string;
  },
) {
  const po = requirePurchaseOrder(ctx, input.purchaseOrderKey);
  const receiver = requireUser(ctx, "warehouse_receiver");
  const requestor = requireUser(ctx, "procurement_requestor");

  const receipt = await prisma.goodsReceipt.upsert({
    where: { receiptNumber: input.receiptNumber },
    update: {
      purchaseOrderId: po.id,
      warehouseId: po.warehouseId,
      status: "RECEIVED",
      receivedAt: daysAgo(input.receivedDaysAgo),
      receivedById: receiver.id,
      requesterConfirmedAt: input.receiptMode === "DAMAGED_RETURN_BASE" ? null : daysAgo(input.receivedDaysAgo - 1),
      requesterConfirmedById: input.receiptMode === "DAMAGED_RETURN_BASE" ? null : requestor.id,
      requesterConfirmationNote:
        input.receiptMode === "DAMAGED_RETURN_BASE"
          ? null
          : "Requester confirmed seeded goods receipt.",
      note: input.note,
    },
    create: {
      receiptNumber: input.receiptNumber,
      purchaseOrderId: po.id,
      warehouseId: po.warehouseId,
      status: "RECEIVED",
      receivedAt: daysAgo(input.receivedDaysAgo),
      receivedById: receiver.id,
      requesterConfirmedAt: input.receiptMode === "DAMAGED_RETURN_BASE" ? null : daysAgo(input.receivedDaysAgo - 1),
      requesterConfirmedById: input.receiptMode === "DAMAGED_RETURN_BASE" ? null : requestor.id,
      requesterConfirmationNote:
        input.receiptMode === "DAMAGED_RETURN_BASE"
          ? null
          : "Requester confirmed seeded goods receipt.",
      note: input.note,
    },
    select: { id: true, receiptNumber: true, purchaseOrderId: true, warehouseId: true },
  });

  await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: receipt.id } });

  const poItems = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId: po.id },
    orderBy: { id: "asc" },
  });

  for (const item of poItems) {
    const quantityReceived =
      input.receiptMode === "PARTIAL"
        ? Math.max(1, Math.floor(item.quantityOrdered / 2))
        : input.receiptMode === "DAMAGED_RETURN_BASE"
          ? item.quantityOrdered
          : item.quantityOrdered;

    await prisma.goodsReceiptItem.create({
      data: {
        goodsReceiptId: receipt.id,
        purchaseOrderItemId: item.id,
        productVariantId: item.productVariantId,
        quantityReceived,
        unitCost: item.unitCost,
      },
    });

    await prisma.purchaseOrderItem.update({
      where: { id: item.id },
      data: { quantityReceived },
    });
  }

  return receipt;
}

export async function seedScmReceivingScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const nextCtx: ScmSeedContext = {
    ...ctx,
    goodsReceipts: { ...(ctx.goodsReceipts ?? {}) },
  };

  const fullReceipt = await upsertGoodsReceipt(prisma, ctx, {
    key: "happyPath",
    receiptNumber: "GRN-SCM-001",
    purchaseOrderKey: "happyPath",
    receivedDaysAgo: 4,
    receiptMode: "FULL",
    note: "Seeded full GRN for completed PO.",
  });
  nextCtx.goodsReceipts!.happyPath = fullReceipt;

  const partialReceipt = await upsertGoodsReceipt(prisma, ctx, {
    key: "partialReceiving",
    receiptNumber: "GRN-SCM-002",
    purchaseOrderKey: "partialReceiving",
    receivedDaysAgo: 2,
    receiptMode: "PARTIAL",
    note: "Seeded partial GRN to test receiving backlog and partial stock flow.",
  });
  nextCtx.goodsReceipts!.partialReceiving = partialReceipt;

  const returnReceipt = await upsertGoodsReceipt(prisma, ctx, {
    key: "returnFlow",
    receiptNumber: "GRN-SCM-003",
    purchaseOrderKey: "returnFlow",
    receivedDaysAgo: 3,
    receiptMode: "DAMAGED_RETURN_BASE",
    note: "Seeded GRN with damaged goods note for supplier return scenario.",
  });
  nextCtx.goodsReceipts!.returnFlow = returnReceipt;

  await prisma.goodsReceiptVendorEvaluation.deleteMany({
    where: { goodsReceiptId: returnReceipt.id },
  });

  await prisma.goodsReceiptVendorEvaluation.create({
    data: {
      goodsReceiptId: returnReceipt.id,
      evaluatorRole: "ADMINISTRATION",
      overallRating: 2,
      serviceQualityRating: 2,
      deliveryRating: 3,
      complianceRating: 2,
      comment: "Seeded quality issue: several safety boots arrived with damaged packaging.",
      createdById: requireUser(ctx, "warehouse_receiver").id,
    },
  });

  console.log("✅ SCM receiving scenarios ensured: full, partial, damaged GRN");
  return nextCtx;
}
