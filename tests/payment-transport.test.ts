import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { LookupFunction } from "node:net";
import type { TLSSocket } from "node:tls";
import type { buildConnector } from "undici";
import { ObservedConnection, TransportObserver, approvedTransportOrigin, emptyMetric, transportErrorCode } from "../lib/payment-control/transport-observer";
import { createObservedConnector } from "../lib/payment-control/transport-connector";
import { inboundTransportEvidence, transportConfiguration } from "../lib/payment-control/transport-config";
import { sanitizeTransportEvidence } from "../lib/payment-control/transport-sanitizer";

const requestId = "11111111-1111-4111-8111-111111111111";
const origin = "https://iwtest.aibl.com.bd";
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function timedConnection(destination = origin) {
  let tick = 0;
  const connection = new ObservedConnection(destination, true, true, () => ({
    wall: new Date(Date.UTC(2026, 9, 25, 0, 0, 0, tick)).toISOString(), mono: tick,
  }));
  return { connection, advance: (ms: number) => { tick += ms; } };
}
function established(destination = origin) {
  const fixture = timedConnection(destination);
  fixture.connection.beginDns(); fixture.advance(7); fixture.connection.endDns(null, 4);
  fixture.connection.beginTcp("192.0.2.1", 4); fixture.advance(11); fixture.connection.connected("192.0.2.1", true);
  fixture.advance(13); fixture.connection.secure({ tlsVersion: "TLSv1.3", cipherSuite: "TLS_AES_256_GCM_SHA384",
    alpnProtocol: "http/1.1", certificateValidated: true, sessionResumed: false });
  return fixture;
}
function capture(observer: TransportObserver, destination = origin, provider: "AIBL_WALLET" | "EPS" = "AIBL_WALLET") {
  const scope = observer.begin(provider, "VERIFY", requestId, destination, "instrumented")!;
  const request = { origin: destination };
  observer.scopes.run(scope, () => observer.handle("create", { request }));
  return { scope, request };
}
function send(observer: TransportObserver, request: object, socket: object) {
  observer.handle("sendHeaders", { request, socket });
  observer.handle("headers", { request });
}

test("actual observed lookup boundaries are OS name resolution, not wire DNS", () => {
  const f = timedConnection(); f.connection.beginDns(); f.advance(17); f.connection.endDns(null, 6);
  assert.equal(f.connection.evidence.dns.durationMs, 17);
  assert.equal(f.connection.evidence.dns.measurementType, "OS_NAME_RESOLUTION");
  assert.equal(f.connection.evidence.dns.family, 6);
  assert.equal(f.connection.evidence.dns.resolutionOccurred, true);
});
test("TCP timing excludes DNS and TLS; TLS uses observed connect-to-secureConnect boundaries", () => {
  const { connection } = established();
  assert.equal(connection.evidence.dns.durationMs, 7);
  assert.equal(connection.evidence.tcp.durationMs, 11);
  assert.equal(connection.evidence.tls.durationMs, 13);
  assert.equal(connection.evidence.tls.certificateValidated, true);
});
test("first request owns new handshake evidence only after exact request/socket association", () => {
  const observer = new TransportObserver(); const c = capture(observer); const socket = {};
  observer.attachSocket(socket, established().connection); send(observer, c.request, socket);
  const [row] = observer.complete(c.scope);
  assert.equal(row.attribution, "SOCKET_CORRELATED"); assert.equal(row.connectionReused, false);
  assert.equal(row.tcp.durationMs, 11); assert.equal(row.tls.durationMs, 13);
  assert.ok(sanitizeTransportEvidence(row));
});
test("two requests reuse the same connection without repeating handshake duration", () => {
  const observer = new TransportObserver(); const socket = {}; observer.attachSocket(socket, established().connection);
  const first = capture(observer); send(observer, first.request, socket); const [a] = observer.complete(first.scope);
  const second = capture(observer); send(observer, second.request, socket); const [b] = observer.complete(second.scope);
  assert.equal(a.connectionId, b.connectionId); assert.equal(b.connectionReused, true);
  for (const stage of ["dns", "tcp", "tls"] as const) assert.deepEqual(b[stage], emptyMetric("REUSED"));
  assert.equal(b.connectionEvidence?.tls.durationMs, 13); assert.ok(sanitizeTransportEvidence(b));
});
test("concurrent same-origin requests use their own sendHeaders socket, not ALS connect ownership", () => {
  const observer = new TransportObserver(); const a = capture(observer); const b = capture(observer);
  const socketA = {}; const socketB = {}; const ca = established(); const cb = established();
  cb.connection.evidence.tcp.durationMs = 29;
  observer.attachSocket(socketA, ca.connection); observer.attachSocket(socketB, cb.connection);
  observer.scopes.run(a.scope, () => send(observer, b.request, socketB));
  observer.scopes.run(b.scope, () => send(observer, a.request, socketA));
  assert.equal(observer.complete(a.scope)[0].tcp.durationMs, 11);
  assert.equal(observer.complete(b.scope)[0].tcp.durationMs, 29);
});
test("different providers/origins cannot inherit each other's socket evidence", () => {
  const observer = new TransportObserver(); const epsOrigin = "https://sandboxpgapi.eps.com.bd";
  const a = capture(observer); const b = capture(observer, epsOrigin, "EPS"); const socketA = {}; const socketB = {};
  observer.attachSocket(socketA, established().connection); observer.attachSocket(socketB, established(epsOrigin).connection);
  send(observer, b.request, socketA);
  assert.equal(observer.complete(b.scope)[0].connectionId, null);
  send(observer, a.request, socketA); assert.ok(observer.complete(a.scope)[0].connectionId);
});
test("hostname or time proximity cannot establish request ownership", () => {
  const observer = new TransportObserver(); const c = capture(observer);
  observer.scopes.run(c.scope, () => observer.handle("beforeConnect", { connectParams: { hostname: "iwtest.aibl.com.bd" } }));
  const [row] = observer.complete(c.scope); assert.equal(row.attribution, "UNATTRIBUTED");
  assert.equal(row.tcp.durationMs, null); assert.equal(row.connectionId, null);
});
test("passive first observation of a pre-existing socket does not claim NEW", () => {
  const observer = new TransportObserver(); const c = capture(observer); send(observer, c.request, {});
  const [row] = observer.complete(c.scope); assert.equal(row.connectionReused, null);
  assert.equal(row.tls.status, "NOT_OBSERVABLE"); assert.equal(row.tls.durationMs, null);
});
test("DNS failure is measured only between actual lookup start/completion", () => {
  const f = timedConnection(); f.connection.beginDns(); f.advance(19); f.connection.endDns({ code: "ENOTFOUND" }, null);
  f.connection.failed({ code: "ENOTFOUND" });
  assert.equal(f.connection.evidence.dns.status, "FAILED"); assert.equal(f.connection.evidence.dns.durationMs, 19);
  assert.equal(f.connection.evidence.tcp.durationMs, null);
});
test("TCP refusal is correlated only by the identical connector/request error object", () => {
  const observer = new TransportObserver(); const f = timedConnection(); const c = capture(observer);
  const error = Object.assign(new Error("private address must not be stored"), { code: "ECONNREFUSED" });
  f.connection.beginTcp("192.0.2.1", 4); f.advance(5); f.connection.failed(error);
  observer.attachError(error, f.connection); observer.handle("error", { request: c.request, error });
  const [row] = observer.complete(c.scope, error); assert.equal(row.attribution, "ERROR_OBJECT_CORRELATED");
  assert.equal(row.tcp.status, "FAILED"); assert.equal(row.tcp.durationMs, 5); assert.equal(row.connectionReused, null);
  assert.doesNotMatch(JSON.stringify(row), /private address|192\.0\.2/);
});
test("a lookalike error object does not inherit a failed connection", () => {
  const observer = new TransportObserver(); const c = capture(observer);
  const connection = timedConnection().connection;
  observer.attachError({ code: "ECONNREFUSED" }, connection);
  observer.handle("error", { request: c.request, error: { code: "ECONNREFUSED" } });
  assert.equal(observer.complete(c.scope)[0].connectionId, null);
});
test("an error on an already established connection cannot relabel its old handshake as a new one", () => {
  const observer = new TransportObserver(); const c = capture(observer);
  const error = { code: "ECONNRESET" }; observer.attachError(error, established().connection);
  observer.handle("error", { request: c.request, error });
  const [row] = observer.complete(c.scope);
  assert.equal(row.connectionId, null); assert.equal(row.tcp.durationMs, null);
});
test("TLS certificate rejection has measured failure duration and no certificate data", () => {
  const f = timedConnection(); f.connection.beginTcp("192.0.2.1", 4); f.advance(3); f.connection.connected("192.0.2.1", true);
  f.advance(9); f.connection.failed({ code: "CERT_HAS_EXPIRED" });
  assert.equal(f.connection.evidence.tls.status, "FAILED"); assert.equal(f.connection.evidence.tls.durationMs, 9);
  assert.equal(f.connection.evidence.tls.errorCode, "CERT_HAS_EXPIRED");
});
test("handshake timeout does not invent a successful TLS connection", () => {
  const f = timedConnection(); f.connection.beginTcp("192.0.2.1", 4); f.advance(2); f.connection.connected("192.0.2.1", true);
  f.advance(100); f.connection.failed({ code: "UND_ERR_CONNECT_TIMEOUT" });
  assert.equal(f.connection.evidence.tls.durationMs, 100); assert.equal(f.connection.evidence.tls.status, "FAILED");
  assert.equal(f.connection.evidence.tls.certificateValidated, null);
});
test("IPv4/IPv6 attempts retain separate outcomes without persisting addresses", () => {
  const f = timedConnection(); f.connection.beginTcp("2001:db8::1", 6); f.advance(4);
  f.connection.endTcp("2001:db8::1", { code: "ENETUNREACH" }); f.connection.beginTcp("192.0.2.1", 4);
  f.advance(6); f.connection.connected("192.0.2.1", false);
  assert.equal(f.connection.evidence.tcpAttempts.length, 2); assert.equal(f.connection.evidence.tcp.durationMs, 6);
  assert.deepEqual(f.connection.evidence.tcpAttempts.map((v) => v.family), [6, 4]);
  assert.doesNotMatch(JSON.stringify(f.connection.evidence), /2001:db8|192\.0\.2/);
});
test("retry after connection failure has a distinct HTTP attempt ID under one Request ID", () => {
  const observer = new TransportObserver(); const first = capture(observer);
  observer.handle("error", { request: first.request, error: { code: "ECONNRESET" } });
  const [failed] = observer.complete(first.scope); const second = capture(observer); const socket = {};
  observer.attachSocket(socket, established().connection); send(observer, second.request, socket);
  const [success] = observer.complete(second.scope);
  assert.equal(failed.requestId, success.requestId); assert.notEqual(failed.attemptId, success.attemptId);
  assert.equal(failed.requestOutcome, "REQUEST_ERROR"); assert.equal(success.requestOutcome, "HTTP_RESPONSE");
});
test("abort and unavailable instrumentation leave timings null", () => {
  const observer = new TransportObserver(); const c = capture(observer);
  const [row] = observer.complete(c.scope, { name: "AbortError" });
  assert.equal(row.requestOutcome, "ABORTED"); assert.equal(row.connectionId, null);
  for (const stage of ["dns", "tcp", "tls"] as const) assert.equal(row[stage].durationMs, null);
});
test("HTTP/2 is explicitly unsupported rather than assigning multiplexed timings", () => {
  const observer = new TransportObserver(); const c = capture(observer); const socket = {}; const f = established();
  f.connection.evidence.tls.alpnProtocol = "h2"; observer.attachSocket(socket, f.connection); send(observer, c.request, socket);
  const [row] = observer.complete(c.scope); assert.equal(row.attribution, "UNSUPPORTED_HTTP2");
  assert.equal(row.tls.durationMs, null); assert.ok(sanitizeTransportEvidence(row));
});
test("TLS session resumption is distinct from reusing an established connection", () => {
  const observer = new TransportObserver(); const c = capture(observer); const socket = {}; const f = established();
  f.connection.evidence.tls.sessionResumed = true; observer.attachSocket(socket, f.connection); send(observer, c.request, socket);
  const [row] = observer.complete(c.scope); assert.equal(row.connectionReused, false); assert.equal(row.connectionEvidence?.tls.sessionResumed, true);
});
test("sanitization projects away payloads, headers, tokens, customer data and error messages", () => {
  const observer = new TransportObserver(); const c = capture(observer); const socket = {};
  observer.attachSocket(socket, established().connection); send(observer, c.request, socket);
  const [row] = observer.complete(c.scope);
  const safe = sanitizeTransportEvidence({ ...row, authorization: "secret", rawBody: "private", phone: "private",
    connectionEvidence: { ...row.connectionEvidence, certificate: "private", tls: { ...row.connectionEvidence!.tls, keylog: "secret" } } });
  assert.ok(safe); assert.doesNotMatch(JSON.stringify(safe), /private|secret|authorization|certificate\":|keylog/);
  assert.equal(sanitizeTransportEvidence({ ...row, destinationOrigin: `${origin}/?token=secret` }), null);
});
test("sanitization rejects missing measurement endpoints and fabricated reused timings", () => {
  const observer = new TransportObserver(); const c = capture(observer); const socket = {};
  observer.attachSocket(socket, established().connection); send(observer, c.request, socket);
  const [row] = observer.complete(c.scope);
  assert.equal(sanitizeTransportEvidence({ ...row, tcp: { ...row.tcp, startTime: null } }), null);
  assert.equal(sanitizeTransportEvidence({ ...row, connectionReused: true }), null);
  assert.equal(sanitizeTransportEvidence({ ...row, connectionEvidence: { ...row.connectionEvidence,
    tcp: { ...row.connectionEvidence!.tcp, status: "NOT_COLLECTED" } } }), null);
});
test("feature flag defaults OFF; approvals, runtime, storage, proxy and TLS policy are explicit gates", () => {
  assert.equal(transportConfiguration({ NODE_ENV: "test" }).mode, "off");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PAYMENT_TRANSPORT_MONITORING_MODE: "instrumented", PAYMENT_TRANSPORT_STORAGE_ENABLED: "true",
    PAYMENT_TRANSPORT_ALLOWED_PROVIDERS: "AIBL_WALLET", PAYMENT_TRANSPORT_ALLOWED_OPERATIONS: "AUTH" };
  assert.equal(transportConfiguration(env).reason, "APPROVAL_REQUIRED");
  const approved = { ...env, PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: "true" };
  assert.equal(transportConfiguration(approved, "24.22.1", "7.30.1").mode, "instrumented");
  assert.equal(transportConfiguration(approved, "24.13.0", "7.18.2").reason, "PATCHED_NODE_REQUIRED");
  assert.equal(transportConfiguration(approved, "20.0.0", "6.29.1").reason, "PATCHED_NODE_REQUIRED");
  assert.equal(transportConfiguration({ ...approved, HTTPS_PROXY: "private" }, "24.22.1", "7.30.1").reason, "PROXY_TRANSPORT_REVIEW_REQUIRED");
  assert.equal(transportConfiguration({ ...approved, NODE_TLS_REJECT_UNAUTHORIZED: "0" }, "24.22.1", "7.30.1").reason, "INSECURE_TLS_CONFIGURATION");
  assert.equal(approvedTransportOrigin("AIBL_WALLET", "https://evil.example"), null);
  assert.equal(approvedTransportOrigin("AIBL_WALLET", `${origin}/iwPGAPI/PGService/token?secret=private`), origin);
});
test("multiple operations and actual sends under one Request ID retain separate attempts", () => {
  const observer = new TransportObserver(); const c = capture(observer); const socket = {};
  observer.attachSocket(socket, established().connection); send(observer, c.request, socket); send(observer, c.request, socket);
  const rows = observer.complete(c.scope); assert.equal(rows.length, 2);
  assert.notEqual(rows[0].attemptId, rows[1].attemptId); assert.equal(rows[1].connectionReused, true);
  assert.equal(rows[1].tls.durationMs, null);
});
test("AUTH and INITIALIZE retain separate attempt and operation IDs even when sharing a socket", () => {
  const observer = new TransportObserver(); const socket = {}; observer.attachSocket(socket, established().connection);
  const rows = (["AUTH", "INITIALIZE"] as const).map((operation) => {
    const scope = observer.begin("AIBL_WALLET", operation, requestId, origin, "instrumented")!;
    const request = { origin }; observer.scopes.run(scope, () => observer.handle("create", { request }));
    send(observer, request, socket); return observer.complete(scope)[0];
  });
  assert.deepEqual(rows.map((row) => row.operation), ["AUTH", "INITIALIZE"]);
  assert.notEqual(rows[0].attemptId, rows[1].attemptId); assert.equal(rows[0].connectionId, rows[1].connectionId);
  assert.equal(rows[1].tls.durationMs, null);
});
test("missing request:create instrumentation yields unavailable metrics, without inferred success", () => {
  const observer = new TransportObserver(); const scope = observer.begin("AIBL_WALLET", "AUTH", requestId, origin, "passive")!;
  observer.handle("headers", { request: { origin } });
  const [row] = observer.complete(scope);
  assert.equal(row.requestOutcome, "NOT_OBSERVED"); assert.equal(row.attribution, "UNATTRIBUTED");
  assert.equal(row.dns.durationMs, null); assert.equal(row.tcp.durationMs, null); assert.equal(row.tls.durationMs, null);
});
test("bounded state and callback failures cannot throw through diagnostics", () => {
  const observer = new TransportObserver(); const scopes = Array.from({ length: 128 }, () => capture(observer).scope);
  assert.equal(observer.begin("EPS", "AUTH", requestId, "https://sandboxpgapi.eps.com.bd", "passive"), null);
  assert.doesNotThrow(() => observer.handle("create", null));
  scopes.forEach((scope) => observer.complete(scope));
  const c = capture(observer); assert.ok(c.scope); assert.deepEqual(observer.complete(c.scope).length, 1);
  assert.equal(observer.complete(c.scope).length, 0);
});
test("incoming proxy TLS is configuration, never inferred from a callback or host collector", () => {
  assert.equal(inboundTransportEvidence(true, { NODE_ENV: "test" }).tlsTermination, "UNKNOWN");
  const evidence = inboundTransportEvidence(true, { NODE_ENV: "test", PAYMENT_INBOUND_TLS_TERMINATION: "UPSTREAM_PROXY" });
  assert.equal(evidence.applicationHandshakeVisibility, "NOT_OBSERVABLE");
  assert.equal(evidence.senderAuthentication, "UNAVAILABLE"); assert.equal(evidence.trustedProxyMeasurements, "NOT_COLLECTED");
});

test("instrumented connector forwards lookup options/callback once and uses real socket event boundaries", () => {
  const observer = new TransportObserver(); const socket = new EventEmitter() as EventEmitter & Partial<TLSSocket>;
  Object.assign(socket, { remoteAddress: "192.0.2.1", authorized: true, alpnProtocol: "http/1.1",
    getCipher: () => ({ standardName: "TLS_AES_256_GCM_SHA384" }), getProtocol: () => "TLSv1.3", isSessionReused: () => false });
  let connectorCallback: buildConnector.Callback = () => {};
  let lookups = 0; let preservedAll = false;
  const fakeLookup: LookupFunction = (_hostname, options, callback) => {
    lookups += 1; preservedAll = options.all === true;
    callback(null, [{ address: "192.0.2.1", family: 4 }]);
  };
  const factory: typeof buildConnector = (options) => (_target, callback) => {
    connectorCallback = callback;
    (options as { lookup: LookupFunction }).lookup("iwtest.aibl.com.bd", { all: true }, () => {});
    return socket as TLSSocket;
  };
  const connector = createObservedConnector(observer, factory, fakeLookup);
  const c = capture(observer);
  connector({ hostname: "iwtest.aibl.com.bd", protocol: "https:", port: "443" }, () => {});
  socket.emit("connectionAttempt", "192.0.2.1", 443, 4); socket.emit("connect");
  connectorCallback(null, socket as TLSSocket);
  send(observer, c.request, socket);
  const [row] = observer.complete(c.scope);
  assert.equal(lookups, 1); assert.equal(preservedAll, true);
  assert.equal(row.dns.status, "OBSERVED"); assert.equal(row.tcp.status, "OBSERVED"); assert.equal(row.tls.status, "OBSERVED");
  assert.equal(row.connectionEvidence?.tls.certificateValidated, true);
});
test("missing actual TCP start never becomes a fabricated zero millisecond duration", () => {
  const f = timedConnection(); f.connection.ipLiteral(); f.connection.connected("192.0.2.1", false);
  assert.equal(f.connection.evidence.dns.status, "NOT_APPLICABLE");
  assert.equal(f.connection.evidence.tcp.status, "NOT_OBSERVABLE"); assert.equal(f.connection.evidence.tcp.durationMs, null);
});
test("existing payment outcomes and read-only Inspector authorization remain independent", () => {
  const source = read("lib/payment-control/transport-storage.ts");
  assert.doesNotMatch(source, /prisma\.(payment|order|paymentEvent)\.(create|update|delete)/);
  const route = read("app/api/admin/payment-control/requests/[requestId]/route.ts");
  assert.match(route, /requirePaymentControlAccess/); assert.match(route, /no-store/);
  const telemetry = read("lib/payment-control/telemetry.ts");
  assert.match(telemetry, /AbortSignal\.timeout\(timeoutMs\)/); assert.doesNotMatch(telemetry, /setGlobalDispatcher/);
  const connector = read("lib/payment-control/transport-connector.ts");
  assert.doesNotMatch(connector, /rejectUnauthorized\s*:\s*false|setGlobalDispatcher|setDefaultResultOrder/);
});
test("storage enforces bounded queue, ring and retention without modifying historical events", () => {
  const source = read("lib/payment-control/transport-storage.ts") + read("lib/payment-control/transport-queue.ts");
  assert.match(source, /MAX_QUEUED = 128/); assert.match(source, /% 10000/);
  assert.match(source, /INTERVAL '7 days'/); assert.match(source, /LIMIT 1000/);
  assert.match(source, /catch/); assert.doesNotMatch(source, /console\.(log|error)|\$executeRawUnsafe/);
  const migration = read("prisma/migrations/20261025120000_payment_transport_evidence/migration.sql");
  assert.doesNotMatch(migration, /ALTER TABLE "(?:Payment|Order|PaymentEvent)"|DROP |TRUNCATE /);
});
test("transport error codes never expose runtime error messages", () => {
  assert.equal(transportErrorCode({ code: "secret", message: "private" }), "UNKNOWN_NETWORK_ERROR");
  assert.equal(transportErrorCode({ code: "ENOTFOUND", message: "private" }), "ENOTFOUND");
});
