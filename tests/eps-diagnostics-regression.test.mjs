// Real EPS provider functions with isolated in-memory transport and transactions.
// No dotenv, native Prisma engine, real bank request or production data access.
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import ts from "typescript";
const tran = "17000000000001234567890";
function fixture(options = {}) {
  const events = [], calls = [];
  let inside = false, locked = false, queue = Promise.resolve();
  let state = { payment: { id: 800001, orderId: 900001, provider: "EPS", externalId: tran, amount: "100.00", currency: "BDT", status: "INITIATED",
    paymentGatewayData: { gatewayId: 17, inventoryMode: "RESERVATION" } }, order: { id: 900001, paymentStatus: "UNPAID", status: "PENDING",
    payment_method: "EPS:17", currency: "BDT", grand_total: "100.00", orderItems: [{ productId: 501, variantId: 601, quantity: 2,
      product: { type: "PHYSICAL" }, bundleComponents: [] }] }, quantity: 8, reserved: 2, commits: 0, captures: 0, notifications: 0,
    holds: [{ quantity: 2, stockLevel: { productVariantId: 601 } }] };
  const copy = value => structuredClone(value);
  const guard = () => assert.ok(inside && locked, "All financial writes require the simulated order lock");
  const tx = { $queryRaw: async () => { assert.ok(inside); locked = true; }, payment: {
    findUniqueOrThrow: async () => copy(state.payment),
    findFirst: async () => options.otherCapture ? ({ id: 99 }) : null,
    count: async () => 0,
    update: async ({ data }) => { guard(); if (data.status === "CAPTURED") state.captures++; Object.assign(state.payment, copy(data)); },
  }, order: { findUniqueOrThrow: async () => copy(state.order), update: async ({ data }) => { guard(); Object.assign(state.order, copy(data)); } },
    inventoryReservation: { findMany: async () => copy(state.holds) }, bundleStockReservation: { findMany: async () => [] },
  };
  const prisma = { payment: { findUnique: async () => copy(state.payment), findFirst: async () => ({ paymentGatewayData: {
    failureStatuses: ["BANK_FINAL_FAILURE"], cancellationStatuses: ["BANK_FINAL_CANCEL"] } }) },
    $transaction: fn => {
      const pending = queue.then(async () => {
        const before = copy(state); inside = true; locked = false;
        try { return await fn(tx); } catch (error) { state = before; throw error; } finally { inside = false; locked = false; }
      });
      queue = pending.catch(() => {}); return pending;
    },
  };
  const env = { EPS_ENV: "sandbox", EPS_USERNAME: "OFFLINE_USER", EPS_PASSWORD: "NOT_A_REAL_PASSWORD", EPS_HASH_KEY: "NOT_A_REAL_KEY",
    EPS_MERCHANT_ID: "OFFLINE_MERCHANT", EPS_STORE_ID: "OFFLINE_STORE", NEXTAUTH_SECRET: "OFFLINE_SIGNING_SECRET" };
  const imports = {
    "server-only": {}, "node:crypto": crypto, "@/generated/prisma": { Prisma: { sql: () => ({}) }, OrderStatus: { CANCELLED: "CANCELLED", FAILED: "FAILED" } },
    "@/lib/prisma": { prisma }, "@/lib/inventory": { commitOrderInventoryReservations: async () => {
      guard(); state.commits++; state.quantity -= state.reserved; state.reserved = 0; state.holds = [];
      return { committedQuantity: 2, committedBundleQuantity: 0 };
    } }, "@/lib/order-inventory-lifecycle": { transitionOrderStatusWithInventory: async ({ nextStatus }) => { guard(); state.order.status = nextStatus; state.reserved = 0; state.holds = []; return { changed: true }; } },
    "@/lib/order-admin-notifications": { createOrderAdminNotifications: async () => { guard(); if (options.failAfterCommit) throw new Error("OFFLINE_TRANSACTION_FAILURE"); state.notifications++; } },
    "@/lib/business-network/commission": { syncCommissionEntriesForOrderStatus: async () => {} }, "@/lib/eps-settings": { epsObject: v => v && typeof v === "object" && !Array.isArray(v) ? v : {} },
    "@/lib/seo-url": { resolveSeoSiteUrl: () => "https://shop.example" },
    "@/lib/payment-control/telemetry": { recordPaymentEvent: async e => { events.push(e); }, paymentFetch: async (context, operation, input, init) => {
      calls.push({ context, operation, input, init });
      if (options.networkFailure) throw new Error("OFFLINE_TIMEOUT");
      if (options.httpFailure) return new Response(null, { status: 502 });
      const body = operation === "AUTH" ? options.auth ?? { token: "OFFLINE_TOKEN" }
        : operation === "INITIALIZE" ? options.initialize ?? { RedirectURL: "https://sandbox.eps.com.bd/payment/fixture", TransactionId: "OFFLINE_BANK_REF" }
          : options.verify ?? { MerchantTransactionId: tran, TotalAmount: "100.00", Status: "Success" };
      return new Response(options.invalidJson ? "not JSON" : JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    } },
  };
  const commonJsModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL("../lib/eps.ts", import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new vm.Script(source).runInContext(vm.createContext({ module: commonJsModule, exports: commonJsModule.exports, process: { env }, Buffer, Date, Map, Set, URL, Response,
    require(name) { if (!(name in imports)) throw new Error("Offline boundary blocked " + name); return imports[name]; } }));
  const eps = commonJsModule.exports;
  state.payment.paymentGatewayData.accountFingerprint = eps.epsConfig().accountFingerprint;
  return { eps, events, calls, state: () => state };
}
test("EPS AUTH and INITIALIZE retain issued field casing, HMAC and hosted redirect validation", async () => {
  const h = fixture();
  assert.equal(await h.eps.getEpsToken({ paymentId: 800001 }), "OFFLINE_TOKEN");
  const body = h.eps.buildEpsInitializeBody({ id: 900001, name: "Offline", email: "offline@example.invalid", phone_number: "00000000000",
    district: "Fixture", country: "Bangladesh", address_details: "Fixture", commercialContext: { epsPostcode: "0000" } }, tran, "100.00", "Fixture", {});
  assert.equal(body.merchantId, "OFFLINE_MERCHANT"); assert.equal(body.CustomerOrderId, `O900001-${tran}`); assert.equal(body.merchantTransactionId, tran);
  assert.equal((await h.eps.initializeEpsPayment(body, "OFFLINE_TOKEN", { paymentId: 800001 })).redirectUrl, "https://sandbox.eps.com.bd/payment/fixture");
  assert.equal(h.calls[0].operation, "AUTH"); assert.equal(h.calls[1].operation, "INITIALIZE");
  assert.equal(h.calls[0].init.redirect, "error"); assert.ok(h.calls[0].init.headers["x-hash"]);
  assert.throws(() => h.eps.epsRedirectUrl("http://attacker.example"));
});
for (const [name, options] of [["AUTH business rejection", { auth: { errorCode: "OFFLINE_REJECTION" } }], ["HTTP failure", { httpFailure: true }],
  ["timeout", { networkFailure: true }], ["invalid JSON", { invalidJson: true }]]) test(`EPS ${name} cannot settle or commit stock`, async () => {
  const h = fixture(options); await assert.rejects(h.eps.reconcileEpsPayment(tran));
  assert.equal(h.state().captures, 0); assert.equal(h.state().commits, 0); assert.equal(h.state().reserved, 2);
});
for (const [name, verify] of [["amount mismatch", { MerchantTransactionId: tran, TotalAmount: "99.99", Status: "Success" }],
  ["transaction mismatch", { MerchantTransactionId: "17000000000000000000000", TotalAmount: "100.00", Status: "Success" }],
  ["conflicting success/error", { MerchantTransactionId: tran, TotalAmount: "100.00", Status: "Success", ErrorCode: "OFFLINE_ERROR" }]])
  test(`EPS ${name} remains unpaid with original reservations`, async () => {
    const h = fixture({ verify }); await assert.rejects(h.eps.reconcileEpsPayment(tran), e => e.status === 409);
    assert.equal(h.state().payment.status, "INITIATED"); assert.equal(h.state().order.paymentStatus, "UNPAID"); assert.equal(h.state().reserved, 2);
  });
test("undocumented EPS success casing remains pending; no inferred terminal outcome", async () => {
  const h = fixture({ verify: { MerchantTransactionId: tran, TotalAmount: "100.00", Status: "SUCCESS" } });
  assert.equal((await h.eps.reconcileEpsPayment(tran)).status, "pending"); assert.equal(h.state().captures, 0); assert.equal(h.state().reserved, 2);
});
test("EPS callback/reconciliation race serializes, captures and commits exactly once", async () => {
  const h = fixture();
  const results = await Promise.all([h.eps.reconcileEpsPayment(tran), h.eps.reconcileEpsPayment(tran)]);
  assert.ok(results.every(r => r.status === "success")); assert.equal(h.state().captures, 1); assert.equal(h.state().commits, 1);
  assert.equal(h.state().quantity, 6); assert.equal(h.state().reserved, 0); assert.equal(h.state().order.paymentStatus, "PAID");
  assert.ok(h.events.some(e => e.operation === "SETTLEMENT" && e.outcome === "DUPLICATE"));
});
test("EPS post-commit database failure rolls back financial state and inventory together", async () => {
  const h = fixture({ failAfterCommit: true }); await assert.rejects(h.eps.reconcileEpsPayment(tran));
  assert.equal(h.state().captures, 0); assert.equal(h.state().commits, 0); assert.equal(h.state().quantity, 8); assert.equal(h.state().reserved, 2);
  assert.equal(h.state().order.paymentStatus, "UNPAID");
});
test("EPS rejects mismatched inventory identity and an already captured sibling payment", async () => {
  for (const mode of ["inventory", "sibling"]) {
    const h = fixture({ otherCapture: mode === "sibling" });
    if (mode === "inventory") h.state().holds[0].stockLevel.productVariantId = 999;
    await assert.rejects(h.eps.reconcileEpsPayment(tran), e => e.status === 409);
    assert.equal(h.state().captures, 0); assert.equal(h.state().commits, 0); assert.equal(h.state().reserved, 2);
  }
});
