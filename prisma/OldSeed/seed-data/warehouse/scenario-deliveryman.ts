import { daysAgo, daysFromNow, money } from "./helpers";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehouseDeliveryman(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  const deliveryKeys = ["delivery1", "delivery2", "delivery3", "delivery4", "delivery5"];
  const warehouseKeys = Object.keys(ctx.warehouses);
  const shipmentKeys = Object.keys(ctx.shipments);

  for (const [index, deliveryKey] of deliveryKeys.entries()) {
    const warehouseKey = warehouseKeys[index % warehouseKeys.length];
    const warehouseId = ctx.warehouses[warehouseKey];
    const userId = ctx.users[deliveryKey];
    const employeeCode = `WH-DM-${String(index + 1).padStart(3, "0")}`;

    const profile = await prisma.deliveryManProfile.upsert({
      where: { userId },
      update: {
        warehouseId,
        employeeCode,
        fullName: `Warehouse Delivery Man ${index + 1}`,
        phone: `0182200000${index + 1}`,
        alternatePhone: `0182290000${index + 1}`,
        email: `warehouse.delivery${index + 1}@boe.demo`,
        dateOfBirth: daysAgo(365 * (25 + index)),
        gender: index % 2 === 0 ? "MALE" : "FEMALE",
        presentAddress: `Present address ${index + 1}, ${warehouseKey}`,
        permanentAddress: `Permanent address ${index + 1}, ${warehouseKey}`,
        emergencyContactName: `Emergency Contact ${index + 1}`,
        emergencyContactPhone: `0192200000${index + 1}`,
        emergencyContactRelation: "Family",
        identityType: "NID",
        identityNumber: `WHNID100000${index + 1}`,
        fatherName: `Father ${index + 1}`,
        fatherIdentityType: "NID",
        fatherIdentityNumber: `WHFNID100000${index + 1}`,
        motherName: `Mother ${index + 1}`,
        motherIdentityType: "NID",
        motherIdentityNumber: `WHMNID100000${index + 1}`,
        bankName: index % 2 === 0 ? "DBBL" : "BRAC Bank",
        bankAccountName: `Warehouse Delivery Man ${index + 1}`,
        bankAccountNumber: `20000000000${index + 1}`,
        bankChequeNumber: `CHK-WH-${index + 1}`,
        bondAmount: money(10000 + index * 1000),
        bondSignedAt: daysAgo(60 + index),
        bondExpiryDate: daysFromNow(365),
        contractSignedAt: daysAgo(45 + index),
        contractStartDate: daysAgo(40 + index),
        contractEndDate: daysFromNow(365),
        contractStatus: "ACTIVE",
        joiningDate: daysAgo(35 + index),
        status: index === 4 ? "PENDING" : "ACTIVE",
        applicationStatus: index === 4 ? "UNDER_REVIEW" : "APPROVED",
        verifiedById: index === 4 ? null : ctx.adminUserId ?? ctx.users.manager,
        verifiedAt: index === 4 ? null : daysAgo(20 + index),
        assignedById: ctx.adminUserId ?? ctx.users.manager,
        note: "Seeded warehouse deliveryman profile",
      },
      create: {
        userId,
        warehouseId,
        employeeCode,
        fullName: `Warehouse Delivery Man ${index + 1}`,
        phone: `0182200000${index + 1}`,
        alternatePhone: `0182290000${index + 1}`,
        email: `warehouse.delivery${index + 1}@boe.demo`,
        dateOfBirth: daysAgo(365 * (25 + index)),
        gender: index % 2 === 0 ? "MALE" : "FEMALE",
        presentAddress: `Present address ${index + 1}, ${warehouseKey}`,
        permanentAddress: `Permanent address ${index + 1}, ${warehouseKey}`,
        emergencyContactName: `Emergency Contact ${index + 1}`,
        emergencyContactPhone: `0192200000${index + 1}`,
        emergencyContactRelation: "Family",
        identityType: "NID",
        identityNumber: `WHNID100000${index + 1}`,
        fatherName: `Father ${index + 1}`,
        fatherIdentityType: "NID",
        fatherIdentityNumber: `WHFNID100000${index + 1}`,
        motherName: `Mother ${index + 1}`,
        motherIdentityType: "NID",
        motherIdentityNumber: `WHMNID100000${index + 1}`,
        bankName: index % 2 === 0 ? "DBBL" : "BRAC Bank",
        bankAccountName: `Warehouse Delivery Man ${index + 1}`,
        bankAccountNumber: `20000000000${index + 1}`,
        bankChequeNumber: `CHK-WH-${index + 1}`,
        bondAmount: money(10000 + index * 1000),
        bondSignedAt: daysAgo(60 + index),
        bondExpiryDate: daysFromNow(365),
        contractSignedAt: daysAgo(45 + index),
        contractStartDate: daysAgo(40 + index),
        contractEndDate: daysFromNow(365),
        contractStatus: "ACTIVE",
        joiningDate: daysAgo(35 + index),
        status: index === 4 ? "PENDING" : "ACTIVE",
        applicationStatus: index === 4 ? "UNDER_REVIEW" : "APPROVED",
        verifiedById: index === 4 ? null : ctx.adminUserId ?? ctx.users.manager,
        verifiedAt: index === 4 ? null : daysAgo(20 + index),
        assignedById: ctx.adminUserId ?? ctx.users.manager,
        note: "Seeded warehouse deliveryman profile",
      },
      select: { id: true },
    });
    ctx.deliveryProfiles[deliveryKey] = profile.id;

    const existingReference = await prisma.deliveryManReference.findFirst({
      where: { deliveryManProfileId: profile.id, phone: `0193300000${index + 1}` },
      select: { id: true },
    });

    const reference = existingReference
      ? await prisma.deliveryManReference.update({
          where: { id: existingReference.id },
          data: {
            name: `Reference ${index + 1}`,
            relation: "Neighbor",
            address: `Reference address ${index + 1}`,
            occupation: "Business",
            identityType: "NID",
            identityNumber: `WHREFNID100000${index + 1}`,
          },
          select: { id: true },
        })
      : await prisma.deliveryManReference.create({
          data: {
            deliveryManProfileId: profile.id,
            name: `Reference ${index + 1}`,
            phone: `0193300000${index + 1}`,
            relation: "Neighbor",
            address: `Reference address ${index + 1}`,
            occupation: "Business",
            identityType: "NID",
            identityNumber: `WHREFNID100000${index + 1}`,
          },
          select: { id: true },
        });

    const existingDocument = await prisma.deliveryManDocument.findFirst({
      where: { deliveryManProfileId: profile.id, type: "IDENTITY_FRONT" },
      select: { id: true },
    });

    const documentData = {
      deliveryManProfileId: profile.id,
      referenceId: reference.id,
      type: "IDENTITY_FRONT" as any,
      title: `Seeded NID front ${index + 1}`,
      fileUrl: `/demo/deliveryman/nid-front-${index + 1}.jpg`,
      fileName: `nid-front-${index + 1}.jpg`,
      mimeType: "image/jpeg",
      fileSize: 120000 + index * 1000,
      note: "Seeded warehouse deliveryman document",
      isVerified: index !== 4,
      verifiedAt: index === 4 ? null : daysAgo(15 + index),
      verifiedById: index === 4 ? null : ctx.adminUserId ?? ctx.users.manager,
    };

    if (existingDocument) {
      await prisma.deliveryManDocument.update({ where: { id: existingDocument.id }, data: documentData });
    } else {
      await prisma.deliveryManDocument.create({ data: documentData });
    }

    const shipmentKey = shipmentKeys[index];
    if (shipmentKey) {
      const statuses = ["ASSIGNED", "ACCEPTED", "PICKUP_CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED"];
      const assignmentStatus = statuses[index] as any;
      const existingAssignment = await prisma.deliveryAssignment.findFirst({
        where: {
          shipmentId: ctx.shipments[shipmentKey],
          deliveryManProfileId: profile.id,
        },
        select: { id: true },
      });

      const assignmentData = {
        orderId: ctx.orders[shipmentKey],
        shipmentId: ctx.shipments[shipmentKey],
        deliveryManProfileId: profile.id,
        warehouseId,
        assignedById: ctx.adminUserId ?? ctx.users.manager,
        status: assignmentStatus,
        pickupProofStatus: index >= 2 ? "CONFIRMED" : "PENDING" as any,
        isCurrent: true,
        note: "Seeded warehouse delivery assignment",
        latestNote: `Current status ${assignmentStatus}`,
        assignedAt: daysAgo(3),
        respondedAt: index >= 1 ? daysAgo(2) : null,
        acceptedAt: index >= 1 ? daysAgo(2) : null,
        pickupConfirmedAt: index >= 2 ? daysAgo(1) : null,
        inTransitAt: index >= 2 ? daysAgo(1) : null,
        outForDeliveryAt: index >= 3 ? daysAgo(0) : null,
        deliveredAt: index === 4 ? new Date() : null,
        deliveredLatitude: index === 4 ? 23.7644 : null,
        deliveredLongitude: index === 4 ? 90.3890 : null,
        deliveredAccuracy: index === 4 ? 12.5 : null,
        completedAt: index === 4 ? new Date() : null,
      };

      const assignment = existingAssignment
        ? await prisma.deliveryAssignment.update({ where: { id: existingAssignment.id }, data: assignmentData, select: { id: true } })
        : await prisma.deliveryAssignment.create({ data: assignmentData, select: { id: true } });

      await prisma.deliveryAssignmentLog.create({
        data: {
          deliveryAssignmentId: assignment.id,
          fromStatus: null,
          toStatus: assignmentStatus,
          note: `Seeded assignment status ${assignmentStatus}`,
          actorUserId: ctx.adminUserId ?? ctx.users.manager,
        },
      });

      const existingPickup = await prisma.warehousePickupProof.findUnique({
        where: { deliveryAssignmentId: assignment.id },
        select: { id: true },
      });

      const pickupData = {
        deliveryAssignmentId: assignment.id,
        actorUserId: userId,
        status: index >= 2 ? "CONFIRMED" : "PENDING" as any,
        productReceived: index >= 2,
        packagingOk: index >= 2,
        productInGoodCondition: index >= 2,
        imageUrl: index >= 2 ? `/demo/pickup/proof-${index + 1}.jpg` : null,
        note: index >= 2 ? "Seeded pickup confirmed" : "Seeded pickup pending",
        confirmedAt: index >= 2 ? daysAgo(1) : null,
      };

      if (existingPickup) {
        await prisma.warehousePickupProof.update({ where: { id: existingPickup.id }, data: pickupData });
      } else {
        await prisma.warehousePickupProof.create({ data: pickupData });
      }
    }
  }

  return ctx;
}
