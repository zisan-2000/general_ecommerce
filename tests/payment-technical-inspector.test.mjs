import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url);
const readSource = (path) => readFileSync(new URL(path, root), "utf8");
const requestId = "11111111-1111-4111-8111-111111111111";

class PaymentControlError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function transpile(path) {
  return ts.transpileModule(readSource(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

function loadCommonJs(path, imports, postlude = "") {
  const commonJsModule = { exports: {} };
  const context = vm.createContext({
    URLSearchParams,
    Date,
    Map,
    Set,
    console,
    process: { versions: { node: "24.13.0", undici: "7.18.2" } },
    exports: commonJsModule.exports,
    module: commonJsModule,
    require(specifier) {
      if (specifier === "server-only") return {};
      if (specifier in imports) return imports[specifier];
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  new vm.Script(transpile(path) + postlude, { filename: path }).runInContext(context);
  return commonJsModule.exports;
}

function loadEventTable() {
  const inspectorTypes = loadCommonJs("lib/payment-control/inspector-types.ts", {});
  // Expose the private table only inside the VM; production exports stay unchanged.
  // No effects, network panel, API, or database imports execute in these renders.
  return loadCommonJs("components/admin/payment-control/PaymentControlCenter.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "next/link": (props) => React.createElement("a", props),
    "next/dynamic": () => () => null,
    "@/lib/payment-control/inspector-types": inspectorTypes,
  }, "\nexports.EventTable = EventTable;").EventTable;
}

function eventTableRows(Table, events) {
  const html = renderToStaticMarkup(React.createElement(Table, {
    events, onSelect: () => {}, onRequest: () => {},
  }));
  return [...html.matchAll(/<tr class="border-b">([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
}

function event(overrides = {}) {
  return {
    id: "event-1",
    requestId,
    networkAgentId: "windows-local",
    requestStartedAt: new Date("2026-10-25T10:00:00.000Z"),
    requestCompletedAt: new Date("2026-10-25T10:00:00.320Z"),
    paymentId: 7,
    orderId: 9,
    transactionId: "sensitive-bank-reference-1234",
    provider: "AIBL_WALLET",
    operation: "AUTH",
    outcome: "HTTP_SUCCESS",
    httpStatus: 200,
    durationMs: 320,
    gatewayStatus: "SUCCESS",
    detailCode: null,
    actorUserId: "staff-1",
    createdAt: new Date("2026-10-25T10:00:00.400Z"),
    accessToken: "must-never-be-returned",
    rawPayload: { SESSIONKEY: "must-never-be-returned" },
    ...overrides,
  };
}

function callbackEvent(overrides = {}) {
  return event({
    actorUserId: null,
    networkAgentId: null,
    requestStartedAt: null,
    requestCompletedAt: null,
    httpStatus: null,
    durationMs: null,
    gatewayStatus: null,
    ...overrides,
  });
}

function successfulCallbackRows() {
  const rows = [
    callbackEvent({ id: "cb-content", operation: "DIAGNOSTIC", outcome: "RECEIVED",
      detailCode: "AIBL_CB_CONTENT_FORM_URLENCODED", createdAt: new Date("2026-10-19T12:38:26.502Z") }),
  ];
  const alternatives = [
    "AIBL_CB_ALT_BILL_CAMEL",
    "AIBL_CB_ALT_BILL_LOWER",
    "AIBL_CB_ALT_BILL_SNAKE",
    "AIBL_CB_ALT_BILL_PASCAL",
    "AIBL_CB_ALT_AMOUNT_LOWER",
    "AIBL_CB_ALT_AMOUNT_PASCAL",
  ];
  alternatives.forEach((detailCode, index) => rows.push(callbackEvent({
    id: `cb-alt-${index}`,
    operation: "DIAGNOSTIC",
    outcome: "REJECTED",
    detailCode,
    createdAt: new Date(Date.parse("2026-10-19T12:38:26.510Z") + index),
  })));
  rows.push(
    callbackEvent({ id: "cb-received", operation: "CALLBACK", outcome: "RECEIVED", detailCode: "CALLBACK_SUCCESS",
      createdAt: new Date("2026-10-19T12:38:26.600Z") }),
    callbackEvent({ id: "cb-http", operation: "STATUS_QUERY", outcome: "HTTP_SUCCESS", httpStatus: 200, durationMs: 426,
      requestStartedAt: new Date("2026-10-19T12:38:26.649Z"), requestCompletedAt: new Date("2026-10-19T12:38:27.075Z"),
      createdAt: new Date("2026-10-19T12:38:27.075Z") }),
    callbackEvent({ id: "cb-verify", operation: "VERIFY", outcome: "SUCCESS", createdAt: new Date("2026-10-19T12:38:27.150Z") }),
    callbackEvent({ id: "cb-settle", operation: "SETTLEMENT", outcome: "SUCCESS", createdAt: new Date("2026-10-19T12:38:27.221Z") }),
  );
  return rows;
}

function matches(row, where = {}) {
  if (where.requestId !== undefined && row.requestId !== where.requestId) return false;
  if (where.paymentId?.not === null && row.paymentId === null) return false;
  if (typeof where.paymentId === "number" && row.paymentId !== where.paymentId) return false;
  if (where.actorUserId?.not === null && row.actorUserId === null) return false;
  if (where.provider !== undefined && row.provider !== where.provider) return false;
  if (where.transactionId !== undefined && row.transactionId !== where.transactionId) return false;
  if (where.operation?.not !== undefined && row.operation === where.operation.not) return false;
  if (where.operation?.in && !where.operation.in.includes(row.operation)) return false;
  if (where.outcome?.in && !where.outcome.in.includes(row.outcome)) return false;
  if (where.OR && !where.OR.some((condition) => matches(row, condition))) return false;
  return true;
}

function ordered(rows, orderBy = []) {
  const direction = orderBy[0]?.createdAt ?? "asc";
  return [...rows].sort((left, right) => {
    const difference = left.createdAt.getTime() - right.createdAt.getTime();
    if (difference) return direction === "desc" ? -difference : difference;
    const idOrder = left.id.localeCompare(right.id);
    return orderBy[1]?.id === "desc" ? -idOrder : idOrder;
  });
}

function makePrisma({
  network = true,
  linkedPayment = true,
  provider = "AIBL_WALLET",
  paymentStatus = "CAPTURED",
  orderPaymentStatus = "PAID",
  orderStatus = "CONFIRMED",
  includeCrossLifecycle = true,
  requestRows,
  extraRows = [],
  actorUserId = "staff-1",
  initiatorCode = "INITIATOR_ADMIN_AUTHORIZED",
  currentOrderOwnerId = "a-different-current-owner",
} = {}) {
  const rows = [
    ...(requestRows ?? [
      event({ provider, actorUserId }),
      ...(initiatorCode ? [event({ id: "initiator-evidence", provider, actorUserId,
        operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: initiatorCode,
        createdAt: new Date("2026-10-25T10:00:00.450Z") })] : []),
      event({ id: "event-2", provider, operation: "INITIALIZE", outcome: "SUCCESS", httpStatus: null,
        durationMs: null, actorUserId: null, createdAt: new Date("2026-10-25T10:00:01.000Z") }),
    ]),
    ...(includeCrossLifecycle ? [
      event({ id: "event-3", provider, requestId: "22222222-2222-4222-8222-222222222222", operation: "VERIFY",
        createdAt: new Date("2026-10-25T10:01:00.000Z"), actorUserId: null }),
      event({ id: "event-4", provider, requestId: "33333333-3333-4333-8333-333333333333", operation: "SETTLEMENT",
        outcome: "SUCCESS", httpStatus: null, durationMs: null, actorUserId: null,
        createdAt: new Date("2026-10-25T10:01:01.000Z") }),
    ] : []),
    ...extraRows,
  ];
  if (!linkedPayment) {
    rows.forEach((row) => { row.paymentId = null; });
  }
  if (!network) {
    rows.forEach((row) => { row.networkAgentId = null; });
  }
  let calls = 0;
  const paymentEvent = {
    async count({ where }) {
      calls += 1;
      return rows.filter((row) => matches(row, where)).length;
    },
    async findMany({ where, orderBy = [], skip = 0, take = 100 }) {
      calls += 1;
      return ordered(rows.filter((row) => matches(row, where)), orderBy).slice(skip, skip + take);
    },
    async findFirst({ where, orderBy = [] }) {
      calls += 1;
      return ordered(rows.filter((row) => matches(row, where)), orderBy)[0] ?? null;
    },
  };
  return {
    get calls() { return calls; },
    paymentEvent,
    payment: { findUnique: async () => linkedPayment ? ({
      id: 7,
      orderId: 9,
      amount: { toString: () => "100.00" },
      currency: "BDT",
      provider,
      status: paymentStatus,
      externalId: "sensitive-bank-reference-1234",
      order: { paymentStatus: orderPaymentStatus, status: orderStatus, userId: currentOrderOwnerId },
      paymentGatewayData: { access_token: "not-selected" },
    }) : null },
    networkMonitorAgent: { findUnique: async () => network ? ({ id: "windows-local", label: "Local collector" }) : null },
    networkHostSample: { findMany: async () => network ? [{
      observedAt: new Date("2026-10-25T10:00:00.000Z"), intervalStartAt: null,
      counterState: "DELTA", packetsSent: 20n, packetsReceived: 18n, packetsDropped: 2n,
      tcpRetransmissions: 1n, tcpConnectionFailures: 0n, sentDelta: 3n, receivedDelta: 2n,
      droppedDelta: 1n, retransmissionsDelta: 1n, connectionFailuresDelta: 0n,
      sessionId: "not-selected", adapterKey: "not-selected",
    }] : [] },
    networkProbeSample: { findMany: async () => network ? [{
      targetLabel: "Local Next.js", protocol: "TCP", port: 3000,
      startedAt: new Date("2026-10-25T10:00:00.000Z"), completedAt: new Date("2026-10-25T10:00:00.010Z"),
      outcome: "SUCCESS", latencyMs: 10, elapsedMs: 10, errorCode: null,
      address: "127.0.0.1",
    }] : [] },
    networkMonitorAlert: { findMany: async () => [] },
  };
}

function loadInspector(prisma, transportAttempts = []) {
  const reader = loadCommonJs("lib/payment-control/request-inspector-reader.ts", {
    "./transport-config": {
      transportConfiguration: () => ({ mode: "off", reason: "DISABLED" }),
      inboundTransportEvidence: (callback) => ({ requestKind: callback ? "INCOMING_CALLBACK" : "NOT_A_CALLBACK",
        tlsTermination: "UNKNOWN", tlsTerminationEvidence: "UNAVAILABLE", trustedReverseProxyConnection: "NOT_COLLECTED",
        applicationHandshakeVisibility: "NOT_OBSERVABLE", trustedProxyMeasurements: "NOT_COLLECTED", senderAuthentication: "UNAVAILABLE" }),
    },
  });
  return loadCommonJs("lib/payment-control/request-inspector.ts", {
    "./request-inspector-reader": reader,
    "@/lib/prisma": { prisma },
    "@/lib/payment-control/authorization": { PaymentControlError },
    "@/lib/network-monitor/policy": {
      uuidPattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    },
    "./transport-storage": { readTransportEvidence: async () => ({ storage: "AVAILABLE", attempts: transportAttempts, limited: false }) },
  });
}

function loadRoute({ authorize, inspect }) {
  return loadCommonJs("app/api/admin/payment-control/requests/[requestId]/route.ts", {
    "next/server": {
      NextResponse: {
        json(body, options = {}) {
          return { body, status: options.status ?? 200, headers: options.headers ?? {} };
        },
      },
    },
    "@/lib/payment-control/authorization": {
      requirePaymentControlAccess: authorize,
      paymentControlErrorResponse(error) {
        return { body: { error: error.message }, status: error.status ?? 500, headers: { "Cache-Control": "private, no-store" } };
      },
    },
    "@/lib/payment-control/request-inspector": { getTechnicalRequestInspector: inspect },
  });
}

test("technical inspector returns bounded, UTC, sanitized recorded evidence", async () => {
  const prisma = makePrisma();
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId, new URLSearchParams("page=1"));

  assert.equal(result.initiator.type, "ADMIN_ACTION");
  assert.equal(result.schemaVersion, "1.4");
  assert.equal(result.initiator.source, "RECORDED");
  assert.equal(result.initiator.identityEvidence, "RECORDED");
  assert.equal(result.initiator.authenticationEvidence, "VERIFIED");
  assert.equal(result.initiator.authorizationEvidence, "VERIFIED");
  assert.equal(result.initiator.actor.name, null);
  assert.match(result.initiator.actor.id, /^…/);
  assert.equal(result.payment.paymentStatus, "CAPTURED");
  assert.equal(result.payment.verificationStatus, "HTTP_SUCCESS");
  assert.equal(result.payment.settlementStatus, "SUCCESS");
  assert.equal(result.payment.transactionReference, "…1234");
  assert.equal(result.handshakes.tcp.status, "NOT_OBSERVABLE");
  assert.equal(result.handshakes.tcp.durationMs, null);
  assert.equal(result.handshakes.dns.destinationReference, "NOT_RECORDED");
  assert.equal(result.handshakes.tls.tlsVersion, null);
  assert.equal(result.network.attribution, "TEMPORAL_CONTEXT_ONLY");
  assert.equal(result.network.collectorAuthenticationEvidence, "VERIFIED");
  assert.match(result.network.collectorEvidenceSource, /AUTHENTICATED_INGEST_ROUTE/);
  assert.equal(result.network.hostSamples[0].packetsSent, "20");
  assert.match(result.timeline[0].timestamp, /Z$/);
  assert.ok(result.payment.lifecycle.some((item) => item.stage === "VERIFY"));
  assert.ok(result.payment.lifecycle.some((item) => item.stage === "SETTLEMENT"));

  const serialized = JSON.stringify(result);
  for (const forbidden of ["must-never-be-returned", "SESSIONKEY", "accessToken", "paymentGatewayData", "127.0.0.1", "sessionId", "adapterKey"]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
});

test("successful callback separates non-fatal alternative-field diagnostics from payment failure", async () => {
  const prisma = makePrisma({ requestRows: successfulCallbackRows(), includeCrossLifecycle: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.overview.primaryRequestType, "CALLBACK");
  assert.equal(result.overview.requestTypeEvidence, "DERIVED");
  assert.equal(result.initiator.type, "PAYMENT_GATEWAY_CALLBACK");
  assert.equal(result.initiator.source, "RECORDED");
  assert.equal(result.initiator.identityEvidence, "UNKNOWN");
  assert.equal(result.initiator.authenticationEvidence, "UNAVAILABLE");
  assert.equal(result.initiator.callbackEvidence.senderAuthentication, "UNAVAILABLE");
  assert.equal(result.initiator.callbackEvidence.authoritativePaymentVerification, "VERIFIED");
  assert.equal(result.payment.finalOutcome.status, "SUCCESS");
  assert.equal(result.error.classification, "NO_CONFIRMED_PAYMENT_FAILURE");
  assert.equal(result.error.summary, "No confirmed payment failure");
  assert.equal(result.error.primaryFailure, null);
  assert.equal(result.error.diagnostics.nonFatalCount, 6);
  assert.equal(result.error.requestFailureCount, 0);
  assert.equal(result.timeline.filter((item) => item.outcome === "REJECTED").length, 6);
});

test("callback request timing stays unavailable while HTTP duration and observed windows remain distinct", async () => {
  const prisma = makePrisma({ requestRows: successfulCallbackRows(), includeCrossLifecycle: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.overview.requestTiming.evidence, "UNAVAILABLE");
  assert.equal(result.overview.requestTiming.durationMs, null);
  assert.equal(result.http.durationMs, 426);
  assert.equal(result.overview.observedRequestWindow.startTime, "2026-10-19T12:38:26.502Z");
  assert.equal(result.overview.observedRequestWindow.endTime, "2026-10-19T12:38:27.221Z");
  assert.equal(result.payment.observedLifecycleWindow.endTime, "2026-10-19T12:38:27.221Z");
});

test("failed payment state produces a confirmed payment failure", async () => {
  const rows = [
    callbackEvent({ id: "failed-callback", operation: "CALLBACK", outcome: "RECEIVED", createdAt: new Date("2026-10-25T11:00:00.000Z") }),
    callbackEvent({ id: "failed-settlement", operation: "SETTLEMENT", outcome: "FAILED", detailCode: "SETTLEMENT_REJECTED",
      createdAt: new Date("2026-10-25T11:00:01.000Z") }),
  ];
  const prisma = makePrisma({ requestRows: rows, paymentStatus: "FAILED", orderPaymentStatus: "UNPAID", orderStatus: "PENDING", includeCrossLifecycle: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.payment.finalOutcome.status, "FAILED");
  assert.equal(result.error.classification, "CONFIRMED_PAYMENT_FAILURE");
  assert.equal(result.error.confirmedPaymentFailure, true);
  assert.equal(result.error.primaryFailure.detailCode, "SETTLEMENT_REJECTED");
});

test("timeout and connection errors remain actual request failures", async () => {
  for (const outcome of ["TIMEOUT", "CONNECTION_ERROR"]) {
    const rows = [callbackEvent({ id: `network-${outcome}`, operation: "STATUS_QUERY", outcome,
      detailCode: outcome === "TIMEOUT" ? "ETIMEDOUT" : "ECONNRESET", durationMs: 20000,
      requestStartedAt: new Date("2026-10-25T12:00:00.000Z"), requestCompletedAt: new Date("2026-10-25T12:00:20.000Z"),
      createdAt: new Date("2026-10-25T12:00:20.000Z") })];
    const prisma = makePrisma({ requestRows: rows, paymentStatus: "INITIATED", orderPaymentStatus: "UNPAID", orderStatus: "PENDING", includeCrossLifecycle: false });
    const { getTechnicalRequestInspector } = loadInspector(prisma);
    const result = await getTechnicalRequestInspector(requestId);
    assert.equal(result.error.classification, "REQUEST_FAILURE");
    assert.equal(result.error.primaryFailure.outcome, outcome);
    assert.equal(result.http.latestOutcome, outcome);
  }
});

test("successful retry preserves earlier failure as recovered history", async () => {
  const rows = [
    callbackEvent({ id: "retry-timeout", operation: "STATUS_QUERY", outcome: "TIMEOUT", durationMs: 20000,
      requestStartedAt: new Date("2026-10-25T13:00:00.000Z"), requestCompletedAt: new Date("2026-10-25T13:00:20.000Z"),
      createdAt: new Date("2026-10-25T13:00:20.000Z") }),
    callbackEvent({ id: "retry-success", operation: "STATUS_QUERY", outcome: "HTTP_SUCCESS", httpStatus: 200, durationMs: 200,
      requestStartedAt: new Date("2026-10-25T13:00:21.000Z"), requestCompletedAt: new Date("2026-10-25T13:00:21.200Z"),
      createdAt: new Date("2026-10-25T13:00:21.200Z") }),
    callbackEvent({ id: "retry-verify", operation: "VERIFY", outcome: "SUCCESS", createdAt: new Date("2026-10-25T13:00:21.300Z") }),
    callbackEvent({ id: "retry-settle", operation: "SETTLEMENT", outcome: "SUCCESS", createdAt: new Date("2026-10-25T13:00:21.400Z") }),
  ];
  const prisma = makePrisma({ requestRows: rows, includeCrossLifecycle: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.error.classification, "NO_CONFIRMED_PAYMENT_FAILURE");
  assert.equal(result.error.requestFailureCount, 1);
  assert.equal(result.error.recoveredFailureCount, 1);
  assert.equal(result.http.latestOutcome, "HTTP_SUCCESS");
  assert.equal(result.http.failureCount, 1);
});

test("incomplete and legacy requests retain explicit missing-evidence states", async () => {
  const prisma = makePrisma({ network: false, linkedPayment: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.payment.evidence, "UNAVAILABLE");
  assert.equal(result.network.evidence, "NOT_COLLECTED");
  assert.equal(result.network.collectorAuthenticationEvidence, "UNAVAILABLE");
  assert.equal(result.handshakes.tls.status, "NOT_OBSERVABLE");
  assert.equal(result.payment.transactionReference, "…1234");
});

test("provider handling is data-driven for EPS, AIBL and future gateways", async () => {
  for (const provider of ["EPS", "AIBL_WALLET", "FUTURE_GATEWAY"]) {
    const prisma = makePrisma({ provider });
    const { getTechnicalRequestInspector } = loadInspector(prisma);
    const result = await getTechnicalRequestInspector(requestId);
    assert.equal(result.overview.provider, provider);
    assert.equal(result.payment.provider, provider);
  }
});

test("authenticated customer classification depends on request-time server authorization evidence", async () => {
  const prisma = makePrisma({ actorUserId: "customer-1", initiatorCode: "INITIATOR_AUTHENTICATED_CUSTOMER",
    currentOrderOwnerId: "changed-after-request" });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.initiator.type, "CUSTOMER_CHECKOUT");
  assert.equal(result.initiator.source, "RECORDED");
  assert.equal(result.initiator.identityEvidence, "RECORDED");
  assert.equal(result.initiator.authenticationEvidence, "VERIFIED");
  assert.equal(result.initiator.authorizationEvidence, "VERIFIED");
  assert.equal(result.initiator.authenticationContext, "REQUEST_TIME_SESSION_AND_ORDER_OWNERSHIP_CHECK_PASSED");
  assert.equal(result.initiator.actor.role, "CUSTOMER");
});

test("legacy/deleted/disabled actor without request-time evidence is not upgraded by current user data", async () => {
  const prisma = makePrisma({ actorUserId: "historical-user", initiatorCode: null });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.initiator.type, "UNKNOWN");
  assert.equal(result.initiator.source, "RECORDED");
  assert.equal(result.initiator.identityEvidence, "RECORDED");
  assert.equal(result.initiator.authenticationEvidence, "UNAVAILABLE");
  assert.equal(result.initiator.actor.role, "RECORDED_ACTOR");
  assert.equal(result.initiator.actor.id, "…user");
  assert.match(result.initiator.authenticationContext, /REQUEST_TIME_AUTHORIZATION_EVIDENCE_UNAVAILABLE/);
});

test("admin request-time evidence records the exact permission gate without reading current RBAC", async () => {
  for (const [initiatorCode, expectedContext] of [
    ["INITIATOR_ADMIN_PAYMENT_MANAGE", "SETTINGS_PAYMENT_MANAGE_PERMISSION_CHECK_PASSED"],
    ["INITIATOR_ADMIN_SETTINGS_MANAGE", "SETTINGS_MANAGE_PERMISSION_CHECK_PASSED"],
    ["INITIATOR_ADMIN_SCOPED_PAYMENT_MANAGE", "SCOPED_SETTINGS_PAYMENT_MANAGE_PERMISSION_CHECK_PASSED"],
  ]) {
    const prisma = makePrisma({ initiatorCode });
    const { getTechnicalRequestInspector } = loadInspector(prisma);
    const result = await getTechnicalRequestInspector(requestId);
    assert.equal(result.initiator.type, "ADMIN_ACTION");
    assert.equal(result.initiator.authenticationEvidence, "VERIFIED");
    assert.ok(result.initiator.authenticationContext.includes(expectedContext));
  }
});

test("registered cron identity and guest-token diagnostics provide explicit initiator context", async () => {
  for (const [detailCode, expectedType, authContext, jobName] of [
    ["INITIATOR_SCHEDULED_CRON", "SCHEDULED_CRON", "REQUEST_TIME_CRON_SECRET_CHECK_PASSED", null],
    ["INITIATOR_CRON_AIBL_RECONCILIATION", "SCHEDULED_CRON", "REQUEST_TIME_CRON_SECRET_CHECK_PASSED", "aibl-wallet-reconciliation"],
    ["INITIATOR_CRON_EPS_RECONCILIATION", "SCHEDULED_CRON", "REQUEST_TIME_CRON_SECRET_CHECK_PASSED", "eps-payment-reconciliation"],
    ["INITIATOR_CRON_PAYMENT_CONTROL_RECONCILIATION", "SCHEDULED_CRON", "REQUEST_TIME_CRON_SECRET_CHECK_PASSED", "payment-control-reconciliation"],
    ["INITIATOR_GUEST_CHECKOUT", "CUSTOMER_CHECKOUT", "REQUEST_TIME_SIGNED_ORDER_TOKEN_VALIDATION_PASSED", null],
    ["INITIATOR_GUEST_RECONCILIATION", "PAYMENT_RECONCILIATION", "REQUEST_TIME_SIGNED_ORDER_TOKEN_VALIDATION_PASSED", null],
  ]) {
    const rows = [callbackEvent({ id: `identity-${detailCode}`, operation: "DIAGNOSTIC", outcome: "RECEIVED", detailCode })];
    const prisma = makePrisma({ requestRows: rows, includeCrossLifecycle: false });
    const { getTechnicalRequestInspector } = loadInspector(prisma);
    const result = await getTechnicalRequestInspector(requestId);
    assert.equal(result.initiator.type, expectedType);
    assert.equal(result.initiator.authenticationContext, authContext);
    assert.equal(result.initiator.authenticationEvidence, "VERIFIED");
    assert.equal(result.initiator.jobName, jobName);
    assert.equal(result.initiator.correlationId, requestId);
  }
});

test("a paid callback does not authenticate its sender and keeps verification as a separate claim", async () => {
  const rows = [
    callbackEvent({ id: "callback-request", operation: "CALLBACK", outcome: "RECEIVED" }),
    callbackEvent({ id: "callback-state", operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "CALLBACK_STATE_VALIDATED" }),
    callbackEvent({ id: "callback-payload", operation: "DIAGNOSTIC", outcome: "SUCCESS", detailCode: "CALLBACK_PAYLOAD_VALIDATED" }),
    callbackEvent({ id: "callback-verify", operation: "VERIFY", outcome: "SUCCESS" }),
    callbackEvent({ id: "callback-settlement", operation: "SETTLEMENT", outcome: "SUCCESS" }),
  ];
  const prisma = makePrisma({ requestRows: rows, includeCrossLifecycle: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.initiator.type, "PAYMENT_GATEWAY_CALLBACK");
  assert.equal(result.initiator.sourceService, "UNVERIFIED_CALLBACK_SOURCE");
  assert.equal(result.initiator.callbackEvidence.requestReceived, "RECORDED");
  assert.equal(result.initiator.callbackEvidence.senderAuthentication, "UNAVAILABLE");
  assert.equal(result.initiator.callbackEvidence.stateOrCorrelationValidation, "VERIFIED");
  assert.equal(result.initiator.callbackEvidence.payloadValidation, "VERIFIED");
  assert.equal(result.initiator.callbackEvidence.authoritativePaymentVerification, "VERIFIED");
  assert.equal(result.payment.finalOutcome.status, "SUCCESS");
});

test("malformed or legacy callback events never imply an authenticated sender", async () => {
  const rows = [callbackEvent({ id: "callback-rejected", operation: "CALLBACK", outcome: "REJECTED", detailCode: "INVALID_CALLBACK" })];
  const prisma = makePrisma({ requestRows: rows, includeCrossLifecycle: false });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.initiator.authenticationEvidence, "UNAVAILABLE");
  assert.equal(result.initiator.callbackEvidence.senderAuthentication, "UNAVAILABLE");
  assert.equal(result.initiator.callbackEvidence.authoritativePaymentVerification, "UNAVAILABLE");
  assert.equal(result.payment.finalOutcome.status, "SUCCESS");
});

test("backend operations without request-time initiator evidence are derived, not verified", async () => {
  const rows = [event({ id: "backend-auth", actorUserId: null, operation: "AUTH" })];
  const prisma = makePrisma({ requestRows: rows, includeCrossLifecycle: false, actorUserId: null, initiatorCode: null });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.initiator.type, "BACKEND_SERVICE");
  assert.equal(result.initiator.source, "DERIVED");
  assert.equal(result.initiator.identityEvidence, "DERIVED");
  assert.equal(result.initiator.authenticationEvidence, "UNAVAILABLE");
});

test("authentication history is sanitized and transport handshake metrics remain explicitly unavailable", async () => {
  const prisma = makePrisma();
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);

  assert.equal(result.authentication.evidence, "RECORDED");
  assert.equal(result.authentication.events.length, 1);
  assert.equal(result.authentication.events[0].operation, "AUTH");
  assert.equal(result.handshakes.dns.status, "NOT_OBSERVABLE");
  assert.equal(result.handshakes.tcp.connectionReused, null);
  assert.equal(result.handshakes.tls.cipherSuite, null);
  assert.equal(result.handshakes.tls.collectionMethod, "UNDICI_CONNECTION_EVENTS_NOT_REQUEST_CORRELATED");
  const serialized = JSON.stringify(result);
  for (const forbidden of ["must-never-be-returned", "SESSIONKEY", "accessToken", "127.0.0.1", "sensitive-bank-reference"]) {
    assert.equal(serialized.includes(forbidden), false, `leaked ${forbidden}`);
  }
});

test("distinct duplicate and concurrent records remain visible by event ID", async () => {
  const sameTime = new Date("2026-10-25T10:00:01.000Z");
  const prisma = makePrisma({ extraRows: [
    event({ id: "duplicate-a", operation: "CALLBACK", outcome: "RECEIVED", createdAt: sameTime }),
    event({ id: "duplicate-b", operation: "CALLBACK", outcome: "RECEIVED", createdAt: sameTime }),
  ] });
  const { getTechnicalRequestInspector } = loadInspector(prisma);
  const result = await getTechnicalRequestInspector(requestId);
  assert.equal(result.timeline.filter((item) => item.stage === "CALLBACK").length, 2);
  assert.equal(new Set(result.timeline.map((item) => item.id)).size, result.timeline.length);
});

test("invalid request IDs and out-of-range pages fail before expensive reads", async () => {
  const prisma = makePrisma();
  const { getTechnicalRequestInspector } = loadInspector(prisma);

  await assert.rejects(() => getTechnicalRequestInspector("not-a-request-id"), /valid payment Request ID/);
  assert.equal(prisma.calls, 0);
  await assert.rejects(() => getTechnicalRequestInspector(requestId, new URLSearchParams("page=21")), /between 1 and 20/);
  assert.equal(prisma.calls, 0);
});

test("API and UI source preserve authorization, no-store, read-only routing and new-tab links", () => {
  const route = readSource("app/api/admin/payment-control/requests/[requestId]/route.ts");
  const page = readSource("app/admin/payment-control/requests/[requestId]/page.tsx");
  const inspector = readSource("components/admin/payment-control/TechnicalInspector.tsx");
  const paymentCenter = readSource("components/admin/payment-control/PaymentControlCenter.tsx");
  const networkPanel = readSource("components/admin/payment-control/NetworkMonitoringPanel.tsx");

  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /requirePaymentControlAccess\(\)/);
  assert.match(route, /private, no-store/);
  assert.match(page, /requirePaymentControlAccess\(\)/);
  assert.match(inspector, /cache: "no-store"/);
  assert.match(inspector, /Copy JSON/);
  assert.match(inspector, /Download JSON/);
  assert.match(inspector, /data\.overview\.primaryRequestType/);
  assert.match(inspector, /data\.overview\.requestTiming\.durationMs/);
  assert.match(inspector, /data\.payment\.finalOutcome\.status/);
  assert.match(inspector, /data\.error\.classification/);
  assert.match(inspector, /data\.error\.diagnostics\.nonFatalCount/);
  assert.match(inspector, /data\.initiator\.authenticationEvidence/);
  assert.match(inspector, /data\.initiator\.callbackEvidence\.senderAuthentication/);
  assert.match(paymentCenter, /target="_blank"/);
  assert.match(networkPanel, /target="_blank"/);
});

test("event table links each full request once while preserving every event and column", () => {
  const Table = loadEventTable();
  // Deliberately share the displayed short prefix but use different full IDs.
  const callbackRequestId = "11111111-2222-4222-8222-222222222222";
  const events = [
    event({ id: "start", operation: "REQUEST", outcome: "STARTED", detailCode: "REQUEST_STARTED" }),
    event({ id: "callback", requestId: callbackRequestId, operation: "CALLBACK", outcome: "REJECTED", detailCode: "BILLNO_MISMATCH" }),
    event({ id: "http", operation: "HTTP", detailCode: "HTTP_SUCCESS" }),
    event({ id: "init", operation: "INITIALIZE", detailCode: "INITIALIZE_SUCCESS" }),
  ];
  const rows = eventTableRows(Table, events);
  assert.equal(rows.length, events.length);
  assert.deepEqual(rows.map((row) => (row.match(/View technical details/g) || []).length), [1, 1, 0, 0]);
  for (const [index, row] of rows.entries()) {
    const current = events[index];
    assert.equal((row.match(/<td\b/g) || []).length, 7);
    for (const value of ["UTC", "AIBL_WALLET", current.operation, current.outcome.replaceAll("_", " "), "200", "320 ms", current.detailCode]) {
      assert.ok(row.includes(value), `event ${current.id} lost ${value}`);
    }
    assert.match(row, /Network context/);
  }
  assert.match(rows[1], /REJECTED/);
  assert.doesNotMatch(rows[1], /PAYMENT_FAILED/);
  for (const [index, id] of [requestId, callbackRequestId].entries()) {
    assert.ok(rows[index].includes(`href="/admin/payment-control/requests/${id}"`));
    assert.match(rows[index], /target="_blank" rel="noopener noreferrer"/);
  }
});

test("event table recalculates the first link after filtering, sorting and pagination", () => {
  const Table = loadEventTable();
  const events = [
    event({ id: "start", operation: "REQUEST", detailCode: "START_DETAIL" }),
    event({ id: "http", operation: "HTTP", detailCode: "HTTP_DETAIL" }),
    event({ id: "init", operation: "INITIALIZE", detailCode: "INIT_DETAIL" }),
  ];
  // Filtering/search, reversed sort, a later page and load-more each provide
  // a different visible list to the existing table without changing its data.
  for (const visible of [events.filter((item) => item.operation !== "REQUEST"), [...events].reverse(), events.slice(2), events]) {
    const rows = eventTableRows(Table, visible);
    assert.equal(rows.length, visible.length);
    assert.match(rows[0], /View technical details/);
    assert.equal(rows.slice(1).some((row) => row.includes("View technical details")), false);
    rows.forEach((row, index) => assert.ok(row.includes(visible[index].detailCode)));
  }
  assert.deepEqual(events.map((item) => item.id), ["start", "http", "init"]);
});

test("event table retains historical events without inventing links for absent request IDs", () => {
  const Table = loadEventTable();
  const rows = eventTableRows(Table, [null, undefined, ""].map((id, index) =>
    event({ id: `legacy-${index}`, requestId: id, detailCode: `LEGACY_DETAIL_${index}` })));
  assert.equal(rows.length, 3);
  rows.forEach((row, index) => {
    assert.ok(row.includes(`LEGACY_DETAIL_${index}`));
    assert.doesNotMatch(row, /View technical details|\/requests\/|Network context/);
  });
  const html = renderToStaticMarkup(React.createElement(Table, { events: [] }));
  assert.match(html, /No recorded events\./);
  assert.doesNotMatch(html, /View technical details/);
});

test("API authorizes before returning an inspector response", async () => {
  let authorized = false;
  let inspected = false;
  const { GET } = loadRoute({
    authorize: async () => { authorized = true; },
    inspect: async (id) => { inspected = true; return { requestId: id }; },
  });
  const response = await GET(
    { nextUrl: { searchParams: new URLSearchParams() } },
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(authorized, true);
  assert.equal(inspected, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
});

test("Windows collector keeps legacy host JSON field and isolates malformed probes", () => {
  const collector = readSource("scripts/network-monitor/windows-collector.ps1");
  assert.match(collector, /\$hostCounters = Get-HostCounters/);
  assert.match(collector, /host = \$hostCounters/);
  assert.match(collector, /function Test-ApprovedProbeTarget/);
  assert.match(collector, /foreach \(\$target in @\(\$configuration\.targets\)\) \{\s*try \{/);
  assert.match(collector, /Probe skipped; safe target processing failure\./);
  assert.doesNotMatch(collector, /\$host\s*=/i);
});

test("API does not inspect data after an authorization failure", async () => {
  let inspected = false;
  const { GET } = loadRoute({
    authorize: async () => { throw new PaymentControlError("Unauthorized", 401); },
    inspect: async () => { inspected = true; return {}; },
  });
  const response = await GET(
    { nextUrl: { searchParams: new URLSearchParams() } },
    { params: Promise.resolve({ requestId }) },
  );
  assert.equal(inspected, false);
  assert.equal(response.status, 401);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
});

test("inspector aggregation remains read-only and does not import gateway settlement code", () => {
  const source = readSource("lib/payment-control/request-inspector.ts") + readSource("lib/payment-control/request-inspector-reader.ts");
  assert.doesNotMatch(source, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
  assert.doesNotMatch(source, /@\/lib\/(eps|aibl-wallet|sslcommerz)/);
  assert.doesNotMatch(source, /paymentGatewayData:\s*true/);
  assert.doesNotMatch(source, /address:\s*true/);
  assert.doesNotMatch(source, /prisma\.user\.findUnique/);
  assert.match(source, /take: 101/);
  assert.match(source, /take: 50/);
});

test("payment initialization actors come from server sessions and validated order authorization, not request body IDs", () => {
  for (const path of ["app/api/aibl-wallet/init/route.ts", "app/api/eps/init/route.ts", "app/api/sslcommerz/init/route.ts"]) {
    const source = readSource(path);
    assert.match(source, /getServerSession\(authOptions\)/);
    assert.match(source, /INITIATOR_AUTHENTICATED_CUSTOMER/);
    assert.doesNotMatch(source, /body\.(actorUserId|userId)/);
  }
});

test("request-time admin and cron markers are emitted only on authorized paths", () => {
  const admin = readSource("app/api/admin/payment-control/[id]/route.ts");
  const comparison = readSource("lib/payment-control/reconciliation.ts");
  const cronRoutes = [
    readSource("app/api/cron/reconcile-aibl-wallet/route.ts"),
    readSource("app/api/cron/reconcile-eps-payments/route.ts"),
    readSource("app/api/cron/payment-control/route.ts"),
  ];
  assert.ok(admin.indexOf("requirePaymentControlAccess(request, true)") < admin.indexOf("kind: \"ADMIN\""));
  assert.match(comparison, /INITIATOR_ADMIN_AUTHORIZED/);
  assert.match(comparison, /INITIATOR_CRON_PAYMENT_CONTROL_RECONCILIATION/);
  assert.ok(cronRoutes.every((source) => /INITIATOR_CRON_|authorization.*secret|Bearer/.test(source)));
  assert.ok(cronRoutes.every((source) => {
    const authGuard = source.indexOf("if (!secret");
    const loop = source.indexOf("for (const payment");
    return authGuard >= 0 && loop > authGuard;
  }));
});

function transportAttempt(suffix, reused = false) {
  const metric = { status: reused ? "REUSED" : "OBSERVED", startTime: reused ? null : "2026-10-25T10:00:00.000Z",
    endTime: reused ? null : "2026-10-25T10:00:00.010Z", durationMs: reused ? null : 10, errorCode: null };
  return { version: 1, provider: "AIBL_WALLET", operation: "VERIFY", requestId,
    attemptId: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix.padStart(12, "0")}`, connectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    destinationOrigin: "https://iwtest.aibl.com.bd", startedAt: "2026-10-25T10:00:00.000Z", completedAt: "2026-10-25T10:00:00.100Z",
    requestTimingSource: "UNDICI_REQUEST_EVENTS",
    connectionReused: reused, attribution: "SOCKET_CORRELATED", collectionMethod: "UNDICI_INSTRUMENTED_CONNECTOR",
    requestOutcome: "HTTP_RESPONSE", errorCode: null, dns: metric, tcp: metric, tls: metric,
    connectionEvidence: { tls: { tlsVersion: "TLSv1.3", cipherSuite: "TLS_AES_256_GCM_SHA384", certificateValidated: true } } };
}
test("v1.4 keeps v1.3 payment and initiator fields while reporting a single actual transport attempt", async () => {
  const { getTechnicalRequestInspector } = loadInspector(makePrisma(), [transportAttempt("1")]);
  const result = await getTechnicalRequestInspector(requestId);
  assert.equal(result.schemaVersion, "1.4"); assert.equal(result.payment.paymentStatus, "CAPTURED");
  assert.equal(result.payment.orderPaymentStatus, "PAID"); assert.ok(result.initiator.authenticationContext);
  assert.equal(result.handshakes.tcp.durationMs, 10); assert.equal(result.handshakes.tls.status, "OBSERVED");
  assert.equal(result.transportEvidence.attempts.length, 1);
});
test("multiple transport attempts never combine unrelated handshake durations into legacy summary", async () => {
  const { getTechnicalRequestInspector } = loadInspector(makePrisma(), [transportAttempt("1"), transportAttempt("2", true)]);
  const result = await getTechnicalRequestInspector(requestId);
  assert.equal(result.transportEvidence.attempts.length, 2); assert.equal(result.handshakes.tcp.durationMs, null);
  assert.equal(result.handshakes.tls.status, "NOT_OBSERVABLE"); assert.equal(result.payment.paymentStatus, "CAPTURED");
});
test("reused transport summary retains null per-attempt durations", async () => {
  const { getTechnicalRequestInspector } = loadInspector(makePrisma(), [transportAttempt("1", true)]);
  const result = await getTechnicalRequestInspector(requestId);
  assert.equal(result.handshakes.tls.connectionReused, true); assert.equal(result.handshakes.tls.durationMs, null);
  assert.equal(result.handshakes.tls.status, "REUSED");
});
