import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { TransportObserver, ObservedConnection, approvedTransportOrigin } from "../lib/payment-control/transport-observer.ts";
import { createDiagnosticSubscriptions, ensureDiagnosticSubscriptions } from "../lib/payment-control/transport-diagnostics.ts";
import { TransportEvidenceQueue } from "../lib/payment-control/transport-queue.ts";
import { sanitizeTransportEvidence, isTransportPayloadWithinBudget, MAX_TRANSPORT_PAYLOAD_BYTES } from "../lib/payment-control/transport-sanitizer.ts";
import { transportScopeAllowed } from "../lib/payment-control/transport-config.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const origin = "https://iwtest.aibl.com.bd";
const compiled = new Map();
function load(path, imports, extras = {}) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const commonJsModule = { exports: {} };
  const context = vm.createContext({ module: commonJsModule, exports: commonJsModule.exports,
    process: { env: { NODE_ENV: "test", PAYMENT_TRANSPORT_STORAGE_ENABLED: "true" } },
    Date, performance, AbortSignal, URL, console: { warn() {}, error() {}, log() {} },
    fetch() { throw new Error("Offline fixture blocked native fetch"); },
    setImmediate() { throw new Error("Offline fixture blocked unscheduled work"); },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Offline fixture blocked unapproved import: ${name}`);
    }, ...extras,
  }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(compiled.get(path), { filename: path }).runInContext(context);
  return { api: commonJsModule.exports, context };
}
function diagnosticFixture() {
  const channels = new Map();
  return { channels, get(name) {
    if (!channels.has(name)) channels.set(name, { listeners: new Set(),
      subscribe(listener) { this.listeners.add(listener); }, unsubscribe(listener) { this.listeners.delete(listener); } });
    return channels.get(name);
  } };
}
function monitorFixture({ observer = TransportObserver, configuration = () => ({ mode: "passive" }),
  approve = approvedTransportOrigin, connector = {}, enqueue = () => {} } = {}) {
  const fixture = diagnosticFixture();
  return { ...load("lib/payment-control/transport-monitor.ts", {
    "server-only": {}, undici: {},
    "./transport-observer": { TransportObserver: observer, approvedTransportOrigin: approve },
    "./transport-storage": { enqueueTransportEvidence: enqueue },
    "./transport-config": { transportConfiguration: () => ({ allowedProviders: ["AIBL_WALLET"],
      allowedOperations: ["VERIFY"], ...configuration() }), transportScopeAllowed },
    "./transport-diagnostics": { createDiagnosticSubscriptions,
      ensureDiagnosticSubscriptions: (state, target) => ensureDiagnosticSubscriptions(state, target, (name) => fixture.get(name)) },
    "./transport-connector": connector,
  }), fixture };
}
async function begin(fixture) { return fixture.api.beginPaymentTransport("AIBL_WALLET", "VERIFY", requestId, origin); }
function telemetryFixture(monitor, fetchMock, persist = async () => {}) {
  return load("lib/payment-control/telemetry.ts", {
    "server-only": {}, "node:crypto": { randomUUID }, "./transport-monitor": monitor,
    "@/lib/prisma": { prisma: { paymentEvent: { create: persist } } },
  }, { fetch: fetchMock }).api;
}
const paymentContext = { provider: "AIBL_WALLET", paymentId: 900001, orderId: 900001, requestId };
function sample() {
  const observer = new TransportObserver();
  const scope = observer.begin("AIBL_WALLET", "VERIFY", requestId, origin, "instrumented");
  const request = { origin }; const socket = {};
  let tick = 0;
  const connection = new ObservedConnection(origin, true, true, () => ({
    wall: new Date(Date.UTC(2026, 9, 25, 0, 0, 0, tick)).toISOString(), mono: tick,
  }));
  connection.beginDns(); tick += 7; connection.endDns(null, 4);
  connection.beginTcp("192.0.2.1", 4); tick += 11; connection.connected("192.0.2.1", true);
  tick += 13;
  connection.secure({ tlsVersion: "TLSv1.3", cipherSuite: "TLS_AES_256_GCM_SHA384", alpnProtocol: "http/1.1", certificateValidated: true, sessionResumed: false });
  observer.attachSocket(socket, connection);
  observer.scopes.run(scope, () => observer.handle("create", { request }));
  observer.handle("sendHeaders", { request, socket }); observer.handle("headers", { request });
  const value = observer.complete(scope)[0]; assert.ok(sanitizeTransportEvidence(value)); return value;
}
function queueFixture(overrides = {}) {
  const tasks = []; const written = [];
  const queue = new TransportEvidenceQueue({ sanitize: sanitizeTransportEvidence,
    write: async (record) => { written.push(record); return "INSERTED"; }, schedule: (task) => tasks.push(task), ...overrides });
  return { queue, tasks, written, async flush() { while (tasks.length) { tasks.shift()(); await queue.waitForIdle(); } } };
}

for (const event of ["undici:request:create", "undici:client:sendHeaders", "undici:client:connected"]) {
  test(`subscriber isolates a throwing observer during ${event}`, () => {
    const fixture = diagnosticFixture(); const state = createDiagnosticSubscriptions();
    assert.equal(ensureDiagnosticSubscriptions(state, { handle() { throw new Error("private diagnostic payload"); } }, (name) => fixture.get(name)), true);
    const payload = Object.freeze({ authorization: "OFFLINE_PRIVATE_SENTINEL" });
    for (const listener of fixture.get(event).listeners) assert.doesNotThrow(() => listener(payload));
    assert.equal(state.observerErrors, 1); assert.doesNotMatch(JSON.stringify(state), /OFFLINE_PRIVATE_SENTINEL|private diagnostic payload/);
  });
}
test("partial subscription rollback removes the listener that was added before subscribe threw", () => {
  const fixture = diagnosticFixture(); const state = createDiagnosticSubscriptions(); const target = fixture.get("undici:request:error");
  const subscribe = target.subscribe;
  target.subscribe = function (listener) { subscribe.call(this, listener); throw new Error("offline registration failure"); };
  assert.equal(ensureDiagnosticSubscriptions(state, { handle() {} }, (name) => fixture.get(name)), false);
  assert.equal(state.status, "IDLE"); assert.equal(state.listeners.length, 0);
  assert.ok([...fixture.channels.values()].every((entry) => entry.listeners.size === 0));
  target.subscribe = subscribe;
  assert.equal(ensureDiagnosticSubscriptions(state, { handle() {} }, (name) => fixture.get(name)), true);
  assert.equal(ensureDiagnosticSubscriptions(state, { handle() {} }, (name) => fixture.get(name)), true);
  assert.ok([...fixture.channels.values()].every((entry) => entry.listeners.size === 1));
});
test("failed rollback and reentrant subscription cannot add duplicate listeners", () => {
  const fixture = diagnosticFixture(); const state = createDiagnosticSubscriptions(); const target = fixture.get("undici:request:create");
  const observer = { handle() {} }; const subscribe = target.subscribe; const unsubscribe = target.unsubscribe;
  target.subscribe = function (listener) { subscribe.call(this, listener);
    assert.equal(ensureDiagnosticSubscriptions(state, observer, (name) => fixture.get(name)), false);
    throw new Error("partial failure"); };
  target.unsubscribe = () => { throw new Error("rollback unavailable"); };
  assert.equal(ensureDiagnosticSubscriptions(state, observer, (name) => fixture.get(name)), false);
  assert.equal(state.status, "ROLLBACK_PENDING");
  assert.equal(ensureDiagnosticSubscriptions(state, observer, (name) => fixture.get(name)), false);
  assert.equal(target.listeners.size, 1);
  target.unsubscribe = unsubscribe; target.subscribe = subscribe;
  assert.equal(ensureDiagnosticSubscriptions(state, observer, (name) => fixture.get(name)), true);
  assert.equal(target.listeners.size, 1);
});
test("legacy hot-reload subscriptions require restart instead of registering duplicates", async () => {
  const fixture = monitorFixture();
  fixture.context.__paymentTransportV1 = { observer: new TransportObserver(), subscribed: true, agent: null };
  assert.equal(await begin(fixture), null); assert.equal(fixture.fixture.channels.size, 0);
});
test("configuration, origin or observer initialization failures leave original HTTP execution available once", async () => {
  for (const options of [
    { configuration() { throw new Error("private config failure"); } },
    { approve() { throw new Error("private origin failure"); } },
    { observer: class { constructor() { throw new Error("private observer failure"); } } },
  ]) {
    const fixture = monitorFixture(options); let calls = 0; const response = { ok: true, status: 200 };
    const telemetry = telemetryFixture(fixture.api, async (_url, init) => { calls++; assert.equal("dispatcher" in init, false); return response; });
    assert.equal(await telemetry.paymentFetch(paymentContext, "VERIFY", origin, { timeoutMs: 20000 }), response);
    assert.equal(calls, 1);
  }
});
test("disabled monitoring performs no subscription, dispatcher import or extra dispatch", async () => {
  const fixture = monitorFixture({ configuration: () => ({ mode: "off" }), approve() { throw new Error("must not execute"); } });
  let calls = 0; const response = { ok: true, status: 200 }; const headers = { "Content-Type": "application/json" };
  const telemetry = telemetryFixture(fixture.api, async (_url, init) => {
    calls++; assert.equal(init.headers, headers); assert.equal(init.body, "OFFLINE_SYNTHETIC_BODY");
    assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.equal("dispatcher" in init, false);
    assert.ok(init.signal instanceof AbortSignal); return response;
  });
  assert.equal(await telemetry.paymentFetch(paymentContext, "VERIFY", origin,
    { timeoutMs: 20000, method: "POST", headers, body: "OFFLINE_SYNTHETIC_BODY", cache: "no-store", redirect: "error" }), response);
  assert.equal(calls, 1); assert.equal(fixture.fixture.channels.size, 0);
});
test("instrumented dependency rejection falls back before dispatch without retrying a gateway request", async () => {
  const fixture = monitorFixture({ configuration: () => ({ mode: "instrumented" }),
    connector: { createInstrumentedAgent() { throw new Error("offline dependency failure"); } } });
  let calls = 0; const response = { ok: true, status: 200 };
  const telemetry = telemetryFixture(fixture.api, async (_url, init) => { calls++; assert.equal("dispatcher" in init, false); return response; });
  assert.equal(await telemetry.paymentFetch(paymentContext, "VERIFY", origin, { timeoutMs: 20000 }), response);
  assert.equal(calls, 1);
});
test("context failure before or after invocation preserves the single original HTTP promise/error", async () => {
  for (const invokeFirst of [false, true]) {
    class Observer extends TransportObserver { constructor() { super(); this.scopes.run = (_scope, fn) => {
      if (invokeFirst) fn(); throw new Error("offline context failure");
    }; } }
    const fixture = monitorFixture({ observer: Observer }); let calls = 0;
    const original = Object.assign(new Error("original synthetic network error"), { code: "ECONNRESET" });
    const telemetry = telemetryFixture(fixture.api, async () => { calls++; throw original; });
    await assert.rejects(telemetry.paymentFetch(paymentContext, "VERIFY", origin, { timeoutMs: 20000 }), (error) => error === original);
    assert.equal(calls, 1);
  }
});
test("repeated finish enqueues once and completion failure still releases the scope", async () => {
  let completed = 0; let enqueued = 0;
  class Observer extends TransportObserver { complete(...args) { completed++; return super.complete(...args); } }
  const fixture = monitorFixture({ observer: Observer, enqueue() { enqueued++; } }); const capture = await begin(fixture);
  capture.finish(); capture.finish(); assert.equal(completed, 1); assert.equal(enqueued, 1);
  class FailingObserver extends TransportObserver { complete() { throw new Error("offline completion failure"); } }
  const failing = monitorFixture({ observer: FailingObserver }); const failed = await begin(failing);
  assert.doesNotThrow(() => failed.finish()); assert.equal(failed.scope.active, false);
});
test("sanitizer exceptions and malformed getters reject evidence without scheduling work", () => {
  const fixture = queueFixture({ sanitize() { throw new Error("OFFLINE_PRIVATE_SENTINEL"); } });
  assert.doesNotThrow(() => fixture.queue.enqueue([sample()])); assert.equal(fixture.tasks.length, 0);
  assert.equal(fixture.queue.snapshot().sanitizerErrors, 1); assert.equal(fixture.queue.snapshot().rejected, 1);
  assert.equal(sanitizeTransportEvidence(new Proxy({}, { get() { throw new Error("private getter"); } })), null);
});
test("queue overflow, write rejection and later recovery are bounded and observable", async () => {
  let fail = true;
  const fixture = queueFixture({ write: async () => { if (fail) throw new Error("private database exception"); return "INSERTED"; } });
  const record = sample(); for (let index = 0; index < 17; index++) fixture.queue.enqueue(Array(8).fill(record));
  assert.equal(fixture.queue.snapshot().queueDepth, 128); assert.equal(fixture.queue.snapshot().dropped, 8);
  await fixture.flush(); assert.equal(fixture.queue.snapshot().writeErrors, 1);
  assert.equal(fixture.queue.snapshot().dropped, 136); assert.equal(fixture.queue.snapshot().queueDepth, 0);
  fail = false; fixture.queue.enqueue([record]); await fixture.flush(); assert.equal(fixture.queue.snapshot().persisted, 1);
  assert.doesNotMatch(JSON.stringify(fixture.queue.snapshot()), /private database/);
});
test("unexpected background rejection and scheduler failure are caught and do not wedge future batches", async () => {
  const fixture = queueFixture(); const original = fixture.queue.drain;
  fixture.queue.drain = async () => { throw new Error("offline unexpected drain rejection"); };
  fixture.queue.enqueue([sample()]); await fixture.flush(); assert.equal(fixture.queue.snapshot().drainErrors, 1);
  fixture.queue.drain = original; fixture.queue.enqueue([sample()]); await fixture.flush();
  assert.equal(fixture.queue.snapshot().persisted, 1);
  fixture.queue.drain = () => { throw new Error("offline synchronous drain failure"); };
  fixture.queue.enqueue([sample()]); await fixture.flush(); assert.equal(fixture.queue.snapshot().drainErrors, 2);
  fixture.queue.drain = original; fixture.queue.enqueue([sample()]); await fixture.flush();
  assert.equal(fixture.queue.snapshot().persisted, 2);
  const rejected = queueFixture({ schedule() { throw new Error("offline scheduler failure"); } });
  assert.doesNotThrow(() => rejected.queue.enqueue([sample()])); assert.equal(rejected.queue.snapshot().dropped, 1);
});
test("unexpected writer results are not reported as persisted evidence", async () => {
  const fixture = queueFixture({ write: async () => "INVALID_RESULT" });
  fixture.queue.enqueue([sample()]); await fixture.flush();
  assert.equal(fixture.queue.snapshot().persisted, 0); assert.equal(fixture.queue.snapshot().writeErrors, 1);
  assert.equal(fixture.queue.snapshot().dropped, 1);
});
test("UTF-8 budget rejects oversized/multibyte serialization while unknown sensitive fields are stripped", () => {
  assert.equal(isTransportPayloadWithinBudget({ value: "x".repeat(MAX_TRANSPORT_PAYLOAD_BYTES) }), false);
  assert.equal(isTransportPayloadWithinBudget({ value: "আ".repeat(3000) }), false);
  const record = sample(); const safe = sanitizeTransportEvidence({ ...record, rawBody: "আ".repeat(10000), authorization: "OFFLINE_PRIVATE_SENTINEL" });
  assert.ok(safe); assert.ok(Buffer.byteLength(JSON.stringify(safe), "utf8") <= MAX_TRANSPORT_PAYLOAD_BYTES);
  assert.doesNotMatch(JSON.stringify(safe), /rawBody|OFFLINE_PRIVATE_SENTINEL|আ/);
  assert.equal(sanitizeTransportEvidence({ ...record, tcp: { ...record.tcp, durationMs: 1e-300 } }), null);
});
test("invalid timestamps, inconsistent durations/IDs, stage ownership and certificate contradictions are rejected", () => {
  const record = sample(); const changed = structuredClone(record);
  changed.connectionEvidence.tls.certificateValidated = false;
  for (const invalid of [
    { ...record, startedAt: "invalid" }, { ...record, completedAt: "2000-01-01T00:00:00.000Z" },
    { ...record, tcp: { ...record.tcp, endTime: "2000-01-01T00:00:00.000Z" } },
    { ...record, tcp: { ...record.tcp, durationMs: 999999 } },
    { ...record, connectionId: randomUUID() }, { ...record, connectionReused: true },
    { ...record, attribution: "UNATTRIBUTED" }, changed,
    { ...record, attribution: "UNSUPPORTED_HTTP2" },
  ]) assert.equal(sanitizeTransportEvidence(invalid), null);
});
test("reasonable wall-clock skew is accepted without altering the monotonic measurement", () => {
  const record = sample(); const changed = structuredClone(record);
  const old = changed.tls.durationMs;
  const end = new Date(Date.parse(changed.tls.endTime) - 500).toISOString();
  changed.tls.endTime = end; changed.connectionEvidence.tls.endTime = end;
  const safe = sanitizeTransportEvidence(changed); assert.ok(safe); assert.equal(safe.tls.durationMs, old);
});

// Cooperative lock/transaction fixture: models the SQL contract, never opens a DB.
function databaseFixture() {
  const rows = new Map(); let sequence = 9999; let turn = Promise.resolve(); const statements = [];
  return { rows, statements, get sequence() { return sequence; },
    async $transaction(work, options) {
      assert.equal(options.isolationLevel, "ReadCommitted"); const previous = turn; let release;
      turn = new Promise((resolve) => { release = resolve; }); await previous;
      let locked = false;
      try { return await work({
        async $queryRaw(query) {
          statements.push(query.text);
          if (/set_config/.test(query.text)) {
            assert.match(query.text, /'lock_timeout', '250ms', true/);
            assert.match(query.text, /'statement_timeout', '500ms', true/); return [];
          }
          assert.match(query.text, /pg_advisory_xact_lock/); locked = true; return [];
        },
        async $executeRaw(query) {
          statements.push(query.text);
          assert.equal(locked, true); assert.match(query.text, /WHERE NOT EXISTS/); assert.match(query.text, /ON CONFLICT \("slot"\) DO UPDATE/);
          const [attemptId, , , , , , json, duplicateId] = query.values; assert.equal(attemptId, duplicateId);
          if ([...rows.values()].some((entry) => entry.attemptId === attemptId)) return 0;
          sequence++; const slot = sequence % 10000;
          rows.set(slot, JSON.parse(json)); return 1;
        },
      }); } finally { release(); }
    },
  };
}
function storageFixture(database) {
  const tasks = [];
  const fixture = load("lib/payment-control/transport-storage.ts", {
    "server-only": {}, "@/generated/prisma": { Prisma: { sql: (strings, ...values) => ({ text: strings.join("?"), values }) } },
    "@/lib/prisma": { prisma: database }, "./transport-sanitizer": { sanitizeTransportEvidence },
    "./transport-queue": { TransportEvidenceQueue },
  }, { setImmediate: (task) => tasks.push(task) });
  return { ...fixture, async flush() {
    while (tasks.length) { tasks.shift()(); await fixture.context.__paymentTransportQueueV2.waitForIdle(); }
  } };
}
test("duplicate attempt IDs do not consume a ring slot or replace an unrelated retained attempt", async () => {
  const database = databaseFixture(); const fixture = storageFixture(database); const first = sample(); const unrelated = sample();
  fixture.api.enqueueTransportEvidence([first, unrelated, first]); await fixture.flush();
  assert.equal(database.rows.size, 2); assert.equal(database.sequence, 10001);
  assert.ok([...database.rows.values()].some((row) => row.attemptId === unrelated.attemptId));
  assert.equal(fixture.context.__paymentTransportQueueV2.snapshot().duplicates, 1);
});
test("ring overwrite replaces only the next slot while retaining uniqueness and the physical cap", async () => {
  const database = databaseFixture();
  for (let slot = 0; slot < 10000; slot++) database.rows.set(slot, { attemptId: `offline-old-${slot}` });
  const fixture = storageFixture(database); const record = sample(); fixture.api.enqueueTransportEvidence([record]); await fixture.flush();
  assert.equal(database.rows.size, 10000); assert.equal(database.rows.get(0).attemptId, record.attemptId);
  assert.equal(database.rows.get(1).attemptId, "offline-old-1");
});
test("concurrent process-local queues serialize duplicate detection and ring allocation through the DB transaction contract", async () => {
  const database = databaseFixture(); const a = storageFixture(database); const b = storageFixture(database); const record = sample();
  a.api.enqueueTransportEvidence([record]); b.api.enqueueTransportEvidence([record, sample()]);
  await Promise.all([a.flush(), b.flush()]);
  assert.equal(database.rows.size, 2); assert.equal(database.sequence, 10001);
  assert.equal([...database.rows.values()].filter((row) => row.attemptId === record.attemptId).length, 1);
});
test("transport storage failure cannot change a successful original payment HTTP result", async () => {
  const storage = storageFixture({ async $transaction() { throw new Error("OFFLINE_PRIVATE_DATABASE_ERROR"); } });
  const monitor = monitorFixture({ enqueue: storage.api.enqueueTransportEvidence }); let calls = 0; const response = { ok: true, status: 200 };
  const telemetry = telemetryFixture(monitor.api, async () => { calls++; return response; });
  assert.equal(await telemetry.paymentFetch(paymentContext, "VERIFY", origin, { timeoutMs: 20000 }), response);
  await storage.flush(); assert.equal(calls, 1);
  assert.equal(storage.context.__paymentTransportQueueV2.snapshot().writeErrors, 1);
});
