import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

function loadTelemetry({ begin, dispatcher, persist, fetchMock }) {
  const code = ts.transpileModule(readFileSync(new URL("../lib/payment-control/telemetry.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsModule = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule, exports: commonJsModule.exports, process: { env: {} },
    Date, performance, AbortSignal, fetch: fetchMock, console: { warn() {} },
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return { randomUUID };
      if (name === "@/lib/prisma") return { prisma: { paymentEvent: { create: persist ?? (async () => {}) } } };
      if (name === "./transport-monitor") return { beginPaymentTransport: begin ?? (async () => null), paymentTransportDispatcher: dispatcher ?? (async () => undefined) };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  new vm.Script(code).runInContext(context);
  return commonJsModule.exports;
}
const context = { provider: "AIBL_WALLET", paymentId: 21, orderId: 20 };
const input = "https://iwtest.aibl.com.bd/iwPGAPI/PGService/Verify";

test("feature disabled uses original fetch once, original options and deadline, without a dispatcher", async () => {
  let calls = 0; const response = { ok: true, status: 200 };
  const { paymentFetch } = loadTelemetry({ fetchMock: async (url, options) => {
    calls += 1; assert.equal(url, input); assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error"); assert.equal(options.body, "synthetic-test-data");
    assert.ok(options.signal instanceof AbortSignal); assert.equal("dispatcher" in options, false); return response;
  } });
  assert.equal(await paymentFetch(context, "VERIFY", input, { method: "POST", redirect: "error", body: "synthetic-test-data", timeoutMs: 20000 }), response);
  assert.equal(calls, 1);
});
test("telemetry initialization, completion and storage failures cannot fail a successful HTTP operation", async () => {
  for (const mode of ["begin", "finish", "persist"]) {
    let calls = 0; const response = { ok: true, status: 200 };
    const { paymentFetch } = loadTelemetry({
      begin: async () => {
        if (mode === "begin") throw new Error("mock monitoring failure");
        return { run: (fn) => fn(), finish: () => { if (mode === "finish") throw new Error("mock telemetry failure"); } };
      },
      persist: async () => { if (mode === "persist") throw new Error("mock storage failure"); },
      fetchMock: async () => { calls += 1; return response; },
    });
    assert.equal(await paymentFetch(context, "VERIFY", input, { timeoutMs: 20000 }), response);
    assert.equal(calls, 1);
  }
});
test("opt-in dispatcher applies only to the scoped call and never retries on network failure", async () => {
  let calls = 0; let completedError; const customDispatcher = {};
  const original = Object.assign(new Error("synthetic refusal"), { code: "ECONNREFUSED" });
  const { paymentFetch } = loadTelemetry({
    begin: async () => ({ run: (fn) => fn(), finish: (error) => { completedError = error; } }),
    dispatcher: async () => customDispatcher,
    fetchMock: async (_url, options) => { calls += 1; assert.equal(options.dispatcher, customDispatcher); throw original; },
  });
  await assert.rejects(paymentFetch(context, "VERIFY", input, { timeoutMs: 20000 }), (error) => error === original);
  assert.equal(calls, 1); assert.equal(completedError, original);
});
test("original HTTP response status and payment result remain untouched by observations", async () => {
  const response = { ok: false, status: 503, syntheticPaymentOutcome: "PENDING" };
  const { paymentFetch } = loadTelemetry({
    begin: async () => ({ run: (fn) => fn(), finish: () => {} }),
    fetchMock: async () => response,
  });
  assert.equal(await paymentFetch(context, "VERIFY", input, { timeoutMs: 20000 }), response);
  assert.equal(response.syntheticPaymentOutcome, "PENDING");
});
