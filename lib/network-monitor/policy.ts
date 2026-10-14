import "server-only";
import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "@/lib/payment-control/authorization";

export const agentIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
export const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type ProbePolicy = { address: string; protocol: "TCP" | "ICMP"; port: number | null; minIntervalSeconds: number };
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PaymentControlError("JSON object required");
  return value as Record<string, unknown>;
}
export function monitorId(value: unknown) {
  if (typeof value !== "string" || !agentIdPattern.test(value)) throw new PaymentControlError("Invalid collector ID");
  return value;
}
export function integer(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new PaymentControlError("Invalid " + label);
  }
  return value;
}
export function label(value: unknown) {
  if (typeof value !== "string" || !/^[\p{L}\p{N} _.-]{3,100}$/u.test(value)) {
    throw new PaymentControlError("Use a 3–100 character non-sensitive label");
  }
  return value;
}
export function canonicalIp(value: unknown) {
  if (typeof value !== "string" || !isIP(value)) throw new PaymentControlError("An explicitly approved IP literal is required");
  return isIP(value) === 6 ? new URL("http://[" + value + "]").hostname.slice(1, -1) : value;
}
export function probePolicy(): ProbePolicy[] {
  // User-authorized development target. No provider domains, DNS discovery or scanning.
  const fallback: ProbePolicy[] = [{ address: "127.0.0.1", port: 3000, protocol: "TCP", minIntervalSeconds: 60 }];
  const raw = process.env.NETWORK_MONITOR_ALLOWED_PROBES_JSON;
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 20) throw new Error();
    return parsed.map((entry) => {
      const data = object(entry);
      if (data.protocol !== "TCP" && data.protocol !== "ICMP") throw new Error();
      return { address: canonicalIp(data.address), protocol: data.protocol,
        port: data.protocol === "TCP" ? integer(data.port, 1, 65535, "port") : null,
        minIntervalSeconds: integer(data.minIntervalSeconds ?? 60, 60, 3600, "probe interval") };
    });
  } catch { throw new PaymentControlError("Invalid server probe-approval policy", 503); }
}
export function approvedTarget(data: { address: string; protocol: string; port: number | null; intervalSeconds: number }) {
  const approved = probePolicy().find((entry) => entry.address === data.address && entry.protocol === data.protocol && entry.port === data.port);
  if (!approved || data.intervalSeconds < approved.minIntervalSeconds) throw new PaymentControlError("Target or frequency is outside the server approval policy", 403);
}
export function thresholds() {
  const value = (name: string, fallback: number, min: number, max: number) => {
    const raw = process.env[name];
    const parsed = raw ? Number(raw) : fallback;
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new PaymentControlError("Invalid network alert threshold configuration", 503);
    return parsed;
  };
  return { lossPct: value("NETWORK_MONITOR_ALERT_LOSS_PCT", 5, 0.1, 100),
    probeLatencyMs: value("NETWORK_MONITOR_ALERT_PROBE_LATENCY_MS", 250, 0.1, 60000),
    apiLatencyMs: value("NETWORK_MONITOR_ALERT_API_LATENCY_MS", 2000, 0.1, 120000),
    minimumLossSamples: 10 };
}
export async function requireCollector(request: Request) {
  const id = monitorId(request.headers.get("x-network-agent-id"));
  let keys: Record<string, unknown>;
  try { keys = object(JSON.parse(process.env.NETWORK_MONITOR_AGENT_KEYS_JSON || "{}")); }
  catch { throw new PaymentControlError("Collector authentication is not configured", 503); }
  const expected = keys[id];
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const validToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
  if (!validToken(expected) || !validToken(supplied) || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new PaymentControlError("Unauthorized collector", 401);
  const agent = await prisma.networkMonitorAgent.findUnique({ where: { id } });
  if (!agent?.enabled) throw new PaymentControlError("Collector is not enabled", 403);
  return agent;
}
export async function readMonitorBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentControlError("JSON body required");
  const decoder = new TextDecoder();
  let bytes = 0; let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 32768) { await reader.cancel(); throw new PaymentControlError("Monitoring body exceeds 32 KB", 413); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return object(JSON.parse(text));
  } catch (error) {
    if (error instanceof PaymentControlError) throw error;
    throw new PaymentControlError("Invalid monitoring JSON body");
  } finally { reader.releaseLock(); }
}
export function counter(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{1,19}$/.test(value)) throw new PaymentControlError("Counters must be non-negative decimal strings or null");
  const parsed = BigInt(value);
  if (parsed > 9223372036854775807n) throw new PaymentControlError("Counter exceeds supported range");
  return parsed;
}
export function timestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(value)) {
    throw new PaymentControlError("UTC ISO measurement timestamp required");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 30000 || parsed.getTime() < Date.now() - 300000) {
    throw new PaymentControlError("Measurement clock is stale or ahead; synchronize collector UTC time");
  }
  return parsed;
}
export function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}
