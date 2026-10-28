import type { Prisma } from "@/generated/prisma";
import type { InspectorEvidenceState, InspectorTimelineEvent, TechnicalInspectorResponse } from "./inspector-types";
import type { InspectorTransportEvidence } from "./transport-types";
import { inboundTransportEvidence, transportConfiguration } from "./transport-config";

// Shared read model: callers supply their own authorized, read-only data access.
// No application bootstrap, gateway imports, listeners, jobs or database singleton.
export type InspectorReadDependencies = {
  prisma: {
    paymentEvent: Pick<Prisma.TransactionClient["paymentEvent"], "count" | "findMany" | "findFirst">;
    payment: Pick<Prisma.TransactionClient["payment"], "findUnique">;
    networkMonitorAgent: Pick<Prisma.TransactionClient["networkMonitorAgent"], "findUnique">;
    networkHostSample: Pick<Prisma.TransactionClient["networkHostSample"], "findMany">;
    networkProbeSample: Pick<Prisma.TransactionClient["networkProbeSample"], "findMany">;
    networkMonitorAlert: Pick<Prisma.TransactionClient["networkMonitorAlert"], "findMany">;
  };
  PaymentControlError: new (message: string, status?: number) => Error;
  uuidPattern: RegExp;
  readTransportEvidence: (requestId: string) => Promise<Pick<InspectorTransportEvidence, "storage" | "attempts" | "limited" | "collectionHealth">>;
};

const PAGE_SIZE = 50;
const MAX_PAGE = 20;
const terminalOutcomes = new Set([
  "HTTP_SUCCESS",
  "HTTP_ERROR",
  "TIMEOUT",
  "CONNECTION_ERROR",
]);
const unsuccessfulOutcomes = new Set([
  "HTTP_ERROR",
  "TIMEOUT",
  "CONNECTION_ERROR",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "MISMATCH",
  "ERROR",
]);
const informationalDiagnosticOutcomes = new Set([
  "RECEIVED",
  "SUCCESS",
  "PENDING",
  "DUPLICATE",
]);
// These codes only report whether undocumented alternative casing was present.
// Their absence never participates in callback authorization or settlement.
const nonFatalDiagnosticCodes = new Set([
  "AIBL_CB_ALT_BILL_CAMEL",
  "AIBL_CB_ALT_BILL_LOWER",
  "AIBL_CB_ALT_BILL_SNAKE",
  "AIBL_CB_ALT_BILL_PASCAL",
  "AIBL_CB_ALT_AMOUNT_LOWER",
  "AIBL_CB_ALT_AMOUNT_PASCAL",
]);
const initiatorDiagnosticCodes = new Set([
  "INITIATOR_SCHEDULED_CRON",
  "INITIATOR_GUEST_CHECKOUT",
  "INITIATOR_GUEST_RECONCILIATION",
  "INITIATOR_AUTHENTICATED_CUSTOMER",
  "INITIATOR_ADMIN_AUTHORIZED",
  "INITIATOR_ADMIN_PAYMENT_MANAGE",
  "INITIATOR_ADMIN_SETTINGS_MANAGE",
  "INITIATOR_ADMIN_SCOPED_PAYMENT_MANAGE",
  "INITIATOR_ADMIN_SCOPED_SETTINGS_MANAGE",
  "INITIATOR_CRON_AIBL_RECONCILIATION",
  "INITIATOR_CRON_EPS_RECONCILIATION",
  "INITIATOR_CRON_PAYMENT_CONTROL_RECONCILIATION",
]);

const eventSelect = {
  id: true,
  requestId: true,
  networkAgentId: true,
  requestStartedAt: true,
  requestCompletedAt: true,
  paymentId: true,
  orderId: true,
  transactionId: true,
  provider: true,
  operation: true,
  outcome: true,
  httpStatus: true,
  durationMs: true,
  gatewayStatus: true,
  detailCode: true,
  actorUserId: true,
  createdAt: true,
} as const;

type RecordedEvent = Prisma.PaymentEventGetPayload<{
  select: typeof eventSelect;
}>;

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function maskedReference(value: string | null | undefined) {
  if (!value) return null;
  const suffix = value.slice(-4);
  return `…${suffix}`;
}

function latestStage(events: RecordedEvent[], operation: string) {
  return [...events].reverse().find((event) => event.operation === operation);
}

function paymentFinalOutcome(status: string | null | undefined) {
  if (!status) return { status: "UNAVAILABLE", evidence: "UNAVAILABLE" as const, source: null };
  if (status === "CAPTURED") return { status: "SUCCESS", evidence: "RECORDED" as const, source: "PAYMENT_STATUS_CAPTURED" };
  if (status === "FAILED" || status === "VOIDED") {
    return { status, evidence: "RECORDED" as const, source: `PAYMENT_STATUS_${status}` };
  }
  if (status === "REFUNDED") return { status: "REFUNDED", evidence: "RECORDED" as const, source: "PAYMENT_STATUS_REFUNDED" };
  return { status: "PENDING", evidence: "RECORDED" as const, source: `PAYMENT_STATUS_${status}` };
}

function maskActorId(id: string | null | undefined) {
  return id ? `…${id.slice(-4)}` : null;
}

function classifyInitiator(events: RecordedEvent[], requestId: string) {
  const identityEvent = events.find((event) => event.operation === "DIAGNOSTIC" &&
    ["SUCCESS", "RECEIVED"].includes(event.outcome) && event.detailCode && initiatorDiagnosticCodes.has(event.detailCode));
  const actorEvent = events.find((event) => event.actorUserId);
  const callback = events.find((event) => event.operation === "CALLBACK");
  const callbackStateValidated = events.some((event) => event.operation === "DIAGNOSTIC" &&
    ["CALLBACK_STATE_VALIDATED", "CALLBACK_CORRELATION_VALIDATED"].includes(event.detailCode ?? "") && event.outcome === "SUCCESS");
  const callbackPayloadValidated = events.some((event) => event.operation === "DIAGNOSTIC" &&
    event.detailCode === "CALLBACK_PAYLOAD_VALIDATED" && event.outcome === "SUCCESS");
  const authoritativeVerification = events.some((event) => event.operation === "VERIFY" &&
    ["SUCCESS", "FAILED", "CANCELLED"].includes(event.outcome))
    ? "VERIFIED" as const
    : events.some((event) => event.operation === "VERIFY") ? "RECORDED" as const : "UNAVAILABLE" as const;
  const callbackEvidence = {
    requestReceived: callback ? "RECORDED" as const : "UNAVAILABLE" as const,
    senderAuthentication: "UNAVAILABLE" as const,
    stateOrCorrelationValidation: callbackStateValidated ? "VERIFIED" as const : "UNAVAILABLE" as const,
    payloadValidation: callbackPayloadValidated ? "VERIFIED" as const : "UNAVAILABLE" as const,
    authoritativePaymentVerification: authoritativeVerification,
  };
  const common = {
    correlationId: requestId,
    traceId: null as null,
  };
  const callbackNotApplicable = {
    requestReceived: "UNAVAILABLE" as const,
    senderAuthentication: "UNAVAILABLE" as const,
    stateOrCorrelationValidation: "UNAVAILABLE" as const,
    payloadValidation: "UNAVAILABLE" as const,
    authoritativePaymentVerification: "UNAVAILABLE" as const,
  };
  const actor = actorEvent?.actorUserId ? { id: maskActorId(actorEvent.actorUserId) ?? "UNKNOWN", name: null } : null;

  if (identityEvent?.detailCode === "INITIATOR_AUTHENTICATED_CUSTOMER") {
    return {
      type: "CUSTOMER_CHECKOUT", source: "RECORDED" as const,
      identityEvidence: "RECORDED" as const, authenticationEvidence: "VERIFIED" as const,
      authorizationEvidence: "VERIFIED" as const,
      actor: actor ? { ...actor, role: "CUSTOMER" } : null,
      sourceService: "STOREFRONT_CHECKOUT", destinationService: `${identityEvent.provider}_PAYMENT_SERVICE`,
      triggeringOperation: actorEvent?.operation ?? "INITIALIZE",
      authenticationContext: "REQUEST_TIME_SESSION_AND_ORDER_OWNERSHIP_CHECK_PASSED",
      evidenceSource: "TRUSTED_REQUEST_TIME_AUTHORIZATION_DIAGNOSTIC", jobName: null,
      callbackEvidence: callbackNotApplicable, ...common,
    };
  }
  if (identityEvent && ["INITIATOR_ADMIN_AUTHORIZED", "INITIATOR_ADMIN_PAYMENT_MANAGE", "INITIATOR_ADMIN_SETTINGS_MANAGE",
    "INITIATOR_ADMIN_SCOPED_PAYMENT_MANAGE", "INITIATOR_ADMIN_SCOPED_SETTINGS_MANAGE"].includes(identityEvent.detailCode ?? "")) {
    const adminAuthenticationContexts: Record<string, string> = {
      INITIATOR_ADMIN_PAYMENT_MANAGE: "REQUEST_TIME_ADMIN_SESSION_AND_SETTINGS_PAYMENT_MANAGE_PERMISSION_CHECK_PASSED",
      INITIATOR_ADMIN_SETTINGS_MANAGE: "REQUEST_TIME_ADMIN_SESSION_AND_SETTINGS_MANAGE_PERMISSION_CHECK_PASSED",
      INITIATOR_ADMIN_SCOPED_PAYMENT_MANAGE: "REQUEST_TIME_ADMIN_SESSION_AND_SCOPED_SETTINGS_PAYMENT_MANAGE_PERMISSION_CHECK_PASSED",
      INITIATOR_ADMIN_SCOPED_SETTINGS_MANAGE: "REQUEST_TIME_ADMIN_SESSION_AND_SCOPED_SETTINGS_MANAGE_PERMISSION_CHECK_PASSED",
    };
    return {
      type: "ADMIN_ACTION", source: "RECORDED" as const,
      identityEvidence: "RECORDED" as const, authenticationEvidence: "VERIFIED" as const,
      authorizationEvidence: "VERIFIED" as const,
      actor: actor ? { ...actor, role: "ADMIN" } : null,
      sourceService: "ADMIN_APPLICATION", destinationService: `${identityEvent.provider}_PAYMENT_SERVICE`,
      triggeringOperation: actorEvent?.operation ?? "STATUS_QUERY",
      authenticationContext: adminAuthenticationContexts[identityEvent.detailCode ?? ""] ??
        "REQUEST_TIME_ADMIN_SESSION_AND_PAYMENT_PERMISSION_CHECK_PASSED",
      evidenceSource: "TRUSTED_REQUEST_TIME_AUTHORIZATION_DIAGNOSTIC", jobName: null,
      callbackEvidence: callbackNotApplicable, ...common,
    };
  }
  if (identityEvent?.detailCode === "INITIATOR_GUEST_CHECKOUT" || identityEvent?.detailCode === "INITIATOR_GUEST_RECONCILIATION") {
    const isCheckout = identityEvent.detailCode === "INITIATOR_GUEST_CHECKOUT";
    return {
      type: isCheckout ? "CUSTOMER_CHECKOUT" : "PAYMENT_RECONCILIATION", source: "RECORDED" as const,
      identityEvidence: "UNAVAILABLE" as const, authenticationEvidence: "VERIFIED" as const,
      authorizationEvidence: "VERIFIED" as const, actor: null,
      sourceService: isCheckout ? "GUEST_STOREFRONT_CHECKOUT" : "GUEST_STOREFRONT_PAYMENT_STATUS",
      destinationService: `${identityEvent.provider}_PAYMENT_SERVICE`,
      triggeringOperation: isCheckout ? "INITIALIZE" : "STATUS_QUERY",
      authenticationContext: "REQUEST_TIME_SIGNED_ORDER_TOKEN_VALIDATION_PASSED",
      evidenceSource: "TRUSTED_REQUEST_TIME_TOKEN_VALIDATION_DIAGNOSTIC", jobName: null,
      callbackEvidence: callbackNotApplicable, ...common,
    };
  }
  const cronJobs: Record<string, string | null> = {
    INITIATOR_CRON_AIBL_RECONCILIATION: "aibl-wallet-reconciliation",
    INITIATOR_CRON_EPS_RECONCILIATION: "eps-payment-reconciliation",
    INITIATOR_CRON_PAYMENT_CONTROL_RECONCILIATION: "payment-control-reconciliation",
    INITIATOR_SCHEDULED_CRON: null,
  };
  if (identityEvent?.detailCode && Object.hasOwn(cronJobs, identityEvent.detailCode)) {
    return {
      type: "SCHEDULED_CRON", source: "RECORDED" as const,
      identityEvidence: "RECORDED" as const, authenticationEvidence: "VERIFIED" as const,
      authorizationEvidence: "VERIFIED" as const, actor: null,
      sourceService: "REGISTERED_PAYMENT_RECONCILIATION_JOB",
      destinationService: `${identityEvent.provider}_PAYMENT_SERVICE`, triggeringOperation: "RECONCILIATION",
      authenticationContext: "REQUEST_TIME_CRON_SECRET_CHECK_PASSED",
      evidenceSource: "TRUSTED_REGISTERED_JOB_DIAGNOSTIC", jobName: cronJobs[identityEvent.detailCode] ?? null,
      callbackEvidence: callbackNotApplicable, ...common,
    };
  }
  if (callback) {
    return {
      type: "PAYMENT_GATEWAY_CALLBACK", source: "RECORDED" as const,
      identityEvidence: "UNKNOWN" as const, authenticationEvidence: "UNAVAILABLE" as const,
      authorizationEvidence: "UNKNOWN" as const, actor: null,
      sourceService: "UNVERIFIED_CALLBACK_SOURCE", destinationService: "PAYMENT_CALLBACK_HANDLER",
      triggeringOperation: callback.operation,
      authenticationContext: "CALLBACK_REQUEST_RECEIVED; SENDER_IDENTITY_NOT_AUTHENTICATED",
      evidenceSource: "PAYMENT_EVENT_CALLBACK_REQUEST", jobName: null,
      callbackEvidence, ...common,
    };
  }
  if (actorEvent) {
    return {
      type: "UNKNOWN", source: "RECORDED" as const,
      identityEvidence: "RECORDED" as const, authenticationEvidence: "UNAVAILABLE" as const,
      authorizationEvidence: "UNKNOWN" as const,
      actor: actor ? { ...actor, role: "RECORDED_ACTOR" } : null,
      sourceService: "UNKNOWN", destinationService: `${actorEvent.provider}_PAYMENT_SERVICE`,
      triggeringOperation: actorEvent.operation,
      authenticationContext: "HISTORICAL_ACTOR_ID_RECORDED; REQUEST_TIME_AUTHORIZATION_EVIDENCE_UNAVAILABLE",
      evidenceSource: "PAYMENT_EVENT_ACTOR_REFERENCE_ONLY", jobName: null,
      callbackEvidence: callbackNotApplicable, ...common,
    };
  }
  const operationEvent = events.find((event) => ["STATUS_QUERY", "VERIFY", "SETTLEMENT", "AUTH", "INITIALIZE"].includes(event.operation));
  if (operationEvent) {
    const reconciliation = ["STATUS_QUERY", "VERIFY", "SETTLEMENT"].includes(operationEvent.operation);
    return {
      type: reconciliation ? "PAYMENT_RECONCILIATION" : "BACKEND_SERVICE", source: "DERIVED" as const,
      identityEvidence: "DERIVED" as const, authenticationEvidence: "UNAVAILABLE" as const,
      authorizationEvidence: "UNKNOWN" as const, actor: null,
      sourceService: "PAYMENT_BACKEND", destinationService: `${operationEvent.provider}_API`,
      triggeringOperation: operationEvent.operation,
      authenticationContext: "NO_REQUEST_TIME_CALLER_AUTHENTICATION_EVIDENCE",
      evidenceSource: "RECORDED_OPERATION_CLASSIFICATION", jobName: null,
      callbackEvidence: callbackNotApplicable, ...common,
    };
  }
  return {
    type: "UNKNOWN", source: "UNAVAILABLE" as const,
    identityEvidence: "UNAVAILABLE" as const, authenticationEvidence: "UNAVAILABLE" as const,
    authorizationEvidence: "UNAVAILABLE" as const, actor: null,
    sourceService: "UNKNOWN", destinationService: "UNKNOWN",
    triggeringOperation: events[0]?.operation ?? "UNKNOWN", authenticationContext: "NO_RELIABLE_INITIATOR_EVIDENCE",
    evidenceSource: "NONE", jobName: null, callbackEvidence: callbackNotApplicable, ...common,
  };
}

function timelineEvent(event: RecordedEvent): InspectorTimelineEvent {
  return {
    id: event.id,
    requestId: event.requestId,
    timestamp: event.createdAt.toISOString(),
    stage: event.operation,
    outcome: event.outcome,
    httpStatus: event.httpStatus,
    durationMs: event.durationMs,
    gatewayStatus: event.gatewayStatus,
    detailCode: event.detailCode,
    paymentId: event.paymentId,
    orderId: event.orderId,
    networkAgentId: event.networkAgentId,
    requestStartedAt: iso(event.requestStartedAt),
    requestCompletedAt: iso(event.requestCompletedAt),
  };
}

function parsePage(value: string | null, PaymentControlError: InspectorReadDependencies["PaymentControlError"]) {
  const page = Number(value ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
    throw new PaymentControlError(`Timeline page must be between 1 and ${MAX_PAGE}`);
  }
  return page;
}

export async function readTechnicalRequestInspector(
  dependencies: InspectorReadDependencies,
  requestId: string,
  params = new URLSearchParams(),
): Promise<TechnicalInspectorResponse> {
  const { prisma, PaymentControlError, uuidPattern, readTransportEvidence } = dependencies;
  if (!uuidPattern.test(requestId)) {
    throw new PaymentControlError("A valid payment Request ID is required");
  }
  const page = parsePage(params.get("page"), PaymentControlError);
  const where = { requestId } as const;
  const [
    totalEvents,
    events,
    firstEvent,
    lastEvent,
    linkedEvent,
    actorEvent,
    terminalEvent,
    operationalFailure,
    primaryOperationalEvent,
    lastOperationalEvent,
    summaryEvents,
  ] =
    await Promise.all([
      prisma.paymentEvent.count({ where }),
      prisma.paymentEvent.findMany({
        where,
        select: eventSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.paymentEvent.findFirst({ where, select: eventSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.paymentEvent.findFirst({ where, select: eventSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.paymentEvent.findFirst({ where: { requestId, paymentId: { not: null } }, select: eventSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.paymentEvent.findFirst({ where: { requestId, actorUserId: { not: null } }, select: eventSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.paymentEvent.findFirst({ where: { requestId, outcome: { in: [...terminalOutcomes] } }, select: eventSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.paymentEvent.findFirst({ where: { requestId, operation: { not: "DIAGNOSTIC" }, outcome: { in: [...unsuccessfulOutcomes] } }, select: eventSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.paymentEvent.findFirst({ where: { requestId, operation: { not: "DIAGNOSTIC" } }, select: eventSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.paymentEvent.findFirst({ where: { requestId, operation: { not: "DIAGNOSTIC" } }, select: eventSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.paymentEvent.findMany({
        where,
        select: eventSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: PAGE_SIZE * MAX_PAGE + 1,
      }),
    ]);

  if (!totalEvents || !firstEvent || !lastEvent) {
    throw new PaymentControlError("Recorded payment request not found", 404);
  }

  const payment = linkedEvent?.paymentId
    ? await prisma.payment.findUnique({
        where: { id: linkedEvent.paymentId },
        select: {
          id: true,
          orderId: true,
          amount: true,
          currency: true,
          provider: true,
          status: true,
          externalId: true,
          order: { select: { paymentStatus: true, status: true } },
        },
      })
    : null;

  const allPageEvents = events as RecordedEvent[];
  const summaryLimited = summaryEvents.length > PAGE_SIZE * MAX_PAGE;
  const requestEvents = Array.from(
    new Map(
      [
        ...summaryEvents.slice(0, PAGE_SIZE * MAX_PAGE),
        firstEvent,
        lastEvent,
        terminalEvent,
        operationalFailure,
        primaryOperationalEvent,
        lastOperationalEvent,
        linkedEvent,
        actorEvent,
      ]
        .filter((event): event is RecordedEvent => Boolean(event))
        .map((event) => [event.id, event]),
    ).values(),
  ).sort((left, right) =>
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.id.localeCompare(right.id),
  );
  const initiator = classifyInitiator(requestEvents, requestId);
  const provider = firstEvent.provider;
  const lifecycleWhere = payment
    ? {
        OR: [
          { paymentId: payment.id },
          ...(payment.externalId
            ? [{ transactionId: payment.externalId, provider: payment.provider ?? provider }]
            : []),
        ],
      }
    : null;
  const [relatedLifecycle, lastLifecycleEvent] = lifecycleWhere
    ? await Promise.all([
        prisma.paymentEvent.findMany({
          where: lifecycleWhere,
          select: eventSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 101,
        }),
        prisma.paymentEvent.findFirst({
          where: lifecycleWhere,
          select: eventSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      ])
    : [requestEvents, lastEvent] as const;
  const lifecycleEvents = relatedLifecycle.slice(0, 100);
  const primaryTypeEvent = primaryOperationalEvent ?? firstEvent;
  const requestTypeEvidence: InspectorEvidenceState = primaryOperationalEvent && primaryOperationalEvent.id !== firstEvent.id
    ? "DERIVED"
    : "RECORDED";
  const operationalTypes = new Set(requestEvents
    .filter((event) => event.operation !== "DIAGNOSTIC")
    .map((event) => event.operation));
  const primaryHttpCandidates = requestEvents.filter((event) =>
    event.operation === primaryTypeEvent.operation && terminalOutcomes.has(event.outcome) &&
    event.requestStartedAt && event.requestCompletedAt && event.durationMs !== null,
  );
  // Timing columns belong to individual gateway HTTP operations. They represent
  // request-level timing only when this Request ID contains one operation/result.
  const requestTimingEvent = operationalTypes.size === 1 && primaryHttpCandidates.length === 1
    ? primaryHttpCandidates[0]
    : null;
  const requestTiming = requestTimingEvent
    ? {
        evidence: "RECORDED" as const,
        startTime: requestTimingEvent.requestStartedAt!.toISOString(),
        endTime: requestTimingEvent.requestCompletedAt!.toISOString(),
        durationMs: requestTimingEvent.durationMs,
        sourceOperation: requestTimingEvent.operation,
      }
    : { evidence: "UNAVAILABLE" as const, startTime: null, endTime: null, durationMs: null, sourceOperation: null };
  const observedRequestWindow = {
    evidence: "DERIVED" as const,
    startTime: firstEvent.createdAt.toISOString(),
    endTime: lastEvent.createdAt.toISOString(),
    windowMs: Math.max(0, lastEvent.createdAt.getTime() - firstEvent.createdAt.getTime()),
  };
  const lifecycleFirstEvent = lifecycleEvents[0] ?? null;
  const observedLifecycleWindow = lifecycleFirstEvent && lastLifecycleEvent
    ? {
        evidence: "DERIVED" as const,
        startTime: lifecycleFirstEvent.createdAt.toISOString(),
        endTime: lastLifecycleEvent.createdAt.toISOString(),
        windowMs: Math.max(0, lastLifecycleEvent.createdAt.getTime() - lifecycleFirstEvent.createdAt.getTime()),
      }
    : { evidence: "UNAVAILABLE" as const, startTime: null, endTime: null, windowMs: null };

  const boundEvent = terminalEvent?.networkAgentId && terminalEvent.requestStartedAt && terminalEvent.requestCompletedAt
    ? terminalEvent
    : null;
  const contextWindowSeconds = boundEvent ? 120 : null;
  const contextStart = boundEvent
    ? new Date(boundEvent.requestStartedAt!.getTime() - contextWindowSeconds! * 1000)
    : null;
  const contextEnd = boundEvent
    ? new Date(boundEvent.requestCompletedAt!.getTime() + contextWindowSeconds! * 1000)
    : null;
  const [agent, hostSamples, probeSamples, alerts] = await Promise.all([
    boundEvent ? prisma.networkMonitorAgent.findUnique({ where: { id: boundEvent.networkAgentId! }, select: { id: true, label: true } }) : null,
    boundEvent ? prisma.networkHostSample.findMany({
      where: { agentId: boundEvent.networkAgentId!, observedAt: { gte: contextStart!, lte: contextEnd! } },
      select: {
        observedAt: true,
        intervalStartAt: true,
        counterState: true,
        packetsSent: true,
        packetsReceived: true,
        packetsDropped: true,
        tcpRetransmissions: true,
        tcpConnectionFailures: true,
        sentDelta: true,
        receivedDelta: true,
        droppedDelta: true,
        retransmissionsDelta: true,
        connectionFailuresDelta: true,
      },
      orderBy: [{ observedAt: "asc" }, { id: "asc" }],
      take: 20,
    }) : [],
    boundEvent ? prisma.networkProbeSample.findMany({
      where: { sample: { agentId: boundEvent.networkAgentId! }, completedAt: { gte: contextStart!, lte: contextEnd! } },
      select: {
        targetLabel: true,
        protocol: true,
        port: true,
        startedAt: true,
        completedAt: true,
        outcome: true,
        latencyMs: true,
        elapsedMs: true,
        errorCode: true,
      },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
      take: 40,
    }) : [],
    prisma.networkMonitorAlert.findMany({
      where: { requestId },
      select: {
        scope: true,
        code: true,
        status: true,
        value: true,
        threshold: true,
        occurrences: true,
        firstSeenAt: true,
        lastSeenAt: true,
        resolvedAt: true,
      },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
  ]);

  const httpEvents = requestEvents.filter((event) => terminalOutcomes.has(event.outcome));
  const lastHttp = terminalEvent ?? httpEvents.at(-1) ?? null;
  const authentication = latestStage(requestEvents, "AUTH") ??
    (firstEvent.operation === "AUTH" ? firstEvent : null);
  const verification = latestStage(lifecycleEvents, "VERIFY") ?? latestStage(lifecycleEvents, "STATUS_QUERY");
  const settlement = latestStage(lifecycleEvents, "SETTLEMENT");
  const paymentEvidence: InspectorEvidenceState = payment ? "RECORDED" : "UNAVAILABLE";
  const finalPaymentOutcome = paymentFinalOutcome(payment?.status);
  const operationalFailures = requestEvents.filter((event) =>
    event.operation !== "DIAGNOSTIC" && unsuccessfulOutcomes.has(event.outcome),
  );
  const diagnosticEvents = requestEvents.filter((event) => event.operation === "DIAGNOSTIC");
  const nonFatalDiagnostics = diagnosticEvents.filter((event) =>
    event.outcome === "REJECTED" && Boolean(event.detailCode && nonFatalDiagnosticCodes.has(event.detailCode)),
  );
  const nonFatalDiagnosticIds = new Set(nonFatalDiagnostics.map((event) => event.id));
  const informationalDiagnostics = diagnosticEvents.filter((event) =>
    !nonFatalDiagnosticIds.has(event.id) &&
    informationalDiagnosticOutcomes.has(event.outcome),
  );
  const informationalDiagnosticIds = new Set(informationalDiagnostics.map((event) => event.id));
  const unclassifiedDiagnostics = diagnosticEvents.filter((event) =>
    !nonFatalDiagnosticIds.has(event.id) && !informationalDiagnosticIds.has(event.id),
  );
  const requestOutcomeEvent = lastOperationalEvent ?? lastEvent;
  const requestEndedInFailure = requestOutcomeEvent.operation !== "DIAGNOSTIC" &&
    unsuccessfulOutcomes.has(requestOutcomeEvent.outcome);
  const confirmedPaymentFailure = payment?.status === "FAILED" || payment?.status === "VOIDED";
  const primaryFailure = confirmedPaymentFailure || requestEndedInFailure
    ? operationalFailure ?? (requestEndedInFailure ? requestOutcomeEvent : null)
    : null;
  const errorClassification = confirmedPaymentFailure
    ? "CONFIRMED_PAYMENT_FAILURE" as const
    : requestEndedInFailure
      ? "REQUEST_FAILURE" as const
      : unclassifiedDiagnostics.length && !["SUCCESS", "REFUNDED"].includes(finalPaymentOutcome.status)
        ? "UNKNOWN_UNCLASSIFIED" as const
        : "NO_CONFIRMED_PAYMENT_FAILURE" as const;
  const errorSummary = errorClassification === "CONFIRMED_PAYMENT_FAILURE"
    ? "Payment state confirms a payment failure"
    : errorClassification === "REQUEST_FAILURE"
      ? "The latest recorded request operation failed; payment failure is not inferred"
      : errorClassification === "UNKNOWN_UNCLASSIFIED"
        ? "Only unclassified diagnostic rejection/error evidence is available"
        : "No confirmed payment failure";
  const networkEvidence: InspectorEvidenceState = boundEvent
    ? hostSamples.length || probeSamples.length ? "RECORDED" : "UNAVAILABLE"
    : "NOT_COLLECTED";

  const transportEvidence = {
    ...await readTransportEvidence(requestId),
    currentConfiguration: { ...transportConfiguration(), nodeVersion: process.versions.node,
      nativeUndiciVersion: process.versions.undici ?? null, connectorUndiciVersion: "6.29.1" as const },
    inbound: inboundTransportEvidence(requestEvents.some((event) => event.operation === "CALLBACK")),
  };
  // Legacy single-handshake fields remain available. Never collapse unrelated
  // attempts/connections into one duration; v1.4 attempts hold the full evidence.
  const singleTransport = transportEvidence.attempts.length === 1 ? transportEvidence.attempts[0] : null;
  const attributable = singleTransport && ["SOCKET_CORRELATED", "ERROR_OBJECT_CORRELATED"].includes(singleTransport.attribution)
    ? singleTransport : null;
  const handshakeSummary = (stage: "dns" | "tcp" | "tls") => attributable ? {
    status: attributable[stage].status,
    evidence: ["OBSERVED", "REUSED", "FAILED"].includes(attributable[stage].status) ? "RECORDED" as const : "NOT_COLLECTED" as const,
    destinationReference: attributable.destinationOrigin,
    durationMs: attributable[stage].durationMs,
    errorCode: attributable[stage].errorCode,
    collectionSource: attributable.collectionMethod,
    collectionMethod: attributable.collectionMethod,
  } : {};

  return {
    schemaVersion: "1.4",
    requestId,
    generatedAt: new Date().toISOString(),
    overview: {
      provider,
      primaryRequestType: primaryTypeEvent.operation,
      requestTypeEvidence,
      operations: [...new Set(requestEvents.map((event) => event.operation))],
      requestOutcome: requestOutcomeEvent.outcome,
      requestOutcomeEvidence: requestOutcomeEvent.id === lastEvent.id ? "RECORDED" : "DERIVED",
      requestTiming,
      observedRequestWindow,
    },
    initiator,
    payment: {
      evidence: paymentEvidence,
      provider: payment?.provider ?? provider,
      paymentId: payment?.id ?? linkedEvent?.paymentId ?? null,
      orderId: payment?.orderId ?? linkedEvent?.orderId ?? firstEvent.orderId,
      amount: payment?.amount?.toString() ?? null,
      currency: payment?.currency ?? null,
      paymentStatus: payment?.status ?? null,
      orderPaymentStatus: payment?.order?.paymentStatus ?? null,
      orderStatus: payment?.order?.status ?? null,
      finalOutcome: finalPaymentOutcome,
      transactionReference: maskedReference(payment?.externalId ?? firstEvent.transactionId),
      verificationStatus: verification?.outcome ?? "NOT_RECORDED",
      settlementStatus: settlement?.outcome ?? "NOT_RECORDED",
      lifecycle: lifecycleEvents.map(timelineEvent),
      lifecycleLimited: relatedLifecycle.length > 100,
      observedLifecycleWindow,
    },
    http: {
      evidence: lastHttp ? "RECORDED" : "UNAVAILABLE",
      statusCode: lastHttp?.httpStatus ?? null,
      durationMs: lastHttp?.durationMs ?? null,
      latestOutcome: lastHttp?.outcome ?? null,
      timedOut: lastHttp?.outcome === "TIMEOUT",
      connectionError: lastHttp?.outcome === "CONNECTION_ERROR",
      failureCount: httpEvents.filter((event) => event.outcome !== "HTTP_SUCCESS").length,
      attemptsLimited: summaryLimited,
      attempts: httpEvents.map((event) => ({
        timestamp: event.createdAt.toISOString(),
        operation: event.operation,
        outcome: event.outcome,
        statusCode: event.httpStatus,
        durationMs: event.durationMs,
        detailCode: event.detailCode,
      })),
    },
    transportEvidence,
    handshakes: {
      tcp: {
        status: "NOT_OBSERVABLE", evidence: "NOT_COLLECTED", destinationReference: "NOT_RECORDED",
        durationMs: null, errorCode: null, connectionReused: null,
        collectionSource: "NODE_NATIVE_FETCH", collectionMethod: "UNDICI_CONNECTION_EVENTS_NOT_REQUEST_CORRELATED",
        ...handshakeSummary("tcp"),
        ...(attributable ? { connectionReused: attributable.connectionReused } : {}),
      },
      tls: {
        status: "NOT_OBSERVABLE", evidence: "NOT_COLLECTED", destinationReference: "NOT_RECORDED",
        durationMs: null, errorCode: null, connectionReused: null, tlsVersion: null, cipherSuite: null,
        certificateValidation: null, collectionSource: "NODE_NATIVE_FETCH",
        collectionMethod: "UNDICI_CONNECTION_EVENTS_NOT_REQUEST_CORRELATED",
        ...handshakeSummary("tls"),
        ...(attributable ? { connectionReused: attributable.connectionReused,
          tlsVersion: attributable.connectionEvidence?.tls.tlsVersion ?? null,
          cipherSuite: attributable.connectionEvidence?.tls.cipherSuite ?? null,
          certificateValidation: attributable.connectionEvidence?.tls.certificateValidated === true ? "VALIDATED"
            : attributable.connectionEvidence?.tls.certificateValidated === false ? "REJECTED" : null } : {}),
      },
      dns: {
        status: "NOT_OBSERVABLE", evidence: "NOT_COLLECTED", destinationReference: "NOT_RECORDED",
        durationMs: null, errorCode: null, cacheOrReuse: "UNKNOWN", collectionSource: "NODE_NATIVE_FETCH",
        collectionMethod: "UNDICI_CONNECTION_EVENTS_NOT_REQUEST_CORRELATED",
        ...handshakeSummary("dns"),
      },
      authenticationExchange: authentication
        ? { status: "RECORDED", outcome: authentication.outcome, evidence: "SANITIZED_EVENT_ONLY" }
        : { status: "NOT_COLLECTED", outcome: null, evidence: null },
    },
    authentication: {
      evidence: requestEvents.some((event) => event.operation === "AUTH") ? "RECORDED" : "NOT_COLLECTED",
      events: requestEvents.filter((event) => event.operation === "AUTH").map((event) => ({
        eventId: event.id,
        requestId: event.requestId,
        timestamp: event.createdAt.toISOString(),
        operation: event.operation,
        outcome: event.outcome,
        httpStatus: event.httpStatus,
        durationMs: event.durationMs,
        detailCode: event.detailCode,
        evidenceSource: "SANITIZED_PAYMENT_EVENT" as const,
      })),
    },
    network: {
      evidence: networkEvidence,
      hostAgentId: boundEvent?.networkAgentId ?? null,
      hostAgentLabel: agent?.label ?? null,
      collectorIdentityEvidence: agent ? "RECORDED" : "UNAVAILABLE",
      collectorAuthenticationEvidence: hostSamples.length || probeSamples.length ? "VERIFIED" : "UNAVAILABLE",
      collectorEvidenceSource: hostSamples.length || probeSamples.length
        ? "SAMPLE_ACCEPTED_THROUGH_TIMING_SAFE_AGENT_AUTHENTICATED_INGEST_ROUTE"
        : "NO_AUTHENTICATED_SAMPLE_IN_CONTEXT_WINDOW",
      contextWindowSeconds,
      attribution: "TEMPORAL_CONTEXT_ONLY",
      hostSamples: hostSamples.map((sample) => ({
        observedAt: sample.observedAt.toISOString(),
        intervalStartAt: iso(sample.intervalStartAt),
        counterState: sample.counterState,
        packetsSent: sample.packetsSent?.toString() ?? null,
        packetsReceived: sample.packetsReceived?.toString() ?? null,
        packetsDropped: sample.packetsDropped?.toString() ?? null,
        tcpRetransmissions: sample.tcpRetransmissions?.toString() ?? null,
        tcpConnectionFailures: sample.tcpConnectionFailures?.toString() ?? null,
        sentDelta: sample.sentDelta?.toString() ?? null,
        receivedDelta: sample.receivedDelta?.toString() ?? null,
        droppedDelta: sample.droppedDelta?.toString() ?? null,
        retransmissionsDelta: sample.retransmissionsDelta?.toString() ?? null,
        connectionFailuresDelta: sample.connectionFailuresDelta?.toString() ?? null,
      })),
      probeSamples: probeSamples.map((sample) => ({
        targetLabel: sample.targetLabel,
        protocol: sample.protocol,
        port: sample.port,
        startedAt: sample.startedAt.toISOString(),
        completedAt: sample.completedAt.toISOString(),
        outcome: sample.outcome,
        latencyMs: sample.latencyMs,
        elapsedMs: sample.elapsedMs,
        errorCode: sample.errorCode,
      })),
      alerts: alerts.map((alert) => ({
        scope: alert.scope,
        code: alert.code,
        status: alert.status,
        value: alert.value,
        threshold: alert.threshold,
        occurrences: alert.occurrences,
        firstSeenAt: alert.firstSeenAt.toISOString(),
        lastSeenAt: alert.lastSeenAt.toISOString(),
        resolvedAt: iso(alert.resolvedAt),
      })),
    },
    error: {
      evidence: primaryFailure || diagnosticEvents.length || payment ? "RECORDED" : "UNAVAILABLE",
      classification: errorClassification,
      summary: errorSummary,
      confirmedPaymentFailure,
      primaryFailure: primaryFailure ? timelineEvent(primaryFailure) : null,
      requestFailureCount: operationalFailures.length,
      requestFailuresLimited: summaryLimited || operationalFailures.length > 20,
      recoveredFailureCount: primaryFailure ? Math.max(0, operationalFailures.length - 1) : operationalFailures.length,
      requestFailures: operationalFailures.slice(-20).map(timelineEvent),
      diagnostics: {
        nonFatalCount: nonFatalDiagnostics.length,
        nonFatalCodes: [...new Set(nonFatalDiagnostics.flatMap((event) => event.detailCode ? [event.detailCode] : []))],
        informationalCount: informationalDiagnostics.length,
        unclassifiedCount: unclassifiedDiagnostics.length,
        limited: summaryLimited,
      },
    },
    timeline: allPageEvents.map(timelineEvent),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalEvents,
      hasMore: page * PAGE_SIZE < totalEvents && page < MAX_PAGE,
      limited: totalEvents > PAGE_SIZE * MAX_PAGE,
    },
    limitations: [
      "Per-attempt DNS/TCP/TLS evidence is available only when collected and socket-correlated. Legacy single-handshake fields remain unavailable for multiple attempts; see transportEvidence.attempts.",
      "DNS measurements are OS name-resolution durations, not proof of wire-level DNS packets. TLS duration is the observed TCP-connect-to-secureConnect interval.",
      "Reused connections have no new handshake timing. Historical connection timings are referenced separately and are not current request durations.",
      "Transport history is limited to 100 attempts per Request ID, 10,000 physical rows and a maximum seven-day query window. Ring rollover and queue loss may remove evidence sooner; seven-day survival is not guaranteed.",
      "Host and probe samples are temporal context and do not prove a payment-specific network cause.",
      "Gateway/internal-network packet metrics are not inferred.",
      "Transaction references are masked and raw payloads, headers, tokens and credentials are excluded.",
      "Related payment lifecycle history is capped at 100 recorded events.",
      "Per-request timeline browsing is capped at 1,000 recorded events.",
      "Observed event windows are derived from stored event timestamps and are not processing durations.",
      "Request-level timing is unavailable when a Request ID contains multiple operations or HTTP attempts.",
    ],
  };
}
