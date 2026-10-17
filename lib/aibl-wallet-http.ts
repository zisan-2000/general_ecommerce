import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { createPaymentInitToken, verifyPaymentInitToken } from "@/lib/sslcommerz";
import { AiblWalletError } from "@/lib/aibl-wallet";
import { aiblWalletGatewayId, aiblWalletObject } from "@/lib/aibl-wallet-settings";
const pendingName = "aibl_wallet_pending";
export function requireAiblSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    const host = request.headers.get("host") || new URL(request.url).host;
    if (origin.host !== host || request.headers.get("sec-fetch-site") === "cross-site") throw new Error();
  } catch { throw new AiblWalletError("Same-origin payment request required", 403); }
}
export async function readAiblBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AiblWalletError("Payment body is required", 400);
  let bytes = 0; let text = ""; const decoder = new TextDecoder();
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw new AiblWalletError("Payment body exceeds 16 KB", 413); }
      text += decoder.decode(part.value, { stream: true }); }
    text += decoder.decode();
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type === "application/json") {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      return aiblWalletObject(value);
    }
    if (type === "application/x-www-form-urlencoded") {
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, value] of new URLSearchParams(text)) {
        if (Object.hasOwn(result, key)) throw new AiblWalletError("Duplicate callback fields are invalid", 400);
        result[key] = value;
      }
      return result;
    }
    throw new AiblWalletError("Use JSON or form-urlencoded payment data", 415);
  } catch (error) {
    if (error instanceof AiblWalletError) throw error;
    throw new AiblWalletError("Invalid payment body", 400);
  } finally { reader.releaseLock(); }
}
export function aiblPendingCookie(request: NextRequest) {
  const raw = request.cookies.get(pendingName)?.value || "";
  if (!/^\d{1,12}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const dot = raw.indexOf("."); const orderId = Number(raw.slice(0, dot)); const token = raw.slice(dot + 1);
  return verifyPaymentInitToken(orderId, token) ? { orderId, token } : null;
}
export function attachAiblPending<T extends NextResponse>(response: T, orderId: number) {
  const token = createPaymentInitToken(orderId, 24 * 60 * 60000);
  if (token) response.cookies.set(pendingName, `${orderId}.${token}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/aibl-wallet", maxAge: 86400 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export function clearAiblPending<T extends NextResponse>(response: T) {
  response.cookies.set(pendingName, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/aibl-wallet", maxAge: 0 });
  return response;
}
export async function authorizeAiblOrder(request: NextRequest, body: Record<string, unknown>, allowAdmin = false) {
  const orderId = Number(body.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new AiblWalletError("Valid orderId is required", 400);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !aiblWalletGatewayId(order.payment_method)) throw new AiblWalletError("AIBL order not found", 404);
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(session?.user as { id?: string; role?: string } | undefined);
  const pending = aiblPendingCookie(request);
  const owner = Boolean(order.userId && order.userId === access.userId);
  const guest = !order.userId && verifyPaymentInitToken(orderId, body.paymentInitToken ?? (pending?.orderId === orderId ? pending.token : null));
  const admin = allowAdmin && (access.hasGlobal("settings.payment.manage") || access.hasGlobal("settings.manage"));
  if (!owner && !guest && !admin) throw new AiblWalletError("Forbidden", 403);
  if (access.userId && (owner || admin)) {
    const user = await prisma.user.findUnique({ where: { id: access.userId }, select: { banned: true } });
    if (!user || user.banned) throw new AiblWalletError("Account access is unavailable", 403);
  }
  return order;
}
export function aiblErrorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof AiblWalletError ? error.message : "AIBL request could not complete; review the pending payment" },
    { status: error instanceof AiblWalletError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
}
