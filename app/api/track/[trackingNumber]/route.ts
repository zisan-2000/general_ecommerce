import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCourierProvider } from "@/lib/couriers";
import { appendShipmentStatusLog } from "@/lib/report-history";
import { createOrderAdminNotifications } from "@/lib/order-admin-notifications";

type RouteParams = {
  params: Promise<{ trackingNumber: string }>;
};

// GET /api/track/:trackingNumber
// Public endpoint: returns latest tracking status and syncs DB from courier API.
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { trackingNumber } = await params;
    if (!trackingNumber) {
      return NextResponse.json({ error: "Tracking number is required" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber },
      include: {
        order: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
        courierRef: true,
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // If shipment is not courier-backed yet, return DB status directly.
    if (!shipment.courierRef) {
      return NextResponse.json({
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        courierStatus: shipment.courierStatus,
        trackingUrl: shipment.trackingUrl,
        courier: {
          name: shipment.courier,
          type: null,
        },
        order: shipment.order,
        lastSyncedAt: shipment.lastSyncedAt,
      });
    }

    // Pull live status from courier then update local DB.
    const provider = getCourierProvider(shipment.courierRef);
    const live = await provider.getTracking(shipment.courierRef, {
      trackingNumber: shipment.trackingNumber,
      externalId: shipment.externalId,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const nextShipment = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: live.status,
          courierStatus: live.courierStatus,
          trackingUrl: live.trackingUrl || shipment.trackingUrl,
          externalId: live.externalId || shipment.externalId,
          trackingNumber: live.trackingNumber || shipment.trackingNumber,
          lastSyncedAt: new Date(),
          deliveredAt: live.status === "DELIVERED" ? new Date() : shipment.deliveredAt,
        },
        include: {
          order: {
            select: {
              id: true,
              name: true,
              phone_number: true,
            },
          },
          courierRef: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      });

      await appendShipmentStatusLog(tx, {
        shipmentId: nextShipment.id,
        fromStatus: shipment.status,
        toStatus: nextShipment.status,
        source: "PUBLIC_TRACK",
      });

      if (shipment.status !== nextShipment.status) {
        await createOrderAdminNotifications({
          tx, orderId: shipment.orderId, title: "Courier status updated",
          message: `Shipment for order #${shipment.orderId} is now ${nextShipment.status.replaceAll("_", " ").toLowerCase()}.`,
          metadata: { event: "SHIPMENT_STATUS_CHANGED", shipmentId: shipment.id, from: shipment.status, to: nextShipment.status },
        });
      }

      return nextShipment;
    });

    return NextResponse.json({
      trackingNumber: updated.trackingNumber,
      externalId: updated.externalId,
      status: updated.status,
      courierStatus: updated.courierStatus,
      trackingUrl: updated.trackingUrl,
      courier: updated.courierRef,
      order: updated.order,
      lastSyncedAt: updated.lastSyncedAt,
    });
  } catch (error) {
    console.error("Error tracking shipment:", error);
    return NextResponse.json({ error: "Failed to fetch tracking" }, { status: 500 });
  }
}
