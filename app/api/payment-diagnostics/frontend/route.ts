import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentInitToken } from "@/lib/sslcommerz";
import { rateLimitRequest } from "@/lib/request-security";
import { readMonitorBody } from "@/lib/network-monitor/policy";
import { diagnosticsEnabled, frontendDiagnosticCodes, type FrontendDiagnosticCode } from "@/lib/payment-control/diagnostic-policy";
import { recordPaymentEvent } from "@/lib/payment-control/telemetry";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!diagnosticsEnabled()) return new Response(null, { status: 204, headers });
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
    const limit = await rateLimitRequest(request, { scope: "payment-browser-diagnostics", limit: 30, windowMs: 60000 });
    if (!limit.allowed) return new Response(null, { status: 429, headers });
    const body = await readMonitorBody(request);
    if (typeof body.orderId !== "number" || !Number.isSafeInteger(body.orderId) || body.orderId < 1 ||
      !frontendDiagnosticCodes.includes(body.code as FrontendDiagnosticCode) || typeof body.durationMs !== "number" ||
      !Number.isSafeInteger(body.durationMs) || body.durationMs < 0 || body.durationMs > 120000) return new Response(null, { status: 400, headers });
    const session = await getServerSession(authOptions);
    const order = await prisma.order.findUnique({ where: { id: body.orderId }, select: { id: true, userId: true, payment_method: true } });
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!order || !(order.userId ? order.userId === userId : verifyPaymentInitToken(order.id, body.paymentInitToken)))
      return new Response(null, { status: 403, headers });
    const provider = order.payment_method.startsWith("EPS:") ? "EPS" : order.payment_method.startsWith("AIBL_WALLET:") ? "AIBL_WALLET" : null;
    if (!provider) return new Response(null, { status: 400, headers });
    const requestId = typeof body.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    // An arbitrary client-supplied UUID is never trusted as a server request ID.
    const bound = requestId ? await prisma.paymentEvent.findFirst({ where: { requestId, orderId: order.id, provider,
      operation: { not: "FRONTEND" } }, select: { paymentId: true } }) : null;
    if (requestId && !bound) return new Response(null, { status: 400, headers });
    await recordPaymentEvent({ provider, orderId: order.id, paymentId: bound?.paymentId ?? undefined,
      requestId: bound ? requestId : undefined, operation: "FRONTEND", outcome: "RECEIVED",
      detailCode: body.code as FrontendDiagnosticCode, durationMs: body.durationMs });
    return new Response(null, { status: 204, headers });
  } catch { return NextResponse.json({ error: "Diagnostic report unavailable" }, { status: 503, headers }); }
}
