import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../../lib/prisma";
import { createOrderNotification } from "../../lib/order-notifications";
import { getOrderAdminNotifications } from "../../lib/order-admin-notifications";

loadEnvConfig(process.cwd());

test("guest orders notify only authorized admins; read state and navigation state stay independent", async () => {
  const rollback = new Error("ROLLBACK_NOTIFICATION_TEST");
  try {
    await assert.rejects(prisma.$transaction(async (tx) => {
      const suffix = randomUUID();
      await tx.permission.upsert({ where: { key: "orders.read_all" }, create: { key: "orders.read_all" }, update: {} });
      const role = await tx.role.create({ data: {
        name: `notification-test-${suffix}`, label: "Notification test",
        rolePermissions: { create: { permission: { connect: { key: "orders.read_all" } } } },
      } });
      const makeUser = (name: string, scopeType?: "GLOBAL" | "WAREHOUSE", banned = false) => tx.user.create({ data: {
        email: `${name}-${suffix}@example.invalid`, name, banned,
        userRoles: scopeType ? { create: { roleId: role.id, scopeType } } : undefined,
      } });
      const admin = await makeUser("global", "GLOBAL");
      const scoped = await makeUser("scoped", "WAREHOUSE");
      const customer = await makeUser("customer");
      const banned = await makeUser("banned", "GLOBAL", true);
      const order = await tx.order.create({ data: {
        name: "Notification test", phone_number: "00000000000", country: "Bangladesh",
        district: "Dhaka", area: "Test", address_details: "Test", payment_method: "CashOnDelivery",
        total: 0, shipping_cost: 0, grand_total: 0,
      } });
      const notify = (event: string) => createOrderNotification({
        tx, userId: null, orderId: order.id, title: event, message: `Your order #${order.id} updated.`, metadata: { event },
      });
      await notify("ORDER_PLACED");
      await notify("ORDER_STATUS_CHANGED");
      await notify("ORDER_PAYMENT_STATUS_CHANGED");
      await notify("SHIPMENT_STATUS_CHANGED");
      await notify("DELIVERY_STATUS_CHANGED");
      let feed = await getOrderAdminNotifications(admin.id, 2, false, tx);
      assert.equal(feed.unreadCount, 5);
      assert.equal(feed.rows.length, 2);
      assert.equal(feed.newOrderCount, 1);
      for (const user of [scoped, customer, banned]) {
        assert.equal((await getOrderAdminNotifications(user.id, 50, false, tx)).rows.length, 0);
      }
      assert.equal(await tx.customerNotification.count({ where: { userId: customer.id } }), 0);
      const displayedIds = feed.newOrderIds;
      // An order arriving after the badge was displayed must survive the acknowledgement.
      await notify("ORDER_PLACED");
      await tx.orderAdminNotification.updateMany({
        where: { userId: admin.id, id: { in: displayedIds } }, data: { navigationSeenAt: new Date() },
      });
      feed = await getOrderAdminNotifications(admin.id, 50, false, tx);
      assert.equal(feed.newOrderCount, 1);
      assert.equal(feed.unreadCount, 6);
      await tx.orderAdminNotification.updateMany({ where: { userId: admin.id }, data: { readAt: new Date() } });
      const unread = await getOrderAdminNotifications(admin.id, 50, true, tx);
      assert.equal(unread.rows.length, 0);
      assert.equal(unread.newOrderCount, 1);
      assert.equal((await getOrderAdminNotifications(admin.id, 50, false, tx)).rows.length, 6);
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
  } finally { await prisma.$disconnect(); }
});
