import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { createServer as createTcpServer, Socket } from "node:net";
import { lookup } from "node:dns";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Agent, buildConnector, request, getGlobalDispatcher } from "undici";
import { z } from "zod";
import { TransportObserver, ObservedConnection, observeIpLiteral, transportErrorCode } from "../lib/payment-control/transport-observer.ts";
import { createDiagnosticSubscriptions, ensureDiagnosticSubscriptions } from "../lib/payment-control/transport-diagnostics.ts";
import { inboundTransportEvidence, transportConfiguration } from "../lib/payment-control/transport-config.ts";
import { loadTransportSource } from "./helpers/payment-transport-uat.mjs";
import { readTechnicalRequestInspector } from "../lib/payment-control/request-inspector-reader.ts";

const cert = readFileSync(new URL("./fixtures/payment-transport/localhost-cert.pem", import.meta.url));
const key = readFileSync(new URL("./fixtures/payment-transport/localhost-key.pem", import.meta.url));
const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve) => server.close(resolve));

test("real local DNS/TCP/TLS, reuse, concurrent sockets and failure evidence", { timeout: 20000 }, async (t) => {
  // This process can only create loopback TCP clients. Production allowlists stay
  // unchanged; the exact source module gets a test-only localhost allowlist.
  const connect = Socket.prototype.connect;
  let blocked = 0;
  Socket.prototype.connect = function (...args) {
    const options = Array.isArray(args[0]) ? args[0][0] : args[0];
    const host = typeof options === "object" ? options.host ?? options.hostname : args[1];
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
      blocked++; throw new Error("LOCAL_UAT_NON_LOOPBACK_BLOCKED");
    }
    return Reflect.apply(connect, this, args);
  };
  t.after(() => { Socket.prototype.connect = connect; assert.equal(blocked, 0); });
  const originalDispatcher = getGlobalDispatcher();
  let received = 0;
  const server = createServer({ key, cert }, (req, res) => {
    received++;
    // Tiny controlled delay keeps concurrent requests in flight, with no payload.
    setTimeout(() => { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("local fixture"); }, 10);
  });
  const port = await listen(server);
  t.after(() => { server.closeAllConnections(); return close(server); });
  const origin = `https://localhost:${port}`;
  const observer = new TransportObserver();
  const subscriptions = createDiagnosticSubscriptions();
  assert.equal(ensureDiagnosticSubscriptions(subscriptions, observer), true);
  t.after(() => { for (const { target, listener } of subscriptions.listeners) target.unsubscribe(listener); });
  const observerImports = { ObservedConnection, observeIpLiteral, transportErrorCode,
    gatewayOrigins: { AIBL_WALLET: [origin] } };
  const connector = loadTransportSource("lib/payment-control/transport-connector.ts", {
    "node:dns": { lookup }, "node:async_hooks": { AsyncLocalStorage },
    undici: { Agent, buildConnector }, "./transport-observer": observerImports,
  });
  const sanitizer = loadTransportSource("lib/payment-control/transport-sanitizer.ts", {
    zod: { z }, "node:buffer": { Buffer }, "./transport-observer": observerImports,
  }).sanitizeTransportEvidence;
  const agents = [];
  t.after(async () => { await Promise.all(agents.map((agent) => agent.destroy())); });
  function agent({ trusted = true, connections = 1, destination = origin } = {}) {
    // TLS validation remains ON. Only this test Agent trusts this public test CA.
    observerImports.gatewayOrigins.AIBL_WALLET.push(destination);
    const dispatcher = new Agent({ connections, pipelining: 1, allowH2: false,
      connect: connector.createObservedConnector(observer,
        (options) => buildConnector({ ...options, ...(trusted ? { ca: cert } : {}), family: 4 })) });
    agents.push(dispatcher); return dispatcher;
  }
  async function capture(dispatcher, destination = origin, fail = false) {
    const scope = observer.begin("AIBL_WALLET", "VERIFY", randomUUID(), destination, "instrumented");
    let caught;
    await observer.scopes.run(scope, async () => {
      try {
        const response = await request(destination, { dispatcher, headersTimeout: 1500, bodyTimeout: 1500,
          signal: AbortSignal.timeout(2500) });
        assert.equal(response.statusCode, 200); await response.body.text();
      } catch (error) { caught = error; }
    });
    assert.equal(Boolean(caught), fail, "local HTTP outcome");
    const rows = observer.complete(scope, caught);
    assert.equal(rows.length, 1);
    return rows[0];
  }
  const dispatcher = agent();
  let first;
  await t.test("real OS lookup, TCP, verified TLS and exact request/socket correlation", async () => {
    first = await capture(dispatcher);
    assert.equal(first.attribution, "SOCKET_CORRELATED");
    assert.equal(first.connectionReused, false);
    for (const stage of ["dns", "tcp", "tls"]) {
      assert.equal(first[stage].status, "OBSERVED", stage);
      assert.ok(first[stage].durationMs >= 0); assert.ok(first[stage].startTime); assert.ok(first[stage].endTime);
    }
    assert.equal(first.connectionEvidence.dns.measurementType, "OS_NAME_RESOLUTION");
    assert.equal(first.connectionEvidence.tls.certificateValidated, true);
    assert.ok(sanitizer(first), "actual timings pass the actual sanitizer");
  });
  await t.test("connection reuse keeps previous handshake out of the new request timings", async () => {
    const next = await capture(dispatcher);
    assert.equal(next.connectionId, first.connectionId); assert.equal(next.connectionReused, true);
    for (const stage of ["dns", "tcp", "tls"]) {
      assert.equal(next[stage].status, "REUSED"); assert.equal(next[stage].durationMs, null);
    }
    assert.ok(sanitizer(next));
  });
  await t.test("central paymentFetch uses Node native fetch with the pinned separate Agent and real socket evidence", async () => {
    // Node's bundled fetch/Undici and the npm Agent are different versions. Test
    // their actual dispatch boundary, not only npm undici.request(). All I/O is
    // still restricted to this loopback fixture; telemetry DB writes are mocked.
    const captured = [];
    const telemetry = loadTransportSource("lib/payment-control/telemetry.ts", {
      "server-only": {}, "node:crypto": { randomUUID },
      "@/lib/prisma": { prisma: { paymentEvent: { create: async () => {} } } },
      "./transport-monitor": {
        beginPaymentTransport: async (provider, operation, requestId, destination) => {
          assert.equal(destination, origin);
          const scope = observer.begin(provider, operation, requestId, origin, "instrumented");
          return { run: (fn) => observer.scopes.run(scope, fn),
            finish: (error) => captured.push(...observer.complete(scope, error)) };
        },
        paymentTransportDispatcher: async () => dispatcher,
      },
    }, { fetch: globalThis.fetch, AbortSignal, console: { warn() {} } });
    const response = await telemetry.paymentFetch({ provider: "AIBL_WALLET", requestId: randomUUID() }, "VERIFY", origin,
      { method: "POST", body: "LOCAL_SYNTHETIC_BODY", timeoutMs: 2500, redirect: "error", cache: "no-store" });
    assert.equal(response.status, 200); assert.equal(await response.text(), "local fixture");
    assert.equal(captured.length, 1); assert.equal(captured[0].attribution, "SOCKET_CORRELATED");
    assert.equal(captured[0].requestOutcome, "HTTP_RESPONSE");
    assert.equal(captured[0].connectionId, first.connectionId);
    assert.equal(captured[0].connectionReused, true); assert.ok(sanitizer(captured[0]));
    assert.equal(getGlobalDispatcher(), originalDispatcher);
  });
  await t.test("real native fetch survives telemetry construction failure with one verified-TLS local request", async () => {
    const failedTelemetry = loadTransportSource("lib/payment-control/transport-connector.ts", {
      "node:dns": { lookup }, "node:async_hooks": { AsyncLocalStorage }, undici: { Agent, buildConnector },
      "./transport-observer": { ...observerImports, ObservedConnection: class { constructor() { throw new Error("SYNTHETIC_TELEMETRY_FAILURE"); } } },
    });
    const fallback = new Agent({ connections: 1, pipelining: 1, allowH2: false,
      connect: failedTelemetry.createObservedConnector(observer, (options) => buildConnector({ ...options, ca: cert, family: 4 })) });
    agents.push(fallback); const before = received;
    const response = await fetch(origin, { dispatcher: fallback, method: "POST", body: "SYNTHETIC_BODY", signal: AbortSignal.timeout(2500) });
    assert.equal(response.status, 200); assert.equal(await response.text(), "local fixture");
    assert.equal(received, before + 1);
    // Same fallback with no test CA must still reject the untrusted certificate.
    const rejecting = new Agent({ connect: failedTelemetry.createObservedConnector(observer,
      (options) => buildConnector({ ...options, family: 4 })) }); agents.push(rejecting);
    await assert.rejects(fetch(origin, { dispatcher: rejecting, signal: AbortSignal.timeout(2500) }));
    assert.equal(received, before + 1, "failed TLS never reaches the HTTP handler or triggers a retry");
  });
  await t.test("concurrent local requests retain distinct socket/request ownership", async () => {
    const rows = await Promise.all(Array.from({ length: 3 }, () => capture(agent())));
    assert.equal(new Set(rows.map((row) => row.connectionId)).size, 3);
    assert.equal(new Set(rows.map((row) => row.requestId)).size, 3);
    for (const row of rows) { assert.equal(row.attribution, "SOCKET_CORRELATED"); assert.ok(sanitizer(row)); }
  });
  await t.test("untrusted local certificate fails without disabling certificate verification", async () => {
    const row = await capture(agent({ trusted: false }), origin, true);
    assert.equal(row.requestOutcome, "REQUEST_ERROR"); assert.equal(row.attribution, "ERROR_OBJECT_CORRELATED");
    assert.equal(row.tls.status, "FAILED"); assert.equal(row.connectionEvidence.tls.certificateValidated, false);
    assert.ok(sanitizer(row));
  });
  await t.test("connection refusal is correlated by the actual connector error", async () => {
    const unused = createTcpServer(); const unusedPort = await listen(unused); await close(unused);
    const destination = `https://localhost:${unusedPort}`;
    const row = await capture(agent({ destination }), destination, true);
    assert.equal(row.errorCode, "ECONNREFUSED"); assert.equal(row.attribution, "ERROR_OBJECT_CORRELATED");
    assert.equal(row.tcp.status, "FAILED"); assert.ok(sanitizer(row));
  });
  await t.test("missing request events stay unavailable, and serialization strips unsafe fields", () => {
    const scope = observer.begin("AIBL_WALLET", "VERIFY", randomUUID(), origin, "instrumented");
    const [missing] = observer.complete(scope);
    assert.equal(missing.attribution, "UNATTRIBUTED"); assert.equal(missing.tls.durationMs, null);
    assert.ok(sanitizer(missing));
    const safe = sanitizer({ ...first, rawPayload: "LOCAL_PRIVATE_SENTINEL", headers: { authorization: "LOCAL_PRIVATE_SENTINEL" } });
    assert.ok(safe); assert.doesNotMatch(JSON.stringify(safe), /LOCAL_PRIVATE_SENTINEL|rawPayload|authorization/);
    assert.equal(getGlobalDispatcher(), originalDispatcher);
    assert.equal(subscriptions.observerErrors, 0);
  });
  await t.test("actual Inspector JSON represents measured local evidence without querying payment data", async () => {
    const safe = sanitizer(first);
    const event = { id: randomUUID(), requestId: safe.requestId, networkAgentId: null,
      requestStartedAt: new Date(safe.startedAt), requestCompletedAt: new Date(safe.completedAt),
      paymentId: null, orderId: null, transactionId: null, actorUserId: null,
      provider: "AIBL_WALLET", operation: "VERIFY", outcome: "HTTP_SUCCESS", httpStatus: 200,
      durationMs: Date.parse(safe.completedAt) - Date.parse(safe.startedAt),
      gatewayStatus: null, detailCode: null, createdAt: new Date(safe.completedAt) };
    const inspector = loadTransportSource("lib/payment-control/request-inspector.ts", {
      "./request-inspector-reader": { readTechnicalRequestInspector },
      "server-only": {}, "@/generated/prisma": {},
      "@/lib/prisma": { prisma: {
        paymentEvent: { count: async () => 1, findMany: async () => [event], findFirst: async ({ where }) => {
          if (where.paymentId || where.actorUserId || where.outcome && !where.outcome.in.includes("HTTP_SUCCESS")) return null;
          return event;
        } }, networkMonitorAlert: { findMany: async () => [] },
      } },
      "@/lib/payment-control/authorization": { PaymentControlError: Error },
      "@/lib/network-monitor/policy": { uuidPattern: /^[a-f0-9-]{36}$/i },
      "./transport-storage": { readTransportEvidence: async () => ({ storage: "AVAILABLE", attempts: [safe], limited: false }) },
      "./transport-config": { transportConfiguration: () => transportConfiguration({ NODE_ENV: "test" }),
        inboundTransportEvidence: (callback) => inboundTransportEvidence(callback, { NODE_ENV: "test" }) },
    }, { URLSearchParams, process: { versions: process.versions } });
    const result = await inspector.getTechnicalRequestInspector(safe.requestId);
    const json = JSON.parse(JSON.stringify(result));
    assert.equal(json.transportEvidence.attempts[0].attemptId, safe.attemptId);
    assert.equal(json.handshakes.tcp.durationMs, safe.tcp.durationMs);
    assert.equal(json.handshakes.tls.certificateValidation, "VALIDATED");
    assert.equal(json.transportEvidence.currentConfiguration.mode, "off");
    assert.equal(json.transportEvidence.inbound.applicationHandshakeVisibility, "NOT_OBSERVABLE");
  });
});
