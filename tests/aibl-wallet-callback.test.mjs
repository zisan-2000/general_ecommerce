import assert from "node:assert/strict";
import test from "node:test";
import { BILL, BANK_TRANSACTION, callbackFields, createOfflineAibl, assertSettledOnce, assertUnsettled } from "./helpers/aibl-wallet-offline.mjs";

function nestedCallbackFields(overrides = {}) {
  return [["data", JSON.stringify(Object.fromEntries(callbackFields(overrides)))]];
}
function observedCallbackFields(inner = {}, outer = {}) {
  return [...nestedCallbackFields(inner), ...Object.entries({
    access_token: "OFFLINE_UNTRUSTED_TOKEN", economic: "OFFLINE_ECONOMIC_METADATA",
    mobile_no: "OFFLINE_PRIVATE_MOBILE", paid_amount: "0.01", reference_no: "OFFLINE_OUTER_REFERENCE",
    responsecode: "OFFLINE_OUTER_RESPONSE", transaction_id: "OFFLINE_OUTER_TRANSACTION", ...outer,
  })];
}
function rawCallbackRequest(h, body, contentType = "application/x-www-form-urlencoded; charset=UTF-8") {
  const url = new URL(h.request().url);
  const request = new Request(url, { method: "POST", headers: { "Content-Type": contentType }, body });
  Object.defineProperty(request, "nextUrl", { value: url });
  return request;
}
async function bufferedCallbackRequest(request) {
  // Finish native FormData serialization before the size-limit test cancels its
  // input. Node 24.22.1's outgoing FormData producer otherwise enqueues after
  // cancellation, unlike the incoming HTTP bytes this fixture represents.
  // Preserve exact encoded bytes, boundary, signed URL and all parser checks.
  const body = await request.arrayBuffer();
  const buffered = new Request(request.url, { method: request.method, headers: request.headers, body });
  Object.defineProperty(buffered, "nextUrl", { value: new URL(request.url) });
  return buffered;
}

for (const encoding of ["urlencoded", "multipart"]) {
  for (const kind of ["approved", "decline", "cancel"]) {
    test(`observed eight-field ${encoding} ${kind} ignores outer metadata and settles only bank proof`, async t => {
      const h = createOfflineAibl(t);
      const fields = observedCallbackFields();
      assert.deepEqual(fields.map(([name]) => name).sort(),
        ["data", "access_token", "economic", "mobile_no", "paid_amount", "reference_no", "responsecode", "transaction_id"].sort());
      const parsed = await h.http.readAiblCallbackBody(h.request({ encoding, kind, fields }));
      assert.equal(parsed.BILLNO, BILL); assert.equal(parsed.AMOUNT, "100.00"); assert.equal(parsed.TRANSNO, BANK_TRANSACTION);
      for (const [name] of fields.slice(1)) assert.equal(Object.hasOwn(parsed, name), false);
      await h.callback(h.request({ encoding, kind, fields }));
      assert.equal(h.bankRequests.length, 1);
      assert.equal(h.bankRequests[0].bill, BILL); assert.equal(h.bankRequests[0].amount, "100.00");
      assertSettledOnce(h);
      assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_OUTER_AUX_IGNORED"));
      const log = JSON.stringify(h.events);
      for (const sensitive of [BILL, BANK_TRANSACTION, ...fields.slice(1).map(([, value]) => value)]) {
        assert.equal(log.includes(sensitive), false);
      }
    });
  }

  for (const [name, fields, expected] of [
    ["unknown field", observedCallbackFields({}, { unexpected_aux: "OFFLINE_VALUE" }), "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["wrong casing", observedCallbackFields({}, { Access_token: "OFFLINE_VALUE" }), "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["bracket nesting", observedCallbackFields({}, { "access_token[nested]": "OFFLINE_VALUE" }), "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["prototype key", [...observedCallbackFields(), ["__proto__", "OFFLINE_VALUE"]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["duplicate token", [...observedCallbackFields(), ["access_token", "OFFLINE_DUPLICATE_TOKEN"]], "AIBL_CB_FORM_DUPLICATE_FIELD"],
    ["duplicate data", [...observedCallbackFields(), nestedCallbackFields()[0]], "AIBL_CB_FORM_DUPLICATE_FIELD"],
    ["matching outer bill", [...observedCallbackFields(), ["BILLNO", BILL]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["conflicting outer amount", [...observedCallbackFields(), ["AMOUNT", "99.99"]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["conflicting outer transaction", [...observedCallbackFields(), ["TRANSNO", "OFFLINE_WRONG_TRANSACTION"]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["malformed inner JSON", [["data", "{"], ...observedCallbackFields().slice(1)], "AIBL_CB_DATA_JSON_INVALID"],
    ["recursive inner envelope", [["data", JSON.stringify({ data: nestedCallbackFields()[0][1] })], ...observedCallbackFields().slice(1)], "AIBL_CB_DATA_RECURSIVE"],
    ["nested inner value", observedCallbackFields({ BILLNO: { value: BILL } }), "AIBL_CB_DATA_NESTED_VALUE"],
    ["duplicate inner key", [["data", '{"AMOUNT":"100","AMOUNT":"100"}'], ...observedCallbackFields().slice(1)], "AIBL_CB_DATA_JSON_DUPLICATE_KEY"],
    ["metadata without data", observedCallbackFields().slice(1), "AIBL_CB_AUX_WITHOUT_DATA"],
    ["metadata with legacy references", [...callbackFields(), ...observedCallbackFields().slice(1)], "AIBL_CB_AUX_WITHOUT_DATA"],
  ]) {
    test(`observed ${encoding} rejects ${name} before bank verification`, async t => {
      const h = createOfflineAibl(t);
      await h.callback(h.request({ encoding, fields }));
      assert.ok(h.events.some(event => event.detailCode === expected));
      assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
      const log = JSON.stringify(h.events);
      for (const sensitive of ["OFFLINE_UNTRUSTED_TOKEN", "OFFLINE_PRIVATE_MOBILE", "OFFLINE_OUTER_REFERENCE", "OFFLINE_OUTER_TRANSACTION"]) {
        assert.equal(log.includes(sensitive), false);
      }
    });
  }

  test(`observed ${encoding} auxiliary token remains subject to the 16 KB request limit`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(await bufferedCallbackRequest(h.request({ encoding, fields: observedCallbackFields({}, { access_token: "x".repeat(17000) }) })));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_BODY_TOO_LARGE"));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });
}

for (const name of ["access_token", "mobile_no"]) {
  test(`observed multipart rejects a file value under ${name}`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ encoding: "multipart", fields: observedCallbackFields({}, { [name]: new Blob(["OFFLINE_FILE_VALUE"]) }) }));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_FORM_FILE_REJECTED"));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });
}

for (const [reason, inner] of [
  ["BILLNO_MISMATCH", { BILLNO: "OFFLINE_WRONG_BILL" }],
  ["AMOUNT_MISSING", { AMOUNT: undefined }],
  ["AMOUNT_MISMATCH", { AMOUNT: "99.99" }],
]) {
  test(`observed outer metadata cannot repair inner ${reason}`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ fields: observedCallbackFields(inner, { reference_no: BILL, paid_amount: "100.00", transaction_id: BANK_TRANSACTION }) }));
    assert.ok(h.events.some(event => event.detailCode === reason));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });
}

test("observed outer transaction cannot replace a mismatched inner TRANSNO", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ fields: observedCallbackFields({ TRANSNO: "OFFLINE_WRONG_TRANSACTION" }, { transaction_id: BANK_TRANSACTION }) }));
  assert.equal(h.bankRequests.length, 1); assert.equal(h.audit.inventoryCommitCalls, 0); assertUnsettled(h);
});

test("observed outer success cannot settle UNKNOWN bank proof or bypass signed state", async t => {
  const h = createOfflineAibl(t, { verifyResponse: { code: 100, msg: "Unknown" } });
  await h.callback(h.request({ fields: observedCallbackFields({}, { responsecode: "0", paid_amount: "100.00" }) }));
  assert.equal(h.bankRequests.length, 1); assert.equal(h.audit.inventoryCommitCalls, 0); assertUnsettled(h);
  const badState = createOfflineAibl(t);
  await badState.callback(badState.request({ fields: observedCallbackFields(), signature: "x".repeat(43) }));
  assert.equal(badState.bankRequests.length, 0); assertUnsettled(badState);
});

test("duplicate observed eight-field callbacks capture and commit inventory only once", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ fields: observedCallbackFields() }));
  await h.callback(h.request({ encoding: "multipart", fields: observedCallbackFields() }));
  assert.equal(h.bankRequests.length, 2); assertSettledOnce(h);
});

test("documented legacy flat JSON remains valid while unknown legacy fields reject", async t => {
  const h = createOfflineAibl(t);
  await h.callback(rawCallbackRequest(h, JSON.stringify(Object.fromEntries(callbackFields())), "application/json"));
  assertSettledOnce(h);
  const unknown = createOfflineAibl(t);
  await unknown.callback(unknown.request({ fields: [...callbackFields(), ["unexpected_aux", "OFFLINE_VALUE"]] }));
  assert.ok(unknown.events.some(event => event.detailCode === "AIBL_CB_OUTER_FIELDS_UNEXPECTED"));
  assert.equal(unknown.bankRequests.length, 0); assertUnsettled(unknown);
});

test("legacy flat JSON rejects duplicate keys, including escaped equivalents", async t => {
  for (const body of ['{"BILLNO":"one","BILLNO":"two","AMOUNT":"100"}',
    '{"AMOUNT":"99","\\u0041MOUNT":"100"}']) {
    const h = createOfflineAibl(t);
    await h.callback(rawCallbackRequest(h, body, "application/json"));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_BODY_JSON_DUPLICATE_KEY"));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  }
});

test("raw HTML form wire body is decoded exactly once, preserving plus, percent and UTF-8", async t => {
  const h = createOfflineAibl(t);
  const message = "OFFLINE_MESSAGE_SENTINEL + %7B %22 %2B %25 & = বাংলা";
  const session = "OFFLINE_SESSION_SENTINEL+%2B/=";
  const data = JSON.stringify(Object.fromEntries(callbackFields({ MESSAGE: message, SESSIONKEY: session })));
  const wire = "data=" + encodeURIComponent(data).replace(/%20/g, "+");
  const parsed = await h.http.readAiblCallbackBody(rawCallbackRequest(h, wire));
  assert.equal(parsed.MESSAGE, message); assert.equal(parsed.SESSIONKEY, session);
  await h.callback(rawCallbackRequest(h, wire));
  assert.equal(h.bankRequests.length, 1); assertSettledOnce(h);
  for (const detailCode of ["AIBL_CB_OUTER_BODY_PARSED", "AIBL_CB_DATA_PRESENT", "AIBL_CB_DATA_JSON_PARSED"]) {
    assert.ok(h.events.some(event => event.detailCode === detailCode));
  }
  const log = JSON.stringify(h.events);
  for (const sensitive of [message, session, BILL, BANK_TRANSACTION, data, wire]) assert.equal(log.includes(sensitive), false);
});

for (const [name, body, contentType, expected] of [
  ["missing request body", null, "application/x-www-form-urlencoded", "AIBL_CB_BODY_MISSING"],
  ["malformed multipart", "missing boundary", "multipart/form-data", "AIBL_CB_FORM_MALFORMED"],
  ["unsupported content", "offline", "text/plain", "AIBL_CB_CONTENT_UNSUPPORTED"],
  ["invalid outer JSON", "{", "application/json", "AIBL_CB_BODY_JSON_INVALID"],
  ["non-object outer JSON", "null", "application/json", "AIBL_CB_BODY_JSON_NOT_OBJECT"],
  ["double-encoded data", "data=" + encodeURIComponent(encodeURIComponent(nestedCallbackFields()[0][1])), "application/x-www-form-urlencoded", "AIBL_CB_DATA_JSON_INVALID"],
  ["extra submit field", "data=" + encodeURIComponent(nestedCallbackFields()[0][1]) + "&submit=Pay", "application/x-www-form-urlencoded", "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
]) {
  test(`raw callback diagnoses ${name} without a fallback or bank request`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(rawCallbackRequest(h, body, contentType));
    assert.ok(h.events.some(event => event.operation === "DIAGNOSTIC" && event.detailCode === expected));
    assert.ok(h.events.some(event => event.detailCode === "INVALID_CALLBACK"));
    assert.equal(h.events.some(event => event.detailCode === "AIBL_CB_BILLNO_PRESENT"), false);
    assert.equal(new Set(h.events.map(event => event.requestId)).size, 1);
    assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
  });
}

test("missing data is observed without breaking supported flat callbacks", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request());
  assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_DATA_MISSING" && event.outcome === "RECEIVED"));
  assertSettledOnce(h);
  const missing = createOfflineAibl(t);
  await missing.callback(rawCallbackRequest(missing, "other=offline"));
  assert.ok(missing.events.some(event => event.detailCode === "AIBL_CB_DATA_MISSING"));
  assert.ok(missing.events.some(event => event.detailCode === "AIBL_CB_OUTER_FIELDS_UNEXPECTED"));
  assert.equal(missing.bankRequests.length, 0); assertUnsettled(missing);
});

test("body stream failure logs a fixed read-stage code without the stream error", async t => {
  const h = createOfflineAibl(t);
  const url = new URL(h.request().url);
  const request = new Request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new ReadableStream({ start(controller) { controller.error(new Error("OFFLINE_PRIVATE_STREAM_ERROR")); } }), duplex: "half" });
  Object.defineProperty(request, "nextUrl", { value: url });
  await h.callback(request);
  assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_BODY_READ_FAILED"));
  assert.equal(JSON.stringify(h.events).includes("OFFLINE_PRIVATE_STREAM_ERROR"), false);
  assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
});

for (const encoding of ["urlencoded", "multipart"]) {
  // These keys are documented inside data; their presence outside data is never accepted.
  for (const name of ["RESCODE", "STATUS", "MESSAGE", "SESSIONKEY"]) {
    test(`${encoding} diagnoses documented ${name} at the wrong outer level without accepting it`, async t => {
      const h = createOfflineAibl(t);
      await h.callback(h.request({ encoding, fields: [...nestedCallbackFields(), [name, "OFFLINE_PRIVATE_AUX_VALUE"]] }));
      for (const code of ["AIBL_CB_OUTER_EXTRA_COUNT_1", "AIBL_CB_OUTER_UNKNOWN_COUNT_0",
        `AIBL_CB_OUTER_FIELD_${name}`, "AIBL_CB_OUTER_FIELDS_UNEXPECTED"]) {
        assert.ok(h.events.some(event => event.detailCode === code));
      }
      assert.equal(JSON.stringify(h.events).includes("OFFLINE_PRIVATE_AUX_VALUE"), false);
      assert.equal(new Set(h.events.map(event => event.requestId)).size, 1);
      assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
    });
  }

  for (const [name, original, conflicting] of [["BILLNO", BILL, "OFFLINE_WRONG_BILL"],
    ["AMOUNT", "100.00", "99.99"], ["TRANSNO", BANK_TRANSACTION, "OFFLINE_WRONG_TRANSACTION"]]) {
    for (const [kind, value] of [["matching", original], ["conflicting", conflicting]]) {
      test(`${encoding} rejects ${kind} outer ${name} instead of merging reference sources`, async t => {
        const h = createOfflineAibl(t);
        await h.callback(h.request({ encoding, fields: [...nestedCallbackFields(), [name, value]] }));
        assert.ok(h.events.some(event => event.detailCode === `AIBL_CB_OUTER_FIELD_${name}`));
        assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_OUTER_FIELDS_UNEXPECTED"));
        assert.equal(h.events.some(event => event.detailCode === "AIBL_CB_DATA_JSON_PARSED"), false);
        assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
      });
    }
  }

  test(`${encoding} counts unknown outer names without logging names, references or values`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ encoding, fields: [...nestedCallbackFields(),
      [BANK_TRANSACTION, "OFFLINE_PRIVATE_VALUE"], ["STATUS", "OFFLINE_OUTER_STATUS_VALUE"]] }));
    for (const code of ["AIBL_CB_OUTER_EXTRA_COUNT_2", "AIBL_CB_OUTER_UNKNOWN_COUNT_1", "AIBL_CB_OUTER_FIELD_STATUS"]) {
      assert.ok(h.events.some(event => event.detailCode === code));
    }
    const log = JSON.stringify(h.events);
    for (const sensitive of [BILL, BANK_TRANSACTION, "OFFLINE_PRIVATE_VALUE", "OFFLINE_OUTER_STATUS_VALUE"]) {
      assert.equal(log.includes(sensitive), false);
    }
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });

  test(`${encoding} bounds unknown outer field count diagnostics`, async t => {
    const h = createOfflineAibl(t);
    const extras = Array.from({ length: 12 }, (_, index) => [`OFFLINE_UNKNOWN_NAME_${index}`, "OFFLINE_PRIVATE_VALUE"]);
    await h.callback(h.request({ encoding, fields: [...nestedCallbackFields(), ...extras] }));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_OUTER_EXTRA_COUNT_GT10"));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_OUTER_UNKNOWN_COUNT_GT10"));
    assert.equal(JSON.stringify(h.events).includes("OFFLINE_UNKNOWN_NAME_"), false);
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });

  test(`${encoding} still rejects duplicate recognizable outer fields before envelope diagnostics`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ encoding, fields: [...nestedCallbackFields(), ["STATUS", "one"], ["STATUS", "two"]] }));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_FORM_DUPLICATE_FIELD"));
    assert.equal(h.events.some(event => event.detailCode?.startsWith("AIBL_CB_OUTER_EXTRA_COUNT_")), false);
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });
}

for (const encoding of ["urlencoded", "multipart"]) {
  for (const kind of ["approved", "decline", "cancel"]) {
    test(`nested data JSON ${encoding} ${kind} uses authoritative bank verification`, async t => {
      const h = createOfflineAibl(t);
      const fields = nestedCallbackFields({ AMOUNT: "100", STATUS: "UNTRUSTED_STATUS",
        MESSAGE: 'Text with "AMOUNT": and escaped \\ characters' });
      const response = await h.callback(h.request({ encoding, kind, fields }));
      assert.equal(response.status, 303);
      assert.equal(h.bankRequests.length, 1);
      assertSettledOnce(h);
      assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_BILLNO_PRESENT" && event.outcome === "SUCCESS"));
      assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_AMOUNT_TYPE_STRING"));
      const log = JSON.stringify(h.events);
      for (const sensitive of [fields[0][1], BILL, BANK_TRANSACTION, "OFFLINE_SESSION_SENTINEL", "UNTRUSTED_STATUS"]) {
        assert.equal(log.includes(sensitive), false);
      }
    });
  }

  const validData = nestedCallbackFields()[0][1];
  const invalidEnvelopes = [
    ["malformed JSON", [["data", "{"]], "AIBL_CB_DATA_JSON_INVALID"],
    ["empty JSON", [["data", ""]], "AIBL_CB_DATA_JSON_INVALID"],
    ["null JSON", [["data", "null"]], "AIBL_CB_DATA_JSON_NOT_OBJECT"],
    ["array JSON", [["data", "[]"]], "AIBL_CB_DATA_JSON_NOT_OBJECT"],
    ["string JSON", [["data", '"not an object"']], "AIBL_CB_DATA_JSON_NOT_OBJECT"],
    ["number JSON", [["data", "100"]], "AIBL_CB_DATA_JSON_NOT_OBJECT"],
    ["boolean JSON", [["data", "true"]], "AIBL_CB_DATA_JSON_NOT_OBJECT"],
    ["duplicate data", [["data", validData], ["data", validData]], "AIBL_CB_FORM_DUPLICATE_FIELD"],
    ["mixed flat reference", [["data", validData], ["BILLNO", BILL]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["mixed flat amount", [["data", validData], ["AMOUNT", "100.00"]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["extra outer field", [["data", validData], ["note", "extra"]], "AIBL_CB_OUTER_FIELDS_UNEXPECTED"],
    ["recursive envelope", [["data", JSON.stringify({ data: validData })]], "AIBL_CB_DATA_RECURSIVE"],
    ["nested reference object", [["data", JSON.stringify({ BILLNO: { value: BILL }, AMOUNT: "100.00" })]], "AIBL_CB_DATA_NESTED_VALUE"],
    ["duplicate JSON key", [["data", '{"BILLNO":"first","BILLNO":"second","AMOUNT":"100"}']], "AIBL_CB_DATA_JSON_DUPLICATE_KEY"],
    ["escaped duplicate JSON key", [["data", '{"AMOUNT":"100","\\u0041MOUNT":"100"}']], "AIBL_CB_DATA_JSON_DUPLICATE_KEY"],
  ];
  for (const [name, fields, diagnosticCode] of invalidEnvelopes) {
    test(`nested ${encoding} rejects ${name} before verification`, async t => {
      const h = createOfflineAibl(t);
      await assert.rejects(h.http.readAiblCallbackBody(h.request({ encoding, fields })), error => error.status === 400 && error.diagnosticCode === diagnosticCode);
      await h.callback(h.request({ encoding, fields }));
      assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0);
      assertUnsettled(h);
      assert.ok(h.events.some(event => event.detailCode === "INVALID_CALLBACK"));
      assert.ok(h.events.some(event => event.operation === "DIAGNOSTIC" && event.detailCode === diagnosticCode));
      assert.equal(new Set(h.events.map(event => event.requestId)).size, 1);
    });
  }

  test(`nested ${encoding} rejects an oversized encoded request`, async t => {
    const h = createOfflineAibl(t);
    const fields = nestedCallbackFields({ MESSAGE: "x".repeat(17000) });
    await assert.rejects(h.http.readAiblCallbackBody(await bufferedCallbackRequest(h.request({ encoding, fields }))), error => error.status === 413 && error.diagnosticCode === "AIBL_CB_BODY_TOO_LARGE");
    await h.callback(await bufferedCallbackRequest(h.request({ encoding, fields })));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_BODY_TOO_LARGE"));
    assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0); assertUnsettled(h);
  });
}

test("oversized incoming-style chunked stream is cancelled and rejected before verification", async t => {
  const h = createOfflineAibl(t); let cancelled = 0;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(8000)); controller.enqueue(new Uint8Array(9000)); },
    cancel() { cancelled++; },
  });
  const request = new Request(h.request().url, { method: "POST", body, duplex: "half",
    headers: { "Content-Type": "multipart/form-data; boundary=offline" } });
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
  await h.callback(request);
  assert.equal(cancelled, 1); assert.equal(h.bankRequests.length, 0); assert.equal(h.audit.transactions, 0);
  assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_BODY_TOO_LARGE")); assertUnsettled(h);
});

test("nested multipart rejects files under data or alongside data", async t => {
  for (const fields of [
    [["data", new Blob([nestedCallbackFields()[0][1]], { type: "application/json" })]],
    [...nestedCallbackFields(), ["attachment", new Blob(["offline fixture"])]],
    [...nestedCallbackFields(), ["STATUS", new Blob(["offline fixture"])]],
  ]) {
    const h = createOfflineAibl(t);
    await assert.rejects(h.http.readAiblCallbackBody(h.request({ encoding: "multipart", fields })), error => error.status === 400 && error.diagnosticCode === "AIBL_CB_FORM_FILE_REJECTED");
    await h.callback(h.request({ encoding: "multipart", fields }));
    assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_FORM_FILE_REJECTED"));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  }
});

test("data envelope is accepted only as a form POST, never as a JSON envelope", async t => {
  const h = createOfflineAibl(t);
  const request = new Request("https://shop.example/api/aibl-wallet/approved", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: nestedCallbackFields()[0][1] }),
  });
  await assert.rejects(h.http.readAiblCallbackBody(request), error => error.status === 400);
  assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
});

for (const kind of ["approved", "decline", "cancel"]) {
  test(`nested ${kind} callback cannot settle an UNKNOWN bank response`, async t => {
    const h = createOfflineAibl(t, { verifyResponse: { code: 100, msg: "Unknown" } });
    await h.callback(h.request({ kind, fields: nestedCallbackFields() }));
    assert.equal(h.bankRequests.length, 1); assert.equal(h.audit.inventoryCommitCalls, 0); assertUnsettled(h);
  });
}

for (const [reason, overrides] of [
  ["BILLNO_MISMATCH", { BILLNO: "OFFLINE_WRONG_BILL" }],
  ["BILLNO_MISMATCH", { BILLNO: undefined, billNo: BILL }],
  ["AMOUNT_MISSING", { AMOUNT: undefined, amount: "100.00" }],
  ["AMOUNT_INVALID", { AMOUNT: "100.001" }],
  ["AMOUNT_MISMATCH", { AMOUNT: "99.99" }],
]) {
  test(`nested callback retains ${reason} validation without accepting aliases`, async t => {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ fields: nestedCallbackFields(overrides) }));
    assert.ok(h.events.some(event => event.detailCode === reason));
    assert.equal(h.bankRequests.length, 0); assertUnsettled(h);
  });
}

test("nested callback still rejects invalid signed state and transaction references", async t => {
  const badState = createOfflineAibl(t);
  await badState.callback(badState.request({ fields: nestedCallbackFields(), signature: "x".repeat(43) }));
  assert.equal(badState.bankRequests.length, 0); assertUnsettled(badState);
  for (const reference of ["invalid/reference", "OFFLINE_DIFFERENT_TRANSACTION"]) {
    const h = createOfflineAibl(t);
    await h.callback(h.request({ fields: nestedCallbackFields({ TRANSNO: reference }) }));
    assert.equal(h.bankRequests.length, reference === "invalid/reference" ? 0 : 1);
    assertUnsettled(h);
  }
});

test("duplicate nested callbacks keep one capture and inventory commit", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ fields: nestedCallbackFields() }));
  await h.callback(h.request({ encoding: "multipart", fields: nestedCallbackFields() }));
  assert.equal(h.bankRequests.length, 2); assertSettledOnce(h);
  assert.ok(h.events.some(event => event.operation === "SETTLEMENT" && event.outcome === "DUPLICATE"));
});

test("nested numeric amount retains existing money normalization", async t => {
  const h = createOfflineAibl(t);
  await h.callback(h.request({ fields: nestedCallbackFields({ AMOUNT: 100 }) }));
  assert.ok(h.events.some(event => event.detailCode === "AIBL_CB_AMOUNT_TYPE_NUMBER"));
  assert.equal(h.bankRequests[0].amount, "100.00"); assertSettledOnce(h);
});

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
