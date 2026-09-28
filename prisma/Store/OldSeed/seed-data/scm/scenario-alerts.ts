import { Prisma } from "../../../generated/prisma";
import { daysAgo } from "./helpers";
import type { ScmSeedContext, ScmSeedPrisma } from "./types";

async function upsertReorderAlert(
  prisma: ScmSeedPrisma,
  input: {
    warehouseId: number;
    productVariantId: number;
    stockOnHand: number;
    threshold: number;
    suggestedQty: number;
    status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
    note: string;
    createdById?: string | null;
    resolvedAt?: Date | null;
  },
) {
  const stock = await prisma.stockLevel.findFirst({
    where: {
      warehouseId: input.warehouseId,
      productVariantId: input.productVariantId,
    },
    select: { id: true },
  });

  if (stock) {
    await prisma.stockLevel.update({
      where: { id: stock.id },
      data: {
        quantity: input.stockOnHand,
        reserved: 0,
      },
    });
  } else {
    await prisma.stockLevel.create({
      data: {
        warehouseId: input.warehouseId,
        productVariantId: input.productVariantId,
        quantity: input.stockOnHand,
        reserved: 0,
      },
    });
  }

  const existing = await prisma.reorderAlert.findFirst({
    where: {
      warehouseId: input.warehouseId,
      productVariantId: input.productVariantId,
      status: input.status,
    },
    select: { id: true },
  });

  const data = {
    stockOnHand: input.stockOnHand,
    threshold: input.threshold,
    suggestedQty: input.suggestedQty,
    status: input.status,
    note: input.note,
    createdById: input.createdById ?? null,
    resolvedAt: input.resolvedAt ?? null,
  };

  if (existing) {
    await prisma.reorderAlert.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const alert = await prisma.reorderAlert.create({
    data: {
      warehouseId: input.warehouseId,
      productVariantId: input.productVariantId,
      ...data,
    },
    select: { id: true },
  });

  return alert.id;
}

async function upsertSupplierPortalNotification(
  prisma: ScmSeedPrisma,
  input: {
    supplierId: number;
    title: string;
    message: string;
    type: "GENERAL" | "DOCUMENT_EXPIRY" | "APPROVAL" | "RFQ" | "WORK_ORDER" | "PAYMENT";
    status: "PENDING" | "SENT" | "FAILED";
    recipientEmail?: string | null;
    metadata?: object;
    createdById?: string | null;
    sentAt?: Date | null;
    readAt?: Date | null;
  },
) {
  const existing = await prisma.supplierPortalNotification.findFirst({
    where: {
      supplierId: input.supplierId,
      title: input.title,
      type: input.type,
    },
    select: { id: true },
  });

  const portalAccess = await prisma.supplierPortalAccess.findFirst({
    where: { supplierId: input.supplierId, status: "ACTIVE" },
    select: { userId: true },
  });

  const data = {
    userId: portalAccess?.userId ?? null,
    channel: "SYSTEM" as const,
    status: input.status,
    type: input.type,
    title: input.title,
    message: input.message,
    recipientEmail: input.recipientEmail ?? null,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    sentAt: input.sentAt ?? null,
    readAt: input.readAt ?? null,
    createdById: input.createdById ?? null,
  };

  if (existing) {
    await prisma.supplierPortalNotification.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const notification = await prisma.supplierPortalNotification.create({
    data: {
      supplierId: input.supplierId,
      ...data,
    },
    select: { id: true },
  });

  return notification.id;
}

export async function seedScmAlertScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const hq = ctx.warehouses.hq;
  const ctg = ctx.warehouses.ctg;
  const khulna = ctx.warehouses.khulna;
  const planner = ctx.users.replenishment_planner ?? ctx.users.scm_admin;

  if (!hq || !ctg || !khulna) {
    throw new Error("Missing warehouse context for SCM alert scenarios.");
  }

  await upsertReorderAlert(prisma, {
    warehouseId: khulna.id,
    productVariantId: ctx.variants.thermal_printer_4in.id,
    stockOnHand: 1,
    threshold: 4,
    suggestedQty: 12,
    status: "OPEN",
    note: "Seeded open low-stock alert for Khulna printer stock.",
    createdById: planner?.id ?? ctx.adminUserId,
  });

  await upsertReorderAlert(prisma, {
    warehouseId: ctg.id,
    productVariantId: ctx.variants.barcode_scanner_usb.id,
    stockOnHand: 3,
    threshold: 6,
    suggestedQty: 10,
    status: "ACKNOWLEDGED",
    note: "Seeded acknowledged scanner reorder alert for Chattogram.",
    createdById: planner?.id ?? ctx.adminUserId,
  });

  await upsertReorderAlert(prisma, {
    warehouseId: hq.id,
    productVariantId: ctx.variants.fragile_label_roll.id,
    stockOnHand: 45,
    threshold: 40,
    suggestedQty: 0,
    status: "RESOLVED",
    note: "Seeded resolved reorder alert for report/status filter coverage.",
    createdById: planner?.id ?? ctx.adminUserId,
    resolvedAt: daysAgo(1),
  });

  await upsertSupplierPortalNotification(prisma, {
    supplierId: ctx.suppliers.alpha_safety.id,
    title: "RFQ assigned for safety footwear",
    message: "Please review the seeded RFQ and submit your quotation.",
    type: "RFQ",
    status: "SENT",
    recipientEmail: "alpha.safety@vendor.test",
    metadata: { seedCode: "SUP-NOTIF-SCM-001", scenario: "rfq" },
    createdById: ctx.adminUserId,
    sentAt: daysAgo(2),
  });

  await upsertSupplierPortalNotification(prisma, {
    supplierId: ctx.suppliers.packmate.id,
    title: "Payment request under finance review",
    message: "Your seeded invoice payment request is under finance review.",
    type: "PAYMENT",
    status: "PENDING",
    recipientEmail: "packmate@vendor.test",
    metadata: { seedCode: "SUP-NOTIF-SCM-002", scenario: "payment" },
    createdById: ctx.adminUserId,
  });

  await upsertSupplierPortalNotification(prisma, {
    supplierId: ctx.suppliers.rackworks.id,
    title: "SLA action required",
    message: "A seeded SLA breach requires corrective action and review.",
    type: "GENERAL",
    status: "SENT",
    recipientEmail: "rackworks@vendor.test",
    metadata: { seedCode: "SUP-NOTIF-SCM-003", scenario: "sla" },
    createdById: ctx.adminUserId,
    sentAt: daysAgo(1),
  });

  console.log("✅ SCM alert scenarios ensured: reorder alerts and supplier portal notifications");
  return ctx;
}
