import "server-only";
import { Prisma, type NetworkProbeSample } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "@/lib/payment-control/authorization";
import { approvedTarget, counter, integer, object, timestamp, uuidPattern } from "./policy";
import { evaluateProbeAlerts, setMonitorAlert } from "./alerts";

export async function ingestNetworkSample(agentId: string, input: Record<string, unknown>) {
  const id = String(input.id ?? ""); const sessionId = String(input.sessionId ?? "");
  if (!uuidPattern.test(id) || !uuidPattern.test(sessionId)) throw new PaymentControlError("Invalid measurement/session ID");
  const sequence = integer(input.sequence, 1, 2147483647, "sequence");
  const observedAt = timestamp(input.observedAt);
  const host = object(input.host);
  const adapterKey = host.adapterKey === null ? null : String(host.adapterKey ?? "");
  if (adapterKey !== null && !/^[a-f0-9]{64}$/i.test(adapterKey)) throw new PaymentControlError("Invalid opaque adapter scope");
  const counters = { packetsSent: counter(host.packetsSent), packetsReceived: counter(host.packetsReceived),
    packetsDropped: counter(host.packetsDropped), tcpRetransmissions: counter(host.tcpRetransmissions),
    tcpConnectionFailures: counter(host.tcpConnectionFailures) };
  if (!adapterKey && [counters.packetsSent, counters.packetsReceived, counters.packetsDropped].some((v) => v !== null)) {
    throw new PaymentControlError("Interface counters require an adapter scope");
  }
  if (!Array.isArray(input.probes) || input.probes.length > 4) throw new PaymentControlError("At most four approved probe samples allowed");
  const entries = input.probes.map(object);
  const seen = new Set<string>();
  const probes: Omit<NetworkProbeSample, "id" | "sampleId">[] = [];
  for (const entry of entries) {
    const targetId = String(entry.targetId ?? "");
    if (!uuidPattern.test(targetId) || seen.has(targetId)) throw new PaymentControlError("Invalid/duplicate target sample");
    seen.add(targetId);
    const target = await prisma.networkProbeTarget.findFirst({ where: { id: targetId, agentId, enabled: true } });
    if (!target || target.version !== entry.targetVersion) throw new PaymentControlError("Probe configuration changed; refresh collector configuration", 409);
    approvedTarget(target);
    const startedAt = timestamp(entry.startedAt); const completedAt = timestamp(entry.completedAt);
    if (completedAt < startedAt || completedAt.getTime() > observedAt.getTime() + 1000 ||
        completedAt.getTime() - startedAt.getTime() > target.timeoutMs + 10000) throw new PaymentControlError("Invalid probe measurement window");
    const outcome = String(entry.outcome ?? "");
    if (!["SUCCESS", "TIMEOUT", "UNREACHABLE", "ERROR"].includes(outcome)) throw new PaymentControlError("Invalid probe outcome");
    const elapsedMs = entry.elapsedMs;
    if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > target.timeoutMs + 10000) {
      throw new PaymentControlError("Invalid measured elapsed time");
    }
    const latencyMs = entry.latencyMs;
    if (outcome === "SUCCESS" && (typeof latencyMs !== "number" || !Number.isFinite(latencyMs) || latencyMs < 0 ||
        latencyMs > target.timeoutMs + 10000)) throw new PaymentControlError("Success requires measured latency");
    if (outcome !== "SUCCESS" && latencyMs !== null) throw new PaymentControlError("Unsuccessful probe latency must be null");
    const code = typeof entry.errorCode === "string" && ["CONNECTION_REFUSED", "NETWORK_UNREACHABLE", "ACCESS_DENIED",
      "PING_ERROR", "SOCKET_ERROR", "UNKNOWN_ERROR"].includes(entry.errorCode) ? entry.errorCode : null;
    probes.push({ targetId, targetVersion: target.version, targetLabel: target.label, address: target.address,
      protocol: target.protocol, port: target.port, startedAt, completedAt, outcome, elapsedMs, latencyMs: latencyMs as number | null, errorCode: code });
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "NetworkMonitorAgent" WHERE "id" = ${agentId} FOR UPDATE`);
    const agent = await tx.networkMonitorAgent.findUniqueOrThrow({ where: { id: agentId } });
    if (!agent.enabled) throw new PaymentControlError("Collector is disabled", 403);
    const duplicate = await tx.networkHostSample.findUnique({ where: { id } });
    if (duplicate) {
      if (duplicate.agentId !== agentId) throw new PaymentControlError("Measurement ID conflict", 409);
      return { duplicate: true, sample: duplicate };
    }
    const previous = await tx.networkHostSample.findFirst({ where: { agentId }, orderBy: [{ observedAt: "desc" }, { id: "desc" }] });
    if (previous && (observedAt.getTime() - previous.observedAt.getTime() < 60000 ||
        previous.sessionId === sessionId && sequence <= previous.sequence)) throw new PaymentControlError("Collector sample is out of order or faster than 60 seconds", 409);
    for (const probe of probes) {
      // Revalidate after acquiring the agent lock; admin config updates use the same lock.
      const current = await tx.networkProbeTarget.findUniqueOrThrow({ where: { id: probe.targetId } });
      if (!current.enabled || current.version !== probe.targetVersion) throw new PaymentControlError("Target was changed or disabled", 409);
      const last = await tx.networkProbeSample.findFirst({ where: { targetId: probe.targetId }, orderBy: { completedAt: "desc" } });
      if (last && probe.startedAt.getTime() - last.startedAt.getTime() < current.intervalSeconds * 1000) {
        throw new PaymentControlError("Probe frequency exceeds approval", 409);
      }
    }
    const sameSession = previous?.sessionId === sessionId;
    const sameAdapter = sameSession && previous?.adapterKey === adapterKey;
    const difference = (next: bigint | null, old: bigint | null | undefined, sameScope: boolean | undefined) =>
      sameScope && next !== null && old !== null && old !== undefined && next >= old ? next - old : null;
    const deltas = { sentDelta: difference(counters.packetsSent, previous?.packetsSent, sameAdapter),
      receivedDelta: difference(counters.packetsReceived, previous?.packetsReceived, sameAdapter),
      droppedDelta: difference(counters.packetsDropped, previous?.packetsDropped, sameAdapter),
      retransmissionsDelta: difference(counters.tcpRetransmissions, previous?.tcpRetransmissions, sameSession),
      connectionFailuresDelta: difference(counters.tcpConnectionFailures, previous?.tcpConnectionFailures, sameSession) };
    const decreased = (key: keyof typeof counters) => previous && counters[key] !== null && previous[key] !== null && counters[key]! < previous[key]!;
    const nicReset = sameAdapter && (["packetsSent", "packetsReceived", "packetsDropped"] as const).some(decreased);
    const tcpReset = sameSession && (["tcpRetransmissions", "tcpConnectionFailures"] as const).some(decreased);
    if (nicReset) { deltas.sentDelta = null; deltas.receivedDelta = null; deltas.droppedDelta = null; }
    if (tcpReset) { deltas.retransmissionsDelta = null; deltas.connectionFailuresDelta = null; }
    const reset = nicReset || tcpReset;
    const counterState = Object.values(counters).every((v) => v === null) ? "UNAVAILABLE" : !sameSession ? "BASELINE"
      : reset || !sameAdapter ? "RESET" : Object.values(counters).some((v) => v === null) ? "PARTIAL" : "OK";
    const sample = await tx.networkHostSample.create({ data: { id, agentId, sessionId, sequence, adapterKey, observedAt,
      intervalStartAt: sameSession ? previous?.observedAt : null, counterState, ...counters, ...deltas,
      probes: { create: probes },
    } });
    await tx.networkMonitorAgent.update({ where: { id: agentId }, data: { lastObservedAt: observedAt, lastSeenAt: new Date() } });
    return { duplicate: false, sample };
  });
  // Alert persistence failures must not ask the collector to duplicate a recorded sample.
  if (!result.duplicate) {
    try {
      await setMonitorAlert({ scope: "HOST", agentId, code: "HOST_CONNECTION_FAILURES", observedAt,
        active: result.sample.connectionFailuresDelta === null ? null : result.sample.connectionFailuresDelta > 0n,
        value: result.sample.connectionFailuresDelta !== null && result.sample.connectionFailuresDelta <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(result.sample.connectionFailuresDelta) : null });
      for (const probe of probes) await evaluateProbeAlerts(probe.targetId);
    } catch { console.warn("Network alert persistence unavailable"); }
  }
  return { sampleId: result.sample.id, duplicate: result.duplicate };
}
