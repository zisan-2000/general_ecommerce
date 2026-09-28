import { daysAgo, daysFromNow, decimal } from "./helpers";
import type { ScmSeedContext, ScmSeedPrisma } from "./types";

type MaterialLineInput = {
  variantKey: keyof ScmSeedContext["variants"] | string;
  description: string;
  quantityRequested: number;
  quantityReleased?: number;
  unitCost?: string | number;
};

function requireVariant(ctx: ScmSeedContext, key: string) {
  const variant = ctx.variants[key];
  if (!variant) throw new Error(`Missing SCM variant for material seed: ${key}`);
  return variant;
}

async function resetMaterialRequestChildren(
  prisma: ScmSeedPrisma,
  materialRequestId: number,
) {
  await prisma.assetRegister.deleteMany({ where: { materialRequestId } });
  await prisma.materialReleaseNoteItem.deleteMany({
    where: { materialReleaseNote: { materialRequestId } },
  });
  await prisma.materialReleaseNote.deleteMany({ where: { materialRequestId } });
  await prisma.materialRequestApprovalEvent.deleteMany({ where: { materialRequestId } });
  await prisma.materialRequestAttachment.deleteMany({ where: { materialRequestId } });
  await prisma.materialRequestItem.deleteMany({ where: { materialRequestId } });
}

async function upsertMaterialRequest(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
  input: {
    requestNumber: string;
    warehouseKey: string;
    status:
      | "DRAFT"
      | "SUBMITTED"
      | "SUPERVISOR_ENDORSED"
      | "PROJECT_MANAGER_ENDORSED"
      | "ADMIN_APPROVED"
      | "PARTIALLY_RELEASED"
      | "RELEASED"
      | "REJECTED";
    title: string;
    purpose: string;
    budgetCode: string;
    note: string;
    requestedDaysAgo: number;
    requiredInDays: number;
    createdByKey?: string;
    rejected?: boolean;
    lines: MaterialLineInput[];
  },
) {
  const warehouse = ctx.warehouses[input.warehouseKey];
  if (!warehouse) throw new Error(`Missing warehouse: ${input.warehouseKey}`);

  const requestor = ctx.users[input.createdByKey ?? "procurement_requestor"];
  const supervisor = ctx.users.procurement_manager;
  const projectManager = ctx.users.final_approver;
  const admin = ctx.users.scm_admin;

  const nowData = {
    requestedAt: daysAgo(input.requestedDaysAgo),
    requiredBy: daysFromNow(input.requiredInDays),
    submittedAt: input.status === "DRAFT" ? null : daysAgo(input.requestedDaysAgo - 1),
    supervisorEndorsedAt:
      [
        "SUPERVISOR_ENDORSED",
        "PROJECT_MANAGER_ENDORSED",
        "ADMIN_APPROVED",
        "PARTIALLY_RELEASED",
        "RELEASED",
      ].includes(input.status) && !input.rejected
        ? daysAgo(Math.max(input.requestedDaysAgo - 2, 0))
        : null,
    projectManagerEndorsedAt:
      ["PROJECT_MANAGER_ENDORSED", "ADMIN_APPROVED", "PARTIALLY_RELEASED", "RELEASED"].includes(
        input.status,
      ) && !input.rejected
        ? daysAgo(Math.max(input.requestedDaysAgo - 3, 0))
        : null,
    adminApprovedAt:
      ["ADMIN_APPROVED", "PARTIALLY_RELEASED", "RELEASED"].includes(input.status) &&
      !input.rejected
        ? daysAgo(Math.max(input.requestedDaysAgo - 4, 0))
        : null,
    rejectedAt: input.rejected ? daysAgo(Math.max(input.requestedDaysAgo - 2, 0)) : null,
  };

  const request = await prisma.materialRequest.upsert({
    where: { requestNumber: input.requestNumber },
    update: {
      warehouseId: warehouse.id,
      status: input.status,
      title: input.title,
      purpose: input.purpose,
      budgetCode: input.budgetCode,
      specification: "Seeded SCM material issue scenario.",
      note: input.note,
      ...nowData,
      supervisorEndorsedById: nowData.supervisorEndorsedAt ? supervisor?.id : null,
      projectManagerEndorsedById: nowData.projectManagerEndorsedAt ? projectManager?.id : null,
      adminApprovedById: nowData.adminApprovedAt ? admin?.id : null,
      rejectedById: input.rejected ? supervisor?.id : null,
      createdById: requestor?.id ?? ctx.adminUserId,
    },
    create: {
      requestNumber: input.requestNumber,
      warehouseId: warehouse.id,
      status: input.status,
      title: input.title,
      purpose: input.purpose,
      budgetCode: input.budgetCode,
      specification: "Seeded SCM material issue scenario.",
      note: input.note,
      ...nowData,
      supervisorEndorsedById: nowData.supervisorEndorsedAt ? supervisor?.id : null,
      projectManagerEndorsedById: nowData.projectManagerEndorsedAt ? projectManager?.id : null,
      adminApprovedById: nowData.adminApprovedAt ? admin?.id : null,
      rejectedById: input.rejected ? supervisor?.id : null,
      createdById: requestor?.id ?? ctx.adminUserId,
    },
    select: { id: true, requestNumber: true, warehouseId: true },
  });

  await resetMaterialRequestChildren(prisma, request.id);

  const createdItems = [] as Array<{
    id: number;
    productVariantId: number;
    quantityRequested: number;
    quantityReleased: number;
    unitCost?: string | number;
  }>;

  for (const line of input.lines) {
    const variant = requireVariant(ctx, line.variantKey);
    const item = await prisma.materialRequestItem.create({
      data: {
        materialRequestId: request.id,
        productVariantId: variant.id,
        description: line.description,
        quantityRequested: line.quantityRequested,
        quantityReleased: line.quantityReleased ?? 0,
      },
      select: {
        id: true,
        productVariantId: true,
        quantityRequested: true,
        quantityReleased: true,
      },
    });
    createdItems.push({ ...item, unitCost: line.unitCost });
  }

  if (input.status !== "DRAFT") {
    await prisma.materialRequestApprovalEvent.create({
      data: {
        materialRequestId: request.id,
        stage: "SUBMISSION",
        decision: "APPROVED",
        note: "Seeded submission event.",
        actedById: requestor?.id ?? ctx.adminUserId,
        actedAt: daysAgo(Math.max(input.requestedDaysAgo - 1, 0)),
      },
    });
  }

  if (nowData.supervisorEndorsedAt) {
    await prisma.materialRequestApprovalEvent.create({
      data: {
        materialRequestId: request.id,
        stage: "SUPERVISOR_ENDORSEMENT",
        decision: "APPROVED",
        note: "Seeded supervisor endorsement.",
        actedById: supervisor?.id ?? ctx.adminUserId,
        actedAt: nowData.supervisorEndorsedAt,
      },
    });
  }

  if (nowData.projectManagerEndorsedAt) {
    await prisma.materialRequestApprovalEvent.create({
      data: {
        materialRequestId: request.id,
        stage: "PROJECT_MANAGER_ENDORSEMENT",
        decision: "APPROVED",
        note: "Seeded project manager endorsement.",
        actedById: projectManager?.id ?? ctx.adminUserId,
        actedAt: nowData.projectManagerEndorsedAt,
      },
    });
  }

  if (nowData.adminApprovedAt) {
    await prisma.materialRequestApprovalEvent.create({
      data: {
        materialRequestId: request.id,
        stage: "ADMIN_APPROVAL",
        decision: "APPROVED",
        note: "Seeded admin approval.",
        actedById: admin?.id ?? ctx.adminUserId,
        actedAt: nowData.adminApprovedAt,
      },
    });
  }

  if (input.rejected) {
    await prisma.materialRequestApprovalEvent.create({
      data: {
        materialRequestId: request.id,
        stage: "REJECTION",
        decision: "REJECTED",
        note: "Seeded rejection case for approval queue testing.",
        actedById: supervisor?.id ?? ctx.adminUserId,
        actedAt: nowData.rejectedAt ?? daysAgo(1),
      },
    });
  }

  return { request, items: createdItems };
}

export async function seedScmMaterialScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const nextCtx: ScmSeedContext = {
    ...ctx,
    materialRequests: { ...(ctx.materialRequests ?? {}) },
    materialReleases: { ...(ctx.materialReleases ?? {}) },
  };

  const draft = await upsertMaterialRequest(prisma, ctx, {
    requestNumber: "MRF-SCM-001",
    warehouseKey: "hq",
    status: "DRAFT",
    title: "Draft packaging material request",
    purpose: "Packaging materials for online order surge.",
    budgetCode: "SCM-MAT-PACKAGING",
    note: "Seeded draft material request.",
    requestedDaysAgo: 1,
    requiredInDays: 6,
    lines: [
      {
        variantKey: "corrugated_carton_m",
        description: "Medium carton for dispatch team.",
        quantityRequested: 200,
      },
    ],
  });

  nextCtx.materialRequests!.draft = {
    id: draft.request.id,
    requestNumber: draft.request.requestNumber,
    warehouseId: draft.request.warehouseId,
  };

  const pending = await upsertMaterialRequest(prisma, ctx, {
    requestNumber: "MRF-SCM-002",
    warehouseKey: "ctg",
    status: "PROJECT_MANAGER_ENDORSED",
    title: "Pending admin approval for Chattogram devices",
    purpose: "Scanner and printer replacement for Chattogram dispatch desk.",
    budgetCode: "SCM-MAT-DEVICE",
    note: "Seeded pending admin approval material request.",
    requestedDaysAgo: 4,
    requiredInDays: 4,
    createdByKey: "warehouse_transfer_manager",
    lines: [
      {
        variantKey: "barcode_scanner_usb",
        description: "USB barcode scanner for outbound desk.",
        quantityRequested: 2,
      },
      {
        variantKey: "thermal_printer_4in",
        description: "Thermal label printer for courier labels.",
        quantityRequested: 1,
      },
    ],
  });

  nextCtx.materialRequests!.pendingAdmin = {
    id: pending.request.id,
    requestNumber: pending.request.requestNumber,
    warehouseId: pending.request.warehouseId,
  };

  const released = await upsertMaterialRequest(prisma, ctx, {
    requestNumber: "MRF-SCM-003",
    warehouseKey: "hq",
    status: "RELEASED",
    title: "Released asset issue for operations tablets",
    purpose: "Issue tablets and scanners for warehouse operations.",
    budgetCode: "SCM-MAT-ASSET",
    note: "Seeded fully released material request with asset register.",
    requestedDaysAgo: 8,
    requiredInDays: 1,
    lines: [
      {
        variantKey: "tablet_ops_8in",
        description: "Operations tablet for floor supervisor.",
        quantityRequested: 2,
        quantityReleased: 2,
        unitCost: "17800",
      },
      {
        variantKey: "barcode_scanner_usb",
        description: "Barcode scanner for put-away desk.",
        quantityRequested: 1,
        quantityReleased: 1,
        unitCost: "4300",
      },
    ],
  });

  const release = await prisma.materialReleaseNote.upsert({
    where: { releaseNumber: "MRN-SCM-001" },
    update: {
      challanNumber: "CH-MRN-SCM-001",
      waybillNumber: "WB-MRN-SCM-001",
      materialRequestId: released.request.id,
      warehouseId: released.request.warehouseId,
      status: "ISSUED",
      note: "Seeded material release note for asset issue.",
      releasedAt: daysAgo(2),
      releasedById: ctx.users.warehouse_receiver?.id ?? ctx.adminUserId,
    },
    create: {
      releaseNumber: "MRN-SCM-001",
      challanNumber: "CH-MRN-SCM-001",
      waybillNumber: "WB-MRN-SCM-001",
      materialRequestId: released.request.id,
      warehouseId: released.request.warehouseId,
      status: "ISSUED",
      note: "Seeded material release note for asset issue.",
      releasedAt: daysAgo(2),
      releasedById: ctx.users.warehouse_receiver?.id ?? ctx.adminUserId,
    },
    select: { id: true, releaseNumber: true, materialRequestId: true, warehouseId: true },
  });

  await prisma.materialReleaseNoteItem.deleteMany({
    where: { materialReleaseNoteId: release.id },
  });

  const releaseItems = [] as Array<{ id: number; productVariantId: number; quantityReleased: number }>;
  for (const item of released.items) {
    if (!item.quantityReleased) continue;
    const releaseItem = await prisma.materialReleaseNoteItem.create({
      data: {
        materialReleaseNoteId: release.id,
        materialRequestItemId: item.id,
        productVariantId: item.productVariantId,
        quantityReleased: item.quantityReleased,
        unitCost: item.unitCost ? decimal(item.unitCost) : null,
      },
      select: { id: true, productVariantId: true, quantityReleased: true },
    });
    releaseItems.push(releaseItem);
  }

  for (const releaseItem of releaseItems) {
    for (let index = 1; index <= releaseItem.quantityReleased; index += 1) {
      await prisma.assetRegister.upsert({
        where: {
          assetTag: `AST-SCM-${releaseItem.productVariantId}-${index.toString().padStart(3, "0")}`,
        },
        update: {
          warehouseId: released.request.warehouseId,
          productVariantId: releaseItem.productVariantId,
          materialRequestId: released.request.id,
          materialReleaseNoteId: release.id,
          materialReleaseItemId: releaseItem.id,
          status: "ACTIVE",
          assignedTo: "Warehouse Operations Team",
          note: "Seeded asset from material release flow.",
          acquiredAt: daysAgo(2),
          createdById: ctx.adminUserId,
        },
        create: {
          assetTag: `AST-SCM-${releaseItem.productVariantId}-${index.toString().padStart(3, "0")}`,
          warehouseId: released.request.warehouseId,
          productVariantId: releaseItem.productVariantId,
          materialRequestId: released.request.id,
          materialReleaseNoteId: release.id,
          materialReleaseItemId: releaseItem.id,
          status: "ACTIVE",
          assignedTo: "Warehouse Operations Team",
          note: "Seeded asset from material release flow.",
          acquiredAt: daysAgo(2),
          createdById: ctx.adminUserId,
        },
      });
    }
  }

  nextCtx.materialRequests!.released = {
    id: released.request.id,
    requestNumber: released.request.requestNumber,
    warehouseId: released.request.warehouseId,
  };
  nextCtx.materialReleases!.assetIssue = {
    id: release.id,
    releaseNumber: release.releaseNumber,
    materialRequestId: release.materialRequestId,
    warehouseId: release.warehouseId,
  };

  const rejected = await upsertMaterialRequest(prisma, ctx, {
    requestNumber: "MRF-SCM-004",
    warehouseKey: "syl",
    status: "REJECTED",
    title: "Rejected emergency fixture request",
    purpose: "Fixture request rejected due to incomplete justification.",
    budgetCode: "SCM-MAT-FIXTURE",
    note: "Seeded rejected material request.",
    requestedDaysAgo: 5,
    requiredInDays: 3,
    createdByKey: "supplier_return_manager",
    rejected: true,
    lines: [
      {
        variantKey: "steel_rack_5tier",
        description: "Additional rack for Sylhet store support.",
        quantityRequested: 2,
      },
    ],
  });

  nextCtx.materialRequests!.rejected = {
    id: rejected.request.id,
    requestNumber: rejected.request.requestNumber,
    warehouseId: rejected.request.warehouseId,
  };

  console.log("✅ SCM material scenarios ensured: draft, pending, released, rejected");
  return nextCtx;
}
