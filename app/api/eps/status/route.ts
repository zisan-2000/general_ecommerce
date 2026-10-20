import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { rateLimitRequest } from "@/lib/request-security";
import { verifyPaymentInitToken } from "@/lib/sslcommerz";
import { EpsError, reconcileEpsPayment } from "@/lib/eps";
import { epsObject } from "@/lib/eps-settings";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
import { attachPaymentResult } from "@/lib/payment-result";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimitRequest(request, { scope: "eps-status", limit: 15, windowMs: 60_000 });
    if (!limit.allowed) throw new EpsError("Too many verification requests", 429);
    const body = epsObject(await request.json().catch(() => null));
    const orderId = Number(body.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new EpsError("Valid orderId is required", 400);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new EpsError("Order not found", 404);
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(session?.user as { id?: string; role?: string } | undefined);
    const owner = Boolean(order.userId && order.userId === access.userId);
    const guest = !order.userId && verifyPaymentInitToken(order.id, body.paymentInitToken);
    const admin = access.hasAny(["settings.payment.manage", "settings.manage"]);
    if (!owner && !guest && !admin) throw new EpsError("Forbidden", 403);
    const payment = await prisma.payment.findFirst({ where: { orderId, provider: "EPS",
      ...(typeof body.tranId === "string" ? { externalId: body.tranId } : {}),
    }, orderBy: { id: "desc" } });
    if (!payment?.externalId) throw new EpsError("EPS payment attempt was not found", 404);
    const result = await reconcileEpsPayment(payment.externalId, request);
    revalidateStorefrontCatalog();
    return attachPaymentResult(NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } }), payment.externalId, "EPS");
  } catch (error) {
    return NextResponse.json({ error: error instanceof EpsError ? error.message : "EPS payment verification is unavailable" },
      { status: error instanceof EpsError ? error.status : 500 });
  }
}
