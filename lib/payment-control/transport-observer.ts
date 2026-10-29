import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { ConnectionEvidence, TransportAttemptEvidence, TransportMetric, TransportOperation, TransportProvider } from "./transport-types";

export const gatewayOrigins: Record<TransportProvider, readonly string[]> = {
  AIBL_WALLET: ["https://iwtest.aibl.com.bd"],
  EPS: ["https://sandboxpgapi.eps.com.bd"],
  SSLCOMMERZ: ["https://sandbox.sslcommerz.com", "https://securepay.sslcommerz.com"],
};
export function approvedTransportOrigin(provider: TransportProvider, input: string | URL) {
  try {
    const url = new URL(input);
    return !url.username && !url.password && gatewayOrigins[provider].includes(url.origin) ? url.origin : null;
  } catch { return null; }
}

const errorCodes = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_ABORTED", "ABORT_ERR", "ABORTED",
  "ERR_SSL_PACKET_LENGTH_TOO_LONG", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN", "ERR_SSL_WRONG_VERSION_NUMBER", "ERR_TLS_HANDSHAKE_TIMEOUT", "UNKNOWN_NETWORK_ERROR",
]);
export function transportErrorCode(error: unknown): string {
  for (let depth = 0; depth < 3 && error && typeof error === "object"; depth += 1) {
    const { code, name, cause } = error as { code?: unknown; name?: unknown; cause?: unknown };
    if (typeof code === "string" && errorCodes.has(code)) return code;
    if (name === "AbortError") return "ABORTED";
    if (name === "TimeoutError") return "ETIMEDOUT";
    error = cause;
  }
  return "UNKNOWN_NETWORK_ERROR";
}
export const emptyMetric = (status: TransportMetric["status"] = "NOT_COLLECTED"): TransportMetric => ({
  status, startTime: null, endTime: null, durationMs: null, errorCode: null,
});
type Stamp = { wall: string; mono: number };
type Clock = () => Stamp;
const clock: Clock = () => ({ wall: new Date().toISOString(), mono: performance.now() });
function finished(start: Stamp, end: Stamp, error?: unknown): TransportMetric {
  return { status: error ? "FAILED" : "OBSERVED", startTime: start.wall, endTime: end.wall,
    durationMs: Math.max(0, Math.round((end.mono - start.mono) * 1000) / 1000),
    errorCode: error ? transportErrorCode(error) : null };
}
export type TlsMetadata = { tlsVersion: string | null; cipherSuite: string | null;
  alpnProtocol: "http/1.1" | "h2" | null; certificateValidated: boolean; sessionResumed: boolean; certificateExpiresAt?: string | null };

// A connection never owns a payment request. Only sendHeaders(request, socket), or
// the identical connector error object on request:error, establishes attribution.
export class ObservedConnection {
  readonly evidence: ConnectionEvidence;
  sends = 0;
  established = false;
  readonly knownNew: boolean;
  private dnsStart: Stamp | null = null;
  private tlsStart: Stamp | null = null;
  private pending: Array<{ address: string; family: 4 | 6 | null; start: Stamp; metric: TransportMetric | null }> = [];
  constructor(readonly origin: string, instrumented: boolean, knownNew = true, private readonly now: Clock = clock) {
    this.knownNew = knownNew;
    this.evidence = { connectionId: randomUUID(), collectionMethod: instrumented
      ? "UNDICI_INSTRUMENTED_CONNECTOR" : "UNDICI_PASSIVE_DIAGNOSTICS",
    dns: { ...emptyMetric(), measurementType: "OS_NAME_RESOLUTION", resolutionOccurred: false, family: null },
    tcp: emptyMetric(), tcpAttempts: [], tcpAttemptsLimited: false,
    tls: { ...emptyMetric(), measurementType: "TCP_CONNECT_TO_SECURE_CONNECT", tlsVersion: null,
      cipherSuite: null, alpnProtocol: null, certificateValidated: null, sessionResumed: null } };
  }
  ipLiteral() { this.evidence.dns.status = "NOT_APPLICABLE"; }
  beginDns() { this.dnsStart = this.now(); this.evidence.dns.resolutionOccurred = true; }
  endDns(error: unknown, family: unknown) {
    if (!this.dnsStart) return;
    Object.assign(this.evidence.dns, finished(this.dnsStart, this.now(), error));
    this.evidence.dns.family = family === 4 || family === 6 ? family : null;
    this.dnsStart = null;
  }
  beginTcp(address: string, family: unknown) {
    if (this.pending.length === 8) { this.evidence.tcpAttemptsLimited = true; return; }
    this.pending.push({ address, family: family === 4 || family === 6 ? family : null, start: this.now(), metric: null });
  }
  endTcp(address: string, error: unknown) {
    const attempt = this.pending.findLast((entry) => entry.address === address && !entry.metric);
    if (attempt) attempt.metric = finished(attempt.start, this.now(), error);
    this.refreshTcpAttempts();
  }
  connected(address: string | undefined, encrypted: boolean) {
    const attempt = this.pending.findLast((entry) => entry.address === address && !entry.metric);
    if (attempt) {
      attempt.metric = finished(attempt.start, this.now());
      this.evidence.tcp = { ...attempt.metric };
    } else this.evidence.tcp = emptyMetric("NOT_OBSERVABLE");
    this.refreshTcpAttempts();
    if (encrypted) this.tlsStart = this.now();
    else { this.evidence.tls.status = "NOT_APPLICABLE"; this.established = true; }
  }
  secure(metadata: TlsMetadata) {
    if (this.tlsStart) Object.assign(this.evidence.tls, finished(this.tlsStart, this.now()));
    Object.assign(this.evidence.tls, metadata);
    this.tlsStart = null;
    this.established = true;
  }
  failed(error: unknown) {
    if (this.established) return;
    if (this.tlsStart) {
      Object.assign(this.evidence.tls, finished(this.tlsStart, this.now(), error));
      this.tlsStart = null;
    } else if (!this.evidence.tcp.endTime) {
      const open = this.pending.filter((entry) => !entry.metric);
      for (const attempt of open) attempt.metric = finished(attempt.start, this.now(), error);
      const last = this.pending.at(-1)?.metric;
      if (last) this.evidence.tcp = { ...last };
      this.evidence.tls.status = "NOT_APPLICABLE";
    }
    // An interrupted lookup has no observed completion; never manufacture one.
    if (this.dnsStart) this.evidence.dns.errorCode = transportErrorCode(error);
    this.refreshTcpAttempts();
  }
  private refreshTcpAttempts() {
    this.evidence.tcpAttempts = this.pending.flatMap((entry) => entry.metric ? [{ ...entry.metric, family: entry.family }] : []);
  }
}

export type TransportScope = {
  provider: TransportProvider; operation: TransportOperation; requestId: string; origin: string;
  mode: "passive" | "instrumented"; active: boolean; started: Stamp;
  attempts: Array<{ evidence: TransportAttemptEvidence; connection: ObservedConnection | null }>;
};
export class TransportObserver {
  readonly scopes = new AsyncLocalStorage<TransportScope>();
  private requests = new WeakMap<object, { scope: TransportScope; attempt: TransportScope["attempts"][number] }>();
  private sockets = new WeakMap<object, ObservedConnection>();
  private errors = new WeakMap<object, ObservedConnection>();
  private activeScopes = 0;
  begin(provider: TransportProvider, operation: TransportOperation, requestId: string, origin: string, mode: TransportScope["mode"]): TransportScope | null {
    if (this.activeScopes >= 128) return null;
    this.activeScopes += 1;
    return { provider, operation, requestId, origin, mode, active: true, started: clock(), attempts: [] };
  }
  attachSocket(socket: object, connection: ObservedConnection) { this.sockets.set(socket, connection); }
  attachError(error: unknown, connection: ObservedConnection) {
    // A later error on an established connection cannot make its old handshake
    // a newly observed failed-connect attempt for a queued request.
    if (!connection.established && error && typeof error === "object") this.errors.set(error, connection);
  }
  handle(event: string, message: unknown) {
    // Diagnostics Channel subscribers must never throw, inspect headers or block.
    try { this.onDiagnostic(event, message as DiagnosticMessage); } catch { /* best effort */ }
  }
  private onDiagnostic(event: string, message: DiagnosticMessage) {
    if (event === "connected" && message.socket) {
      const scope = this.scopes.getStore();
      const params = message.connectParams;
      const hostname = params?.hostname?.includes(":") ? `[${params.hostname}]` : params?.hostname;
      const actualOrigin = params?.protocol && hostname
        ? new URL(`${params.protocol}//${hostname}${params.port ? `:${params.port}` : ""}`).origin : null;
      if (scope?.active && actualOrigin === scope.origin && !this.sockets.has(message.socket)) {
        // No timing inferred from beforeConnect or elapsed HTTP time.
        this.attachSocket(message.socket, new ObservedConnection(scope.origin, false));
      }
      return;
    }
    const request = message.request;
    if (!request) return;
    if (event === "create") {
      const scope = this.scopes.getStore();
      if (!scope?.active || scope.attempts.length >= 8 || String(request.origin) !== scope.origin) return;
      const attempt = this.newAttempt(scope);
      this.requests.set(request, { scope, attempt });
      return;
    }
    const linked = this.requests.get(request);
    if (!linked?.scope.active) return;
    if (event === "sendHeaders" && message.socket) {
      if (linked.attempt.connection) {
        if (linked.scope.attempts.length >= 8) return;
        linked.attempt = this.newAttempt(linked.scope);
      }
      let connection = this.sockets.get(message.socket);
      if (!connection) {
        // This socket may predate subscription: first observation != first use.
        connection = new ObservedConnection(linked.scope.origin, false, false);
        this.attachSocket(message.socket, connection);
      }
      if (connection.origin !== linked.scope.origin) return;
      const evidence = linked.attempt.evidence;
      evidence.connectionReused = connection.sends > 0 ? true : connection.knownNew ? false : null;
      connection.sends += 1;
      evidence.attribution = "SOCKET_CORRELATED";
      linked.attempt.connection = connection;
    } else if (event === "headers") {
      linked.attempt.evidence.requestOutcome = "HTTP_RESPONSE";
      linked.attempt.evidence.completedAt = new Date().toISOString();
    }
    else if (event === "error") {
      linked.attempt.evidence.requestOutcome = "REQUEST_ERROR";
      linked.attempt.evidence.completedAt = new Date().toISOString();
      linked.attempt.evidence.errorCode = transportErrorCode(message.error);
      if (!linked.attempt.connection && message.error && typeof message.error === "object") {
        const connection = this.errors.get(message.error);
        if (connection?.origin === linked.scope.origin) {
          linked.attempt.connection = connection;
          linked.attempt.evidence.attribution = "ERROR_OBJECT_CORRELATED";
        }
      }
    }
  }
  private newAttempt(scope: TransportScope): TransportScope["attempts"][number] {
    const attempt = { connection: null as ObservedConnection | null, evidence: {
      version: 1 as const, provider: scope.provider, operation: scope.operation, requestId: scope.requestId,
      attemptId: randomUUID(), connectionId: null, destinationOrigin: scope.origin,
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), connectionReused: null,
      requestTimingSource: "UNDICI_REQUEST_EVENTS" as const,
      attribution: "UNATTRIBUTED" as TransportAttemptEvidence["attribution"],
      collectionMethod: scope.mode === "instrumented" ? "UNDICI_INSTRUMENTED_CONNECTOR" as const : "UNDICI_PASSIVE_DIAGNOSTICS" as const,
      requestOutcome: "NOT_OBSERVED" as TransportAttemptEvidence["requestOutcome"], errorCode: null,
      dns: emptyMetric(), tcp: emptyMetric(), tls: emptyMetric(), connectionEvidence: null,
    } };
    scope.attempts.push(attempt);
    return attempt;
  }
  complete(scope: TransportScope, error?: unknown): TransportAttemptEvidence[] {
    if (!scope.active) return [];
    scope.active = false;
    this.activeScopes -= 1;
    if (!scope.attempts.length) {
      const fallback = this.newAttempt(scope);
      fallback.evidence.startedAt = scope.started.wall;
      fallback.evidence.requestTimingSource = "MONITORING_SCOPE";
    }
    return scope.attempts.map(({ evidence, connection }, index) => {
      if (evidence.requestOutcome === "NOT_OBSERVED") evidence.completedAt = new Date().toISOString();
      if (error && index === scope.attempts.length - 1) {
        evidence.errorCode = transportErrorCode(error);
        evidence.requestOutcome = evidence.errorCode === "ABORTED" ? "ABORTED" : "REQUEST_ERROR";
      }
      if (!connection) return evidence;
      const snapshot: ConnectionEvidence = structuredClone(connection.evidence);
      evidence.connectionId = snapshot.connectionId;
      evidence.collectionMethod = snapshot.collectionMethod;
      evidence.connectionEvidence = snapshot;
      if (snapshot.tls.alpnProtocol === "h2") {
        evidence.attribution = "UNSUPPORTED_HTTP2";
        evidence.connectionReused = null;
        return evidence;
      }
      for (const stage of ["dns", "tcp", "tls"] as const) {
        evidence[stage] = evidence.connectionReused === true ? emptyMetric("REUSED")
          : evidence.connectionReused === false || evidence.attribution === "ERROR_OBJECT_CORRELATED"
            ? { ...snapshot[stage] } : emptyMetric("NOT_OBSERVABLE");
      }
      return evidence;
    });
  }
  discard(scope: TransportScope) {
    if (scope.active) { scope.active = false; this.activeScopes -= 1; }
  }
}

type DiagnosticMessage = {
  request?: object & { origin?: unknown }; socket?: object; error?: unknown;
  connectParams?: { protocol?: string; hostname?: string; port?: string | number };
};

export function observeIpLiteral(connection: ObservedConnection, hostname: string) {
  if (isIP(hostname.replace(/^\[|\]$/g, ""))) connection.ipLiteral();
}
