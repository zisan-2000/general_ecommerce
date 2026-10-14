import "server-only";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { rateLimitRequest } from "@/lib/request-security";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export class PaymentControlError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function requirePaymentControlAccess(request?: Request, mutation = false) {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(session?.user as { id?: string; role?: string } | undefined);
  if (!access.userId) throw new PaymentControlError("Unauthorized", 401);
  const staff = await prisma.user.findUnique({ where: { id: access.userId }, select: { banned: true } });
  if (!staff || staff.banned) throw new PaymentControlError("Staff access is unavailable", 403);
  // Transaction histories are store-wide: warehouse-scoped permissions do not grant access.
  if (!access.hasGlobal("settings.payment.manage") && !access.hasGlobal("settings.manage")) {
    throw new PaymentControlError("Global payment management permission required", 403);
  }
  if (request && mutation) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    let valid = false;
    try { valid = Boolean(origin && new URL(origin).host === host); } catch { /* reject */ }
    if (!valid) throw new PaymentControlError("Same-origin request required", 403);
    const limit = await rateLimitRequest(request, { scope: "payment-control", identifier: access.userId,
      limit: 30, windowMs: 60_000 });
    if (!limit.allowed) throw new PaymentControlError("Too many payment management requests", 429);
  }
  return access;
}

export function paymentControlErrorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code)) {
    return NextResponse.json({ error: "Payment Control Center database schema is missing; apply the reviewed migration and regenerate Prisma Client" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ error: error instanceof PaymentControlError ? error.message : "Payment control operation could not complete" },
    { status: error instanceof PaymentControlError ? error.status : 500,
      headers: { "Cache-Control": "private, no-store" } });
}
export function positiveId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new PaymentControlError("Valid payment/refund ID required");
  return id;
}
export function idempotencyKey(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) {
    throw new PaymentControlError("A 16–80 character idempotency key is required");
  }
  return value;
}
