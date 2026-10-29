import assert from "node:assert/strict";
import test from "node:test";
import { Decimal as ForeignDecimal } from "@prisma/client/runtime/library";
import { BILL, BANK_ORDER, SUCCESS, OfflineDecimal, createOfflineAibl, assertSettledOnce, assertUnsettled } from "./helpers/aibl-wallet-offline.mjs";

test("disabled transport-monitor boundary loads telemetry offline and preserves callback/verification idempotency", async t => {
  const h = createOfflineAibl(t);
  assert.equal(Object.isFrozen(h.transportMonitor), true);
  assert.deepEqual(Object.keys(h.transportMonitor).sort(), ["beginPaymentTransport", "paymentTransportDispatcher"]);
  const capture = await h.transportMonitor.beginPaymentTransport("AIBL_WALLET", "VERIFY",
    "11111111-1111-4111-8111-111111111111", "https://iwtest.aibl.com.bd/iwPGAPI/PGService/verify");
  assert.equal(capture, null);
  assert.equal(await h.transportMonitor.paymentTransportDispatcher(capture), undefined);

  await h.callback(h.request());
  const result = await h.wallet.reconcileAiblWalletPayment(BILL);
  assert.equal(result.status, "success");
  assert.equal(h.bankRequests.length, 2); // Both are the existing in-memory verification mock.
  assertSettledOnce(h);
  assert.ok(h.events.some(event => event.operation === "SETTLEMENT" && event.outcome === "DUPLICATE"));
  h.assertOffline();
});

test("real verify request binds stored bank OrderID, merchant bill and DB amount", async t => {
  const h = createOfflineAibl(t);
  const result = await h.wallet.reconcileAiblWalletPayment(BILL);
  assert.equal(result.status, "success");
  assert.deepEqual(h.bankRequests, [{ amount: "100.00", bankOrderId: BANK_ORDER, bill: BILL }]);
  assertSettledOnce(h);
});

test("cross-runtime Prisma Decimal preserves amount through verification and settlement", async t => {
  const h = createOfflineAibl(t);
  const amount = new ForeignDecimal("100.00");
  assert.notEqual(ForeignDecimal, OfflineDecimal);
  assert.equal(amount instanceof OfflineDecimal, false);
  assert.equal(OfflineDecimal.isDecimal(amount), true);
  h.state().payment.amount = amount;

  const result = await h.wallet.reconcileAiblWalletPayment(BILL);
  assert.equal(result.status, "success");
  assert.deepEqual(h.bankRequests, [{ amount: "100.00", bankOrderId: BANK_ORDER, bill: BILL }]);
  assert.ok(h.events.some(event => event.detailCode === "AIBL_AMOUNT_DECIMAL_INSTANCE" && event.outcome === "REJECTED"));
  for (const code of ["AIBL_AMOUNT_DECIMAL_RECOGNIZED", "AIBL_AMOUNT_VALID", "AIBL_AMOUNT_NONZERO"]) {
    assert.ok(h.events.some(event => event.detailCode === code && event.outcome === "SUCCESS"));
  }
  assertSettledOnce(h);
});

for (const amount of ["100.001", "0.00"]) {
  test(`cross-runtime Prisma Decimal ${amount} still fails strict amount validation`, async t => {
    const h = createOfflineAibl(t);
    h.state().payment.amount = new ForeignDecimal(amount);
    await assert.rejects(h.wallet.reconcileAiblWalletPayment(BILL), error => error.status === 409);
    assert.equal(h.bankRequests.length, 0);
    assert.equal(h.audit.transactions, 0);
    assertUnsettled(h);
  });
}

for (const [name, verifyResponse] of [
  ["unknown", { code: 100, msg: "Unknown" }],
  ["wrong message casing", { ...SUCCESS, msg: "order verified" }],
  ["undocumented field casing", { Code: 200, Msg: "Order Verified", TransactionID: "OFFLINE_TRANSACTION" }],
  ["missing transaction ID", { code: 200, msg: "Order Verified" }],
]) {
  test(`${name} verification remains pending with all reservations retained`, async t => {
    const h = createOfflineAibl(t, { verifyResponse });
    const result = await h.wallet.reconcileAiblWalletPayment(BILL);
    assert.equal(result.status, "pending"); assertUnsettled(h);
    assert.equal(h.audit.inventoryCommitCalls, 0);
    assert.equal(h.state().payment.paymentGatewayData.verification, "PENDING_REVIEW");
  });
}

test("simulated bank timeout cannot capture or release reservations", async t => {
  const h = createOfflineAibl(t, { bankError: true });
  await assert.rejects(h.wallet.reconcileAiblWalletPayment(BILL), error => error instanceof h.wallet.AiblWalletError);
  assertUnsettled(h); assert.equal(h.audit.inventoryCommitCalls, 0);
});

test("confirmed bank success still rolls back on reservation mismatch", async t => {
  const h = createOfflineAibl(t);
  h.state().reservations[0].quantity = 1;
  await assert.rejects(h.wallet.reconcileAiblWalletPayment(BILL), error => error.status === 409);
  assert.equal(h.bankRequests.length, 1); assert.equal(h.audit.rollbacks, 1);
  assert.equal(h.audit.inventoryCommitCalls, 0);
  assert.equal(h.state().payment.status, "INITIATED"); assert.equal(h.state().order.paymentStatus, "UNPAID");
  assert.equal(h.state().stock.quantity, 8); assert.equal(h.state().stock.reserved, 2);
  assert.equal(h.state().inventoryLogs.length, 0);
});

test("failure after inventory commit rolls back stock, capture and PAID together", async t => {
  const h = createOfflineAibl(t, { failNotification: true });
  await assert.rejects(h.wallet.reconcileAiblWalletPayment(BILL), error => error.status === 409);
  assert.equal(h.audit.inventoryCommitCalls, 1); assert.equal(h.audit.rollbacks, 1);
  assertUnsettled(h);
});

test("bank transaction already linked to another attempt cannot settle", async t => {
  const h = createOfflineAibl(t, { duplicateBankTransaction: true });
  await assert.rejects(h.wallet.reconcileAiblWalletPayment(BILL), error => error.status === 409);
  assertUnsettled(h); assert.equal(h.audit.inventoryCommitCalls, 0);
});

test("account fingerprint mismatch fails before any mocked bank request", async t => {
  const h = createOfflineAibl(t);
  h.state().payment.paymentGatewayData.accountFingerprint = "offline-mismatched-fingerprint";
  await assert.rejects(h.wallet.reconcileAiblWalletPayment(BILL), error => error.status === 409);
  assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
});

test("callback and reconciliation race cannot double-capture or double-deduct stock", async t => {
  const h = createOfflineAibl(t);
  const [, result] = await Promise.all([h.callback(h.request()), h.wallet.reconcileAiblWalletPayment(BILL)]);
  assert.equal(result.status, "success"); assertSettledOnce(h);
});
