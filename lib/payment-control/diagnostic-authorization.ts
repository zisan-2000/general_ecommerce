import "server-only";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/request-security";
import { requirePaymentControlAccess, PaymentControlError } from "./authorization";
export type DiagnosticPermission = "payments.diagnostics.capture" | "payments.diagnostics.export" | "payments.diagnostics.evidence";
export async function requireDiagnosticAccess(request: Request, permission?: DiagnosticPermission, mutation = false) {
  const access = await requirePaymentControlAccess(request, mutation);
  if (mutation && request.headers.get("origin") !== new URL(request.url).origin) throw new PaymentControlError("Same-origin diagnostic request required", 403);
  if (permission && !access.hasGlobal(permission)) throw new PaymentControlError("Dedicated diagnostic permission required", 403);
  const limit = await rateLimitRequest(request, { scope: permission ?? "payment-diagnostic-read", identifier: access.userId!,
    limit: permission === "payments.diagnostics.capture" ? 5 : 30, windowMs: 60000 });
  if (!limit.allowed) throw new PaymentControlError("Diagnostic request limit exceeded", 429);
  return access;
}
// Sensitive evidence actions fail closed if the durable audit cannot be saved.
// Fixed metadata projection: no request headers, secret values or raw payloads.
export async function auditDiagnosticAction(userId: string, action: string, entityId: string) {
  await prisma.activityLog.create({ data: { userId, action, entity: "PAYMENT_DIAGNOSTICS", entityId,
    metadata: { source: "AUTHORIZED_DIAGNOSTIC_API" }, updatetAt: new Date() } });
}
