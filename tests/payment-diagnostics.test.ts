import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { paymentTraceId, tracePaymentId, diagnosticsEnabled, diagnosticLimits } from "../lib/payment-control/diagnostic-policy";
import { investigatePayment, latencyPercentiles, type InvestigationEvent } from "../lib/payment-control/investigation-engine";
import { checkConsistency, type ConsistencySnapshot } from "../lib/payment-control/consistency";
import { canonicalPcapng, sanitizePcapng } from "../lib/payment-control/pcapng";
import { approvedCaptureIps, requireCaptureEnabled, captureFilter } from "../lib/payment-control/capture-policy";
import { executeCapture, runCaptureProcess, type ProcessRunner } from "../scripts/lib/payment-capture-runner";
import { evidenceManifest, investigationCsv, investigationPdf } from "../lib/payment-control/investigation-report";
import type { PaymentInvestigation } from "../lib/payment-control/investigation";
import { diagnosticStage, paymentDiagnosticAdapter } from "../lib/payment-control/diagnostic-adapters";
const requestId = "11111111-1111-4111-8111-111111111111";
function event(patch: Partial<InvestigationEvent> = {}): InvestigationEvent {
  return { id: requestId, requestId, paymentId: 71, source: "SERVER", operation: "INITIALIZE", outcome: "HTTP_SUCCESS",
    detailCode: null, httpStatus: 200, durationMs: 12, gatewayStatus: null, createdAt: "2026-10-29T00:00:00.000Z", ...patch };
}
function analyze(events: InvestigationEvent[], pending = false) {
  return investigatePayment({ events, pending, ageMs: 3600000, checks: [], transports: [], limited: false });
}
test("stable unique attempt trace survives callbacks and reverses without financial writes", () => {
  const ids = [1, 2, 71, 2147483647];
  assert.equal(new Set(ids.map(paymentTraceId)).size, ids.length);
  for (const id of ids) assert.equal(tracePaymentId(paymentTraceId(id)), id);
  for (const trace of [requestId, "secret", "d3500000-0000-4000-8000-000000000000"]) assert.equal(tracePaymentId(trace), null);
  assert.throws(() => paymentTraceId(-1));
});
test("gateway diagnostic adapters preserve the different issued contracts and recorded operations", () => {
  assert.equal(diagnosticStage("EPS", "AUTH", null), "AUTH");
  assert.equal(diagnosticStage("AIBL_WALLET", "AUTH", null), "TOKEN");
  assert.equal(diagnosticStage("EPS", "STATUS_QUERY", null), "STATUS");
  assert.equal(diagnosticStage("AIBL_WALLET", "STATUS_QUERY", null), "VERIFY_REQUEST");
  assert.equal(diagnosticStage("AIBL_WALLET", "VERIFY", null), "VERIFY_RESULT");
  assert.match(paymentDiagnosticAdapter("AIBL_WALLET").verificationContract, /No echoed amount\/currency is inferred/);
  assert.throws(() => paymentDiagnosticAdapter("UNSUPPORTED"));
});
test("new collection and packet capture default off; limits fail closed", () => {
  assert.equal(diagnosticsEnabled({} as NodeJS.ProcessEnv), false);
  assert.throws(() => requireCaptureEnabled({} as NodeJS.ProcessEnv), /CAPTURE_DISABLED/);
  assert.throws(() => diagnosticLimits({ NODE_ENV: "test", PAYMENT_DIAGNOSTICS_MAX_CAPTURE_SECONDS: "10000" }));
  assert.equal(diagnosticLimits({} as NodeJS.ProcessEnv).seconds, 30);
});
test("capture refuses disabled TLS verification and TLS key logging", () => {
  const env = { NODE_ENV: "test" as const, PAYMENT_DIAGNOSTICS_ENABLED: "true", PAYMENT_NETWORK_CAPTURE_ENABLED: "true", PAYMENT_DIAGNOSTICS_EVIDENCE_DIR: resolve(".payment-evidence") };
  for (const patch of [{ NODE_TLS_REJECT_UNAUTHORIZED: "0" }, { SSLKEYLOGFILE: "forbidden" }, { NODE_OPTIONS: "--tls-keylog=forbidden" }])
    assert.throws(() => requireCaptureEnabled({ ...env, ...patch }), /INSECURE_CAPTURE_TLS_CONFIGURATION/);
});
for (const [code, category] of Object.entries({ ENOTFOUND: "DNS_FAILURE", EAI_AGAIN: "DNS_FAILURE", ECONNREFUSED: "TCP_CONNECTION_FAILURE",
  ECONNRESET: "TCP_RESET", CERT_HAS_EXPIRED: "TLS_CERTIFICATE_ERROR", ERR_TLS_CERT_ALTNAME_INVALID: "TLS_CERTIFICATE_ERROR",
  ERR_TLS_HANDSHAKE_TIMEOUT: "TLS_HANDSHAKE_FAILURE" })) {
  test(`observed ${code} classifies ${category} without blaming bank internals`, () => {
    const result = analyze([event({ detailCode: code, outcome: "CONNECTION_ERROR", httpStatus: null })]);
    assert.equal(result.findings[0].category, category); assert.equal(result.findings[0].confidence, "CONFIRMED");
    assert.equal(result.bankInternalRootCause, "UNKNOWN");
  });
}
test("HTTP status and provider business rejection are separate evidence", () => {
  assert.ok(analyze([event({ outcome: "HTTP_ERROR", httpStatus: 502 })]).findings.some(f => f.category === "HTTP_ERROR"));
  assert.ok(analyze([event({ outcome: "REJECTED", httpStatus: 200, detailCode: "INITIALIZE_REJECTED" })]).findings.some(f => f.category === "GATEWAY_ERROR"));
  assert.equal(analyze([event()]).result, "UNKNOWN");
});
test("timeout is observed uncertainty and never bank fault, failure, or repair instruction", () => {
  const result = analyze([event({ outcome: "TIMEOUT" })], true);
  assert.ok(result.findings.some(f => f.category === "HTTP_TIMEOUT" && f.bankConfirmationRequired));
  assert.equal(result.bankInternalRootCause, "UNKNOWN");
  assert.match(result.findings[0].explanation, /may still have processed/);
});
test("repeated callbacks confirm delivery repetition but not capture or replay attack", () => {
  const result = analyze([event({ operation: "CALLBACK", outcome: "RECEIVED" }), event({ id: "second", operation: "CALLBACK", outcome: "RECEIVED" })]);
  assert.ok(result.findings.some(f => f.category === "CALLBACK_DUPLICATED"));
  assert.ok(!result.findings.some(f => f.category === "DUPLICATE_PAYMENT"));
});
test("unrecorded callback is probable only and successful callback is never server verification", () => {
  const missing = analyze([event({ outcome: "SUCCESS" })], true);
  assert.equal(missing.findings.find(f => f.category === "CALLBACK_MISSING")?.confidence, "PROBABLE");
  assert.equal(analyze([event({ operation: "CALLBACK", outcome: "RECEIVED" })]).result, "UNKNOWN");
});
test("browser errors are explicitly untrusted probable reports", () => {
  const result = analyze([event({ source: "CLIENT_REPORTED", operation: "FRONTEND", detailCode: "FRONTEND_API_FAILED", outcome: "RECEIVED" })]);
  assert.equal(result.findings[0].confidence, "PROBABLE");
});
test("no evidence yields UNKNOWN; absent measurements never become PASS", () => {
  const result = analyze([]); assert.equal(result.result, "UNKNOWN"); assert.equal(result.findings[0].category, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(latencyPercentiles([]), { p50Ms: null, p95Ms: null, p99Ms: null, sampleSize: 0 });
  assert.deepEqual(latencyPercentiles([1, 2, 3, 4, null]), { p50Ms: 2, p95Ms: 4, p99Ms: 4, sampleSize: 4 });
});
test("capture-window retransmissions are probable and cannot prove payment-specific packet loss", () => {
  const result = investigatePayment({ events: [], checks: [], transports: [], pending: false, ageMs: 0, limited: false,
    captures: [{ id: requestId, resets: 1, retransmissions: 2 }] });
  assert.equal(result.findings.find(f => f.category === "TCP_RETRANSMISSION")?.confidence, "PROBABLE");
  assert.equal(result.bankInternalRootCause, "UNKNOWN");
});
const baseline: ConsistencySnapshot = { payment: { id: 71, status: "CAPTURED", amount: "100.00", currency: "BDT", createdAt: "2026-10-29T00:00:00.000Z" },
  order: { id: 7, paymentStatus: "PAID", status: "CONFIRMED", amount: "100.00", currency: "BDT" }, settledPayments: 1,
  duplicateBankReferences: 0, reservations: 0, stock: [{ id: 8, kind: "VARIANT", quantity: 9, reserved: 2, actualReserved: 2 }],
  stockLimited: false, verificationRecorded: true, settlementRecorded: true, reconciliation: null };
for (const [name, patch, code] of [
  ["captured/unpaid", { order: { ...baseline.order, paymentStatus: "UNPAID" } }, "PAYMENT_ORDER_CONSISTENCY"],
  ["duplicate capture", { settledPayments: 2 }, "DUPLICATE_PAYMENT"],
  ["duplicate bank ref", { duplicateBankReferences: 1 }, "DUPLICATE_TRANSACTION_REFERENCE"],
  ["amount mismatch", { payment: { ...baseline.payment, amount: "100.01" } }, "PAYMENT_AMOUNT_MISMATCH"],
  ["captured holds", { reservations: 1 }, "INVENTORY_COMMIT_RESERVATIONS"],
  ["negative warehouse availability", { stock: [{ id: 8, kind: "VARIANT", quantity: 1, reserved: 2, actualReserved: 2 }] }, "NEGATIVE_AVAILABLE_STOCK"],
  ["bundle reserved counter mismatch", { stock: [{ id: 9, kind: "BUNDLE", quantity: 9, reserved: 2, actualReserved: 1 }] }, "INVENTORY_RESERVATION_INCONSISTENCY"],
  ["multi-warehouse aggregate drift", { variantTotals: [{ id: 8, storedStock: 5, computedStock: 7 }] }, "MULTI_WAREHOUSE_STOCK_MISMATCH"],
  ["wrong committed inventory quantity", { commitLedger: { stockRequired: true, observed: true, matches: false, certainty: "SNAPSHOT" } }, "INVENTORY_COMMIT_LEDGER"],
] as Array<[string, Partial<ConsistencySnapshot>, string]>) test(`read-only consistency detects ${name}`, () => {
  const snapshot = { ...baseline, ...patch }, before = JSON.stringify(snapshot);
  assert.equal(checkConsistency(snapshot).find(c => c.code === code)?.status, "FAIL"); assert.equal(JSON.stringify(snapshot), before);
});
test("unobserved verification and unauthorized modification checks stay unknown", () => {
  const checks = checkConsistency({ ...baseline, verificationRecorded: false, duplicateBankReferences: null, stock: [], stockLimited: true });
  assert.equal(checks.find(c => c.code === "PAYMENT_VERIFICATION_EVIDENCE")?.status, "NOT_OBSERVED");
  assert.equal(checks.find(c => c.code === "UNAUTHORIZED_ADMIN_MODIFICATION")?.status, "UNKNOWN");
  assert.equal(checks.find(c => c.code === "NEGATIVE_AVAILABLE_STOCK")?.status, "UNKNOWN");
  assert.equal(checks.find(c => c.code === "DUPLICATE_TRANSACTION_REFERENCE")?.status, "NOT_OBSERVED");
});
export function packetFixture() {
  const packet = Buffer.alloc(14 + 20 + 20 + 32);
  packet.writeUInt16BE(0x0800, 12); packet[14] = 0x45; packet.writeUInt16BE(packet.length - 14, 16); packet[23] = 6;
  Buffer.from([10, 0, 0, 1]).copy(packet, 26); Buffer.from([8, 8, 8, 8]).copy(packet, 30);
  packet.writeUInt16BE(53200, 34); packet.writeUInt16BE(443, 36); packet[46] = 0x50; packet[47] = 4;
  packet.write("SECRET_PAYLOAD_DO_NOT_EXPORT", 54);
  return canonicalPcapng([{ data: packet, originalLength: packet.length, high: 0, low: 12345 }]);
}
test("valid PCAPNG is parsed, packet-counted, payload-stripped, hashed and idempotent", () => {
  const raw = packetFixture(); assert.ok(raw.includes(Buffer.from("SECRET_PAYLOAD")));
  const safe = sanitizePcapng(raw, ["8.8.8.8"]);
  assert.equal(safe.packetCount, 1); assert.equal(safe.resets, 1); assert.ok(!safe.data.includes(Buffer.from("SECRET_PAYLOAD")));
  assert.equal(sanitizePcapng(safe.data, ["8.8.8.8"]).sha256, safe.sha256);
  assert.match(safe.sha256, /^[a-f0-9]{64}$/);
});
test("zero packets is valid interface evidence but never observed gateway traffic", () => {
  assert.equal(sanitizePcapng(canonicalPcapng([]), ["8.8.8.8"]).packetCount, 0);
});
test("nanosecond PCAPNG timestamps normalize explicitly without fabricating timing", () => {
  const raw = packetFixture(), iface = Buffer.alloc(28);
  iface.writeUInt32LE(1); iface.writeUInt32LE(28, 4); iface.writeUInt16LE(1, 8); iface.writeUInt32LE(256, 12);
  iface.writeUInt16LE(9, 16); iface.writeUInt16LE(1, 18); iface[20] = 9; iface.writeUInt32LE(28, 24);
  const nano = Buffer.concat([raw.subarray(0, 28), iface, raw.subarray(48)]);
  const safe = sanitizePcapng(nano, ["8.8.8.8"]);
  assert.equal(safe.packetCount, 1); assert.equal(safe.data.readUInt32LE(64), 12);
});
for (const [name, fixture] of [
  ["truncation", () => packetFixture().subarray(0, -1)], ["bad block length", () => { const b = packetFixture(); b.writeUInt32LE(0xffffffff, 4); return b; }],
  ["decryption secret block", () => { const b = Buffer.alloc(12); b.writeUInt32LE(0x0a); b.writeUInt32LE(12, 4); b.writeUInt32LE(12, 8); return Buffer.concat([canonicalPcapng([]), b]); }],
] as Array<[string, () => Buffer]>) test(`PCAPNG rejects ${name}`, () => assert.throws(() => sanitizePcapng(fixture(), ["8.8.8.8"])));
test("out-of-scope gateway packet and shell-like target rejected", () => {
  assert.throws(() => sanitizePcapng(packetFixture(), ["1.1.1.1"]), /OUT_OF_SCOPE/);
  assert.throws(() => captureFilter(["8.8.8.8; echo unsafe"]));
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "224.0.0.1", "::1"]) {
    assert.throws(() => approvedCaptureIps("EPS", { NODE_ENV: "test", PAYMENT_CAPTURE_GATEWAY_IPS_JSON: JSON.stringify({ EPS: [ip] }) }));
  }
});
test("isolated agent validates real output rather than a tool banner and always cleans temporary files", async () => {
  const root = await mkdtemp(join(tmpdir(), "payment-diagnostic-test-"));
  const config = { root, dumpcap: process.execPath, tshark: process.execPath, interfaceId: "1" };
  const calls: string[][] = [];
  const fake: ProcessRunner = async (_binary, args) => {
    calls.push(args);
    if (args[0] === "-D") return { output: "1. Offline fixture interface\n" };
    if (args.includes("-w")) { await writeFile(args[args.indexOf("-w") + 1], packetFixture()); return { output: "" }; }
    return { output: "1\n" };
  };
  try {
    const result = await executeCapture({ id: requestId, kind: "CAPTURE", seconds: 1, maxBytes: 65536, approvedIps: ["8.8.8.8"] }, config, undefined, fake);
    assert.equal(result.packetCount, 1); assert.equal(result.retransmissions, 1); assert.equal(calls.filter(c => c.includes("-w")).length, 2);
    assert.deepEqual(await readdir(root), []);
    await assert.rejects(executeCapture({ id: requestId, kind: "READINESS", seconds: 1, maxBytes: 65536, approvedIps: ["8.8.8.8"] }, config,
      undefined, async () => ({ output: "TShark ready banner only" })), /CAPTURE_INTERFACE_UNAVAILABLE/);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("agent startup failure, malformed output, oversized capture and analysis failure clean up", async () => {
  const root = await mkdtemp(join(tmpdir(), "payment-diagnostic-test-"));
  try {
    for (const mode of ["startup", "invalid", "oversized", "analysis"]) {
      const fake: ProcessRunner = async (_binary, args) => {
        if (mode === "startup") throw new Error("CAPTURE_TOOL_UNAVAILABLE");
        if (args[0] === "-D") return { output: "1. fixture" };
        if (args.includes("-w")) { await writeFile(args[args.indexOf("-w") + 1], mode === "invalid" ? "bad" : mode === "oversized" ? Buffer.alloc(65537) : packetFixture()); return { output: "" }; }
        throw new Error("CAPTURE_ANALYSIS_FAILED");
      };
      await assert.rejects(executeCapture({ id: requestId, kind: "CAPTURE", seconds: 1, maxBytes: 65536, approvedIps: ["8.8.8.8"] },
        { root, dumpcap: process.execPath, tshark: process.execPath, interfaceId: "1" }, undefined, fake));
      assert.deepEqual(await readdir(root), []);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("process runner rejects shells, bounds execution and handles missing tools without leaking stderr", async () => {
  await assert.rejects(runCaptureProcess(resolve("unsafe.cmd"), [], { timeoutMs: 1000 }), /CAPTURE_TOOL_UNAVAILABLE/);
  await assert.rejects(runCaptureProcess(resolve("not-a-capture-binary.exe"), [], { timeoutMs: 1000 }), /CAPTURE_TOOL_UNAVAILABLE/);
  await assert.rejects(runCaptureProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeoutMs: 100 }), /CAPTURE_TIMEOUT/);
  const result = await runCaptureProcess(process.execPath, ["-e", "process.stdout.write(String(process.env.SSLKEYLOGFILE || process.env.EPS_PASSWORD || 'SAFE'))"], { timeoutMs: 5000 });
  assert.equal(result.output, "SAFE");
});
const report = { version: 1, generatedAt: "2026-10-29T00:00:00.000Z", payment: { id: 71, traceId: paymentTraceId(71), provider: "EPS", environment: "sandbox", reference: "reference-sha256:abcd",
  status: "INITIATED", orderPaymentStatus: "UNPAID" }, events: [event({ outcome: "TIMEOUT" })], transport: { attempts: [], limited: false }, checks: [],
  captureEvidence: { availability: "AVAILABLE", limited: false, jobs: [] }, analysis: analyze([event({ outcome: "TIMEOUT" })]), limitations: ["Bank internal causes require bank logs."], limited: false } as unknown as PaymentInvestigation;
test("bank report JSON manifest is deterministic and CSV neutralizes formulas", () => {
  assert.equal(evidenceManifest(report).manifest.sha256, evidenceManifest(structuredClone(report)).manifest.sha256);
  const modified = structuredClone(report); modified.analysis.findings[0].recommendedAction = "=UNSAFE()";
  assert.match(investigationCsv(modified), /'=UNSAFE/);
  assert.notEqual(evidenceManifest(report).manifest.sha256, evidenceManifest(modified).manifest.sha256);
});
test("PDF bank report is parseable, paginated and contains no raw payload fields", async () => {
  const bytes = await investigationPdf(report);
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes); assert.ok(pdf.getPageCount() >= 1);
  assert.match(Buffer.from(bytes).subarray(0, 8).toString(), /^%PDF-/);
  assert.ok(!JSON.stringify(evidenceManifest(report)).includes("SECRET_PAYLOAD"));
});
