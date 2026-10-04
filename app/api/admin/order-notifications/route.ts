import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOrderAdminNotifications } from "@/lib/order-admin-notifications";

async function resolveAccess() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(session?.user);
  if (!access.userId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!access.hasGlobal("orders.read_all")) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: access.userId };
}

export async function GET(request: NextRequest) {
  try {
    const access = await resolveAccess();
    if (access.response) return access.response;
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);
    return NextResponse.json(await getOrderAdminNotifications(
      access.userId!, Number.isInteger(limit) && limit > 0 ? limit : 50,
      request.nextUrl.searchParams.get("unreadOnly") === "true",
    ));
  } catch (error) {
    console.error("Order notifications GET:", error);
    return NextResponse.json({ error: "Failed to load order notifications." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await resolveAccess();
    if (access.response) return access.response;
    const body = await request.json();
    const where = { userId: access.userId! };
    if (body.action === "seen_orders") {
      // Only acknowledge the IDs the sidebar actually displayed; a racing new order stays new.
      if (!Array.isArray(body.ids) || !body.ids.every((id: unknown) => Number.isInteger(id) && Number(id) > 0)) {
        return NextResponse.json({ error: "Notification IDs are required." }, { status: 400 });
      }
      await prisma.orderAdminNotification.updateMany({
        where: { ...where, id: { in: body.ids }, stage: "ORDER_PLACED", navigationSeenAt: null },
        data: { navigationSeenAt: new Date() },
      });
    } else if (body.markAll === true) {
      await prisma.orderAdminNotification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
    } else if (Number.isInteger(body.id) && body.id > 0) {
      const result = await prisma.orderAdminNotification.updateMany({ where: { ...where, id: body.id }, data: { readAt: new Date() } });
      if (!result.count) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    } else {
      return NextResponse.json({ error: "Invalid notification action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Order notifications PATCH:", error);
    return NextResponse.json({ error: "Failed to update order notifications." }, { status: 500 });
  }
}
