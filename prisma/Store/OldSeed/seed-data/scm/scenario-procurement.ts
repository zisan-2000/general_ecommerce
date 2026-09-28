import type { ScmSeedContext, ScmSeedPrisma } from "./types";
import { daysAgo, daysFromNow, decimal } from "./helpers";

type ProcurementLine = {
  variantKey: string;
  description: string;
  quantity: number;
  unitCost: number;
};

const HAPPY_PATH_LINES: ProcurementLine[] = [
  {
    variantKey: "corrugated_carton_m",
    description: "Medium cartons for ecommerce dispatch packing.",
    quantity: 600,
    unitCost: 31,
  },
  {
    variantKey: "courier_polybag_l",
    description: "Large courier polybags for order fulfillment.",
    quantity: 900,
    unitCost: 7,
  },
  {
    variantKey: "fragile_label_roll",
    description: "Fragile warning label rolls for warehouse packing.",
    quantity: 60,
    unitCost: 110,
  },
];

const PARTIAL_RECEIVING_LINES: ProcurementLine[] = [
  {
    variantKey: "barcode_scanner_usb",
    description: "USB barcode scanners for warehouse receiving desk.",
    quantity: 8,
    unitCost: 4300,
  },
  {
    variantKey: "thermal_printer_4in",
    description: "Thermal label printers for shipping labels.",
    quantity: 4,
    unitCost: 11100,
  },
];

const RETURN_LINES: ProcurementLine[] = [
  {
    variantKey: "safety_boot_black_42",
    description: "Safety boots for warehouse floor team.",
    quantity: 40,
    unitCost: 2950,
  },
  {
    variantKey: "hi_vis_vest_l",
    description: "Hi-vis vests for warehouse floor team.",
    quantity: 75,
    unitCost: 520,
  },
];

function requireUser(ctx: ScmSeedContext, key: string) {
  const user = ctx.users[key];
  if (!user) throw new Error(`Missing SCM seed user: ${key}`);
  return user;
}

function requireWarehouse(ctx: ScmSeedContext, key: string) {
  const warehouse = ctx.warehouses[key];
  if (!warehouse) throw new Error(`Missing SCM seed warehouse: ${key}`);
  return warehouse;
}

function requireSupplier(ctx: ScmSeedContext, key: string) {
  const supplier = ctx.suppliers[key];
  if (!supplier) throw new Error(`Missing SCM seed supplier: ${key}`);
  return supplier;
}

function requireVariant(ctx: ScmSeedContext, key: string) {
  const variant = ctx.variants[key];
  if (!variant) throw new Error(`Missing SCM seed variant: ${key}`);
  return variant;
}

function lineTotal(line: ProcurementLine, multiplier = 1) {
  return line.quantity * line.unitCost * multiplier;
}

function subtotal(lines: ProcurementLine[], multiplier = 1) {
  return lines.reduce((sum, line) => sum + lineTotal(line, multiplier), 0);
}

async function recreatePrItems(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  purchaseRequisitionId: number,
  lines: ProcurementLine[],
) {
  await prisma.purchaseRequisitionItem.deleteMany({
    where: { purchaseRequisitionId },
  });

  await prisma.purchaseRequisitionItem.createMany({
    data: lines.map((line) => ({
      purchaseRequisitionId,
      productVariantId: requireVariant(ctx, line.variantKey).id,
      description: line.description,
      quantityRequested: line.quantity,
      quantityApproved: line.quantity,
    })),
  });
}

async function upsertPurchaseRequisition(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    requisitionNumber: string;
    title: string;
    warehouseKey: string;
    status:
      | "SUBMITTED"
      | "BUDGET_CLEARED"
      | "ENDORSED"
      | "APPROVED"
      | "CONVERTED"
      | "REJECTED";
    lines: ProcurementLine[];
    requestedDaysAgo: number;
    converted?: boolean;
    rejected?: boolean;
    note?: string;
  },
) {
  const warehouse = requireWarehouse(ctx, input.warehouseKey);
  const requestor = requireUser(ctx, "procurement_requestor");
  const manager = requireUser(ctx, "procurement_manager");
  const finalApprover = requireUser(ctx, "final_approver");

  const estimatedAmount = subtotal(input.lines);
  const now = daysAgo(input.requestedDaysAgo);

  const pr = await prisma.purchaseRequisition.upsert({
    where: { requisitionNumber: input.requisitionNumber },
    update: {
      warehouseId: warehouse.id,
      status: input.status,
      title: input.title,
      purpose: "Seeded SCM Pass 2 workflow scenario.",
      budgetCode: "SCM-DEMO-BUDGET",
      specification: "Seeded procurement specification for workflow testing.",
      estimatedAmount: decimal(estimatedAmount),
      requestedAt: now,
      neededBy: daysFromNow(10),
      submittedAt:
        input.status === "SUBMITTED"
          ? now
          : daysAgo(input.requestedDaysAgo - 1),
      budgetClearedAt: [
        "BUDGET_CLEARED",
        "ENDORSED",
        "APPROVED",
        "CONVERTED",
      ].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 2)
        : null,
      endorsedAt: ["ENDORSED", "APPROVED", "CONVERTED"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 3)
        : null,
      approvedAt: ["APPROVED", "CONVERTED"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 4)
        : null,
      rejectedAt: input.rejected ? daysAgo(input.requestedDaysAgo - 2) : null,
      convertedAt: input.converted ? daysAgo(input.requestedDaysAgo - 5) : null,
      routedToProcurementAt: input.converted
        ? daysAgo(input.requestedDaysAgo - 5)
        : null,
      createdById: requestor.id,
      budgetClearedById: manager.id,
      endorsedById: manager.id,
      approvedById: finalApprover.id,
      convertedById: manager.id,
      assignedProcurementOfficerId: manager.id,
      note: input.note ?? "Seeded Pass 2 purchase requisition.",
    },
    create: {
      requisitionNumber: input.requisitionNumber,
      warehouseId: warehouse.id,
      status: input.status,
      title: input.title,
      purpose: "Seeded SCM Pass 2 workflow scenario.",
      budgetCode: "SCM-DEMO-BUDGET",
      specification: "Seeded procurement specification for workflow testing.",
      estimatedAmount: decimal(estimatedAmount),
      requestedAt: now,
      neededBy: daysFromNow(10),
      submittedAt:
        input.status === "SUBMITTED"
          ? now
          : daysAgo(input.requestedDaysAgo - 1),
      budgetClearedAt: [
        "BUDGET_CLEARED",
        "ENDORSED",
        "APPROVED",
        "CONVERTED",
      ].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 2)
        : null,
      endorsedAt: ["ENDORSED", "APPROVED", "CONVERTED"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 3)
        : null,
      approvedAt: ["APPROVED", "CONVERTED"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 4)
        : null,
      rejectedAt: input.rejected ? daysAgo(input.requestedDaysAgo - 2) : null,
      convertedAt: input.converted ? daysAgo(input.requestedDaysAgo - 5) : null,
      routedToProcurementAt: input.converted
        ? daysAgo(input.requestedDaysAgo - 5)
        : null,
      createdById: requestor.id,
      budgetClearedById: manager.id,
      endorsedById: manager.id,
      approvedById: finalApprover.id,
      convertedById: manager.id,
      assignedProcurementOfficerId: manager.id,
      note: input.note ?? "Seeded Pass 2 purchase requisition.",
    },
    select: { id: true, requisitionNumber: true },
  });

  await recreatePrItems(prisma, ctx, pr.id, input.lines);
  return pr;
}

async function recreateRfqItems(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  rfqId: number,
  lines: ProcurementLine[],
) {
  await prisma.rfqItem.deleteMany({ where: { rfqId } });
  await prisma.rfqItem.createMany({
    data: lines.map((line) => ({
      rfqId,
      productVariantId: requireVariant(ctx, line.variantKey).id,
      description: line.description,
      quantityRequested: line.quantity,
      targetUnitCost: decimal(line.unitCost),
    })),
  });
}

async function upsertRfqWithQuotations(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    rfqNumber: string;
    purchaseRequisitionId?: number;
    warehouseKey: string;
    status: "SUBMITTED" | "CLOSED" | "AWARDED";
    lines: ProcurementLine[];
    supplierKeys: string[];
    winningSupplierKey: string;
    requestedDaysAgo: number;
  },
) {
  const warehouse = requireWarehouse(ctx, input.warehouseKey);
  const manager = requireUser(ctx, "procurement_manager");

  const rfq = await prisma.rfq.upsert({
    where: { rfqNumber: input.rfqNumber },
    update: {
      warehouseId: warehouse.id,
      purchaseRequisitionId: input.purchaseRequisitionId ?? null,
      status: input.status,
      requestedAt: daysAgo(input.requestedDaysAgo),
      submissionDeadline: daysFromNow(5),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      closedAt: ["CLOSED", "AWARDED"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 4)
        : null,
      awardedAt:
        input.status === "AWARDED" ? daysAgo(input.requestedDaysAgo - 5) : null,
      scopeOfWork: "Seeded RFQ scope for SCM Pass 2 testing.",
      termsAndConditions: "Standard SCM seeded RFQ terms apply.",
      technicalSpecifications:
        "Supplier must comply with product specification and delivery SLA.",
      evaluationCriteria:
        "Technical compliance 70%, financial competitiveness 30%.",
      createdById: manager.id,
      approvedById: manager.id,
      currency: "BDT",
      sourceRequisitionSnapshot: { seeded: true, rfqNumber: input.rfqNumber },
      note: "Seeded RFQ for workflow scenario.",
    },
    create: {
      rfqNumber: input.rfqNumber,
      warehouseId: warehouse.id,
      purchaseRequisitionId: input.purchaseRequisitionId ?? null,
      status: input.status,
      requestedAt: daysAgo(input.requestedDaysAgo),
      submissionDeadline: daysFromNow(5),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      closedAt: ["CLOSED", "AWARDED"].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 4)
        : null,
      awardedAt:
        input.status === "AWARDED" ? daysAgo(input.requestedDaysAgo - 5) : null,
      scopeOfWork: "Seeded RFQ scope for SCM Pass 2 testing.",
      termsAndConditions: "Standard SCM seeded RFQ terms apply.",
      technicalSpecifications:
        "Supplier must comply with product specification and delivery SLA.",
      evaluationCriteria:
        "Technical compliance 70%, financial competitiveness 30%.",
      createdById: manager.id,
      approvedById: manager.id,
      currency: "BDT",
      sourceRequisitionSnapshot: { seeded: true, rfqNumber: input.rfqNumber },
      note: "Seeded RFQ for workflow scenario.",
    },
    select: { id: true, rfqNumber: true },
  });

  await recreateRfqItems(prisma, ctx, rfq.id, input.lines);
  const rfqItems = await prisma.rfqItem.findMany({ where: { rfqId: rfq.id } });

  for (const supplierKey of input.supplierKeys) {
    const supplier = requireSupplier(ctx, supplierKey);
    const invite = await prisma.rfqSupplierInvite.upsert({
      where: { rfqId_supplierId: { rfqId: rfq.id, supplierId: supplier.id } },
      update: {
        status:
          supplierKey === input.winningSupplierKey ? "AWARDED" : "RESPONDED",
        invitedAt: daysAgo(input.requestedDaysAgo - 1),
        respondedAt: daysAgo(input.requestedDaysAgo - 3),
        createdById: manager.id,
        note: "Seeded RFQ supplier invite.",
      },
      create: {
        rfqId: rfq.id,
        supplierId: supplier.id,
        status:
          supplierKey === input.winningSupplierKey ? "AWARDED" : "RESPONDED",
        invitedAt: daysAgo(input.requestedDaysAgo - 1),
        respondedAt: daysAgo(input.requestedDaysAgo - 3),
        createdById: manager.id,
        note: "Seeded RFQ supplier invite.",
      },
      select: { id: true },
    });

    const multiplier =
      supplierKey === input.winningSupplierKey
        ? 1
        : supplierKey.endsWith("mate")
          ? 1.06
          : 1.12;
    const quoteSubtotal = subtotal(input.lines, multiplier);
    const quoteTax = quoteSubtotal * 0.05;
    const quoteTotal = quoteSubtotal + quoteTax;

    const quotation = await prisma.supplierQuotation.upsert({
      where: { rfqId_supplierId: { rfqId: rfq.id, supplierId: supplier.id } },
      update: {
        rfqSupplierInviteId: invite.id,
        status: "SUBMITTED",
        revisionNo: 1,
        quotedAt: daysAgo(input.requestedDaysAgo - 3),
        validUntil: daysFromNow(14),
        submittedById: manager.id,
        currency: "BDT",
        subtotal: decimal(quoteSubtotal),
        taxTotal: decimal(quoteTax),
        total: decimal(quoteTotal),
        technicalProposal: "Seeded supplier technical proposal.",
        financialProposal: "Seeded supplier financial proposal.",
        note: "Seeded supplier quotation.",
      },
      create: {
        rfqId: rfq.id,
        supplierId: supplier.id,
        rfqSupplierInviteId: invite.id,
        status: "SUBMITTED",
        revisionNo: 1,
        quotedAt: daysAgo(input.requestedDaysAgo - 3),
        validUntil: daysFromNow(14),
        submittedById: manager.id,
        currency: "BDT",
        subtotal: decimal(quoteSubtotal),
        taxTotal: decimal(quoteTax),
        total: decimal(quoteTotal),
        technicalProposal: "Seeded supplier technical proposal.",
        financialProposal: "Seeded supplier financial proposal.",
        note: "Seeded supplier quotation.",
      },
      select: { id: true, supplierId: true, total: true },
    });

    await prisma.supplierQuotationItem.deleteMany({
      where: { supplierQuotationId: quotation.id },
    });

    await prisma.supplierQuotationItem.createMany({
      data: rfqItems.map((rfqItem) => {
        const line = input.lines.find(
          (item) =>
            requireVariant(ctx, item.variantKey).id ===
            rfqItem.productVariantId,
        );
        const unitCost = (line?.unitCost ?? 0) * multiplier;
        return {
          supplierQuotationId: quotation.id,
          rfqItemId: rfqItem.id,
          productVariantId: rfqItem.productVariantId,
          description: rfqItem.description,
          quantityQuoted: rfqItem.quantityRequested,
          unitCost: decimal(unitCost),
          lineTotal: decimal(rfqItem.quantityRequested * unitCost),
        };
      }),
    });
  }

  return rfq;
}

async function upsertComparativeStatement(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    csNumber: string;
    rfqId: number;
    warehouseKey: string;
    status:
      | "SUBMITTED"
      | "MANAGER_APPROVED"
      | "COMMITTEE_APPROVED"
      | "FINAL_APPROVED";
    requestedDaysAgo: number;
  },
) {
  const warehouse = requireWarehouse(ctx, input.warehouseKey);
  const manager = requireUser(ctx, "procurement_manager");
  const committee = requireUser(ctx, "procurement_committee");
  const finalApprover = requireUser(ctx, "final_approver");

  const approvalStage =
    input.status === "SUBMITTED"
      ? "MANAGER_REVIEW"
      : input.status === "MANAGER_APPROVED"
        ? "COMMITTEE_REVIEW"
        : input.status === "COMMITTEE_APPROVED"
          ? "FINAL_APPROVAL"
          : "FINAL_APPROVAL";

  const cs = await prisma.comparativeStatement.upsert({
    where: { csNumber: input.csNumber },
    update: {
      rfqId: input.rfqId,
      warehouseId: warehouse.id,
      versionNo: 1,
      status: input.status,
      approvalStage,
      generatedAt: daysAgo(input.requestedDaysAgo),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      managerApprovedAt: [
        "MANAGER_APPROVED",
        "COMMITTEE_APPROVED",
        "FINAL_APPROVED",
      ].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 2)
        : null,
      committeeApprovedAt: ["COMMITTEE_APPROVED", "FINAL_APPROVED"].includes(
        input.status,
      )
        ? daysAgo(input.requestedDaysAgo - 3)
        : null,
      finalApprovedAt:
        input.status === "FINAL_APPROVED"
          ? daysAgo(input.requestedDaysAgo - 4)
          : null,
      managerApprovedById: manager.id,
      committeeApprovedById: committee.id,
      finalApprovedById: finalApprover.id,
      createdById: manager.id,
      updatedById: manager.id,
      sourceQuotationSnapshot: { seeded: true, csNumber: input.csNumber },
      note: "Seeded comparative statement for workflow testing.",
    },
    create: {
      csNumber: input.csNumber,
      rfqId: input.rfqId,
      warehouseId: warehouse.id,
      versionNo: 1,
      status: input.status,
      approvalStage,
      generatedAt: daysAgo(input.requestedDaysAgo),
      submittedAt: daysAgo(input.requestedDaysAgo - 1),
      managerApprovedAt: [
        "MANAGER_APPROVED",
        "COMMITTEE_APPROVED",
        "FINAL_APPROVED",
      ].includes(input.status)
        ? daysAgo(input.requestedDaysAgo - 2)
        : null,
      committeeApprovedAt: ["COMMITTEE_APPROVED", "FINAL_APPROVED"].includes(
        input.status,
      )
        ? daysAgo(input.requestedDaysAgo - 3)
        : null,
      finalApprovedAt:
        input.status === "FINAL_APPROVED"
          ? daysAgo(input.requestedDaysAgo - 4)
          : null,
      managerApprovedById: manager.id,
      committeeApprovedById: committee.id,
      finalApprovedById: finalApprover.id,
      createdById: manager.id,
      updatedById: manager.id,
      sourceQuotationSnapshot: { seeded: true, csNumber: input.csNumber },
      note: "Seeded comparative statement for workflow testing.",
    },
    select: { id: true, csNumber: true },
  });

  await prisma.comparativeStatementLine.deleteMany({
    where: { comparativeStatementId: cs.id },
  });

  const quotations = await prisma.supplierQuotation.findMany({
    where: { rfqId: input.rfqId },
    orderBy: { total: "asc" },
  });

  let rank = 0;
  for (const quotation of quotations) {
    rank += 1;
    await prisma.comparativeStatementLine.create({
      data: {
        comparativeStatementId: cs.id,
        supplierQuotationId: quotation.id,
        supplierId: quotation.supplierId,
        financialSubtotal: quotation.subtotal,
        financialTaxTotal: quotation.taxTotal,
        financialGrandTotal: quotation.total,
        currency: quotation.currency,
        technicalScore: decimal(rank === 1 ? 92 : rank === 2 ? 86 : 78),
        financialScore: decimal(rank === 1 ? 96 : rank === 2 ? 88 : 80),
        combinedScore: decimal(rank === 1 ? 93.2 : rank === 2 ? 86.6 : 78.6),
        rank,
        isResponsive: true,
        technicalNote: "Seeded technical evaluation.",
        financialNote: "Seeded financial evaluation.",
      },
    });
  }

  return cs;
}

async function upsertPurchaseOrder(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    poNumber: string;
    supplierKey: string;
    warehouseKey: string;
    purchaseRequisitionId?: number;
    sourceComparativeStatementId?: number;
    status:
      | "SUBMITTED"
      | "MANAGER_APPROVED"
      | "COMMITTEE_APPROVED"
      | "APPROVED"
      | "PARTIALLY_RECEIVED"
      | "RECEIVED";
    lines: ProcurementLine[];
    orderDaysAgo: number;
  },
) {
  const supplier = requireSupplier(ctx, input.supplierKey);
  const warehouse = requireWarehouse(ctx, input.warehouseKey);
  const manager = requireUser(ctx, "procurement_manager");
  const committee = requireUser(ctx, "procurement_committee");
  const finalApprover = requireUser(ctx, "final_approver");

  const orderSubtotal = subtotal(input.lines);
  const taxTotal = orderSubtotal * 0.05;
  const shippingTotal = 1500;
  const grandTotal = orderSubtotal + taxTotal + shippingTotal;
  const approvalStage =
    input.status === "SUBMITTED"
      ? "MANAGER_REVIEW"
      : input.status === "MANAGER_APPROVED"
        ? "COMMITTEE_REVIEW"
        : "FINAL_APPROVAL";

  const po = await prisma.purchaseOrder.upsert({
    where: { poNumber: input.poNumber },
    update: {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      purchaseRequisitionId: input.purchaseRequisitionId ?? null,
      sourceComparativeStatementId: input.sourceComparativeStatementId ?? null,
      status: input.status,
      approvalStage,
      orderDate: daysAgo(input.orderDaysAgo),
      expectedAt: daysFromNow(7),
      submittedAt: daysAgo(input.orderDaysAgo - 1),
      managerApprovedAt: [
        "MANAGER_APPROVED",
        "COMMITTEE_APPROVED",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
      ].includes(input.status)
        ? daysAgo(input.orderDaysAgo - 2)
        : null,
      committeeApprovedAt: [
        "COMMITTEE_APPROVED",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
      ].includes(input.status)
        ? daysAgo(input.orderDaysAgo - 3)
        : null,
      finalApprovedAt: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(
        input.status,
      )
        ? daysAgo(input.orderDaysAgo - 4)
        : null,
      approvedAt: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(
        input.status,
      )
        ? daysAgo(input.orderDaysAgo - 4)
        : null,
      receivedAt:
        input.status === "RECEIVED" ? daysAgo(input.orderDaysAgo - 6) : null,
      createdById: manager.id,
      managerApprovedById: manager.id,
      committeeApprovedById: committee.id,
      finalApprovedById: finalApprover.id,
      approvedById: finalApprover.id,
      currency: "BDT",
      subtotal: decimal(orderSubtotal),
      taxTotal: decimal(taxTotal),
      shippingTotal: decimal(shippingTotal),
      grandTotal: decimal(grandTotal),
      termsAndConditions: "Seeded SCM purchase order terms.",
      notes: "Seeded purchase order for SCM Pass 2 workflow.",
    },
    create: {
      poNumber: input.poNumber,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      purchaseRequisitionId: input.purchaseRequisitionId ?? null,
      sourceComparativeStatementId: input.sourceComparativeStatementId ?? null,
      status: input.status,
      approvalStage,
      orderDate: daysAgo(input.orderDaysAgo),
      expectedAt: daysFromNow(7),
      submittedAt: daysAgo(input.orderDaysAgo - 1),
      managerApprovedAt: [
        "MANAGER_APPROVED",
        "COMMITTEE_APPROVED",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
      ].includes(input.status)
        ? daysAgo(input.orderDaysAgo - 2)
        : null,
      committeeApprovedAt: [
        "COMMITTEE_APPROVED",
        "APPROVED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
      ].includes(input.status)
        ? daysAgo(input.orderDaysAgo - 3)
        : null,
      finalApprovedAt: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(
        input.status,
      )
        ? daysAgo(input.orderDaysAgo - 4)
        : null,
      approvedAt: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(
        input.status,
      )
        ? daysAgo(input.orderDaysAgo - 4)
        : null,
      receivedAt:
        input.status === "RECEIVED" ? daysAgo(input.orderDaysAgo - 6) : null,
      createdById: manager.id,
      managerApprovedById: manager.id,
      committeeApprovedById: committee.id,
      finalApprovedById: finalApprover.id,
      approvedById: finalApprover.id,
      currency: "BDT",
      subtotal: decimal(orderSubtotal),
      taxTotal: decimal(taxTotal),
      shippingTotal: decimal(shippingTotal),
      grandTotal: decimal(grandTotal),
      termsAndConditions: "Seeded SCM purchase order terms.",
      notes: "Seeded purchase order for SCM Pass 2 workflow.",
    },
    select: { id: true, poNumber: true, supplierId: true, warehouseId: true },
  });

  for (const line of input.lines) {
    const variant = requireVariant(ctx, line.variantKey);
    const quantityReceived =
      input.status === "RECEIVED"
        ? line.quantity
        : input.status === "PARTIALLY_RECEIVED"
          ? Math.floor(line.quantity / 2)
          : 0;

    const existingItem = await prisma.purchaseOrderItem.findFirst({
      where: {
        purchaseOrderId: po.id,
        productVariantId: variant.id,
      },
      select: { id: true },
    });

    const itemData = {
      description: line.description,
      quantityOrdered: line.quantity,
      quantityReceived,
      unitCost: decimal(line.unitCost),
      lineTotal: decimal(lineTotal(line)),
    };

    if (existingItem) {
      await prisma.purchaseOrderItem.update({
        where: { id: existingItem.id },
        data: itemData,
      });
    } else {
      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          productVariantId: variant.id,
          ...itemData,
        },
      });
    }
  }

  await prisma.purchaseOrderLandedCost.deleteMany({
    where: { purchaseOrderId: po.id },
  });
  await prisma.purchaseOrderLandedCost.createMany({
    data: [
      {
        purchaseOrderId: po.id,
        component: "FREIGHT",
        amount: decimal(1000),
        currency: "BDT",
        note: "Seeded freight landed cost.",
        incurredAt: daysAgo(input.orderDaysAgo - 2),
        createdById: manager.id,
      },
      {
        purchaseOrderId: po.id,
        component: "HANDLING",
        amount: decimal(500),
        currency: "BDT",
        note: "Seeded handling landed cost.",
        incurredAt: daysAgo(input.orderDaysAgo - 2),
        createdById: manager.id,
      },
    ],
  });

  return po;
}

export async function seedScmProcurementScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const nextCtx: ScmSeedContext = {
    ...ctx,
    purchaseOrders: { ...(ctx.purchaseOrders ?? {}) },
  };

  const prHappy = await upsertPurchaseRequisition(prisma, ctx, {
    requisitionNumber: "PR-SCM-001",
    title: "Packaging materials replenishment",
    warehouseKey: "hq",
    status: "CONVERTED",
    lines: HAPPY_PATH_LINES,
    requestedDaysAgo: 16,
    converted: true,
  });

  const rfqHappy = await upsertRfqWithQuotations(prisma, ctx, {
    rfqNumber: "RFQ-SCM-001",
    purchaseRequisitionId: prHappy.id,
    warehouseKey: "hq",
    status: "AWARDED",
    lines: HAPPY_PATH_LINES,
    supplierKeys: ["packmate", "greenpack", "printcraft"],
    winningSupplierKey: "packmate",
    requestedDaysAgo: 14,
  });

  const csHappy = await upsertComparativeStatement(prisma, ctx, {
    csNumber: "CS-SCM-001",
    rfqId: rfqHappy.id,
    warehouseKey: "hq",
    status: "FINAL_APPROVED",
    requestedDaysAgo: 11,
  });

  const poHappy = await upsertPurchaseOrder(prisma, ctx, {
    poNumber: "PO-SCM-001",
    supplierKey: "packmate",
    warehouseKey: "hq",
    purchaseRequisitionId: prHappy.id,
    sourceComparativeStatementId: csHappy.id,
    status: "RECEIVED",
    lines: HAPPY_PATH_LINES,
    orderDaysAgo: 9,
  });

  nextCtx.purchaseOrders!.happyPath = poHappy;

  const prPartial = await upsertPurchaseRequisition(prisma, ctx, {
    requisitionNumber: "PR-SCM-002",
    title: "Warehouse IT equipment purchase",
    warehouseKey: "ctg",
    status: "CONVERTED",
    lines: PARTIAL_RECEIVING_LINES,
    requestedDaysAgo: 12,
    converted: true,
  });

  const rfqPartial = await upsertRfqWithQuotations(prisma, ctx, {
    rfqNumber: "RFQ-SCM-002",
    purchaseRequisitionId: prPartial.id,
    warehouseKey: "ctg",
    status: "AWARDED",
    lines: PARTIAL_RECEIVING_LINES,
    supplierKeys: ["tekbridge", "bytefield", "officebay"],
    winningSupplierKey: "tekbridge",
    requestedDaysAgo: 10,
  });

  const csPartial = await upsertComparativeStatement(prisma, ctx, {
    csNumber: "CS-SCM-002",
    rfqId: rfqPartial.id,
    warehouseKey: "ctg",
    status: "FINAL_APPROVED",
    requestedDaysAgo: 8,
  });

  const poPartial = await upsertPurchaseOrder(prisma, ctx, {
    poNumber: "PO-SCM-002",
    supplierKey: "tekbridge",
    warehouseKey: "ctg",
    purchaseRequisitionId: prPartial.id,
    sourceComparativeStatementId: csPartial.id,
    status: "PARTIALLY_RECEIVED",
    lines: PARTIAL_RECEIVING_LINES,
    orderDaysAgo: 7,
  });

  nextCtx.purchaseOrders!.partialReceiving = poPartial;

  const prReturn = await upsertPurchaseRequisition(prisma, ctx, {
    requisitionNumber: "PR-SCM-003",
    title: "Warehouse safety gear purchase",
    warehouseKey: "syl",
    status: "CONVERTED",
    lines: RETURN_LINES,
    requestedDaysAgo: 11,
    converted: true,
  });

  const poReturn = await upsertPurchaseOrder(prisma, ctx, {
    poNumber: "PO-SCM-003",
    supplierKey: "alpha_safety",
    warehouseKey: "syl",
    purchaseRequisitionId: prReturn.id,
    status: "RECEIVED",
    lines: RETURN_LINES,
    orderDaysAgo: 8,
  });

  nextCtx.purchaseOrders!.returnFlow = poReturn;

  await upsertPurchaseRequisition(prisma, ctx, {
    requisitionNumber: "PR-SCM-004",
    title: "Approval backlog - pending submitted requisition",
    warehouseKey: "hq",
    status: "SUBMITTED",
    lines: [HAPPY_PATH_LINES[0]],
    requestedDaysAgo: 3,
    note: "Seeded backlog item waiting for PR approval.",
  });

  await upsertPurchaseRequisition(prisma, ctx, {
    requisitionNumber: "PR-SCM-005",
    title: "Rejected requisition demo",
    warehouseKey: "hq",
    status: "REJECTED",
    lines: [PARTIAL_RECEIVING_LINES[0]],
    requestedDaysAgo: 5,
    rejected: true,
    note: "Seeded rejected PR for status coverage.",
  });

  await upsertRfqWithQuotations(prisma, ctx, {
    rfqNumber: "RFQ-SCM-003",
    warehouseKey: "hq",
    status: "SUBMITTED",
    lines: [RETURN_LINES[0]],
    supplierKeys: ["alpha_safety", "safetyhub"],
    winningSupplierKey: "alpha_safety",
    requestedDaysAgo: 2,
  });

  console.log(
    "✅ SCM procurement scenarios ensured: PR, RFQ, quotations, CS, PO",
  );
  return nextCtx;
}
