import { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";
import { createOrderAdminNotifications } from "@/lib/order-admin-notifications";

type NotificationClient = Pick<PrismaClient, "customerNotification" | "user" | "orderAdminNotification">;

export async function createOrderNotification(params: {
  tx: NotificationClient;
  userId?: string | null;
  orderId: number;
  title: string;
  message: string;
  targetUrl?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await createOrderAdminNotifications(params);
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
