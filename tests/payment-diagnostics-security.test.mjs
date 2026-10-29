import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import ts from "typescript";
import * as policy from "../lib/payment-control/diagnostic-policy.ts";
import * as engine from "../lib/payment-control/investigation-engine.ts";
import * as consistency from "../lib/payment-control/consistency.ts";
import * as diagnosticAdapters from "../lib/payment-control/diagnostic-adapters.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import * as pcap from "../lib/payment-control/pcapng.ts";
const requestId = "11111111-1111-4111-8111-111111111111";
class ControlError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function load(path, imports, globals = {}) {
  const commonJsModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new vm.Script(code, { filename: path }).runInContext(vm.createContext({
    module: commonJsModule, exports: commonJsModule.exports, Date, Buffer, URL, URLSearchParams, Set, Map, Response, AbortSignal, performance,
    process: { env: {} }, console: { warn() {}, error() {} },
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      if (name in imports) return imports[name];
      throw new Error("Offline test blocked import: " + name);
    }, ...globals,
  }));
  return commonJsModule.exports;
}
function authorization({ userId = "staff", banned = false, keys = ["settings.payment.manage"], allowed = true } = {}) {
  const logs = [], access = { userId, hasGlobal: key => keys.includes(key) };
  const prisma = { user: { findUnique: async () => banned === null ? null : ({ banned }) },
    activityLog: { create: async value => { logs.push(value); } } };
  const rateLimitRequest = async () => ({ allowed });
  const base = load("lib/payment-control/authorization.ts", {
    "next/server": { NextResponse: Response }, "next-auth/next": { getServerSession: async () => ({ user: { id: userId } }) },
    "@/lib/auth": { authOptions: {} }, "@/lib/rbac": { getAccessContext: async () => access },
    "@/lib/request-security": { rateLimitRequest }, "@/generated/prisma": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "@/lib/prisma": { prisma },
  });
  const diagnostic = load("lib/payment-control/diagnostic-authorization.ts", { "@/lib/prisma": { prisma },
    "@/lib/request-security": { rateLimitRequest }, "./authorization": base });
  return { ...diagnostic, logs };
}
for (const [name, options, status] of [
  ["anonymous", { userId: null }, 401], ["banned", { banned: true }, 403], ["deleted", { banned: null }, 403],
  ["warehouse-only", { keys: [] }, 403], ["global payment manager without capture grant", {}, 403],
]) test(`RBAC rejects ${name}`, async () => {
  const auth = authorization(options);
  await assert.rejects(auth.requireDiagnosticAccess(new Request("https://shop.example/api/test"), "payments.diagnostics.capture"), e => e.status === status);
  assert.equal(auth.logs.length, 0);
});
test("capture grant requires same-origin mutation and dedicated global grant", async () => {
  const auth = authorization({ keys: ["settings.payment.manage", "payments.diagnostics.capture"] });
  await assert.rejects(auth.requireDiagnosticAccess(new Request("https://shop.example/api/test", { method: "POST" }), "payments.diagnostics.capture", true), e => e.status === 403);
  await assert.rejects(auth.requireDiagnosticAccess(new Request("https://shop.example/api/test", { method: "POST", headers: { origin: "https://attacker.example" } }), "payments.diagnostics.capture", true), e => e.status === 403);
  assert.equal((await auth.requireDiagnosticAccess(new Request("https://shop.example/api/test", { method: "POST", headers: { origin: "https://shop.example" } }), "payments.diagnostics.capture", true)).userId, "staff");
});
for (const permission of ["payments.diagnostics.capture", "payments.diagnostics.export", "payments.diagnostics.evidence"]) {
  test(`${permission} is independent and rate limited`, async () => {
    await assert.rejects(authorization().requireDiagnosticAccess(new Request("https://shop.example/api/test"), permission), e => e.status === 403);
    await assert.rejects(authorization({ keys: ["settings.payment.manage", permission], allowed: false }).requireDiagnosticAccess(new Request("https://shop.example/api/test"), permission), e => e.status === 429);
  });
}
test("evidence export cannot read files or database before permission succeeds", async () => {
  let touched = 0;
  const route = load("app/api/admin/payment-control/diagnostics/captures/[id]/route.ts", {
    "next/server": {}, "@/lib/prisma": { prisma: { paymentDiagnosticCapture: { findFirst() { touched++; } } } },
    "@/lib/payment-control/diagnostic-authorization": { requireDiagnosticAccess: async () => { throw new ControlError("Denied", 403); }, auditDiagnosticAction: async () => { touched++; } },
    "@/lib/payment-control/capture-storage": { readCaptureEvidence: async () => { touched++; } },
    "@/lib/payment-control/authorization": { PaymentControlError: ControlError, paymentControlErrorResponse: e => new Response(null, { status: e.status || 500 }) },
  });
  const response = await route.GET(new Request("https://shop.example/api/evidence"), { params: Promise.resolve({ id: requestId }) });
  assert.equal(response.status, 403); assert.equal(touched, 0);
});
test("investigation reads one repeatable read-only snapshot and recovers pre-claim AUTH via request ID", async () => {
  const queries = [], reads = [];
  const event = { id: requestId, requestId, paymentId: 71, operation: "VERIFY", outcome: "SUCCESS", detailCode: null, httpStatus: null,
    durationMs: null, gatewayStatus: null, createdAt: new Date("2026-10-29T00:00:00Z") };
  const tx = {
    $executeRawUnsafe: async sql => { queries.push(sql); }, $queryRaw: async sql => { reads.push(sql); return []; },
    payment: { findFirst: async () => { assert.deepEqual(queries, ["SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '3000ms'"]);
      return { id: 71, orderId: 7, provider: "EPS", status: "CAPTURED", amount: "100.00", currency: "BDT", externalId: "NEVER_EXPORT_FULL_REF",
        createdAt: new Date("2026-10-29T00:00:00Z"), updatedAt: new Date("2026-10-29T00:01:00Z"), paymentGatewayData: { token: "NEVER_EXPORT_TOKEN", verifiedStatus: "Success", lastCheckedAt: "2026-10-29T00:01:00Z" },
        order: { id: 7, paymentStatus: "PAID", status: "CONFIRMED", grand_total: "100.00", currency: "BDT", orderItems: [] } }; }, count: async () => 1 },
    paymentEvent: { findMany: async query => {
      reads.push(query);
      if (query.where.operation === "FRONTEND") return [{ id: "order-only", detailCode: "FRONTEND_NETWORK_INTERRUPTED", durationMs: 1000, createdAt: new Date("2026-10-29T00:00:00Z") }];
      if (query.distinct) return [{ requestId }];
      assert.ok(query.where.OR.some(item => item.requestId?.in?.includes(requestId)));
      return [event, { ...event, id: "auth-before-claim", paymentId: null, operation: "AUTH", outcome: "HTTP_SUCCESS" }];
    } }, inventoryReservation: { count: async () => 0 }, bundleStockReservation: { count: async () => 0 },
    paymentReconciliation: { findFirst: async () => null },
    inventoryLog: { groupBy: async () => [] },
  };
  const prisma = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, "RepeatableRead"); return fn(tx); },
    paymentDiagnosticCapture: { findMany: async () => { throw new Error("Missing optional migration"); } } };
  const reader = load("lib/payment-control/investigation.ts", {
    "@/generated/prisma": { Prisma: { sql: (strings, ...values) => ({ strings, values }) } }, "@/lib/prisma": { prisma },
    "./authorization": { PaymentControlError: ControlError }, "./diagnostic-policy": policy, "./consistency": consistency,
    "./investigation-engine": engine, "./transport-storage": { readTransportEvidence: async () => ({ attempts: [], limited: false, storage: "NOT_COLLECTED" }) },
    "./capture": { captureProjection: {} }, "@/lib/eps-settings": { epsObject: value => value || {} },
    "./diagnostic-adapters": diagnosticAdapters,
  });
  const report = await reader.getPaymentInvestigation(71);
  assert.equal(report.events.length, 2); assert.equal(report.captureEvidence.availability, "UNAVAILABLE");
  assert.equal(report.orderBrowserReports.events.length, 1); assert.equal(report.orderBrowserReports.scope, "ORDER_ONLY_NOT_ATTEMPT_ATTRIBUTED");
  assert.equal(report.payment.traceId, policy.paymentTraceId(71));
  assert.ok(!JSON.stringify(report).includes("NEVER_EXPORT"));
  assert.ok(report.checks.some(c => c.code === "PAYMENT_VERIFICATION_EVIDENCE" && c.status === "PASS"));
});
test("capture control plane rejects bad keys without any database writes", async () => {
  const capture = load("lib/payment-control/capture.ts", {
    "@/generated/prisma": { Prisma: {} }, "@/lib/prisma": { prisma: {} }, "./authorization": { PaymentControlError: ControlError },
    "./capture-policy": { requireCaptureEnabled: () => ({}), approvedCaptureIps: () => ["8.8.8.8"], captureOperations: ["AUTH"] },
  }, { process: { env: { PAYMENT_CAPTURE_AGENT_ID: "capture-test", PAYMENT_CAPTURE_AGENT_TOKEN: "a".repeat(32) } } });
  for (const headers of [{}, { authorization: "Bearer wrong", "x-capture-agent-id": "capture-test" },
    { authorization: "Bearer " + "a".repeat(32), "x-capture-agent-id": "other" },
    { authorization: "Bearer " + "é".repeat(32), "x-capture-agent-id": "capture-test" }])
    await assert.rejects(capture.requireCaptureAgent(new Request("https://shop.example/api/agent", { headers })), e => e.status === 401);
  assert.equal(await capture.requireCaptureAgent(new Request("https://shop.example/api/agent", { headers: {
    authorization: "Bearer " + "a".repeat(32), "x-capture-agent-id": "capture-test" } })), "capture-test");
});
test("browser collection disabled performs no authorization, body read or database I/O", async () => {
  const denied = () => { throw new Error("Disabled feature performed I/O"); };
  const route = load("app/api/payment-diagnostics/frontend/route.ts", {
    "next/server": { NextResponse: Response }, "next-auth/next": { getServerSession: denied }, "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma: {} }, "@/lib/sslcommerz": { verifyPaymentInitToken: denied },
    "@/lib/request-security": { rateLimitRequest: denied }, "@/lib/network-monitor/policy": { readMonitorBody: denied },
    "@/lib/payment-control/diagnostic-policy": { diagnosticsEnabled: () => false }, "@/lib/payment-control/telemetry": { recordPaymentEvent: denied },
  });
  assert.equal((await route.POST(new Request("https://shop.example/api/test", { method: "POST", body: "invalid" }))).status, 204);
});
test("private evidence storage rejects unsafe paths, verifies hashes and cleans exact evidence IDs", async () => {
  const folder = await fs.mkdtemp(path.join(tmpdir(), "payment-evidence-test-"));
  const privateDir = path.join(folder, "private");
  const storage = load("lib/payment-control/capture-storage.ts", { "node:path": path, "node:fs/promises": fs, "./pcapng": pcap },
    { process: { env: { PAYMENT_DIAGNOSTICS_EVIDENCE_DIR: privateDir }, cwd: () => process.cwd() } });
  try {
    const safe = await storage.saveCaptureEvidence(requestId, pcap.canonicalPcapng([]), ["8.8.8.8"]);
    assert.equal((await storage.readCaptureEvidence(requestId, safe.bytes, safe.sha256)).length, safe.bytes);
    await assert.rejects(storage.readCaptureEvidence("../../outside", safe.bytes, safe.sha256), /INVALID_EVIDENCE_ID/);
    await fs.writeFile(path.join(privateDir, requestId + ".pcapng"), Buffer.alloc(safe.bytes));
    await assert.rejects(storage.readCaptureEvidence(requestId, safe.bytes, safe.sha256), /EVIDENCE_INTEGRITY_FAILED/);
    await storage.deleteCaptureEvidence(requestId); assert.deepEqual(await fs.readdir(privateDir), []);
    for (const name of ["evidence-unsafe-test", "..evidence-unsafe-test"]) {
      const publicStorage = load("lib/payment-control/capture-storage.ts", { "node:path": path, "node:fs/promises": fs, "./pcapng": pcap },
        { process: { env: { PAYMENT_DIAGNOSTICS_EVIDENCE_DIR: path.resolve("public", name) }, cwd: () => process.cwd() } });
      await assert.rejects(publicStorage.evidenceDirectory(), /UNSAFE_EVIDENCE_DIRECTORY/);
    }
  } finally {
    const rel = path.relative(path.resolve(tmpdir()), path.resolve(folder));
    assert.ok(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
    await fs.rm(folder, { recursive: true, force: true });
  }
});
test("browser diagnostics failure cannot retry or fail an otherwise successful payment request", async () => {
  let paymentRequests = 0, diagnosticRequests = 0;
  const response = new Response('{}', { headers: { "X-Payment-Request-Id": requestId } });
  const browser = load("lib/payment-control/browser-diagnostics.ts", {}, { process: { env: { NEXT_PUBLIC_PAYMENT_DIAGNOSTICS_ENABLED: "true" } },
    fetch: async url => {
      if (url === "/api/payment-diagnostics/frontend") { diagnosticRequests++; throw new Error("Offline collector"); }
      paymentRequests++; return response;
    } });
  assert.equal(await browser.diagnosticPaymentFetch("/api/eps/init", {}, { orderId: 7 }), response);
  await Promise.resolve(); assert.equal(paymentRequests, 1); assert.equal(diagnosticRequests, 1);
});
test("browser network interruption is reported without a second gateway request", async () => {
  let paymentRequests = 0; const reports = [];
  const browser = load("lib/payment-control/browser-diagnostics.ts", {}, { process: { env: { NEXT_PUBLIC_PAYMENT_DIAGNOSTICS_ENABLED: "true" } },
    fetch: async (url, init) => {
      if (url === "/api/payment-diagnostics/frontend") { reports.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
      paymentRequests++; throw new Error("Offline connection interruption");
    } });
  await assert.rejects(browser.diagnosticPaymentFetch("/api/aibl-wallet/init", {}, { orderId: 7, customerEmail: "must-not-be-projected" }));
  assert.equal(paymentRequests, 1); assert.equal(reports[0].code, "FRONTEND_NETWORK_INTERRUPTED");
  assert.equal("customerEmail" in reports[0], false);
});
test("blocked browser redirect is reported and never issues a payment retry", async () => {
  const reports = [];
  const location = {}; Object.defineProperty(location, "href", { set() { throw new Error("Navigation unavailable"); } });
  const browser = load("lib/payment-control/browser-diagnostics.ts", {}, { process: { env: { NEXT_PUBLIC_PAYMENT_DIAGNOSTICS_ENABLED: "true" } },
    window: { location }, fetch: async (url, init) => { assert.equal(url, "/api/payment-diagnostics/frontend"); reports.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); } });
  assert.throws(() => browser.diagnosticPaymentRedirect("https://sandbox.eps.com.bd/fixture", new Response(null, { headers: { "X-Payment-Request-Id": requestId } }), { orderId: 7 }));
  assert.deepEqual(reports.map(r => r.code), ["FRONTEND_REDIRECT_REQUESTED", "FRONTEND_REDIRECT_FAILED"]);
});
test("trace search selects exact internal attempt while legacy order filters remain intact", () => {
  const queries = load("lib/payment-control/queries.ts", { "@/generated/prisma": {}, "@/lib/prisma": { prisma: {} },
    "./authorization": { PaymentControlError: ControlError }, "@/lib/aibl-wallet-settings": {}, "./diagnostic-policy": policy });
  assert.equal(queries.paymentFilters(new URLSearchParams({ q: policy.paymentTraceId(71) })).where.id, 71);
  assert.ok(queries.paymentFilters(new URLSearchParams({ q: "7" })).where.OR.some(v => v.orderId === 7));
  assert.throws(() => queries.paymentFilters(new URLSearchParams({ q: "unsafe;DROP" })), e => e.status === 400);
});
test("capture jobs fail closed on audit errors and competing agents cannot claim twice", async () => {
  let jobs = [], auditFailure = true, pending = Promise.resolve();
  const matches = (job, where) => (!where.agentId || where.agentId === job.agentId) && (!where.kind || where.kind === job.kind) &&
    (!where.status || (typeof where.status === "string" ? job.status === where.status : where.status.in.includes(job.status))) &&
    (!where.createdAt?.lt || job.createdAt < where.createdAt.lt) && (!where.startedAt?.lt || job.startedAt && job.startedAt < where.startedAt.lt) &&
    (!where.expiresAt?.gt || job.expiresAt > where.expiresAt.gt) && (!where.completedAt?.gt || job.completedAt && job.completedAt > where.completedAt.gt);
  const tx = { $queryRaw: async () => [], paymentDiagnosticCapture: {
    count: async ({ where }) => jobs.filter(j => matches(j, where)).length,
    create: async ({ data }) => { const job = { ...data, status: "QUEUED", createdAt: new Date() }; jobs.push(job); return job; },
    findFirst: async ({ where }) => jobs.find(j => matches(j, where)) || null,
    update: async ({ where, data }) => { const job = jobs.find(j => j.id === where.id); Object.assign(job, data); return { ...job }; },
    updateMany: async ({ where, data }) => { const targets = jobs.filter(j => matches(j, where)); for (const j of targets) Object.assign(j, data); return { count: targets.length }; },
  }, activityLog: { create: async () => { if (auditFailure) throw new Error("Offline audit write failed"); } } };
  const prisma = { payment: { findFirst: async () => ({ id: 71, provider: "EPS" }) }, $transaction: fn => {
    const result = pending.then(async () => { const before = structuredClone(jobs); try { return await fn(tx); } catch (e) { jobs = before; throw e; } });
    pending = result.catch(() => {}); return result;
  } };
  const capture = load("lib/payment-control/capture.ts", { "@/generated/prisma": { Prisma: { sql: () => ({}) } }, "@/lib/prisma": { prisma },
    "./authorization": { PaymentControlError: ControlError }, "./capture-policy": { approvedCaptureIps: () => ["8.8.8.8"], captureOperations: ["AUTH", "INITIALIZE"],
      requireCaptureEnabled: () => ({ seconds: 30, bytes: 65536, retentionDays: 7 }) } }, { process: { env: { PAYMENT_CAPTURE_AGENT_ID: "fixture-agent" } } });
  await assert.rejects(capture.requestCapture({ paymentId: 71, kind: "READINESS", operation: "AUTH" }, "staff")); assert.equal(jobs.length, 0);
  auditFailure = false;
  await capture.requestCapture({ paymentId: 71, kind: "READINESS", operation: "AUTH" }, "staff");
  const results = await Promise.all([capture.claimCaptureJob("fixture-agent"), capture.claimCaptureJob("fixture-agent")]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(jobs[0].status, "RUNNING");
  jobs[0].status = "FAILED";
  await capture.requestCapture({ paymentId: 71, kind: "CAPTURE", operation: "INITIALIZE" }, "staff");
  assert.equal(await capture.claimCaptureJob("fixture-agent"), null);
  assert.equal(jobs[1].errorCode, "READINESS_REQUIRED");
});
function retentionFixture(failFile = false) {
  const calls = [];
  const prisma = { paymentDiagnosticCapture: {
    findMany: async query => { calls.push(["captureScan", query.take]); return [{ id: requestId }]; },
    delete: async query => { calls.push(["captureMetadataDelete", query.where.id]); },
  }, paymentEvent: {
    findMany: async query => { assert.equal(query.where.operation, "FRONTEND"); assert.equal(query.take, 1000); return [{ id: "expired-client-report" }]; },
    deleteMany: async query => { assert.equal(query.where.operation, "FRONTEND"); assert.equal(query.where.id.in[0], "expired-client-report"); calls.push(["frontendDelete"]); return { count: 1 }; },
  } };
  const route = load("app/api/cron/payment-diagnostics-retention/route.ts", { "next/server": { NextResponse: Response },
    "@/lib/prisma": { prisma }, "@/lib/payment-control/diagnostic-policy": { diagnosticLimits: () => ({ retentionDays: 7 }) },
    "@/lib/payment-control/capture-storage": { deleteCaptureEvidence: async id => { assert.equal(id, requestId); if (failFile) throw new Error("Storage unavailable"); calls.push(["fileDelete", id]); } },
  }, { process: { env: { CRON_SECRET: "OFFLINE_CRON_SECRET" } } });
  return { route, calls };
}
test("retention requires cron authorization and deletes only bounded diagnostic records after their files", async () => {
  const { route, calls } = retentionFixture();
  assert.equal((await route.GET(new Request("https://shop.example/api/cron"))).status, 401); assert.equal(calls.length, 0);
  const result = await route.GET(new Request("https://shop.example/api/cron", { headers: { authorization: "Bearer OFFLINE_CRON_SECRET" } }));
  assert.equal(result.status, 200); assert.equal((await result.json()).deletedFrontendEvents, 1);
  assert.deepEqual(calls.map(c => c[0]), ["captureScan", "fileDelete", "captureMetadataDelete", "frontendDelete"]);
});
test("retention storage failure cannot delete evidence metadata or server payment history", async () => {
  const { route, calls } = retentionFixture(true);
  const result = await route.GET(new Request("https://shop.example/api/cron", { headers: { authorization: "Bearer OFFLINE_CRON_SECRET" } }));
  assert.equal(result.status, 503); assert.deepEqual(calls.map(c => c[0]), ["captureScan"]);
});
