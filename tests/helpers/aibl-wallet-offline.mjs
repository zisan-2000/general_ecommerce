// Offline adapter for the real application functions, following the VM pattern
// in customer-order-history.test.mjs. No app imports, dotenv or PrismaClient.
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import prismaRuntime from "../../generated/prisma/runtime/library.js";

export const ORDER_ID = 900004; // Synthetic; never the real Order #4.
export const BILL = "AI1700000000000aaaaaaaaaaaaaaaa";
export const BANK_ORDER = "OFFLINE_BANK_ORDER";
export const BANK_TRANSACTION = "OFFLINE_BANK_TRANSACTION";
export const SUCCESS = Object.freeze({ code: 200, msg: "Order Verified", transactionID: BANK_TRANSACTION });

// Arithmetic constructor only: never import or instantiate PrismaClient/load environment files.
export const OfflineDecimal = prismaRuntime.Decimal;
function copy(value) {
  // Preserve the foreign constructor so mocked DB reads cannot hide cross-runtime identity bugs.
  if (OfflineDecimal.isDecimal(value)) return new value.constructor(value.toString());
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  return value;
}
class OfflineResponse extends Response {
  constructor(body, init) {
    super(body, init);
    this.cookieWrites = [];
    this.cookies = { set: (name, value, options) => this.cookieWrites.push({ name, value, options }) };
  }
  static redirect(url, status = 307) { return new OfflineResponse(null, { status, headers: { Location: String(url) } }); }
  static json(body, init = {}) { return new OfflineResponse(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json" } }); }
}
const compiled = new Map();
function sourceCode(path) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(
    readFileSync(new URL("../../" + path, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
  ).outputText);
  return compiled.get(path);
}

export function createOfflineAibl(t, options = {}) {
  const events = [];
  const bankRequests = [];
  const audit = { forbiddenEffects: 0, transactions: 0, rollbacks: 0, inventoryCommitCalls: 0 };
  const env = Object.freeze({
    NODE_ENV: "test", AIBL_WALLET_ENV: "uat",
    PAYMENT_TRANSPORT_MONITORING_MODE: "off", PAYMENT_TRANSPORT_STORAGE_ENABLED: "false",
    PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: "false",
    AIBL_WALLET_API_BASE_URL: "https://iwtest.aibl.com.bd/iwPGAPI/",
    AIBL_WALLET_HOSTED_BASE_URL: "https://iwtest.aibl.com.bd/iwepayuat/epayment/",
    AIBL_WALLET_API_USER: "OFFLINE_USER", AIBL_WALLET_API_PASS: "NOT_A_REAL_PASSWORD",
    AIBL_WALLET_MERCHANT_ID: "OFFLINE_MERCHANT", AIBL_WALLET_ACCESS_KEY: "NOT_A_REAL_ACCESS_KEY",
    NEXTAUTH_SECRET: "OFFLINE_SIGNING_KEY_NOT_FOR_DEPLOYMENT", NEXT_PUBLIC_APP_URL: "https://shop.example",
  });
  let state = {
    order: { id: ORDER_ID, payment_method: "AIBL_WALLET:17", paymentStatus: "UNPAID", status: "PENDING",
      currency: "BDT", grand_total: new OfflineDecimal("100.00"), fulfillmentWarehouseId: 7,
      orderItems: [{ productId: 501, variantId: 601, quantity: 2, product: { type: "PHYSICAL" }, bundleComponents: [] }] },
    payment: { id: 800004, orderId: ORDER_ID, provider: "AIBL_WALLET", externalId: BILL,
      status: "INITIATED", currency: "BDT", amount: new OfflineDecimal("100.00"), paymentGatewayData: {
        gatewayId: 17, bankOrderId: BANK_ORDER, initializationValidated: true,
        inventorySnapshot: { variants: [[1, 11, 601, 501, 7, 2]], bundles: [] },
      } },
    reservations: [{ id: 1, orderId: ORDER_ID, stockLevelId: 11, quantity: 2 }],
    stock: { id: 11, warehouseId: 7, productVariantId: 601, quantity: 8, reserved: 2, variant: { productId: 501 } },
    variantStock: 6, inventoryLogs: [], snapshots: 0, captureWrites: 0, paidWrites: 0,
    notifications: 0, commissions: 0,
  };
  let insideTransaction = false;
  let orderLocked = false;
  const transactionScope = new AsyncLocalStorage();
  let queue = Promise.resolve();
  const forbidden = (name) => { audit.forbiddenEffects++; throw new Error("Offline harness blocked: " + name); };
  const writeGuard = () => assert.ok(transactionScope.getStore() === true && insideTransaction && orderLocked, "Financial writes require the simulated order lock");
  const paymentMatches = (where) => (where.id === undefined || where.id === state.payment.id) &&
    (where.externalId === undefined || where.externalId === state.payment.externalId);
  const payment = {
    findUnique: async ({ where }) => paymentMatches(where) ? copy(state.payment) : null,
    findUniqueOrThrow: async ({ where }) => { assert.ok(paymentMatches(where)); return copy(state.payment); },
    findFirst: async ({ where }) => {
      if (where.paymentGatewayData) {
        if (options.duplicateBankTransaction) return { id: 800005 };
        return null;
      }
      return where.orderId === ORDER_ID && where.status?.in.includes(state.payment.status) ? copy(state.payment) : null;
    },
    update: async ({ where, data }) => {
      writeGuard(); assert.equal(where.id, state.payment.id);
      if (data.status === "CAPTURED") state.captureWrites++;
      Object.assign(state.payment, copy(data)); return copy(state.payment);
    },
  };
  const order = {
    findUnique: async ({ where }) => where.id === ORDER_ID ? copy(state.order) : null,
    findUniqueOrThrow: async ({ where }) => { assert.equal(where.id, ORDER_ID); return copy(state.order); },
    update: async ({ where, data }) => {
      writeGuard(); assert.equal(where.id, ORDER_ID);
      if (data.paymentStatus === "PAID") state.paidWrites++;
      Object.assign(state.order, copy(data)); return copy(state.order);
    },
  };
  const tx = {
    payment, order,
    $queryRaw: async (query) => {
      assert.ok(insideTransaction);
      if (query.text.includes('FROM "Order"') && query.text.includes("FOR UPDATE")) {
        assert.equal(query.values[0], ORDER_ID); orderLocked = true; return [{ id: ORDER_ID }];
      }
      if (query.text.includes("pg_advisory_xact_lock")) { assert.ok(orderLocked); return []; }
      return forbidden("unexpected SQL");
    },
    inventoryReservation: {
      findMany: async ({ where }) => { assert.equal(where.orderId, ORDER_ID); return state.reservations.map(row => ({ ...copy(row), stockLevel: copy(state.stock) })); },
      delete: async ({ where }) => { writeGuard(); state.reservations = state.reservations.filter(row => row.id !== where.id); },
    },
    bundleStockReservation: { findMany: async () => [] },
    stockLevel: {
      findMany: async ({ where }) => { assert.equal(where.productVariantId, state.stock.productVariantId); return [copy(state.stock)]; },
      updateMany: async ({ where, data }) => {
        writeGuard();
        if (where.id !== state.stock.id || state.stock.reserved < where.reserved.gte || state.stock.quantity < where.quantity.gte) return { count: 0 };
        state.stock.reserved -= data.reserved.decrement; state.stock.quantity -= data.quantity.decrement;
        return { count: 1 };
      },
    },
    productVariant: { update: async ({ where, data }) => { writeGuard(); assert.equal(where.id, 601); state.variantStock = data.stock; } },
    inventoryLog: { create: async ({ data }) => { writeGuard(); state.inventoryLogs.push(copy(data)); return copy(data); } },
  };
  const prisma = {
    payment, order,
    paymentEvent: { create: async ({ data }) => { events.push(copy(data)); return copy(data); } },
    $transaction: async (work) => {
      // Serialize the in-memory transaction like a row lock; restore state on errors.
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      const snapshot = copy(state);
      insideTransaction = true; orderLocked = false; audit.transactions++;
      try { return await transactionScope.run(true, () => work(tx)); }
      catch (error) { state = snapshot; audit.rollbacks++; throw error; }
      finally { insideTransaction = false; orderLocked = false; release(); }
    },
  };
  const Prisma = { Decimal: OfflineDecimal, sql: (strings, ...values) => ({ text: strings.join("?"), values }) };
  const OrderStatus = Object.fromEntries("PENDING CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED FAILED RETURNED".split(" ").map(v => [v, v]));
  function load(path, imports) {
    const loadedModule = { exports: {} };
    const context = vm.createContext({
      module: loadedModule, exports: loadedModule.exports,
      require: (name) => Object.hasOwn(imports, name) ? imports[name] : forbidden("unapproved import " + name),
      process: Object.freeze({ env }),
      URL, URLSearchParams, Request, Response, Headers, FormData, Blob, TextDecoder, TextEncoder,
      Buffer, Date, AbortSignal, performance,
      fetch: () => forbidden("native fetch"),
      console: { warn: () => forbidden("unexpected warning"), error: () => forbidden("unexpected error log"), log: () => forbidden("unexpected log") },
    }, { codeGeneration: { strings: false, wasm: false } });
    new vm.Script(sourceCode(path), { filename: path }).runInContext(context);
    return loadedModule.exports;
  }
  const generated = { Prisma, OrderStatus };
  const settings = load("lib/aibl-wallet-settings.ts", {});
  const seo = load("lib/seo-url.ts", {});
  // Exact telemetry import boundary only. Never load the real monitor or its
  // diagnostics/storage/Undici dependencies in this isolated VM. Match the real
  // OFF-mode exports: no capture and no dispatcher, with no I/O or subscriptions.
  const transportMonitor = Object.freeze({
    beginPaymentTransport: async (_provider, _operation, _requestId, _input) => {
      assert.equal(env.PAYMENT_TRANSPORT_MONITORING_MODE, "off");
      assert.equal(env.PAYMENT_TRANSPORT_STORAGE_ENABLED, "false");
      assert.equal(env.PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED, "false");
      return null;
    },
    paymentTransportDispatcher: async capture => {
      if (capture !== null) return forbidden("enabled transport monitoring");
      return undefined;
    },
  });
  const telemetry = load("lib/payment-control/telemetry.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/prisma": { prisma },
    "./transport-monitor": transportMonitor,
  });
  const inventory = load("lib/inventory.ts", {
    "@/generated/prisma": generated,
    "@/lib/report-history": { captureVariantInventoryDailySnapshots: async () => { writeGuard(); state.snapshots++; } },
  });
  const lifecycle = load("lib/order-inventory-lifecycle.ts", { "@/generated/prisma": generated, "@/lib/inventory": inventory });
  const wallet = load("lib/aibl-wallet.ts", {
    "server-only": {}, "node:crypto": crypto, "@/generated/prisma": generated, "@/lib/prisma": { prisma },
    "@/lib/seo-url": seo, "@/lib/aibl-wallet-settings": settings,
    "@/lib/inventory": { ...inventory, commitOrderInventoryReservations: async (args) => {
      audit.inventoryCommitCalls++; return inventory.commitOrderInventoryReservations(args);
    } },
    "@/lib/order-inventory-lifecycle": lifecycle,
    "@/lib/business-network/commission": { syncCommissionEntriesForOrderStatus: async () => { writeGuard(); state.commissions++; } },
    "@/lib/order-admin-notifications": { createOrderAdminNotifications: async () => {
      writeGuard(); if (options.failNotification) throw new Error("Simulated transaction failure"); state.notifications++;
    } },
    "@/lib/payment-control/telemetry": { ...telemetry, paymentFetch: async (_context, operation, input, init) => {
      assert.notEqual(transactionScope.getStore(), true, "Bank I/O must occur outside its own DB transaction");
      if (operation !== "STATUS_QUERY" || String(input) !== env.AIBL_WALLET_API_BASE_URL + "PGService/verify") return forbidden("non-verification bank operation");
      assert.equal(init.method, "POST"); assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
      const form = new URLSearchParams(init.body);
      assert.deepEqual([...form.keys()].sort(), ["api_user", "api_pass", "merchantID", "accessKey", "OrderID", "amount", "bill_no"].sort());
      bankRequests.push({ amount: form.get("amount"), bankOrderId: form.get("OrderID"), bill: form.get("bill_no") });
      if (options.bankError) throw new Error("Simulated offline bank timeout");
      return new Response(JSON.stringify(options.verifyResponse ?? SUCCESS), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  state.payment.paymentGatewayData.accountFingerprint = wallet.aiblWalletConfig().accountFingerprint;
  const http = load("lib/aibl-wallet-http.ts", {
    "server-only": {}, "next/server": { NextResponse: OfflineResponse }, "next-auth/next": { getServerSession: () => forbidden("session lookup") },
    "@/lib/prisma": { prisma }, "@/lib/auth": { authOptions: {} }, "@/lib/rbac": { getAccessContext: () => forbidden("RBAC lookup") },
    "@/lib/sslcommerz": { createPaymentInitToken: () => forbidden("guest token creation"), verifyPaymentInitToken: () => forbidden("guest token verification") },
    "@/lib/aibl-wallet": wallet, "@/lib/aibl-wallet-settings": settings,
  });
  const callback = load("lib/aibl-wallet-callback.ts", {
    "next/server": { NextResponse: OfflineResponse }, "node:crypto": crypto, "@/lib/prisma": { prisma },
    "@/lib/aibl-wallet": wallet, "@/lib/aibl-wallet-settings": settings, "@/lib/aibl-wallet-http": http,
    "@/lib/payment-result": { attachPaymentResult: async response => response },
    "@/lib/payment-control/telemetry": telemetry,
    "@/lib/request-security": { rateLimitRequest: async () => ({ allowed: true }) },
    "@/lib/storefront-catalog-cache": { revalidateStorefrontCatalog() {} },
  });
  function request({ encoding = "urlencoded", fields = callbackFields(), signature, attempt, kind = "approved" } = {}) {
    const url = new URL(wallet.aiblWalletCallbackUrls(BILL)[kind + "_url"]);
    if (signature === null) url.searchParams.delete("state");
    else if (signature !== undefined) url.searchParams.set("state", signature);
    if (attempt !== undefined) url.searchParams.set("attempt", attempt);
    const body = encoding === "multipart" ? new FormData() : new URLSearchParams();
    for (const [key, value] of fields) body.append(key, value);
    const req = new Request(url, { method: "POST", body });
    Object.defineProperty(req, "nextUrl", { value: url });
    return req;
  }
  const harness = {
    wallet, http, callback: callback.handleAiblWalletCallback, request, events, bankRequests, audit, transportMonitor,
    state: () => state,
    assertOffline: () => assert.equal(audit.forbiddenEffects, 0, "Unexpected side effect was blocked"),
  };
  t.after(harness.assertOffline);
  return harness;
}

export function callbackFields(overrides = {}) {
  return Object.entries({ RESCODE: "0", STATUS: "APPROVED", AMOUNT: "100.00", MESSAGE: "OFFLINE_MESSAGE",
    SESSIONKEY: "OFFLINE_SESSION_SENTINEL", TRANSNO: BANK_TRANSACTION, BILLNO: BILL, ...overrides })
    .filter(([, value]) => value !== undefined);
}

export function assertUnsettled(h) {
  const state = h.state();
  assert.equal(state.payment.status, "INITIATED");
  assert.equal(state.order.paymentStatus, "UNPAID");
  assert.equal(state.stock.quantity, 8); assert.equal(state.stock.reserved, 2);
  assert.equal(state.reservations.length, 1);
  assert.equal(state.captureWrites, 0); assert.equal(state.paidWrites, 0);
  assert.equal(state.inventoryLogs.length, 0);
}

export function assertSettledOnce(h) {
  const state = h.state();
  assert.equal(state.payment.status, "CAPTURED"); assert.equal(state.order.paymentStatus, "PAID");
  assert.equal(state.order.status, "CONFIRMED");
  assert.equal(state.payment.paymentGatewayData.bankTransactionId, BANK_TRANSACTION);
  assert.equal(state.order.transactionId, BANK_TRANSACTION);
  assert.equal(state.stock.quantity, 6); assert.equal(state.stock.reserved, 0);
  assert.equal(state.variantStock, 6); assert.equal(state.reservations.length, 0);
  assert.equal(state.captureWrites, 1); assert.equal(state.paidWrites, 1);
  assert.equal(h.audit.inventoryCommitCalls, 1); assert.equal(state.inventoryLogs.length, 1);
  assert.equal(state.inventoryLogs[0].change, -2);
  assert.equal(state.notifications, 1); assert.equal(state.commissions, 1);
}
