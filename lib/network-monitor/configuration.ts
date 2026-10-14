import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "@/lib/payment-control/authorization";
import { approvedTarget, canonicalIp, integer, label, monitorId, object, probePolicy } from "./policy";

export async function monitorConfiguration() {
  const agents = await prisma.networkMonitorAgent.findMany({ include: { targets: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" }, take: 50 });
  return { agents, allowedProbes: probePolicy(), hostIntervalSeconds: 60 };
}
export async function saveMonitorConfiguration(input: unknown, actorUserId: string) {
  const body = object(input);
  const agentId = monitorId(body.agentId);
  if (body.action === "AGENT") {
    const agentLabel = label(body.label);
    if (typeof body.enabled !== "boolean") throw new PaymentControlError("Enabled must be boolean");
    return prisma.$transaction(async (tx) => {
      const agent = await tx.networkMonitorAgent.upsert({ where: { id: agentId }, create: {
        id: agentId, label: agentLabel, enabled: body.enabled as boolean, createdById: actorUserId,
      }, update: {} });
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "NetworkMonitorAgent" WHERE "id" = ${agentId} FOR UPDATE`);
      return tx.networkMonitorAgent.update({ where: { id: agent.id }, data: { label: agentLabel, enabled: body.enabled as boolean } });
    });
  }
  if (body.action !== "TARGET") throw new PaymentControlError("Invalid configuration action");
  const protocol = String(body.protocol);
  if (!["TCP", "ICMP"].includes(protocol)) throw new PaymentControlError("Invalid probe protocol");
  const target = { address: canonicalIp(body.address), protocol, port: protocol === "TCP" ? integer(body.port, 1, 65535, "port") : null,
    intervalSeconds: integer(body.intervalSeconds, 60, 3600, "interval"),
    timeoutMs: integer(body.timeoutMs, 100, 5000, "timeout"), label: label(body.label) };
  if (typeof body.enabled !== "boolean") throw new PaymentControlError("Enabled must be boolean");
  approvedTarget(target); // Mandatory independent server policy, including for disabled targets.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "NetworkMonitorAgent" WHERE "id" = ${agentId} FOR UPDATE`);
    const agent = await tx.networkMonitorAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new PaymentControlError("Register collector first", 404);
    const id = typeof body.targetId === "string" ? body.targetId : undefined;
    if (await tx.networkProbeTarget.findFirst({ where: { agentId, address: target.address, protocol: target.protocol,
      port: target.port, ...(id ? { id: { not: id } } : {}) } })) {
      throw new PaymentControlError("This collector already has this target; edit the existing target", 409);
    }
    if (id) {
      const current = await tx.networkProbeTarget.findFirst({ where: { id, agentId } });
      if (!current) throw new PaymentControlError("Target not found", 404);
      if (current.version !== body.version) throw new PaymentControlError("Probe configuration changed; reload", 409);
      return tx.networkProbeTarget.update({ where: { id }, data: { ...target, enabled: body.enabled as boolean,
        approvedById: actorUserId, approvedAt: new Date(), version: { increment: 1 } } });
    }
    if (await tx.networkProbeTarget.count({ where: { agentId } }) >= 4) throw new PaymentControlError("At most four targets per collector", 409);
    return tx.networkProbeTarget.create({ data: { agentId, ...target, enabled: body.enabled as boolean, approvedById: actorUserId } });
  });
}
