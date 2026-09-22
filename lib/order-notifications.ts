import { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";

type NotificationClient = Pick<PrismaClient, "customerNotification">;

export async function createOrderNotification(params: {
  tx: NotificationClient;
  userId?: string | null;
  orderId: number;
  title: string;
  message: string;
  targetUrl?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  if (!params.userId) return null;

  return params.tx.customerNotification.create({
    data: {
      userId: params.userId,
      type: "ORDER_UPDATE",
      title: params.title,
      message: params.message,
      targetUrl: params.targetUrl ?? `/ecommerce/user/orders/${params.orderId}`,
      metadata: params.metadata,
    },
    select: { id: true },
  });
}
