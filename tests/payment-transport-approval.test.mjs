import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { transportConfiguration, transportScopeAllowed } from "../lib/payment-control/transport-config.ts";
import { TransportObserver, approvedTransportOrigin } from "../lib/payment-control/transport-observer.ts";
import { loadTransportSource } from "./helpers/payment-transport-uat.mjs";

const approved = { NODE_ENV: "test", PAYMENT_TRANSPORT_MONITORING_MODE: "instrumented", PAYMENT_TRANSPORT_STORAGE_ENABLED: "true",
  PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: "true", PAYMENT_TRANSPORT_ALLOWED_PROVIDERS: "AIBL_WALLET", PAYMENT_TRANSPORT_ALLOWED_OPERATIONS: "AUTH" };
const config = (env = approved, node = "24.22.1", undici = "7.30.1") => transportConfiguration(env, node, undici);
test("no default providers or operations can be approved implicitly", () => {
  assert.equal(config({ NODE_ENV: "test" }).mode, "off");
  assert.equal(config({ ...approved, PAYMENT_TRANSPORT_ALLOWED_PROVIDERS: undefined }).mode, "off");
  assert.equal(config({ ...approved, PAYMENT_TRANSPORT_ALLOWED_OPERATIONS: undefined }).mode, "off");
  const value = config(); assert.equal(value.mode, "instrumented");
  assert.equal(transportScopeAllowed(value, "AIBL_WALLET", "AUTH"), true);
  for (const provider of ["EPS", "SSLCOMMERZ"]) for (const op of ["AUTH", "INITIALIZE", "VERIFY", "STATUS_QUERY"]) assert.equal(transportScopeAllowed(value, provider, op), false);
  for (const op of ["INITIALIZE", "VERIFY", "STATUS_QUERY"]) assert.equal(transportScopeAllowed(value, "AIBL_WALLET", op), false);
});
test("patched runtime is checked independently of the installed npm Agent", () => {
  for (const [node, undici] of [["24.13.0", "7.18.2"], ["24.22.0", "7.30.1"], ["24.22.1", "7.18.2"],
    ["24.22.1", undefined], ["25.0.0", "7.30.1"], ["24.22.1-rc.1", "7.30.1"]]) {
    // undefined explicitly models a missing runtime field rather than using the process default.
    const value = transportConfiguration(approved, node, undici ?? ""); assert.equal(value.mode, "off");
  }
  assert.equal(config().mode, "instrumented");
});
for (const [key, values] of [
  ["PAYMENT_TRANSPORT_MONITORING_MODE", ["INSTRUMENTED", "unknown", ""]],
  ["PAYMENT_TRANSPORT_STORAGE_ENABLED", ["yes", "1", "TRUE", "false", undefined]],
  ["PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED", ["yes", "1", "TRUE", "false", undefined]],
  ["PAYMENT_TRANSPORT_ALLOWED_PROVIDERS", [undefined, "", "*", "aibl_wallet", "AIBL_WALLET,", "AIBL_WALLET,EPS_UNKNOWN", "AIBL_WALLET,AIBL_WALLET"]],
  ["PAYMENT_TRANSPORT_ALLOWED_OPERATIONS", [undefined, "", "*", "auth", "AUTH,", "AUTH,REFUND", "AUTH,AUTH"]],
]) test(`invalid/missing ${key} fails closed`, () => {
  for (const value of values) assert.equal(config({ ...approved, [key]: value }).mode, "off");
});
test("proxy and insecure TLS restrictions remain enforced", () => {
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) assert.equal(config({ ...approved, [key]: "SYNTHETIC_PROXY" }).mode, "off");
  for (const extra of [{ NODE_USE_ENV_PROXY: "1" }, { NODE_OPTIONS: "--use-env-proxy" }, { NODE_TLS_REJECT_UNAUTHORIZED: "0" }]) assert.equal(config({ ...approved, ...extra }).mode, "off");
});
test("mode, storage, approval and scope flag combinations fail closed", () => {
  for (const mode of ["off", "passive", "instrumented"]) for (const storage of [undefined, "false", "true"])
    for (const approval of [undefined, "false", "true"]) for (const provider of [undefined, "AIBL_WALLET", "*"])
      for (const operation of [undefined, "AUTH", "*"]) {
        const value = config({ ...approved, PAYMENT_TRANSPORT_MONITORING_MODE: mode,
          PAYMENT_TRANSPORT_STORAGE_ENABLED: storage, PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: approval,
          PAYMENT_TRANSPORT_ALLOWED_PROVIDERS: provider, PAYMENT_TRANSPORT_ALLOWED_OPERATIONS: operation });
        const expected = mode !== "off" && storage === "true" && provider === "AIBL_WALLET" && operation === "AUTH" &&
          (mode === "passive" || approval === "true");
        assert.equal(value.mode !== "off", expected);
      }
});
test("AIBL-only scope leaves unapproved providers and operations on original native fetch", async () => {
  let subscriptions = 0; let agents = 0; let writes = 0; let fetches = 0;
  const monitor = loadTransportSource("lib/payment-control/transport-monitor.ts", {
    "server-only": {}, "./transport-observer": { TransportObserver, approvedTransportOrigin },
    "./transport-storage": { enqueueTransportEvidence() { writes++; } },
    "./transport-config": { transportConfiguration: config, transportScopeAllowed },
    "./transport-diagnostics": { createDiagnosticSubscriptions: () => ({}), ensureDiagnosticSubscriptions: () => { subscriptions++; return true; } },
    "./transport-connector": { createInstrumentedAgent() { agents++; return {}; } },
  });
  const response = { ok: true, status: 200 };
  const telemetry = loadTransportSource("lib/payment-control/telemetry.ts", {
    "server-only": {}, "node:crypto": { randomUUID }, "./transport-monitor": monitor,
    "@/lib/prisma": { prisma: { paymentEvent: { create: async () => {} } } },
  }, { AbortSignal, fetch: async (_url, init) => {
    fetches++; assert.equal("dispatcher" in init, false); assert.equal(init.body, "SYNTHETIC_BODY");
    assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.ok(init.signal instanceof AbortSignal); return response;
  } });
  for (const [provider, url, operation] of [
    ["EPS", "https://sandboxpgapi.eps.com.bd", "AUTH"], ["SSLCOMMERZ", "https://securepay.sslcommerz.com", "INITIALIZE"],
    ["AIBL_WALLET", "https://iwtest.aibl.com.bd", "STATUS_QUERY"],
  ]) assert.equal(await telemetry.paymentFetch({ provider }, operation, url,
    { method: "POST", body: "SYNTHETIC_BODY", cache: "no-store", redirect: "error", timeoutMs: 20000 }), response);
  assert.equal(fetches, 3); assert.equal(subscriptions, 0); assert.equal(agents, 0); assert.equal(writes, 0);
  const capture = await monitor.beginPaymentTransport("AIBL_WALLET", "AUTH", randomUUID(), "https://iwtest.aibl.com.bd");
  assert.ok(capture); assert.equal(subscriptions, 1);
  assert.ok(await monitor.paymentTransportDispatcher(capture)); assert.equal(agents, 1);
  capture.finish(); assert.equal(writes, 1);
});
