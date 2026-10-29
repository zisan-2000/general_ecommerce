import { z } from "zod";
import { Buffer } from "node:buffer";
import { gatewayOrigins } from "./transport-observer";
import type { TransportAttemptEvidence } from "./transport-types";

const identifier = z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
const timestamp = z.string().datetime({ precision: 3 }).length(24);
const WALL_CLOCK_TOLERANCE_MS = 2000;
export const MAX_TRANSPORT_PAYLOAD_BYTES = 8000;
const errorCode = z.enum([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_ABORTED", "ABORT_ERR", "ABORTED",
  "ERR_SSL_PACKET_LENGTH_TOO_LONG", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN", "ERR_SSL_WRONG_VERSION_NUMBER", "ERR_TLS_HANDSHAKE_TIMEOUT", "UNKNOWN_NETWORK_ERROR",
]).nullable();
const metric = z.object({
  status: z.enum(["OBSERVED", "REUSED", "NOT_APPLICABLE", "NOT_COLLECTED", "NOT_OBSERVABLE", "FAILED"]),
  startTime: timestamp.nullable(), endTime: timestamp.nullable(),
  // The collector emits millisecond values rounded to three decimal places.
  // Disallow exponent-sized fractions that JSONB could expand into huge decimals.
  durationMs: z.number().finite().nonnegative().max(3_600_000)
    .refine((value) => value === 0 || value >= 0.001 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001).nullable(), errorCode,
});
const collectionMethod = z.enum(["UNDICI_INSTRUMENTED_CONNECTOR", "UNDICI_PASSIVE_DIAGNOSTICS"]);
const family = z.union([z.literal(4), z.literal(6)]).nullable();
const evidenceSchema = z.object({
  version: z.literal(1), provider: z.enum(["AIBL_WALLET", "EPS", "SSLCOMMERZ"]),
  operation: z.enum(["AUTH", "INITIALIZE", "STATUS_QUERY", "VERIFY"]),
  requestId: identifier, attemptId: identifier, connectionId: identifier.nullable(),
  destinationOrigin: z.string().max(100), startedAt: timestamp, completedAt: timestamp,
  requestTimingSource: z.enum(["UNDICI_REQUEST_EVENTS", "MONITORING_SCOPE"]),
  connectionReused: z.boolean().nullable(),
  attribution: z.enum(["SOCKET_CORRELATED", "ERROR_OBJECT_CORRELATED", "UNATTRIBUTED", "UNSUPPORTED_HTTP2"]),
  collectionMethod, requestOutcome: z.enum(["HTTP_RESPONSE", "REQUEST_ERROR", "ABORTED", "NOT_OBSERVED"]), errorCode,
  dns: metric, tcp: metric, tls: metric,
  connectionEvidence: z.object({
    connectionId: identifier, collectionMethod,
    dns: metric.extend({ measurementType: z.literal("OS_NAME_RESOLUTION"), resolutionOccurred: z.boolean(), family }),
    tcp: metric, tcpAttempts: z.array(metric.extend({ family })).max(8), tcpAttemptsLimited: z.boolean(),
    tls: metric.extend({
      measurementType: z.literal("TCP_CONNECT_TO_SECURE_CONNECT"),
      tlsVersion: z.enum(["TLSv1.2", "TLSv1.3"]).nullable(),
      cipherSuite: z.string().regex(/^(TLS_|ECDHE-|DHE-|AES|CHACHA20)[A-Z0-9_-]{1,72}$/).nullable(),
      alpnProtocol: z.enum(["http/1.1", "h2"]).nullable(), certificateValidated: z.boolean().nullable(),
      sessionResumed: z.boolean().nullable(),
      certificateExpiresAt: timestamp.nullable().optional(),
    }),
  }).nullable(),
});

export function isTransportPayloadWithinBudget(value: unknown) {
  try {
    const json = JSON.stringify(value);
    // Projection contains ASCII-only keys/values and non-exponent numeric values.
    // JSONB text adds at most one space per ':'/',' separator, so <= 2 * compact
    // bytes (16,000) stays below the unchanged 20,000-byte DB constraint.
    if (typeof json !== "string" || Buffer.byteLength(json, "utf8") > MAX_TRANSPORT_PAYLOAD_BYTES) return false;
    for (let index = 0; index < json.length; index++) if (json.charCodeAt(index) > 127) return false;
    return true;
  } catch { return false; }
}
function validMetric(entry: TransportAttemptEvidence["tcp"]) {
  if (["OBSERVED", "FAILED"].includes(entry.status)) {
    if (entry.durationMs === null || !entry.startTime || !entry.endTime) return false;
    const elapsed = Date.parse(entry.endTime) - Date.parse(entry.startTime);
    if (!Number.isFinite(elapsed) || elapsed < -WALL_CLOCK_TOLERANCE_MS ||
      Math.abs(elapsed - entry.durationMs) > WALL_CLOCK_TOLERANCE_MS) return false;
    if (entry.status === "OBSERVED" ? entry.errorCode !== null : entry.errorCode === null) return false;
  } else if (entry.durationMs !== null || entry.startTime !== null || entry.endTime !== null) return false;
  return entry.status !== "REUSED" || entry.errorCode === null;
}
function sameMetric(left: TransportAttemptEvidence["tcp"], right: TransportAttemptEvidence["tcp"]) {
  return left.status === right.status && left.startTime === right.startTime && left.endTime === right.endTime &&
    left.durationMs === right.durationMs && left.errorCode === right.errorCode;
}
function ordered(left: string | null, right: string | null) {
  return !left || !right || Date.parse(left) <= Date.parse(right) + WALL_CLOCK_TOLERANCE_MS;
}

function projectEvidence(input: unknown): TransportAttemptEvidence | null {
  // Whitelisted projection at BOTH write and read boundaries. Unknown fields are
  // stripped, even if a future caller mistakenly passes headers/socket objects.
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return null;
  const value = parsed.data;
  if (!gatewayOrigins[value.provider].includes(value.destinationOrigin)) return null;
  if (!ordered(value.startedAt, value.completedAt)) return null;
  if (["REQUEST_ERROR", "ABORTED"].includes(value.requestOutcome) ? value.errorCode === null : value.errorCode !== null) return null;
  if (value.connectionId !== (value.connectionEvidence?.connectionId ?? null)) return null;
  if (value.attribution === "UNATTRIBUTED" && value.connectionEvidence) return null;
  if (value.attribution !== "UNATTRIBUTED" && !value.connectionEvidence) return null;
  if (value.connectionReused !== null && value.attribution !== "SOCKET_CORRELATED") return null;
  const metrics = [value.dns, value.tcp, value.tls,
    ...(value.connectionEvidence ? [value.connectionEvidence.dns, value.connectionEvidence.tcp,
      value.connectionEvidence.tls, ...value.connectionEvidence.tcpAttempts] : [])];
  if (!metrics.every(validMetric)) return null;
  const connection = value.connectionEvidence;
  if (connection) {
    if (connection.collectionMethod !== value.collectionMethod) return null;
    if ([connection.dns, connection.tcp, connection.tls].some((entry) => entry.status === "REUSED")) return null;
    if (connection.tcpAttempts.some((entry) => !["OBSERVED", "FAILED"].includes(entry.status))) return null;
    if (connection.collectionMethod === "UNDICI_PASSIVE_DIAGNOSTICS" &&
      (connection.tcpAttempts.length > 0 || connection.dns.resolutionOccurred ||
      [connection.dns, connection.tcp, connection.tls].some((entry) => entry.durationMs !== null))) return null;
    if (["OBSERVED", "FAILED"].includes(connection.dns.status) && !connection.dns.resolutionOccurred) return null;
    if (!connection.dns.resolutionOccurred && connection.dns.family !== null) return null;
    if (connection.dns.resolutionOccurred && connection.dns.status === "NOT_APPLICABLE") return null;
    if (connection.dns.status === "FAILED" && [connection.tcp, connection.tls].some((entry) => entry.status === "OBSERVED")) return null;
    if (["OBSERVED", "FAILED"].includes(connection.tcp.status) && !connection.tcpAttempts.some((entry) => sameMetric(entry, connection.tcp))) return null;
    if (connection.tls.status === "OBSERVED" && (connection.tls.certificateValidated !== true ||
      connection.tls.tlsVersion === null || connection.tcp.status === "FAILED")) return null;
    if (connection.tls.status === "FAILED" && connection.tls.certificateValidated === true) return null;
    if (connection.tls.certificateValidated === false && connection.tls.status !== "FAILED") return null;
    if (connection.tls.status !== "OBSERVED" && connection.tls.sessionResumed !== null) return null;
    if (connection.tls.certificateValidated === false && !/CERT|SIGNATURE/.test(connection.tls.errorCode ?? "")) return null;
    if (!ordered(connection.dns.endTime, connection.tcp.startTime) ||
      !ordered(connection.tcp.endTime, connection.tls.startTime)) return null;
  }
  if (value.requestTimingSource === "MONITORING_SCOPE" &&
    (value.attribution !== "UNATTRIBUTED" || value.requestOutcome === "HTTP_RESPONSE")) return null;
  if (value.attribution === "ERROR_OBJECT_CORRELATED" && !["REQUEST_ERROR", "ABORTED"].includes(value.requestOutcome)) return null;
  if (value.attribution === "UNSUPPORTED_HTTP2" ? connection?.tls.alpnProtocol !== "h2" : connection?.tls.alpnProtocol === "h2") return null;
  for (const stage of ["dns", "tcp", "tls"] as const) {
    const entry = value[stage];
    if (value.connectionReused === true && (entry.status !== "REUSED" || entry.durationMs !== null || entry.startTime || entry.endTime)) return null;
    if (connection && (value.connectionReused === false || value.attribution === "ERROR_OBJECT_CORRELATED")) {
      if (!sameMetric(entry, connection[stage])) return null;
    } else if (value.connectionReused !== true && !["NOT_COLLECTED", "NOT_OBSERVABLE"].includes(entry.status)) return null;
  }
  if (!isTransportPayloadWithinBudget(value)) return null;
  return value;
}

export function sanitizeTransportEvidence(input: unknown): TransportAttemptEvidence | null {
  try { return projectEvidence(input); }
  catch { return null; } // Getters, proxies, serialization and validators are untrusted boundaries.
}
