import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "./authorization";
import { approvedCaptureIps, captureOperations, requireCaptureEnabled, type CaptureProvider } from "./capture-policy";
export const captureProjection = { id: true, paymentId: true, requestId: true, provider: true, operation: true,
  kind: true, status: true, agentId: true, seconds: true, maxBytes: true, createdAt: true, startedAt: true,
  completedAt: true, expiresAt: true, errorCode: true, packetCount: true, bytes: true, sha256: true, summary: true } as const;
export async function requestCapture(input: Record<string, unknown>, actorUserId: string) {
  let limits;
  try { limits = requireCaptureEnabled(); } catch { throw new PaymentControlError("Capture disabled or private storage policy is unavailable", 503); }
  if (!Number.isSafeInteger(input.paymentId) || Number(input.paymentId) < 1 || !["CAPTURE", "READINESS"].includes(String(input.kind)) ||
    !captureOperations.includes(input.operation as typeof captureOperations[number])) throw new PaymentControlError("Invalid capture job");
  const payment = await prisma.payment.findFirst({ where: { id: Number(input.paymentId), orderId: { not: null },
    provider: { in: ["EPS", "AIBL_WALLET"] } }, select: { id: true, provider: true } });
  if (!payment) throw new PaymentControlError("Payment attempt not found", 404);
  const provider = payment.provider as CaptureProvider;
  try { approvedCaptureIps(provider); } catch { throw new PaymentControlError("Gateway capture destinations require operator approval", 503); }
  if (provider === "EPS" && input.operation === "VERIFY" || provider === "AIBL_WALLET" && input.operation === "STATUS_QUERY")
    throw new PaymentControlError("Operation does not match this provider");
  const requestId = typeof input.requestId === "string" && /^[a-f0-9-]{36}$/i.test(input.requestId) ? input.requestId : null;
  if (input.requestId && !requestId) throw new PaymentControlError("Invalid request ID");
  if (requestId && !await prisma.paymentEvent.findFirst({ where: { paymentId: payment.id, requestId, provider }, select: { id: true } }))
    throw new PaymentControlError("Request does not belong to this attempt");
  const agentId = process.env.PAYMENT_CAPTURE_AGENT_ID;
  if (!agentId || !/^[A-Za-z0-9_-]{1,64}$/.test(agentId)) throw new PaymentControlError("Capture agent is not configured", 503);
  return prisma.$transaction(async tx => {
    // A dedicated diagnostic lock, never the order/settlement lock namespace.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(1784484441, 9)::text AS "lock"`);
    await tx.paymentDiagnosticCapture.updateMany({ where: { status: "QUEUED", createdAt: { lt: new Date(Date.now() - 120000) } },
      data: { status: "FAILED", errorCode: "CAPTURE_QUEUE_EXPIRED", completedAt: new Date() } });
    await tx.paymentDiagnosticCapture.updateMany({ where: { status: { in: ["RUNNING", "UPLOADING"] }, startedAt: { lt: new Date(Date.now() - 120000) } },
      data: { status: "FAILED", errorCode: "AGENT_LEASE_EXPIRED", completedAt: new Date() } });
    if (await tx.paymentDiagnosticCapture.count({ where: { status: { in: ["QUEUED", "RUNNING"] }, expiresAt: { gt: new Date() } } }) >= 4)
      throw new PaymentControlError("Capture queue is full", 409);
    if (await tx.paymentDiagnosticCapture.count({ where: { kind: "CAPTURE", expiresAt: { gt: new Date() } } }) >= 100)
      throw new PaymentControlError("Evidence retention capacity reached; run authorized retention cleanup", 409);
    const job = await tx.paymentDiagnosticCapture.create({ data: { id: randomUUID(), paymentId: payment.id, provider,
      operation: String(input.operation), requestId, kind: String(input.kind), agentId, createdById: actorUserId,
      seconds: input.kind === "READINESS" ? 1 : limits.seconds, maxBytes: limits.bytes,
      expiresAt: new Date(Date.now() + limits.retentionDays * 86400000) }, select: captureProjection });
    await tx.activityLog.create({ data: { userId: actorUserId, action: "CAPTURE_REQUESTED", entity: "PAYMENT_DIAGNOSTICS",
      entityId: job.id, metadata: { provider, operation: job.operation, kind: job.kind, seconds: job.seconds, maxBytes: job.maxBytes }, updatetAt: new Date() } });
    return job;
  }, { maxWait: 1000, timeout: 3000 });
}
export async function requireCaptureAgent(request: Request) {
  try { requireCaptureEnabled(); } catch { throw new PaymentControlError("Capture disabled", 503); }
  const expected = process.env.PAYMENT_CAPTURE_AGENT_TOKEN ?? "";
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const agentId = process.env.PAYMENT_CAPTURE_AGENT_ID;
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(expected) || !/^[A-Za-z0-9_-]{32,256}$/.test(actual) || actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected)) || request.headers.get("x-capture-agent-id") !== agentId || !agentId)
    throw new PaymentControlError("Unauthorized capture agent", 401);
  return agentId;
}
export async function claimCaptureJob(agentId: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(1784484441, 9)::text AS "lock"`);
    const now = new Date();
    await tx.paymentDiagnosticCapture.updateMany({ where: { agentId, status: { in: ["RUNNING", "UPLOADING"] },
      startedAt: { lt: new Date(now.getTime() - 120000) } }, data: { status: "FAILED", errorCode: "AGENT_LEASE_EXPIRED", completedAt: now } });
    await tx.paymentDiagnosticCapture.updateMany({ where: { agentId, status: "QUEUED", createdAt: { lt: new Date(now.getTime() - 120000) } },
      data: { status: "FAILED", errorCode: "CAPTURE_QUEUE_EXPIRED", completedAt: now } });
    if (await tx.paymentDiagnosticCapture.count({ where: { agentId, status: "RUNNING" } })) return null;
    const job = await tx.paymentDiagnosticCapture.findFirst({ where: { agentId, status: "QUEUED", expiresAt: { gt: now } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    if (!job) return null;
    if (job.kind === "CAPTURE") {
      const ready = await tx.paymentDiagnosticCapture.findFirst({ where: { agentId, provider: job.provider,
        kind: "READINESS", status: "COMPLETE", completedAt: { gt: new Date(now.getTime() - 300000) } } });
      if (!ready) {
        await tx.paymentDiagnosticCapture.update({ where: { id: job.id }, data: { status: "FAILED", errorCode: "READINESS_REQUIRED", completedAt: now } });
        return null;
      }
    }
    const updated = await tx.paymentDiagnosticCapture.update({ where: { id: job.id }, data: { status: "RUNNING", startedAt: now }, select: captureProjection });
    return { ...updated, approvedIps: approvedCaptureIps(job.provider as CaptureProvider) };
  }, { maxWait: 1000, timeout: 3000 });
}
