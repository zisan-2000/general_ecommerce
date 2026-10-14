import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "@/lib/payment-control/authorization";
import { agentIdPattern, thresholds, uuidPattern } from "./policy";
import { probeStats, setMonitorAlert } from "./alerts";

const terminal = ["HTTP_SUCCESS", "HTTP_ERROR", "TIMEOUT", "CONNECTION_ERROR"];
const sampleLimit = 240;
export async function networkOverview(params: URLSearchParams) {
  const hours = Number(params.get("hours") || 1);
  const page = Number(params.get("page") || 1);
  const requestId = params.get("requestId");
  if (requestId && !uuidPattern.test(requestId)) throw new PaymentControlError("Use an exact payment Request ID");
  if (![1, 6, 24, 168].includes(hours) || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
    throw new PaymentControlError("Invalid monitoring range/page");
  }
  const agents = await prisma.networkMonitorAgent.findMany({ orderBy: { createdAt: "asc" }, take: 50 });
  const agentId = params.get("agentId") || agents[0]?.id;
  if (agentId && (!agentIdPattern.test(agentId) || !agents.some((a) => a.id === agentId))) {
    throw new PaymentControlError("Unknown collector", 404);
  }
  const now = new Date(); const start = new Date(now.getTime() - hours * 3600000);
  // No collector selection means no host/probe samples, rather than mixing machines.
  const hostWhere: Prisma.NetworkHostSampleWhereInput = { agentId: agentId || "", observedAt: { gte: start, lte: now } };
  const probeWhere: Prisma.NetworkProbeSampleWhereInput = { sample: { agentId: agentId || "" }, completedAt: { gte: start, lte: now } };
  // API metrics include unbound/legacy requests. Their host is never guessed.
  const apiWhere: Prisma.PaymentEventWhereInput = { outcome: { in: terminal }, createdAt: { gte: start, lte: now } };
  const skip = (page - 1) * 25;
  const [hosts, probes, apiEvents, hostHistory, probeHistory, apiHistory, hostTotal, probeTotal, apiTotal, apiAggregate, apiSummary, targets] = await Promise.all([
    prisma.networkHostSample.findMany({ where: hostWhere, orderBy: [{ observedAt: "desc" }, { id: "desc" }], take: sampleLimit }),
    prisma.networkProbeSample.findMany({ where: probeWhere, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: sampleLimit }),
    prisma.paymentEvent.findMany({ where: apiWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: sampleLimit }),
    prisma.networkHostSample.findMany({ where: hostWhere, orderBy: [{ observedAt: "desc" }, { id: "desc" }], skip, take: 25 }),
    prisma.networkProbeSample.findMany({ where: probeWhere, orderBy: [{ completedAt: "desc" }, { id: "desc" }], skip, take: 25 }),
    prisma.paymentEvent.findMany({ where: apiWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take: 25 }),
    prisma.networkHostSample.count({ where: hostWhere }), prisma.networkProbeSample.count({ where: probeWhere }),
    prisma.paymentEvent.count({ where: apiWhere }),
    prisma.paymentEvent.aggregate({ where: apiWhere, _avg: { durationMs: true }, _max: { durationMs: true } }),
    prisma.paymentEvent.groupBy({ by: ["provider", "outcome"], where: apiWhere, _count: { _all: true } }),
    prisma.networkProbeTarget.findMany({ where: { agentId: agentId || "" }, orderBy: { createdAt: "asc" } }),
  ]);
  const limits = thresholds();
  // Payment alerts reflect the latest recorded result per provider/explicit host in this range.
  // Refresh evaluates observations; it never calls a gateway or changes a payment.
  const groups = new Set<string>();
  try {
    for (const event of apiEvents) {
      const key = event.provider + ":" + (event.networkAgentId || "UNBOUND");
      if (groups.has(key)) continue;
      groups.add(key);
      const common = { scope: "PAYMENT_API" as const, agentId: event.networkAgentId ?? undefined,
        requestId: event.requestId ?? undefined, observedAt: event.requestCompletedAt ?? event.createdAt };
      await setMonitorAlert({ ...common, code: event.provider + "_API_CONNECTION_FAILURE", active: event.outcome === "CONNECTION_ERROR" });
      await setMonitorAlert({ ...common, code: event.provider + "_API_TIMEOUT", active: event.outcome === "TIMEOUT" });
      await setMonitorAlert({ ...common, code: event.provider + "_API_HTTP_ERROR", active: event.outcome === "HTTP_ERROR", value: event.httpStatus });
      await setMonitorAlert({ ...common, code: event.provider + "_API_HIGH_LATENCY", active: event.durationMs === null ? null
        : event.durationMs > limits.apiLatencyMs, value: event.durationMs, threshold: limits.apiLatencyMs });
    }
  } catch { console.warn("Network API alert persistence unavailable"); }
  const alerts = await prisma.networkMonitorAlert.findMany({ where: { occurrences: { gt: 0 }, OR: [{ agentId: agentId || "" }, { scope: "PAYMENT_API" }] },
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }], take: 100 });
  const targetStats = targets.map((target) => {
    const rows = probes.filter((p) => p.targetId === target.id && p.targetVersion === target.version);
    return { ...target, ...probeStats(rows, target.intervalSeconds), latest: rows[0] ?? null,
      stale: !rows[0] || now.getTime() - rows[0].completedAt.getTime() > Math.max(180000, target.intervalSeconds * 2500) };
  });
  let correlation = null;
  if (requestId) {
    const events = await prisma.paymentEvent.findMany({ where: { requestId }, orderBy: { createdAt: "asc" }, take: 20 });
    const result = events.find((e) => terminal.includes(e.outcome));
    const boundAgent = result?.networkAgentId;
    const began = result?.requestStartedAt; const ended = result?.requestCompletedAt;
    let contextHosts: typeof hosts = []; let contextProbes: typeof probes = [];
    if (boundAgent && began && ended) {
      const contextStart = new Date(began.getTime() - 120000); const contextEnd = new Date(ended.getTime() + 120000);
      [contextHosts, contextProbes] = await Promise.all([
        prisma.networkHostSample.findMany({ where: { agentId: boundAgent, observedAt: { gte: contextStart, lte: contextEnd } }, orderBy: { observedAt: "asc" }, take: 20 }),
        prisma.networkProbeSample.findMany({ where: { sample: { agentId: boundAgent }, completedAt: { gte: contextStart, lte: contextEnd } }, orderBy: { completedAt: "asc" }, take: 40 }),
      ]);
    }
    correlation = { requestId, events, agentId: boundAgent ?? null, requestStartedAt: began ?? null, requestCompletedAt: ended ?? null,
      hostSamples: contextHosts, probeSamples: contextProbes,
      available: Boolean(boundAgent && began && ended), windowSeconds: 120 };
  }
  return { agents, agentId: agentId ?? null, range: { start, end: now }, page, pageSize: 25, sampleLimit,
    thresholds: limits, hosts, probes, apiEvents, hostHistory, probeHistory, apiHistory,
    totals: { host: hostTotal, probe: probeTotal, api: apiTotal }, targets: targetStats, alerts, correlation,
    hostStale: !hosts[0] || now.getTime() - hosts[0].observedAt.getTime() > 180000,
    api: { count: apiTotal, averageMs: apiAggregate._avg.durationMs, maxMs: apiAggregate._max.durationMs, summary: apiSummary } };
}
