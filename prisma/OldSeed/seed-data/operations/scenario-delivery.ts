import { daysAgo } from "./helpers";
import type { OperationsSeedContext, TxClient } from "./types";

const DELIVERY_PROOFS = [
  {
    orderKey: "pendingCod",
    userKey: "customerA",
    tickReceived: false,
    tickCorrectItems: false,
    tickGoodCondition: false,
    note: "Pending delivery confirmation.",
    photoUrl: null,
    confirmedDaysAgo: 1,
  },
  {
    orderKey: "confirmedPaid",
    userKey: "customerB",
    tickReceived: false,
    tickCorrectItems: false,
    tickGoodCondition: false,
    note: "Assigned but not delivered yet.",
    photoUrl: null,
    confirmedDaysAgo: 2,
  },
  {
    orderKey: "processingCard",
    userKey: "customerC",
    tickReceived: false,
    tickCorrectItems: false,
    tickGoodCondition: false,
    note: "Parcel is in transit.",
    photoUrl: null,
    confirmedDaysAgo: 2,
  },
  {
    orderKey: "shippedPaid",
    userKey: "customerA",
    tickReceived: false,
    tickCorrectItems: false,
    tickGoodCondition: false,
    note: "Out for delivery; proof pending.",
    photoUrl: null,
    confirmedDaysAgo: 1,
  },
  {
    orderKey: "deliveredPaid",
    userKey: "customerB",
    tickReceived: true,
    tickCorrectItems: true,
    tickGoodCondition: true,
    note: "Customer confirmed successful delivery.",
    photoUrl: "/demo/operations/delivery-proof-1005.jpg",
    confirmedDaysAgo: 4,
  },
] as const;

export async function seedOperationsDelivery(
  prisma: TxClient,
  ctx: OperationsSeedContext,
): Promise<void> {
  for (const proof of DELIVERY_PROOFS) {
    const shipmentId = ctx.shipments[proof.orderKey];
    const existingProof = await prisma.deliveryProof.findUnique({
      where: { shipmentId },
      select: { id: true },
    });

    const proofData = {
      orderId: ctx.orders[proof.orderKey],
      shipmentId,
      userId: ctx.users[proof.userKey],
      tickReceived: proof.tickReceived,
      tickCorrectItems: proof.tickCorrectItems,
      tickGoodCondition: proof.tickGoodCondition,
      photoUrl: proof.photoUrl,
      note: proof.note,
      confirmedAt: daysAgo(proof.confirmedDaysAgo),
      ipAddress: "127.0.0.1",
      userAgent: "Operations seed",
    };

    if (existingProof) {
      await prisma.deliveryProof.update({
        where: { id: existingProof.id },
        data: proofData,
      });
    } else {
      await prisma.deliveryProof.create({ data: proofData });
    }
  }
}
