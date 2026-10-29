import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminOrderEditError, adminOrderGateway, buildAdminOrderPatch, gatewayConfirmationBlocked, shipmentOrderStatusUpdate, verifyAdminOrderPayment } from "../lib/admin-order-editor.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = ts.createSourceFile("orders.tsx", read("app/admin/operations/orders/page.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpers = { AdminOrderEditError, adminOrderGateway, buildAdminOrderPatch, gatewayConfirmationBlocked, shipmentOrderStatusUpdate };
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("OFFLINE_REAL_FETCH_FORBIDDEN"); };
after(() => { globalThis.fetch = originalFetch; });
function find(predicate) {
  let found;
  const visit = (node) => { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); };
  visit(source); assert.ok(found, "Expected actual editor code"); return found;
}
function compile(text) {
  return ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
const order = (gateway = "EPS", paymentStatus = "PAID") => ({ id: 71, status: "PENDING", paymentStatus,
  transactionId: "synthetic-reference", payment_method: `${gateway}:sandbox` });
const edits = (overrides = {}) => ({ status: "CONFIRMED", paymentStatus: "PAID", transactionId: "synthetic-reference", ...overrides });
const reply = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

function editorFixture(original, overrides = {}) {
  const state = { detail: structuredClone(original), orders: [structuredClone(original)], error: null, success: false, saving: false, verifying: false };
  const requests = [];
  const context = {
    ...helpers, useCallback: (callback) => callback, orderDetail: structuredClone(original), selectedOrderId: original.id,
    saving: false, verifyingPayment: false, detailGeneration: { current: 1 },
    editOrderStatus: "CONFIRMED", editPaymentStatus: original.paymentStatus, editTransactionId: original.transactionId || "",
    shipment: null, editCourierId: "", editWarehouseId: "", editCourier: "", editTrackingNumber: "",
    editExpectedDate: "", editDeliveredDate: "", editShipmentStatus: "PENDING", warehouseStock: null,
    isWarehouseSelectable: () => true, applyShipmentState: () => {}, orderListCache: new Map(),
    t: (key) => key, console: { warn() {} },
    setOrderDetail: (value) => { state.detail = typeof value === "function" ? value(state.detail) : value; },
    setOrders: (update) => { state.orders = update(state.orders); },
    setSaving: (value) => { state.saving = value; }, setVerifyingPayment: (value) => { state.verifying = value; },
    setEditOrderStatus: (value) => { state.editStatus = value; },
    setEditPaymentStatus: (value) => { state.editPayment = value; },
    setEditTransactionId: (value) => { state.editTransaction = value; },
    setVerificationNotice: (value) => { state.notice = value; },
    setSuccessMessage: () => {}, setSuccessOpen: (value) => { state.success = value; },
    setErrorMessage: (value) => { state.error = value; }, setErrorOpen: () => {},
    ...overrides,
  };
  context.fetch = async (url, init) => {
    const body = JSON.parse(init.body); requests.push({ url, method: init.method, body });
    if (url.startsWith("/api/orders/")) return reply({ ...original, ...body });
    if (url.startsWith("/api/shipments/")) return reply({ ...context.shipment, ...body });
    throw new Error("OFFLINE_UNAPPROVED_REQUEST");
  };
  const loadHandler = (name) => {
    const declaration = find((node) => ts.isVariableDeclaration(node) && node.name.getText(source) === name);
    return new vm.Script(compile(`const ${name} = ${declaration.initializer.getText(source)};\n${name};`)).runInContext(vm.createContext(context));
  };
  return { state, requests, context, loadHandler };
}

for (const gateway of ["EPS", "AIBL_WALLET"]) {
  test(`${gateway}: PAID confirmation sends only changed status, even with edited payment drafts`, async () => {
    const original = order(gateway);
    assert.deepEqual(buildAdminOrderPatch(original, edits({ paymentStatus: "UNPAID", transactionId: "" })), { status: "CONFIRMED" });
    const f = editorFixture(original, { editPaymentStatus: "UNPAID", editTransactionId: "" });
    await f.loadHandler("handleSaveAll")();
    assert.deepEqual(f.requests, [{ url: "/api/orders/71", method: "PATCH", body: { status: "CONFIRMED" } }]);
    assert.equal(f.state.detail.paymentStatus, "PAID"); assert.equal(f.state.detail.transactionId, original.transactionId);
    assert.equal(f.state.success, true); assert.equal(f.state.error, null);
  });

  test(`${gateway}: UNPAID confirmation cannot be spoofed by setting the editor payment draft to PAID`, async () => {
    const original = order(gateway, "UNPAID");
    assert.throws(() => buildAdminOrderPatch(original, edits()), AdminOrderEditError);
    const f = editorFixture(original, { editPaymentStatus: "PAID" });
    await f.loadHandler("handleSaveAll")();
    assert.equal(f.requests.length, 0); assert.equal(f.state.detail.paymentStatus, "UNPAID");
    assert.equal(f.state.error, "detail.verifyBeforeConfirm"); assert.equal(f.state.success, false);
  });

  test(`${gateway}: shipment-only tracking edit skips both initial and unchanged-shipment order PATCH`, async () => {
    const original = order(gateway);
    const f = editorFixture(original, { editOrderStatus: "PENDING", editTransactionId: "", editPaymentStatus: "UNPAID",
      shipment: { id: 9, status: "DELIVERED" }, editShipmentStatus: "DELIVERED", editTrackingNumber: "updated-tracking" });
    await f.loadHandler("handleSaveAll")();
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, "/api/shipments/9");
    assert.equal(f.requests[0].body.trackingNumber, "updated-tracking");
    assert.equal(f.state.detail.transactionId, original.transactionId); assert.equal(f.state.success, true);
  });

  test(`${gateway}: unchanged or null transaction reference is never included in a gateway PATCH`, () => {
    for (const transactionId of [null, "synthetic-reference"]) {
      assert.deepEqual(buildAdminOrderPatch({ ...order(gateway), transactionId }, edits({ transactionId: transactionId || "" })), { status: "CONFIRMED" });
      assert.equal(buildAdminOrderPatch({ ...order(gateway), transactionId }, edits({ status: "PENDING", transactionId: "tampered-draft" })), null);
    }
    assert.throws(() => buildAdminOrderPatch(order(gateway, "REFUNDED"), edits()), AdminOrderEditError);
  });
}

test("COD, Manual and SSLCommerz retain editable payment fields and send changed values", () => {
  for (const payment_method of ["COD", "MANUAL:bkash", "SSLCOMMERZ:card"]) {
    const original = { ...order(), payment_method, paymentStatus: "UNPAID", transactionId: null };
    assert.deepEqual(buildAdminOrderPatch(original, edits()), { status: "CONFIRMED", paymentStatus: "PAID", transactionId: "synthetic-reference" });
    assert.equal(buildAdminOrderPatch(original, edits({ status: "PENDING", paymentStatus: "UNPAID", transactionId: "" })), null);
  }
  assert.equal(shipmentOrderStatusUpdate("IN_TRANSIT", "DELIVERED", "SHIPPED"), "DELIVERED");
  assert.equal(shipmentOrderStatusUpdate("DELIVERED", "DELIVERED", "CONFIRMED"), null);
});

test("unchanged order and empty shipment form make no requests", async () => {
  const f = editorFixture(order(), { editOrderStatus: "PENDING" });
  await f.loadHandler("handleSaveAll")(); assert.equal(f.requests.length, 0);
});

test("a changed terminal shipment status retains existing status sync and updates the order draft", async () => {
  const f = editorFixture({ ...order(), status: "SHIPPED" }, { editOrderStatus: "SHIPPED",
    shipment: { id: 9, status: "IN_TRANSIT" }, editShipmentStatus: "DELIVERED" });
  await f.loadHandler("handleSaveAll")();
  assert.deepEqual(f.requests.map((request) => request.url), ["/api/shipments/9", "/api/orders/71"]);
  assert.deepEqual(f.requests[1].body, { status: "DELIVERED" });
  assert.equal(f.state.editStatus, "DELIVERED"); assert.equal(f.state.detail.status, "DELIVERED");
});

for (const gateway of ["EPS", "AIBL_WALLET"]) {
  test(`${gateway}: authorized verification POST is followed by fresh order GET`, async () => {
    const original = order(gateway, "UNPAID"); const calls = [];
    const result = await verifyAdminOrderPayment(original, async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1 ? reply({ status: "success" }) : reply({ ...original, paymentStatus: "PAID" });
    });
    assert.equal(calls[0].url, gateway === "EPS" ? "/api/eps/status" : "/api/aibl-wallet/status");
    assert.equal(calls[0].init.method, "POST"); assert.equal(calls[0].init.credentials, "same-origin");
    assert.deepEqual(JSON.parse(calls[0].init.body), { orderId: original.id });
    assert.equal(calls[1].url, "/api/orders/71"); assert.equal(calls[1].init.cache, "no-store");
    assert.equal(result.order.paymentStatus, "PAID"); assert.equal(original.paymentStatus, "UNPAID");
  });
}

test("gateway success alone never invents PAID; pending/failed/cancelled results retain refreshed server state", async () => {
  for (const status of ["success", "pending", "failed", "cancelled"]) {
    let count = 0;
    const result = await verifyAdminOrderPayment(order("EPS", "UNPAID"), async () => ++count === 1 ? reply({ status }) : reply(order("EPS", "UNPAID")));
    assert.equal(result.order.paymentStatus, "UNPAID");
    assert.equal(gatewayConfirmationBlocked(result.order, "CONFIRMED"), true);
  }
});

test("forbidden verification stops without a refresh, and unsuccessful refresh never returns a paid order", async () => {
  let count = 0;
  await assert.rejects(verifyAdminOrderPayment(order("EPS", "UNPAID"), async () => { count++; return reply({ error: "Forbidden" }, 403); }), /Forbidden/);
  assert.equal(count, 1);
  count = 0;
  await assert.rejects(verifyAdminOrderPayment(order("EPS", "UNPAID"), async () => ++count === 1 ? reply({ status: "success" }) : reply({}, 500)), /order refresh failed/);
  count = 0;
  await assert.rejects(verifyAdminOrderPayment(order("EPS", "UNPAID"), async () => ++count === 1 ? reply({ status: "success" }) : reply({ ...order(), id: 999 })), /Invalid refreshed order/);
});

test("actual verification handler updates details/list from GET and ignores results after closing/switching orders", async () => {
  for (const closed of [false, true]) {
    const f = editorFixture(order("EPS", "UNPAID")); let count = 0;
    f.context.verifyAdminOrderPayment = (original) => verifyAdminOrderPayment(original, async () => {
      count++;
      if (count === 1) return reply({ status: "success" });
      if (closed) f.context.detailGeneration.current++;
      return reply(order("EPS", "PAID"));
    });
    await f.loadHandler("handleVerifyPayment")();
    assert.equal(count, 2); assert.equal(f.state.verifying, false);
    assert.equal(f.state.detail.paymentStatus, closed ? "UNPAID" : "PAID");
    assert.equal(f.state.orders[0].paymentStatus, closed ? "UNPAID" : "PAID");
    if (!closed) assert.equal(f.state.editPayment, "PAID");
  }
});

test("actual editor controls lock gateway payment fields and disable UNPAID confirmation", () => {
  const element = (setter) => find((node) => ts.isJsxElement(node) && node.openingElement.attributes.properties.some((attr) =>
    ts.isJsxAttribute(attr) && attr.name.text === "onChange" && attr.getText(source).includes(setter)));
  const transaction = find((node) => ts.isJsxSelfClosingElement(node) && node.attributes.properties.some((attr) =>
    ts.isJsxAttribute(attr) && attr.name.text === "onChange" && attr.getText(source).includes("setEditTransactionId")));
  const text = `function Controls() { return <>${element("setEditOrderStatus").getText(source)}${element("setEditPaymentStatus").getText(source)}${transaction.getText(source)}</>; }\nControls;`;
  for (const gateway of ["EPS", "AIBL_WALLET", null]) for (const payment of ["UNPAID", "PAID"]) {
    const original = order(gateway || "COD", payment);
    const context = vm.createContext({ ...helpers, paymentGateway: gateway, orderDetail: original, saving: false, verifyingPayment: false,
      editOrderStatus: "PENDING", editPaymentStatus: payment, editTransactionId: "synthetic-reference", t: (key) => key,
      setEditOrderStatus() {}, setEditPaymentStatus() {}, setEditTransactionId() {}, exports: {},
      require(name) { assert.equal(name, "react/jsx-runtime"); return jsxRuntime; } });
    const Controls = new vm.Script(compile(text)).runInContext(context);
    const html = renderToStaticMarkup(React.createElement(Controls));
    const paidSelect = html.match(/<select[^>]*aria-label="detail.paymentStatusLabel"[^>]*>/)[0];
    assert.equal(/disabled=""/.test(paidSelect), !!gateway);
    assert.equal(/readOnly=""/i.test(html), !!gateway);
    assert.equal(/<option value="CONFIRMED" disabled=""/.test(html), !!gateway && payment !== "PAID");
  }
  for (const locale of ["en", "bn", "ar", "zh", "id", "ne"]) {
    const labels = JSON.parse(read(`messages/${locale}.json`)).AdminOrderManagement.detail;
    for (const key of ["gatewayPaymentReadOnly", "verifyGatewayPayment", "verifyingPayment", "paymentVerificationResult", "verifyBeforeConfirm"]) assert.equal(typeof labels[key], "string");
  }
});

function backendFixture(original) {
  const state = { order: structuredClone(original), transitions: 0, locks: 0 };
  class GatewayError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const tx = {
    $queryRaw: async () => { state.locks++; return [{ id: original.id }]; },
    order: { findUniqueOrThrow: async () => state.order, update: async ({ data }) => { Object.assign(state.order, data); return state.order; } },
  };
  const imports = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
    "next-auth/next": { getServerSession: async () => ({ user: { id: "synthetic-admin" } }) },
    "@/lib/auth": { authOptions: {} },
    "@/lib/prisma": { prisma: { order: { findUnique: async () => state.order }, $transaction: async (work) => work(tx) } },
    "@/lib/rbac": { getAccessContext: async () => ({ userId: "synthetic-admin", has: () => true, hasGlobal: () => true }) },
    "@/lib/warehouse-scope": {}, "@/lib/activity-log": { logActivity: async () => {} },
    "@/lib/order-notifications": { createOrderNotification: async () => {} },
    "@/lib/storefront-catalog-cache": { revalidateStorefrontCatalog() {} },
    "@/generated/prisma": { OrderStatus: Object.fromEntries(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "FAILED", "RETURNED", "REFUNDED", "CANCELLED"].map((value) => [value, value])), Prisma: { sql: () => ({}) } },
    "@/lib/eps": { EpsError: GatewayError }, "@/lib/aibl-wallet": { AiblWalletError: GatewayError },
    "@/lib/business-network/commission": { syncCommissionEntriesForOrderStatus: async () => {} },
    "@/lib/order-inventory-lifecycle": { OrderStatusTransitionError: class extends Error {},
      transitionOrderStatusWithInventory: async ({ nextStatus }) => {
        const previousStatus = state.order.status; state.transitions++; state.order = { ...state.order, status: nextStatus };
        return { order: state.order, previousStatus, changed: previousStatus !== nextStatus };
      } },
    "@/lib/order-public": {},
  };
  const commonJsModule = { exports: {} };
  const context = vm.createContext({ module: commonJsModule, exports: commonJsModule.exports,
    console: { error() { throw new Error("Unexpected backend failure"); } },
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unapproved offline backend import: ${name}`); return imports[name]; },
  });
  new vm.Script(compile(read("app/api/orders/[id]/route.ts"))).runInContext(context);
  return { state, patch: (body) => commonJsModule.exports.PATCH({ json: async () => body }, { params: Promise.resolve({ id: String(original.id) }) }) };
}

for (const gateway of ["EPS", "AIBL_WALLET"]) {
  test(`${gateway}: actual backend accepts PAID status-only confirmation through existing inventory transition`, async () => {
    const f = backendFixture(order(gateway));
    const response = await f.patch(buildAdminOrderPatch(order(gateway), edits()));
    assert.equal(response.status, 200); assert.equal(f.state.order.status, "CONFIRMED");
    assert.equal(f.state.order.paymentStatus, "PAID"); assert.equal(f.state.order.transactionId, "synthetic-reference");
    assert.equal(f.state.transitions, 1); assert.equal(f.state.locks, 1);
  });
  test(`${gateway}: actual backend still rejects UNPAID confirmation before inventory transition`, async () => {
    const f = backendFixture(order(gateway, "UNPAID")); const response = await f.patch({ status: "CONFIRMED" });
    assert.equal(response.status, 409); assert.equal(f.state.transitions, 0); assert.equal(f.state.order.status, "PENDING");
  });
  for (const protectedPatch of [{ transactionId: null }, { transactionId: "synthetic-reference" }, { paymentStatus: "PAID" }]) {
    test(`${gateway}: actual backend still rejects direct ${Object.keys(protectedPatch)[0]} edits`, async () => {
      const f = backendFixture(order(gateway, "UNPAID"));
      const response = await f.patch(protectedPatch);
      assert.equal(response.status, 409); assert.equal(f.state.transitions, 0);
    });
  }
}
