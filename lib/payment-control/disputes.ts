import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { resolveSeoSiteUrl } from "@/lib/seo-url";
import { PaymentControlError, idempotencyKey, positiveId } from "./authorization";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function safeCaseText(value: unknown, label: string, minimum = 3, maximum = 2000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < minimum || text.length > maximum) throw new PaymentControlError(`${label} must be ${minimum}–${maximum} characters`);
  if (/(?:bearer\s+\S+|(?:password|passwd|secret|token|x-hash|card_no|cvv|pin)\s*[:=]\s*\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:\d[ -]?){13,19})/i.test(text)) {
    throw new PaymentControlError("Remove credentials, tokens, card numbers and sensitive payment data from case text");
  }
  return text;
}
function evidenceUrl(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 1000) throw new PaymentControlError("Invalid evidence URL");
  try {
    const url = new URL(value);
    if (url.search || url.hash || url.username || url.password || /token|secret|password|passwd/i.test(url.pathname)) throw new Error();
    resolveSeoSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: url.origin });
    return url.href;
  } catch { throw new PaymentControlError("Evidence URL must be public HTTPS without credentials, query or fragment; use access-controlled evidence storage"); }
}
async function validateAssignee(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 100) throw new PaymentControlError("Invalid staff assignment");
  const user = await prisma.user.findUnique({ where: { id: value }, select: { id: true, role: true, banned: true } });
  if (!user || user.banned) throw new PaymentControlError("Staff member is unavailable");
  const access = await getAccessContext(user);
  if (!access.hasGlobal("settings.payment.manage") && !access.hasGlobal("settings.manage")) {
    throw new PaymentControlError("Assignee must have global payment management permission");
  }
  return user.id;
}
export async function paymentStaffOptions() {
  return prisma.user.findMany({ where: { OR: [{ banned: false }, { banned: null }], AND: [{ OR: [
    { userRoles: { some: { role: { name: "superadmin", deletedAt: null } } } },
    { userRoles: { some: { scopeType: "GLOBAL", role: { deletedAt: null, rolePermissions: { some: {
      permission: { key: { in: ["settings.payment.manage", "settings.manage"] } },
    } } } } } },
  ] }] }, select: { id: true, name: true }, take: 100, orderBy: { name: "asc" } });
}
export async function createPaymentDispute(input: unknown, actorUserId: string) {
  const body = object(input);
  const paymentId = positiveId(body.paymentId);
  const key = idempotencyKey(body.idempotencyKey);
  const category = String(body.category ?? "");
  if (!["COMPLAINT", "PAYMENT_MISMATCH", "REFUND", "DUPLICATE_CHARGE"].includes(category)) throw new PaymentControlError("Invalid dispute category");
  const complaint = safeCaseText(body.complaint, "Complaint", 10);
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, orderId: { not: null }, provider: { in: ["EPS", "SSLCOMMERZ", "AIBL_WALLET"] } }, select: { id: true } });
  if (!payment) throw new PaymentControlError("Payment not found", 404);
  const assignedToId = await validateAssignee(body.assignedToId);
  const findRetry = async () => {
    const existing = await prisma.paymentDispute.findUnique({ where: { idempotencyKey: key } });
    if (existing && (existing.paymentId !== paymentId || existing.category !== category ||
        existing.complaint !== complaint || existing.createdById !== actorUserId)) {
      throw new PaymentControlError("Idempotency key already used for another complaint", 409);
    }
    return existing;
  };
  const retry = await findRetry();
  if (retry) return retry;
  try {
    return await prisma.paymentDispute.create({ data: { paymentId, idempotencyKey: key, category, complaint,
      assignedToId, createdById: actorUserId,
      activities: { create: { action: "CREATED", toStatus: "OPEN", assignedToId, actorUserId } },
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await findRetry();
      if (existing) return existing;
    }
    throw error;
  }
}
export async function updatePaymentDispute(id: string, input: unknown, actorUserId: string) {
  const body = object(input);
  const version = positiveId(body.version);
  const status = String(body.status ?? "");
  if (!["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"].includes(status)) throw new PaymentControlError("Invalid dispute status");
  const assignedToId = await validateAssignee(body.assignedToId);
  const resolution = ["RESOLVED", "REJECTED"].includes(status) ? safeCaseText(body.resolution, "Resolution", 10) : null;
  const evidence = body.evidence ? object(body.evidence) : null;
  const preparedEvidence = evidence ? {
    label: safeCaseText(evidence.label, "Evidence label", 3, 120),
    note: safeCaseText(evidence.note, "Evidence note"), url: evidenceUrl(evidence.url), actorUserId,
  } : null;
  return prisma.$transaction(async (tx) => {
    const current = await tx.paymentDispute.findUnique({ where: { id } });
    if (!current) throw new PaymentControlError("Dispute not found", 404);
    const changed = await tx.paymentDispute.updateMany({ where: { id, version }, data: {
      status, assignedToId, resolution, version: { increment: 1 },
    } });
    if (changed.count !== 1) throw new PaymentControlError("Dispute changed; reload before saving", 409);
    if (preparedEvidence) await tx.paymentDisputeEvidence.create({ data: { disputeId: id, ...preparedEvidence } });
    await tx.paymentDisputeActivity.create({ data: { disputeId: id, action: preparedEvidence ? "UPDATED_WITH_EVIDENCE" : "UPDATED",
      fromStatus: current.status, toStatus: status, assignedToId, resolution, actorUserId } });
    return tx.paymentDispute.findUniqueOrThrow({ where: { id } });
  });
}
