import type { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

type NotificationClient = Pick<PrismaClient, "user" | "orderAdminNotification">;

export async function createOrderAdminNotifications(input: {
  tx: NotificationClient;
  orderId: number;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const recipients = await input.tx.user.findMany({
    where: {
      AND: [{ OR: [{ banned: null }, { banned: false }] }],
      OR: [
        { userRoles: { some: { role: { deletedAt: null, name: "superadmin" } } } },
        { userRoles: { some: { scopeType: "GLOBAL", role: {
          deletedAt: null,
          rolePermissions: { some: { permission: { key: "orders.read_all" } } },
        } } } },
      ],
    },
    select: { id: true },
  });
  if (!recipients.length) return;
  const metadata = input.metadata;
  const stage = metadata && typeof metadata === "object" && "event" in metadata
    && typeof metadata.event === "string" ? metadata.event : "ORDER_UPDATE";
  await input.tx.orderAdminNotification.createMany({
    data: recipients.map(({ id }) => ({
      userId: id,
      orderId: input.orderId,
      stage,
      title: input.title,
      message: input.message.replace(/^Your order/, "Order").replace(/^Payment for your order/, "Payment for order"),
      metadata,
    })),
  });
}

export async function getOrderAdminNotifications(userId: string, limit = 50, unreadOnly = false, client: Pick<PrismaClient, "orderAdminNotification"> = prisma) {
  const [rows, unreadCount, newOrders] = await Promise.all([
    client.orderAdminNotification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.max(1, Math.min(limit, 200)),
    }),
    client.orderAdminNotification.count({ where: { userId, readAt: null } }),
    client.orderAdminNotification.findMany({ where: { userId, stage: "ORDER_PLACED", navigationSeenAt: null }, select: { id: true } }),
  ]);
  return {
    unreadCount,
    newOrderCount: newOrders.length,
    newOrderIds: newOrders.map((row) => row.id),
    rows: rows.map((row) => ({
      ...row,
      type: "ORDER" as const,
      status: "SENT",
      entityNumber: `#${row.orderId}`,
      href: `/admin/operations/orders?orderId=${row.orderId}`,
      sentAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      navigationSeenAt: row.navigationSeenAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
