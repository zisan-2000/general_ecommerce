import type { ScmSeedContext, ScmSeedPrisma } from "./types";
import { daysAgo, daysFromNow, decimal } from "./helpers";

function requireUser(ctx: ScmSeedContext, key: string) {
  const user = ctx.users[key];
  if (!user) throw new Error(`Missing SCM seed user: ${key}`);
  return user;
}

function requirePurchaseOrder(ctx: ScmSeedContext, key: string) {
  const purchaseOrder = ctx.purchaseOrders?.[key];
  if (!purchaseOrder)
    throw new Error(`Missing SCM seed purchase order: ${key}`);
  return purchaseOrder;
}

function requireGoodsReceipt(ctx: ScmSeedContext, key: string) {
  const goodsReceipt = ctx.goodsReceipts?.[key];
  if (!goodsReceipt) throw new Error(`Missing SCM seed goods receipt: ${key}`);
  return goodsReceipt;
}

async function recreateInvoiceItems(
  prisma: ScmSeedPrisma,
  supplierInvoiceId: number,
  purchaseOrderId: number,
  partial = false,
) {
  await prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoiceId } });
  const poItems = await prisma.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    orderBy: { id: "asc" },
  });

  for (const item of poItems) {
    const qty = partial
      ? Math.max(1, Math.floor(item.quantityOrdered / 2))
      : item.quantityOrdered;
    const unitCost = Number(item.unitCost);
    await prisma.supplierInvoiceItem.create({
      data: {
        supplierInvoiceId,
        purchaseOrderItemId: item.id,
        productVariantId: item.productVariantId,
        description: item.description,
        quantityInvoiced: qty,
        unitCost: item.unitCost,
        lineTotal: decimal(qty * unitCost),
      },
    });
  }
}

async function upsertSupplierInvoice(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    key: string;
    invoiceNumber: string;
    purchaseOrderKey: string;
    status: "POSTED" | "PARTIALLY_PAID" | "PAID";
    matchStatus: "MATCHED" | "VARIANCE" | "PENDING";
    issueDaysAgo: number;
    partial?: boolean;
    paymentHold?: boolean;
    note: string;
  },
) {
  const poRef = requirePurchaseOrder(ctx, input.purchaseOrderKey);
  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poRef.id },
  });
  const financeFocal = requireUser(ctx, "finance_focal");

  const invoiceSubtotal = input.partial
    ? Number(po.subtotal) / 2
    : Number(po.subtotal);
  const invoiceTax = input.partial
    ? Number(po.taxTotal) / 2
    : Number(po.taxTotal);
  const otherCharges = input.partial
    ? Number(po.shippingTotal) / 2
    : Number(po.shippingTotal);
  const invoiceTotal = invoiceSubtotal + invoiceTax + otherCharges;

  const invoice = await prisma.supplierInvoice.upsert({
    where: { invoiceNumber: input.invoiceNumber },
    update: {
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      status: input.status,
      matchStatus: input.matchStatus,
      issueDate: daysAgo(input.issueDaysAgo),
      dueDate: daysFromNow(20),
      postedAt: daysAgo(input.issueDaysAgo - 1),
      createdById: financeFocal.id,
      matchedAt:
        input.matchStatus === "PENDING"
          ? null
          : daysAgo(input.issueDaysAgo - 2),
      matchedById: input.matchStatus === "PENDING" ? null : financeFocal.id,
      currency: "BDT",
      subtotal: decimal(invoiceSubtotal),
      taxTotal: decimal(invoiceTax),
      otherCharges: decimal(otherCharges),
      total: decimal(invoiceTotal),
      note: input.note,
      paymentHoldStatus: input.paymentHold ? "HELD" : "CLEAR",
      paymentHoldReason: input.paymentHold
        ? "Seeded SLA/quality variance hold."
        : null,
      paymentHoldAt: input.paymentHold ? daysAgo(input.issueDaysAgo - 1) : null,
    },
    create: {
      invoiceNumber: input.invoiceNumber,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      status: input.status,
      matchStatus: input.matchStatus,
      issueDate: daysAgo(input.issueDaysAgo),
      dueDate: daysFromNow(20),
      postedAt: daysAgo(input.issueDaysAgo - 1),
      createdById: financeFocal.id,
      matchedAt:
        input.matchStatus === "PENDING"
          ? null
          : daysAgo(input.issueDaysAgo - 2),
      matchedById: input.matchStatus === "PENDING" ? null : financeFocal.id,
      currency: "BDT",
      subtotal: decimal(invoiceSubtotal),
      taxTotal: decimal(invoiceTax),
      otherCharges: decimal(otherCharges),
      total: decimal(invoiceTotal),
      note: input.note,
      paymentHoldStatus: input.paymentHold ? "HELD" : "CLEAR",
      paymentHoldReason: input.paymentHold
        ? "Seeded SLA/quality variance hold."
        : null,
      paymentHoldAt: input.paymentHold ? daysAgo(input.issueDaysAgo - 1) : null,
    },
    select: {
      id: true,
      invoiceNumber: true,
      supplierId: true,
      purchaseOrderId: true,
      total: true,
    },
  });

  await recreateInvoiceItems(prisma, invoice.id, po.id, input.partial);

  await prisma.supplierLedgerEntry.deleteMany({
    where: {
      referenceType: "SUPPLIER_INVOICE",
      referenceNumber: input.invoiceNumber,
    },
  });
  await prisma.supplierLedgerEntry.create({
    data: {
      supplierId: invoice.supplierId,
      entryDate: daysAgo(input.issueDaysAgo),
      entryType: "INVOICE",
      direction: "CREDIT",
      amount: invoice.total,
      currency: "BDT",
      note: "Seeded ledger payable from supplier invoice.",
      referenceType: "SUPPLIER_INVOICE",
      referenceNumber: input.invoiceNumber,
      purchaseOrderId: invoice.purchaseOrderId,
      supplierInvoiceId: invoice.id,
      createdById: financeFocal.id,
    },
  });

  return invoice;
}

async function upsertPaymentRequest(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    prfNumber: string;
    invoiceId: number;
    goodsReceiptKey: string;
    status:
      | "SUBMITTED"
      | "MANAGER_APPROVED"
      | "FINANCE_APPROVED"
      | "PAID"
      | "REJECTED";
    amount: number;
    requestedDaysAgo: number;
    note: string;
  },
) {
  const invoice = await prisma.supplierInvoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
  });
  const grn = requireGoodsReceipt(ctx, input.goodsReceiptKey);
  const manager = requireUser(ctx, "ap_manager");
  const finance = requireUser(ctx, "finance_focal");
  const treasury = requireUser(ctx, "final_approver");

  const approvalStage =
    input.status === "SUBMITTED"
      ? "MANAGER_REVIEW"
      : input.status === "MANAGER_APPROVED"
        ? "FINANCE_REVIEW"
        : input.status === "FINANCE_APPROVED"
          ? "TREASURY"
          : input.status === "PAID"
            ? "PAID"
            : "REJECTION";

  return prisma.paymentRequest.upsert({
    where: { prfNumber: input.prfNumber },
    update: {
      supplierId: invoice.supplierId,
      warehouseId: grn.warehouseId,
      purchaseOrderId: invoice.purchaseOrderId,
      goodsReceiptId: grn.id,
      supplierInvoiceId: invoice.id,
      status: input.status,
      approvalStage,
      amount: decimal(input.amount),
      currency: "BDT",
      requestedAt: daysAgo(input.requestedDaysAgo),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      managerApprovedAt: [
        "MANAGER_APPROVED",
        "FINANCE_APPROVED",
        "PAID",
      ].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 2)
        : null,
      financeApprovedAt: ["FINANCE_APPROVED", "PAID"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 3)
        : null,
      treasuryProcessedAt:
        input.status === "PAID" ? daysAgo(input.requestedDaysAgo - 4) : null,
      paidAt:
        input.status === "PAID" ? daysAgo(input.requestedDaysAgo - 4) : null,
      rejectedAt:
        input.status === "REJECTED"
          ? daysAgo(input.requestedDaysAgo - 2)
          : null,
      createdById: manager.id,
      managerApprovedById: manager.id,
      financeApprovedById: finance.id,
      treasuryProcessedById: treasury.id,
      rejectedById: input.status === "REJECTED" ? manager.id : null,
      note: input.note,
      referenceNumber: invoice.invoiceNumber,
    },
    create: {
      prfNumber: input.prfNumber,
      supplierId: invoice.supplierId,
      warehouseId: grn.warehouseId,
      purchaseOrderId: invoice.purchaseOrderId,
      goodsReceiptId: grn.id,
      supplierInvoiceId: invoice.id,
      status: input.status,
      approvalStage,
      amount: decimal(input.amount),
      currency: "BDT",
      requestedAt: daysAgo(input.requestedDaysAgo),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      managerApprovedAt: [
        "MANAGER_APPROVED",
        "FINANCE_APPROVED",
        "PAID",
      ].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 2)
        : null,
      financeApprovedAt: ["FINANCE_APPROVED", "PAID"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 3)
        : null,
      treasuryProcessedAt:
        input.status === "PAID" ? daysAgo(input.requestedDaysAgo - 4) : null,
      paidAt:
        input.status === "PAID" ? daysAgo(input.requestedDaysAgo - 4) : null,
      rejectedAt:
        input.status === "REJECTED"
          ? daysAgo(input.requestedDaysAgo - 2)
          : null,
      createdById: manager.id,
      managerApprovedById: manager.id,
      financeApprovedById: finance.id,
      treasuryProcessedById: treasury.id,
      rejectedById: input.status === "REJECTED" ? manager.id : null,
      note: input.note,
      referenceNumber: invoice.invoiceNumber,
    },
    select: {
      id: true,
      prfNumber: true,
      supplierId: true,
      supplierInvoiceId: true,
    },
  });
}

async function upsertSupplierPayment(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    paymentNumber: string;
    invoiceId: number;
    paymentRequestNumber: string;
    amount: number;
    paymentDaysAgo: number;
  },
) {
  const invoice = await prisma.supplierInvoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
  });
  const finance = requireUser(ctx, "finance_focal");

  const payment = await prisma.supplierPayment.upsert({
    where: { paymentNumber: input.paymentNumber },
    update: {
      supplierId: invoice.supplierId,
      supplierInvoiceId: invoice.id,
      paymentDate: daysAgo(input.paymentDaysAgo),
      createdById: finance.id,
      amount: decimal(input.amount),
      currency: "BDT",
      method: "BANK_TRANSFER",
      reference: `BANK-${input.paymentNumber}`,
      note: "Seeded supplier payment.",
    },
    create: {
      paymentNumber: input.paymentNumber,
      supplierId: invoice.supplierId,
      supplierInvoiceId: invoice.id,
      paymentDate: daysAgo(input.paymentDaysAgo),
      createdById: finance.id,
      amount: decimal(input.amount),
      currency: "BDT",
      method: "BANK_TRANSFER",
      reference: `BANK-${input.paymentNumber}`,
      note: "Seeded supplier payment.",
    },
    select: { id: true, paymentNumber: true, supplierId: true },
  });

  await prisma.paymentRequest.update({
    where: { prfNumber: input.paymentRequestNumber },
    data: { supplierPaymentId: payment.id },
  });

  await prisma.supplierInvoice.update({
    where: { id: invoice.id },
    data: { status: "PAID" },
  });

  await prisma.supplierLedgerEntry.deleteMany({
    where: {
      referenceType: "SUPPLIER_PAYMENT",
      referenceNumber: input.paymentNumber,
    },
  });
  await prisma.supplierLedgerEntry.create({
    data: {
      supplierId: payment.supplierId,
      entryDate: daysAgo(input.paymentDaysAgo),
      entryType: "PAYMENT",
      direction: "DEBIT",
      amount: decimal(input.amount),
      currency: "BDT",
      note: "Seeded ledger settlement from supplier payment.",
      referenceType: "SUPPLIER_PAYMENT",
      referenceNumber: input.paymentNumber,
      supplierInvoiceId: invoice.id,
      supplierPaymentId: payment.id,
      createdById: finance.id,
    },
  });

  return payment;
}

export async function seedScmFinanceScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const nextCtx: ScmSeedContext = {
    ...ctx,
    supplierInvoices: { ...(ctx.supplierInvoices ?? {}) },
  };

  const invoiceHappy = await upsertSupplierInvoice(prisma, ctx, {
    key: "happyPath",
    invoiceNumber: "INV-SCM-001",
    purchaseOrderKey: "happyPath",
    status: "POSTED",
    matchStatus: "MATCHED",
    issueDaysAgo: 3,
    note: "Seeded matched invoice for happy path.",
  });
  nextCtx.supplierInvoices!.happyPath = invoiceHappy;

  const prfPaid = await upsertPaymentRequest(prisma, ctx, {
    prfNumber: "PAYREQ-SCM-001",
    invoiceId: invoiceHappy.id,
    goodsReceiptKey: "happyPath",
    status: "PAID",
    amount: Number(invoiceHappy.total),
    requestedDaysAgo: 2,
    note: "Seeded paid payment request.",
  });

  await upsertSupplierPayment(prisma, ctx, {
    paymentNumber: "PAY-SCM-001",
    invoiceId: invoiceHappy.id,
    paymentRequestNumber: prfPaid.prfNumber,
    amount: Number(invoiceHappy.total),
    paymentDaysAgo: 1,
  });

  const invoicePartial = await upsertSupplierInvoice(prisma, ctx, {
    key: "partialReceiving",
    invoiceNumber: "INV-SCM-002",
    purchaseOrderKey: "partialReceiving",
    status: "POSTED",
    matchStatus: "PENDING",
    issueDaysAgo: 1,
    partial: true,
    note: "Seeded pending invoice for partial receiving flow.",
  });
  nextCtx.supplierInvoices!.partialReceiving = invoicePartial;

  await upsertPaymentRequest(prisma, ctx, {
    prfNumber: "PAYREQ-SCM-002",
    invoiceId: invoicePartial.id,
    goodsReceiptKey: "partialReceiving",
    status: "FINANCE_APPROVED",
    amount: Number(invoicePartial.total),
    requestedDaysAgo: 1,
    note: "Seeded finance-approved payment request waiting for treasury.",
  });

  const invoiceReturn = await upsertSupplierInvoice(prisma, ctx, {
    key: "returnFlow",
    invoiceNumber: "INV-SCM-003",
    purchaseOrderKey: "returnFlow",
    status: "POSTED",
    matchStatus: "VARIANCE",
    issueDaysAgo: 2,
    paymentHold: true,
    note: "Seeded invoice with variance and payment hold for return flow.",
  });
  nextCtx.supplierInvoices!.returnFlow = invoiceReturn;

  await upsertPaymentRequest(prisma, ctx, {
    prfNumber: "PAYREQ-SCM-003",
    invoiceId: invoiceReturn.id,
    goodsReceiptKey: "returnFlow",
    status: "SUBMITTED",
    amount: Number(invoiceReturn.total),
    requestedDaysAgo: 1,
    note: "Seeded submitted payment request blocked by invoice variance.",
  });

  console.log(
    "✅ SCM finance scenarios ensured: invoices, payment requests, payment, ledger",
  );
  return nextCtx;
}
