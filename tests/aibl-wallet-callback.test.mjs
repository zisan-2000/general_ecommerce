import assert from "node:assert/strict";
import test from "node:test";
import { BILL, BANK_TRANSACTION, callbackFields, createOfflineAibl, assertSettledOnce, assertUnsettled } from "./helpers/aibl-wallet-offline.mjs";

for (const encoding of ["urlencoded", "multipart"]) {
  test(`valid ${encoding} callback verifies and settles automatically`, async t => {
    const h = createOfflineAibl(t);
    const request = h.request({ encoding, fields: callbackFields({ AMOUNT: "100" }) });
    assert.match(request.headers.get("content-type"), encoding === "multipart" ? /^multipart\/form-data; boundary=/ : /^application\/x-www-form-urlencoded/);
    const response = await h.callback(request);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://shop.example/ecommerce/payment-result");
    assert.equal(h.bankRequests.length, 1);
    assertSettledOnce(h);
    assert.ok(response.cookieWrites.some(cookie => cookie.name === "aibl_wallet_pending" && cookie.options.maxAge === 0));
    assert.ok(h.events.some(event => event.operation === "CALLBACK" && event.outcome === "RECEIVED"));
    assert.ok(h.events.some(event => event.operation === "VERIFY" && event.outcome === "SUCCESS"));
    assert.ok(h.events.some(event => event.operation === "SETTLEMENT" && event.outcome === "SUCCESS"));
  });

  test(`${encoding} duplicate fields are rejected before bank verification`, async t => {
    const h = createOfflineAibl(t);
    const fields = [...callbackFields(), ["AMOUNT", "1.00"]];
    await assert.rejects(h.http.readAiblBody(h.request({ encoding, fields })), error => error.status === 400);
    await h.callback(h.request({ encoding, fields }));
    assert.equal(h.bankRequests.length, 0);
    assert.equal(h.audit.transactions, 0);
    assertUnsettled(h);
    assert.ok(h.events.some(event => event.detailCode === "INVALID_CALLBACK"));
  });
}

test("multipart file uploads are rejected, including files under a required field name", async t => {
  for (const key of ["attachment", "AMOUNT"]) {
    const h = createOfflineAibl(t);
    const fields = key === "AMOUNT" ? callbackFields({ AMOUNT: undefined }) : callbackFields();
    fields.push([key, new Blob(["offline fixture only"], { type: "text/plain" })]);
    await assert.rejects(h.http.readAiblBody(h.request({ encoding: "multipart", fields })), error => error.status === 400);
    await h.callback(h.request({ encoding: "multipart", fields }));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  }
});

const rejections = [
  ["BILLNO_MISMATCH", { BILLNO: "OFFLINE_WRONG_BILL" }],
  ["BILLNO_MISMATCH", { BILLNO: undefined }],
  ["AMOUNT_MISSING", { AMOUNT: undefined }],
  ["AMOUNT_MISSING", { AMOUNT: "" }],
  ["AMOUNT_INVALID", { AMOUNT: "BDT 100.00" }],
  ["AMOUNT_INVALID", { AMOUNT: "100.001" }],
  ["AMOUNT_MISMATCH", { AMOUNT: "99.99" }],
];
for (const [index, [reason, overrides]] of rejections.entries()) {
  test(`callback rejection ${index + 1} records ${reason} without settlement`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ fields: callbackFields(overrides) }));
    assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
    const events = h.events.filter(event => event.operation === "CALLBACK");
    assert.equal(events.length, 1);
    assert.equal(events[0].detailCode, reason);
    assert.equal(events[0].outcome, "MISMATCH");
    assert.equal(events[0].orderId, h.state().order.id);
    assert.equal(events[0].paymentId, h.state().payment.id);
    assert.match(events[0].requestId, /^[a-f0-9-]{36}$/);
  });
}

test("multiple invalid fields share a callback Request ID and expose no payload/reference", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ fields: callbackFields({ BILLNO: "OFFLINE_WRONG_BILL", AMOUNT: undefined }) }));
  assert.deepEqual(h.events.filter(event => event.operation === "CALLBACK").map(event => event.detailCode), ["BILLNO_MISMATCH", "AMOUNT_MISSING"]);
  assert.equal(new Set(h.events.map(event => event.requestId)).size, 1);
  const serialized = JSON.stringify(h.events);
  for (const forbidden of [BILL, BANK_TRANSACTION, "OFFLINE_WRONG_BILL", "OFFLINE_SESSION_SENTINEL", "OFFLINE_MESSAGE", "NOT_A_REAL_PASSWORD", "NOT_A_REAL_ACCESS_KEY"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.ok(h.events.every(event => event.transactionId === null));
  assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
});

for (const [name, signature] of [["missing", null], ["malformed", "invalid"], ["wrong HMAC", "x".repeat(43)]]) {
  test(`${name} callback state fails real signature validation`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ signature }));
    assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
    assert.ok(h.events.some(event => event.detailCode === "INVALID_CALLBACK"));
    assert.ok(h.events.every(event => event.paymentId === null && event.orderId === null));
  });
}

test("a signed state cannot be moved to another merchant attempt", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ attempt: "AI1700000000000bbbbbbbbbbbbbbbb" }));
  assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
});

test("APPROVED browser payload cannot settle UNKNOWN bank verification", async t => {
  const h = createOfflineAibl(t, { verifyResponse: { code: 100, msg: "Unknown" } });
  const response = await h.callback(h.request());
  assert.equal(response.status, 303); assert.equal(h.bankRequests.length, 1);
  assertUnsettled(h); assert.equal(h.audit.inventoryCommitCalls, 0);
  assert.equal(h.state().payment.paymentGatewayData.verification, "PENDING_REVIEW");
  assert.equal(response.cookieWrites.some(cookie => cookie.name === "aibl_wallet_pending"), false);
});

test("callback transaction reference must match the verified bank transaction", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ fields: callbackFields({ TRANSNO: "OFFLINE_DIFFERENT_TRANSACTION" }) }));
  assert.equal(h.bankRequests.length, 1); assert.equal(h.audit.inventoryCommitCalls, 0); assertUnsettled(h);
});

test("duplicate callbacks do not capture or commit inventory twice", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request());
  await h.callback(h.request({ encoding: "multipart" }));
  assertSettledOnce(h);
  assert.equal(h.bankRequests.length, 2); // Repeat verification is allowed; repeat capture is not.
  assert.ok(h.events.some(event => event.operation === "SETTLEMENT" && event.outcome === "DUPLICATE"));
});

test("concurrent duplicate callbacks preserve a single settlement", async t => {
  const h = createOfflineAibl(t);
  await Promise.all([h.callback(h.request()), h.callback(h.request({ encoding: "multipart" }))]);
  assertSettledOnce(h);
  assert.equal(h.bankRequests.length, 2);
});

test("body limits and malformed multipart reject without verification", async t => {
  const h = createOfflineAibl(t);
  await assert.rejects(h.http.readAiblBody(h.request({ fields: callbackFields({ MESSAGE: "x".repeat(17000) }) })), error => error.status === 413);
  const malformed = new Request("https://shop.example/api/aibl-wallet/approved", {
    method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: "missing boundary",
  });
  await assert.rejects(h.http.readAiblBody(malformed), error => error.status === 400);
  assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
});
