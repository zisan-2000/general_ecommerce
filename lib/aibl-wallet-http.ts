import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { createPaymentInitToken, verifyPaymentInitToken } from "@/lib/sslcommerz";
import { AiblWalletError } from "@/lib/aibl-wallet";
import { aiblWalletGatewayId, aiblWalletObject } from "@/lib/aibl-wallet-settings";
import type { AiblCallbackDiagnosticCode } from "@/lib/payment-control/telemetry";
const pendingName = "aibl_wallet_pending";
const callbackAuxiliaryNames = new Set([
  "access_token", "economic", "mobile_no", "paid_amount", "reference_no", "responsecode", "transaction_id",
]);
const callbackLegacyNames = new Set(["RESCODE", "STATUS", "AMOUNT", "MESSAGE", "SESSIONKEY", "TRANSNO", "BILLNO"]);
export class AiblBodyParseError extends AiblWalletError {
  constructor(message: string, status: number, readonly diagnosticCode: AiblCallbackDiagnosticCode) { super(message, status); }
}
function callbackFieldCount(count: number) {
  return (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const)[count] ?? "GT10";
}
function assertUniqueCallbackJsonKeys(raw: string, diagnosticCode: AiblCallbackDiagnosticCode) {
  // Called after JSON.parse validates syntax. Callback objects must be flat;
  // consume complete strings so escaped text inside MESSAGE is never treated as a key.
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|:/g) ?? [];
  const keys = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!tokens[i].startsWith('"') || tokens[i + 1] !== ":") continue;
    const key: string = JSON.parse(tokens[i]);
    if (keys.has(key)) throw new AiblBodyParseError("Duplicate callback JSON fields are invalid", 400, diagnosticCode);
    keys.add(key);
  }
}
export function requireAiblSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    const host = request.headers.get("host") || new URL(request.url).host;
    if (origin.host !== host || request.headers.get("sec-fetch-site") === "cross-site") throw new Error();
  } catch { throw new AiblWalletError("Same-origin payment request required", 403); }
}
export async function readAiblBody(request: Request, rejectDuplicateJsonKeys = false) {
  const reader = request.body?.getReader();
  if (!reader) throw new AiblBodyParseError("Payment body is required", 400, "AIBL_CB_BODY_MISSING");
  let bytes = 0; const chunks: Uint8Array[] = [];
  let failureCode: AiblCallbackDiagnosticCode = "AIBL_CB_BODY_READ_FAILED";
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
      if (bytes > 16384) { failureCode = "AIBL_CB_BODY_TOO_LARGE"; await reader.cancel();
        throw new AiblBodyParseError("Payment body exceeds 16 KB", 413, failureCode); }
      chunks.push(part.value); }
    failureCode = "AIBL_CB_BODY_DECODE_FAILED";
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type === "application/json") {
      failureCode = "AIBL_CB_BODY_JSON_INVALID";
      const raw = new TextDecoder().decode(buffer);
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new AiblBodyParseError("Invalid payment body", 400, "AIBL_CB_BODY_JSON_NOT_OBJECT");
      }
      if (rejectDuplicateJsonKeys) assertUniqueCallbackJsonKeys(raw, "AIBL_CB_BODY_JSON_DUPLICATE_KEY");
      return aiblWalletObject(value);
    }
    if (type === "application/x-www-form-urlencoded" || type === "multipart/form-data") {
      failureCode = "AIBL_CB_FORM_MALFORMED";
      const result: Record<string, unknown> = Object.create(null);
      // Parse only the already bounded body. Preserve the multipart boundary;
      // never call request.formData() on an unbounded incoming stream.
      const fields = type === "multipart/form-data"
        ? await new Response(buffer, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData()
        : new URLSearchParams(new TextDecoder().decode(buffer)); // Exactly one form URL decode; no fallback decode.
      for (const [key, value] of fields) {
        if (Object.hasOwn(result, key)) throw new AiblBodyParseError("Duplicate callback fields are invalid", 400, "AIBL_CB_FORM_DUPLICATE_FIELD");
        if (typeof value !== "string") throw new AiblBodyParseError("Payment form fields must be text; files are not accepted", 400, "AIBL_CB_FORM_FILE_REJECTED");
        result[key] = value;
      }
      return result;
    }
    throw new AiblBodyParseError("Use JSON, form-urlencoded or multipart payment data", 415, "AIBL_CB_CONTENT_UNSUPPORTED");
  } catch (error) {
    if (error instanceof AiblWalletError) throw error;
    throw new AiblBodyParseError("Invalid payment body", 400, failureCode);
  } finally { reader.releaseLock(); }
}
export async function readAiblCallbackBody(request: Request, onDiagnostic?: (code: AiblCallbackDiagnosticCode) => Promise<void>) {
  const note = async (code: AiblCallbackDiagnosticCode) => {
    try { await onDiagnostic?.(code); } catch { /* Diagnostics must not change callback acceptance. */ }
  };
  const body = await readAiblBody(request, true); // Callback-only duplicate JSON check; existing 16 KB/form/file limits.
  await note("AIBL_CB_OUTER_BODY_PARSED");
  if (!Object.hasOwn(body, "data")) {
    await note("AIBL_CB_DATA_MISSING"); // Observation, not rejection: preserve existing flat callbacks.
    if (Object.keys(body).some((name) => callbackAuxiliaryNames.has(name))) {
      throw new AiblBodyParseError("Callback metadata requires data JSON", 400, "AIBL_CB_AUX_WITHOUT_DATA");
    }
    if (Object.keys(body).some((name) => !callbackLegacyNames.has(name))) {
      throw new AiblBodyParseError("Unknown flat callback field", 400, "AIBL_CB_OUTER_FIELDS_UNEXPECTED");
    }
    if (Object.values(body).some((field) => field !== null && typeof field === "object")) {
      throw new AiblBodyParseError("Invalid flat callback structure", 400, "AIBL_CB_DATA_NESTED_VALUE");
    }
    return body;
  }
  await note("AIBL_CB_DATA_PRESENT");
  const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded" && type !== "multipart/form-data") {
    throw new AiblBodyParseError("Ambiguous callback envelope", 400, "AIBL_CB_ENVELOPE_CONTENT_INVALID");
  }
  const extraNames = Object.keys(body).filter((name) => name !== "data");
  if (extraNames.some((name) => !callbackAuxiliaryNames.has(name))) {
    // Only bank-documented JSON keys get named diagnostics if found at the outer level.
    // Mixed reference sources and every name outside the observed auxiliary allowlist reject.
    const knownOuterNames = ["RESCODE", "STATUS", "AMOUNT", "MESSAGE", "SESSIONKEY", "TRANSNO", "BILLNO"] as const;
    const knownNames = new Set<string>([...knownOuterNames, ...callbackAuxiliaryNames]);
    await note(`AIBL_CB_OUTER_EXTRA_COUNT_${callbackFieldCount(extraNames.length)}`);
    await note(`AIBL_CB_OUTER_UNKNOWN_COUNT_${callbackFieldCount(extraNames.filter((name) => !knownNames.has(name)).length)}`);
    for (const name of knownOuterNames) {
      if (Object.hasOwn(body, name)) await note(`AIBL_CB_OUTER_FIELD_${name}`);
    }
    throw new AiblBodyParseError("Ambiguous callback envelope", 400, "AIBL_CB_OUTER_FIELDS_UNEXPECTED");
  }
  if (typeof body.data !== "string") throw new AiblBodyParseError("Ambiguous callback envelope", 400, "AIBL_CB_DATA_TYPE_INVALID");
  if (extraNames.some((name) => typeof body[name] !== "string")) {
    throw new AiblBodyParseError("Callback metadata must be text", 400, "AIBL_CB_AUX_TYPE_INVALID");
  }
  // All form text remains bounded by the existing 16 KB request limit. Never parse,
  // merge, authenticate with, return or log the untrusted auxiliary values.
  if (extraNames.length) await note("AIBL_CB_OUTER_AUX_IGNORED");
  try {
    const value: unknown = JSON.parse(body.data);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new AiblBodyParseError("Invalid callback data JSON", 400, "AIBL_CB_DATA_JSON_NOT_OBJECT");
    }
    const payload = aiblWalletObject(value);
    // The confirmed JSON payload is flat. No recursive envelopes or nested references.
    if (Object.hasOwn(payload, "data")) throw new AiblBodyParseError("Invalid callback data JSON", 400, "AIBL_CB_DATA_RECURSIVE");
    if (Object.values(payload).some((field) => field !== null && typeof field === "object")) {
      throw new AiblBodyParseError("Invalid callback data JSON", 400, "AIBL_CB_DATA_NESTED_VALUE");
    }
    assertUniqueCallbackJsonKeys(body.data, "AIBL_CB_DATA_JSON_DUPLICATE_KEY");
    await note("AIBL_CB_DATA_JSON_PARSED");
    return payload;
  } catch (error) {
    if (error instanceof AiblBodyParseError) throw error;
    // Never propagate JSON parser messages: they can contain bank payload fragments.
    throw new AiblBodyParseError("Invalid callback data JSON", 400, "AIBL_CB_DATA_JSON_INVALID");
  }
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
