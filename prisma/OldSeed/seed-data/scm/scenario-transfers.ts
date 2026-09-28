import { daysAgo, daysFromNow } from "./helpers";
import type { ScmSeedContext, ScmSeedPrisma } from "./types";

type TransferLineInput = {
  variantKey: string;
  description: string;
  quantityRequested: number;
  quantityDispatched?: number;
  quantityReceived?: number;
};

function requireWarehouse(ctx: ScmSeedContext, key: string) {
  const warehouse = ctx.warehouses[key];
  if (!warehouse) throw new Error(`Missing warehouse for transfer seed: ${key}`);
  return warehouse;
}

function requireVariant(ctx: ScmSeedContext, key: string) {
  const variant = ctx.variants[key];
  if (!variant) throw new Error(`Missing variant for transfer seed: ${key}`);
  return variant;
}

async function upsertTransfer(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    transferNumber: string;
    sourceWarehouseKey: string;
    destinationWarehouseKey: string;
    status:
      | "DRAFT"
      | "SUBMITTED"
      | "APPROVED"
      | "PARTIALLY_DISPATCHED"
      | "DISPATCHED"
      | "PARTIALLY_RECEIVED"
      | "RECEIVED"
      | "CANCELLED";
    requestedDaysAgo: number;
    requiredInDays: number;
    note: string;
    lines: TransferLineInput[];
  },
) {
  const source = requireWarehouse(ctx, input.sourceWarehouseKey);
  const destination = requireWarehouse(ctx, input.destinationWarehouseKey);
  const creator = ctx.users.warehouse_transfer_manager ?? ctx.users.scm_admin;
  const approver = ctx.users.scm_admin;
  const dispatcher = ctx.users.warehouse_receiver ?? ctx.users.scm_admin;
  const receiver = ctx.users.replenishment_planner ?? ctx.users.scm_admin;

  const submittedAt = input.status === "DRAFT" ? null : daysAgo(Math.max(input.requestedDaysAgo - 1, 0));
  const approvedAt = [
    "APPROVED",
    "PARTIALLY_DISPATCHED",
    "DISPATCHED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
  ].includes(input.status)
    ? daysAgo(Math.max(input.requestedDaysAgo - 2, 0))
    : null;
  const dispatchedAt = ["PARTIALLY_DISPATCHED", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(
    input.status,
  )
    ? daysAgo(Math.max(input.requestedDaysAgo - 3, 0))
    : null;
  const receivedAt = ["PARTIALLY_RECEIVED", "RECEIVED"].includes(input.status)
    ? daysAgo(Math.max(input.requestedDaysAgo - 4, 0))
    : null;

  const transfer = await prisma.warehouseTransfer.upsert({
    where: { transferNumber: input.transferNumber },
    update: {
      sourceWarehouseId: source.id,
      destinationWarehouseId: destination.id,
      status: input.status,
      requestedAt: daysAgo(input.requestedDaysAgo),
      requiredBy: daysFromNow(input.requiredInDays),
      submittedAt,
      approvedAt,
      dispatchedAt,
      receivedAt,
      createdById: creator?.id ?? ctx.adminUserId,
      approvedById: approvedAt ? approver?.id ?? ctx.adminUserId : null,
      dispatchedById: dispatchedAt ? dispatcher?.id ?? ctx.adminUserId : null,
      receivedById: receivedAt ? receiver?.id ?? ctx.adminUserId : null,
      note: input.note,
    },
    create: {
      transferNumber: input.transferNumber,
      sourceWarehouseId: source.id,
      destinationWarehouseId: destination.id,
      status: input.status,
      requestedAt: daysAgo(input.requestedDaysAgo),
      requiredBy: daysFromNow(input.requiredInDays),
      submittedAt,
      approvedAt,
      dispatchedAt,
      receivedAt,
      createdById: creator?.id ?? ctx.adminUserId,
      approvedById: approvedAt ? approver?.id ?? ctx.adminUserId : null,
      dispatchedById: dispatchedAt ? dispatcher?.id ?? ctx.adminUserId : null,
      receivedById: receivedAt ? receiver?.id ?? ctx.adminUserId : null,
      note: input.note,
    },
    select: {
      id: true,
      transferNumber: true,
      sourceWarehouseId: true,
      destinationWarehouseId: true,
    },
  });

  await prisma.warehouseTransferItem.deleteMany({
    where: { warehouseTransferId: transfer.id },
  });

  for (const line of input.lines) {
    const variant = requireVariant(ctx, line.variantKey);
    await prisma.warehouseTransferItem.create({
      data: {
        warehouseTransferId: transfer.id,
        productVariantId: variant.id,
        description: line.description,
        quantityRequested: line.quantityRequested,
        quantityDispatched: line.quantityDispatched ?? 0,
        quantityReceived: line.quantityReceived ?? 0,
      },
    });
  }

  return transfer;
}

async function setStockLevel(
  prisma: ScmSeedPrisma,
  input: {
    warehouseId: number;
    productVariantId: number;
    quantity: number;
  },
) {
  const existing = await prisma.stockLevel.findFirst({
    where: {
      warehouseId: input.warehouseId,
      productVariantId: input.productVariantId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.stockLevel.update({
      where: { id: existing.id },
      data: { quantity: input.quantity, reserved: 0 },
    });
    return;
  }

  await prisma.stockLevel.create({
    data: {
      warehouseId: input.warehouseId,
      productVariantId: input.productVariantId,
      quantity: input.quantity,
      reserved: 0,
    },
  });
}

export async function seedScmTransferScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const nextCtx: ScmSeedContext = {
    ...ctx,
    warehouseTransfers: { ...(ctx.warehouseTransfers ?? {}) },
  };

  const draft = await upsertTransfer(prisma, ctx, {
    transferNumber: "WHT-SCM-001",
    sourceWarehouseKey: "hq",
    destinationWarehouseKey: "ctg",
    status: "DRAFT",
    requestedDaysAgo: 1,
    requiredInDays: 5,
    note: "Seeded draft warehouse transfer.",
    lines: [
      {
        variantKey: "courier_polybag_l",
        description: "Draft polybag transfer to Chattogram.",
        quantityRequested: 300,
      },
    ],
  });

  const approved = await upsertTransfer(prisma, ctx, {
    transferNumber: "WHT-SCM-002",
    sourceWarehouseKey: "hq",
    destinationWarehouseKey: "syl",
    status: "APPROVED",
    requestedDaysAgo: 3,
    requiredInDays: 4,
    note: "Seeded approved transfer waiting for dispatch.",
    lines: [
      {
        variantKey: "fragile_label_roll",
        description: "Fragile label rolls for Sylhet packing area.",
        quantityRequested: 20,
      },
    ],
  });

  const dispatched = await upsertTransfer(prisma, ctx, {
    transferNumber: "WHT-SCM-003",
    sourceWarehouseKey: "hq",
    destinationWarehouseKey: "khulna",
    status: "DISPATCHED",
    requestedDaysAgo: 5,
    requiredInDays: 2,
    note: "Seeded dispatched transfer in transit.",
    lines: [
      {
        variantKey: "safety_boot_black_42",
        description: "Safety boot transfer in transit.",
        quantityRequested: 12,
        quantityDispatched: 12,
      },
      {
        variantKey: "hi_vis_vest_l",
        description: "Hi-vis vest transfer in transit.",
        quantityRequested: 20,
        quantityDispatched: 20,
      },
    ],
  });

  const received = await upsertTransfer(prisma, ctx, {
    transferNumber: "WHT-SCM-004",
    sourceWarehouseKey: "hq",
    destinationWarehouseKey: "ctg",
    status: "RECEIVED",
    requestedDaysAgo: 8,
    requiredInDays: 1,
    note: "Seeded completed transfer with stock movement.",
    lines: [
      {
        variantKey: "corrugated_carton_m",
        description: "Completed carton transfer.",
        quantityRequested: 150,
        quantityDispatched: 150,
        quantityReceived: 150,
      },
      {
        variantKey: "courier_polybag_l",
        description: "Completed polybag transfer.",
        quantityRequested: 250,
        quantityDispatched: 250,
        quantityReceived: 250,
      },
    ],
  });

  await setStockLevel(prisma, {
    warehouseId: received.sourceWarehouseId,
    productVariantId: ctx.variants.corrugated_carton_m.id,
    quantity: 260,
  });
  await setStockLevel(prisma, {
    warehouseId: received.destinationWarehouseId,
    productVariantId: ctx.variants.corrugated_carton_m.id,
    quantity: 150,
  });
  await setStockLevel(prisma, {
    warehouseId: received.sourceWarehouseId,
    productVariantId: ctx.variants.courier_polybag_l.id,
    quantity: 420,
  });
  await setStockLevel(prisma, {
    warehouseId: received.destinationWarehouseId,
    productVariantId: ctx.variants.courier_polybag_l.id,
    quantity: 250,
  });

  nextCtx.warehouseTransfers!.draft = draft;
  nextCtx.warehouseTransfers!.approved = approved;
  nextCtx.warehouseTransfers!.dispatched = dispatched;
  nextCtx.warehouseTransfers!.received = received;

  console.log("✅ SCM transfer scenarios ensured: draft, approved, dispatched, received");
  return nextCtx;
}
