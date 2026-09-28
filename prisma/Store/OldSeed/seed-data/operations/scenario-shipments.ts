import { daysAgo, daysFromNow, money } from "./helpers";
import type { OperationsSeedContext, TxClient } from "./types";

const SHIPMENTS = [
  {
    orderKey: "pendingCod",
    warehouseKey: "dhaka",
    courierKey: "steadfast",
    status: "PENDING",
    trackingNumber: "OPS-TRK-1001",
    shippedAt: null,
    expectedDate: daysFromNow(3),
    deliveredAt: null,
    priority: 1,
  },
  {
    orderKey: "confirmedPaid",
    warehouseKey: "dhaka",
    courierKey: "pathao",
    status: "ASSIGNED",
    trackingNumber: "OPS-TRK-1002",
    shippedAt: null,
    expectedDate: daysFromNow(2),
    deliveredAt: null,
    priority: 2,
  },
  {
    orderKey: "processingCard",
    warehouseKey: "chattogram",
    courierKey: "redx",
    status: "IN_TRANSIT",
    trackingNumber: "OPS-TRK-1003",
    shippedAt: daysAgo(2),
    expectedDate: daysFromNow(1),
    deliveredAt: null,
    priority: 2,
  },
  {
    orderKey: "shippedPaid",
    warehouseKey: "sylhet",
    courierKey: "custom",
    status: "OUT_FOR_DELIVERY",
    trackingNumber: "OPS-TRK-1004",
    shippedAt: daysAgo(3),
    expectedDate: daysFromNow(0),
    deliveredAt: null,
    priority: 3,
  },
  {
    orderKey: "deliveredPaid",
    warehouseKey: "khulna",
    courierKey: "express",
    status: "DELIVERED",
    trackingNumber: "OPS-TRK-1005",
    shippedAt: daysAgo(8),
    expectedDate: daysAgo(5),
    deliveredAt: daysAgo(4),
    priority: 0,
  },
] as const;

const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ["PENDING"],
  ASSIGNED: ["PENDING", "ASSIGNED"],
  IN_TRANSIT: ["PENDING", "ASSIGNED", "IN_TRANSIT"],
  OUT_FOR_DELIVERY: ["PENDING", "ASSIGNED", "IN_TRANSIT", "OUT_FOR_DELIVERY"],
  DELIVERED: ["PENDING", "ASSIGNED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
};

const DELIVERY_ROSTER = {
  dhaka: {
    userKey: "deliveryAgent",
    employeeCode: "DM-OPS-DHK-001",
    fullName: "Delivery Agent Dhaka",
    identityNumber: "NID-OPS-DHK-001",
  },
  chattogram: {
    userKey: "deliveryChattogram",
    employeeCode: "DM-OPS-CTG-001",
    fullName: "Delivery Agent Chattogram",
    identityNumber: "NID-OPS-CTG-001",
  },
  sylhet: {
    userKey: "deliverySylhet",
    employeeCode: "DM-OPS-SYL-001",
    fullName: "Delivery Agent Sylhet",
    identityNumber: "NID-OPS-SYL-001",
  },
  khulna: {
    userKey: "deliveryKhulna",
    employeeCode: "DM-OPS-KHL-001",
    fullName: "Delivery Agent Khulna",
    identityNumber: "NID-OPS-KHL-001",
  },
} as const;

type DeliveryAssignmentSeedScenario = {
  status: string;
  note: string;
  acceptedDaysAgo?: number;
  pickupConfirmedDaysAgo?: number;
  inTransitDaysAgo?: number;
  outForDeliveryDaysAgo?: number;
  deliveredDaysAgo?: number;
  pickupProofNote?: string;
  proofImageUrl?: string;
};

const DELIVERY_ASSIGNMENT_SCENARIOS: Record<string, DeliveryAssignmentSeedScenario> = {
  pendingCod: {
    status: "ASSIGNED",
    note: "Seeded newly assigned delivery waiting for rider response.",
  },
  confirmedPaid: {
    status: "ACCEPTED",
    note: "Seeded accepted delivery waiting for warehouse pickup.",
    acceptedDaysAgo: 1,
  },
  processingCard: {
    status: "PICKUP_CONFIRMED",
    note: "Seeded picked-up parcel waiting for in-transit movement.",
    acceptedDaysAgo: 2,
    pickupConfirmedDaysAgo: 1,
    pickupProofNote: "Seeded warehouse pickup confirmation.",
  },
  shippedPaid: {
    status: "OUT_FOR_DELIVERY",
    note: "Seeded out-for-delivery parcel for active dashboard coverage.",
    acceptedDaysAgo: 4,
    pickupConfirmedDaysAgo: 3,
    inTransitDaysAgo: 2,
    outForDeliveryDaysAgo: 1,
    pickupProofNote: "Seeded pickup proof before last-mile dispatch.",
  },
  deliveredPaid: {
    status: "DELIVERED",
    note: "Seeded delivered parcel with completed rider workflow.",
    acceptedDaysAgo: 7,
    pickupConfirmedDaysAgo: 6,
    inTransitDaysAgo: 5,
    outForDeliveryDaysAgo: 4,
    deliveredDaysAgo: 4,
    pickupProofNote: "Seeded pickup proof for delivered shipment.",
    proofImageUrl: "/demo/operations/delivery-proof-1005.jpg",
  },
} as const;

type DeliveryProfileRef = {
  id: string;
  userId: string;
  warehouseId: number;
};

async function ensureDeliveryManProfile(
  prisma: TxClient,
  ctx: OperationsSeedContext,
  warehouseKey: keyof typeof DELIVERY_ROSTER,
): Promise<DeliveryProfileRef> {
  const roster = DELIVERY_ROSTER[warehouseKey];
  const userId = ctx.users[roster.userKey];
  const warehouseId = ctx.warehouses[warehouseKey];

  if (!userId || !warehouseId) {
    throw new Error(`Missing delivery seed context for warehouse: ${warehouseKey}`);
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: {
      id: true,
      name: true,
      code: true,
      area: true,
      district: true,
    },
  });

  if (!warehouse) {
    throw new Error(`Warehouse not found for delivery seed: ${warehouseKey}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error(`Delivery seed user not found: ${roster.userKey}`);
  }

  const role = await prisma.role.findUnique({
    where: { name: "delivery_man" },
    select: { id: true },
  });

  if (!role) {
    throw new Error("delivery_man role not found during operations seed.");
  }

  await prisma.warehouseMembership.upsert({
    where: {
      userId_warehouseId: {
        userId,
        warehouseId,
      },
    },
    update: {
      isPrimary: true,
      status: "ACTIVE",
      assignedById: ctx.adminUserId ?? null,
    },
    create: {
      userId,
      warehouseId,
      isPrimary: true,
      status: "ACTIVE",
      assignedById: ctx.adminUserId ?? null,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_scopeType_warehouseId: {
        userId,
        roleId: role.id,
        scopeType: "WAREHOUSE",
        warehouseId,
      },
    },
    update: {
      assignedById: ctx.adminUserId ?? null,
    },
    create: {
      userId,
      roleId: role.id,
      scopeType: "WAREHOUSE",
      warehouseId,
      assignedById: ctx.adminUserId ?? null,
    },
  });

  const profileData = {
    warehouseId,
    employeeCode: roster.employeeCode,
    fullName: roster.fullName,
    phone: user.phone ?? "",
    alternatePhone: null,
    email: user.email,
    dateOfBirth: daysAgo(365 * 27),
    gender: "MALE",
    presentAddress: `${warehouse.area ?? "Seed Area"}, ${warehouse.district ?? "Seed District"}`,
    permanentAddress: `${warehouse.area ?? "Seed Area"}, ${warehouse.district ?? "Seed District"}`,
    emergencyContactName: "Seed Emergency Contact",
    emergencyContactPhone: "01900000000",
    emergencyContactRelation: "Brother",
    identityType: "NID" as const,
    identityNumber: roster.identityNumber,
    passportExpiryDate: null,
    fatherName: "Seed Father",
    fatherIdentityType: "NID" as const,
    fatherIdentityNumber: `${roster.identityNumber}-F`,
    motherName: "Seed Mother",
    motherIdentityType: "NID" as const,
    motherIdentityNumber: `${roster.identityNumber}-M`,
    bankName: "DBBL",
    bankAccountName: roster.fullName,
    bankAccountNumber: `DM${warehouse.id.toString().padStart(8, "0")}`,
    bankChequeNumber: null,
    bondAmount: money(10000),
    bondSignedAt: daysAgo(40),
    bondExpiryDate: daysFromNow(325),
    contractSignedAt: daysAgo(45),
    contractStartDate: daysAgo(45),
    contractEndDate: daysFromNow(320),
    contractStatus: "ACTIVE",
    joiningDate: daysAgo(60),
    status: "ACTIVE" as const,
    applicationStatus: "APPROVED" as const,
    verifiedById: ctx.adminUserId ?? null,
    verifiedAt: daysAgo(50),
    rejectionReason: null,
    note: "Seeded active delivery man profile for operations delivery dashboard.",
    assignedById: ctx.adminUserId ?? null,
  };

  const existingProfile = await prisma.deliveryManProfile.findUnique({
    where: { userId },
    select: { id: true, userId: true, warehouseId: true },
  });

  const profile = existingProfile
    ? await prisma.deliveryManProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
        select: { id: true, userId: true, warehouseId: true },
      })
    : await prisma.deliveryManProfile.create({
        data: {
          userId,
          ...profileData,
        },
        select: { id: true, userId: true, warehouseId: true },
      });

  return profile;
}

async function recreateDeliveryAssignment(
  prisma: TxClient,
  ctx: OperationsSeedContext,
  input: {
    shipmentId: number;
    orderId: number;
    warehouseId: number;
    profile: DeliveryProfileRef;
    orderKey: keyof typeof DELIVERY_ASSIGNMENT_SCENARIOS;
  },
) {
  const scenario = DELIVERY_ASSIGNMENT_SCENARIOS[input.orderKey];

  await prisma.shipmentAssignment.deleteMany({
    where: { shipmentId: input.shipmentId },
  });

  await prisma.deliveryAssignment.deleteMany({
    where: { shipmentId: input.shipmentId },
  });

  const assignment = await prisma.deliveryAssignment.create({
    data: {
      orderId: input.orderId,
      shipmentId: input.shipmentId,
      deliveryManProfileId: input.profile.id,
      warehouseId: input.warehouseId,
      assignedById: ctx.adminUserId ?? ctx.users.orderManager,
      status: scenario.status as any,
      pickupProofStatus:
        scenario.status === "PICKUP_CONFIRMED" ||
        scenario.status === "OUT_FOR_DELIVERY" ||
        scenario.status === "DELIVERED"
          ? "CONFIRMED"
          : "PENDING",
      isCurrent: true,
      note: scenario.note,
      latestNote: scenario.note,
      assignedAt: daysAgo(2),
      respondedAt: scenario.acceptedDaysAgo ? daysAgo(scenario.acceptedDaysAgo) : null,
      acceptedAt: scenario.acceptedDaysAgo ? daysAgo(scenario.acceptedDaysAgo) : null,
      pickupConfirmedAt: scenario.pickupConfirmedDaysAgo
        ? daysAgo(scenario.pickupConfirmedDaysAgo)
        : null,
      inTransitAt: scenario.inTransitDaysAgo ? daysAgo(scenario.inTransitDaysAgo) : null,
      outForDeliveryAt: scenario.outForDeliveryDaysAgo
        ? daysAgo(scenario.outForDeliveryDaysAgo)
        : null,
      deliveredAt: scenario.deliveredDaysAgo ? daysAgo(scenario.deliveredDaysAgo) : null,
      completedAt: scenario.deliveredDaysAgo ? daysAgo(scenario.deliveredDaysAgo) : null,
      deliveredLatitude: scenario.deliveredDaysAgo ? 22.3569 : null,
      deliveredLongitude: scenario.deliveredDaysAgo ? 91.7832 : null,
      deliveredAccuracy: scenario.deliveredDaysAgo ? 18 : null,
    },
    select: { id: true },
  });

  const logs: Array<{
    toStatus: string;
    fromStatus: string | null;
    createdDaysAgo: number;
    note: string;
  }> = [
    {
      toStatus: "ASSIGNED",
      fromStatus: null,
      createdDaysAgo: 2,
      note: "Seeded delivery assignment created.",
    },
  ];

  if (scenario.acceptedDaysAgo) {
    logs.push({
      toStatus: "ACCEPTED",
      fromStatus: "ASSIGNED",
      createdDaysAgo: scenario.acceptedDaysAgo,
      note: "Seeded rider acceptance.",
    });
  }

  if (scenario.pickupConfirmedDaysAgo) {
    logs.push({
      toStatus: "PICKUP_CONFIRMED",
      fromStatus: "ACCEPTED",
      createdDaysAgo: scenario.pickupConfirmedDaysAgo,
      note: "Seeded warehouse pickup confirmation.",
    });
  }

  if (scenario.inTransitDaysAgo) {
    logs.push({
      toStatus: "IN_TRANSIT",
      fromStatus: "PICKUP_CONFIRMED",
      createdDaysAgo: scenario.inTransitDaysAgo,
      note: "Seeded in-transit status update.",
    });
  }

  if (scenario.outForDeliveryDaysAgo) {
    logs.push({
      toStatus: "OUT_FOR_DELIVERY",
      fromStatus: "IN_TRANSIT",
      createdDaysAgo: scenario.outForDeliveryDaysAgo,
      note: "Seeded out-for-delivery status update.",
    });
  }

  if (scenario.deliveredDaysAgo) {
    logs.push({
      toStatus: "DELIVERED",
      fromStatus: "OUT_FOR_DELIVERY",
      createdDaysAgo: scenario.deliveredDaysAgo,
      note: "Seeded delivered status update.",
    });
  }

  for (const log of logs) {
    await prisma.deliveryAssignmentLog.create({
      data: {
        deliveryAssignmentId: assignment.id,
        fromStatus: log.fromStatus as any,
        toStatus: log.toStatus as any,
        note: log.note,
        actorUserId: input.profile.userId,
        createdAt: daysAgo(log.createdDaysAgo),
      },
    });
  }

  if (scenario.pickupConfirmedDaysAgo) {
    await prisma.warehousePickupProof.create({
      data: {
        deliveryAssignmentId: assignment.id,
        actorUserId: input.profile.userId,
        status: "CONFIRMED",
        productReceived: true,
        packagingOk: true,
        productInGoodCondition: true,
        imageUrl: scenario.proofImageUrl ?? null,
        note: scenario.pickupProofNote ?? "Seeded warehouse pickup proof.",
        confirmedAt: daysAgo(scenario.pickupConfirmedDaysAgo),
      },
    });
  }

  await prisma.shipmentAssignment.create({
    data: {
      shipmentId: input.shipmentId,
      assignedToId: input.profile.userId,
      assignedById: ctx.adminUserId ?? ctx.users.orderManager,
      warehouseId: input.warehouseId,
      role: "delivery_man",
      note: scenario.note,
      assignedAt: daysAgo(2),
      completedAt: scenario.deliveredDaysAgo ? daysAgo(scenario.deliveredDaysAgo) : null,
    },
  });
}

export async function seedOperationsShipments(
  prisma: TxClient,
  ctx: OperationsSeedContext,
): Promise<OperationsSeedContext> {
  const deliveryProfiles = {
    dhaka: await ensureDeliveryManProfile(prisma, ctx, "dhaka"),
    chattogram: await ensureDeliveryManProfile(prisma, ctx, "chattogram"),
    sylhet: await ensureDeliveryManProfile(prisma, ctx, "sylhet"),
    khulna: await ensureDeliveryManProfile(prisma, ctx, "khulna"),
  } as const;

  for (const item of SHIPMENTS) {
    const deliveryProfile = deliveryProfiles[item.warehouseKey];
    const existing = await prisma.shipment.findUnique({
      where: { orderId: ctx.orders[item.orderKey] },
      select: { id: true },
    });

    const shipmentData = {
      orderId: ctx.orders[item.orderKey],
      warehouseId: ctx.warehouses[item.warehouseKey],
      courier: item.courierKey,
      courierId: ctx.couriers[item.courierKey],
      trackingNumber: item.trackingNumber,
      externalId: `OPS-EXT-${item.orderKey}`,
      trackingUrl: `https://tracking.example.com/${item.trackingNumber}`,
      status: item.status as any,
      courierStatus: item.status,
      lastSyncedAt: new Date(),
      shippedAt: item.shippedAt,
      expectedDate: item.expectedDate,
      deliveredAt: item.deliveredAt,
      deliveryConfirmationPin: item.status === "DELIVERED" ? "123456" : null,
      deliveryConfirmationRequestedAt: item.status === "DELIVERED" ? daysAgo(4) : null,
      deliveryConfirmationToken: `ops-token-${item.orderKey}`,
      estimatedCost: money(100 + item.priority * 20),
      actualCost: item.status === "DELIVERED" ? money(130) : null,
      packagingCost: money(20),
      handlingCost: money(15),
      thirdPartyCost: money(60 + item.priority * 10),
      priority: item.priority,
      assignedToUserId: deliveryProfile.userId,
      assignedAt: daysAgo(2),
      pickedAt: item.shippedAt,
      outForDeliveryAt: item.status === "OUT_FOR_DELIVERY" || item.status === "DELIVERED" ? daysAgo(1) : null,
      dispatchNote: "Seeded operations shipment",
    };

    const shipment = existing
      ? await prisma.shipment.update({ where: { id: existing.id }, data: shipmentData, select: { id: true } })
      : await prisma.shipment.create({ data: shipmentData, select: { id: true } });

    ctx.shipments[item.orderKey] = shipment.id;

    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: ctx.orders[item.orderKey] },
      select: { id: true, quantity: true },
    });

    await prisma.shipmentItem.deleteMany({ where: { shipmentId: shipment.id } });
    for (const orderItem of orderItems) {
      await prisma.shipmentItem.create({
        data: {
          shipmentId: shipment.id,
          orderItemId: orderItem.id,
          quantity: orderItem.quantity,
        },
      });
    }

    await prisma.shipmentStatusLog.deleteMany({ where: { shipmentId: shipment.id } });
    const flow = STATUS_FLOW[item.status] ?? [item.status];
    for (let index = 0; index < flow.length; index += 1) {
      await prisma.shipmentStatusLog.create({
        data: {
          shipmentId: shipment.id,
          fromStatus: index === 0 ? null : (flow[index - 1] as any),
          toStatus: flow[index] as any,
          source: "SEED",
          note: `Operations seed status: ${flow[index]}`,
          createdAt: daysAgo(flow.length - index),
        },
      });
    }

    await prisma.shipmentCostLog.deleteMany({ where: { shipmentId: shipment.id } });
    for (const cost of [
      { costType: "PACKAGING", amount: 20, note: "Packing material" },
      { costType: "HANDLING", amount: 15, note: "Warehouse handling" },
      { costType: "COURIER", amount: 80 + item.priority * 10, note: "Courier estimate" },
    ]) {
      await prisma.shipmentCostLog.create({
        data: {
          shipmentId: shipment.id,
          costType: cost.costType,
          amount: money(cost.amount),
          note: cost.note,
          createdById: ctx.adminUserId ?? null,
        },
      });
    }

    await prisma.shipmentAssignment.deleteMany({ where: { shipmentId: shipment.id } });

    await recreateDeliveryAssignment(prisma, ctx, {
      shipmentId: shipment.id,
      orderId: ctx.orders[item.orderKey],
      warehouseId: ctx.warehouses[item.warehouseKey],
      profile: deliveryProfile,
      orderKey: item.orderKey,
    });
  }

  return ctx;
}
