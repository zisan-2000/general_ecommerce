import "server-only";
import { prisma } from "@/lib/prisma";
import { thresholds } from "./policy";

type AlertInput = { scope: "HOST" | "PROBE" | "PAYMENT_API"; agentId?: string; targetId?: string;
  requestId?: string; code: string; active: boolean | null; value?: number | null; threshold?: number; observedAt: Date };
export async function setMonitorAlert(input: AlertInput) {
  if (input.active === null) return; // Missing data never resolves a real alert.
  const dedupeKey = [input.scope, input.agentId || "UNBOUND", input.targetId || "NONE", input.code].join(":");
  // Retain a healthy watermark too, so a delayed older failure cannot become current.
  await prisma.networkMonitorAlert.upsert({ where: { dedupeKey },
    create: { dedupeKey, scope: input.scope, agentId: input.agentId, targetId: input.targetId,
      requestId: input.requestId, code: input.code, value: input.value, threshold: input.threshold,
      status: input.active ? "OPEN" : "RESOLVED", occurrences: input.active ? 1 : 0,
      resolvedAt: input.active ? null : input.observedAt, firstSeenAt: input.observedAt, lastSeenAt: input.observedAt },
    update: {},
  });
  if (!input.active) {
    await prisma.networkMonitorAlert.updateMany({ where: { dedupeKey, status: "OPEN", lastSeenAt: { lt: input.observedAt } },
      data: { status: "RESOLVED", resolvedAt: input.observedAt, lastSeenAt: input.observedAt } });
    await prisma.networkMonitorAlert.updateMany({ where: { dedupeKey, status: "RESOLVED", lastSeenAt: { lt: input.observedAt } },
      data: { lastSeenAt: input.observedAt } });
    return;
  }
  // Atomic timestamp guard: concurrent dashboard reads or old buffered samples cannot
  // overwrite a newer alert/resolution or increment occurrences twice for one observation.
  await prisma.networkMonitorAlert.updateMany({ where: { dedupeKey, occurrences: 0, lastSeenAt: { lt: input.observedAt } },
    data: { status: "OPEN", resolvedAt: null, requestId: input.requestId, value: input.value, threshold: input.threshold,
      firstSeenAt: input.observedAt, lastSeenAt: input.observedAt, occurrences: 1 } });
  await prisma.networkMonitorAlert.updateMany({ where: { dedupeKey, occurrences: { gt: 0 }, lastSeenAt: { lt: input.observedAt } },
    data: { status: "OPEN", resolvedAt: null, requestId: input.requestId, value: input.value,
      threshold: input.threshold, lastSeenAt: input.observedAt, occurrences: { increment: 1 } },
  });
}

export function probeStats(samples: Array<{ protocol: string; outcome: string; latencyMs: number | null;
  startedAt: Date; completedAt: Date; targetVersion: number }>, intervalSeconds: number) {
  const sorted = [...samples].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const success = sorted.filter((row) => row.outcome === "SUCCESS" && row.latencyMs !== null);
  const differences: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]; const b = sorted[i];
    if (a.outcome === "SUCCESS" && b.outcome === "SUCCESS" && a.latencyMs !== null && b.latencyMs !== null &&
        a.targetVersion === b.targetVersion && b.startedAt.getTime() - a.startedAt.getTime() <= intervalSeconds * 2500) {
      differences.push(Math.abs(b.latencyMs - a.latencyMs));
    }
  }
  const knownIcmp = sorted.length > 0 && sorted.every((row) => row.protocol === "ICMP" && ["SUCCESS", "TIMEOUT"].includes(row.outcome));
  return { attempts: sorted.length, successes: success.length,
    timeouts: sorted.filter((row) => row.outcome === "TIMEOUT").length,
    failures: sorted.filter((row) => row.outcome !== "SUCCESS").length,
    averageLatencyMs: success.length ? success.reduce((sum, row) => sum + row.latencyMs!, 0) / success.length : null,
    jitterMs: differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : null,
    jitterPairs: differences.length,
    // Standard ICMP echo no-reply measurement. TCP handshakes cannot measure packet loss.
    packetLossPct: knownIcmp ? (sorted.length - success.length) * 100 / sorted.length : null,
    // Echo attempts/replies are probe observations, not captured on-wire packet totals.
    echoAttempts: knownIcmp ? sorted.length : null, echoReplies: knownIcmp ? success.length : null,
    packetsDropped: null,
  };
}

export async function evaluateProbeAlerts(targetId: string) {
  const target = await prisma.networkProbeTarget.findUnique({ where: { id: targetId } });
  if (!target) return;
  const measurements = await prisma.networkProbeSample.findMany({ where: { targetId, targetVersion: target.version,
    completedAt: { gte: new Date(Date.now() - target.intervalSeconds * 12500) } },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 10 });
  if (!measurements.length) return;
  const stats = probeStats(measurements, target.intervalSeconds);
  const limits = thresholds();
  const common = { scope: "PROBE" as const, agentId: target.agentId, targetId, observedAt: measurements[0].completedAt };
  await setMonitorAlert({ ...common, code: "CONNECTION_FAILURE", active: measurements[0].outcome !== "SUCCESS",
    value: stats.failures });
  await setMonitorAlert({ ...common, code: "HIGH_PROBE_LATENCY", active: stats.averageLatencyMs === null ? null
    : stats.averageLatencyMs > limits.probeLatencyMs, value: stats.averageLatencyMs, threshold: limits.probeLatencyMs });
  await setMonitorAlert({ ...common, code: "HIGH_ICMP_LOSS", active: stats.packetLossPct === null ||
    measurements.length < limits.minimumLossSamples ? null : stats.packetLossPct > limits.lossPct,
    value: stats.packetLossPct, threshold: limits.lossPct });
}
