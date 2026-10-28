import type { InspectorTransportEvidence } from "./transport-types";

export type InspectorEvidenceState =
  | "RECORDED"
  | "VERIFIED"
  | "DERIVED"
  | "UNKNOWN"
  | "NOT_COLLECTED"
  | "UNAVAILABLE";

export type InspectorTransportStatus =
  | "OBSERVED"
  | "REUSED"
  | "NOT_APPLICABLE"
  | "RECORDED"
  | "SUCCESS"
  | "FAILED"
  | "REUSED_CONNECTION"
  | "NOT_OBSERVABLE"
  | "NOT_COLLECTED"
  | "UNAVAILABLE";

export type InspectorTimelineEvent = {
  id: string;
  requestId: string | null;
  timestamp: string;
  stage: string;
  outcome: string;
  httpStatus: number | null;
  durationMs: number | null;
  gatewayStatus: string | null;
  detailCode: string | null;
  paymentId: number | null;
  orderId: number | null;
  networkAgentId: string | null;
  requestStartedAt: string | null;
  requestCompletedAt: string | null;
};

export type InspectorTiming = {
  evidence: InspectorEvidenceState;
  startTime: string | null;
  endTime: string | null;
  durationMs: number | null;
  sourceOperation: string | null;
};

export type InspectorObservedWindow = {
  evidence: InspectorEvidenceState;
  startTime: string | null;
  endTime: string | null;
  windowMs: number | null;
};

export type TechnicalInspectorResponse = {
  schemaVersion: "1.4";
  requestId: string;
  generatedAt: string;
  overview: {
    provider: string;
    primaryRequestType: string;
    requestTypeEvidence: InspectorEvidenceState;
    operations: string[];
    requestOutcome: string;
    requestOutcomeEvidence: InspectorEvidenceState;
    requestTiming: InspectorTiming;
    observedRequestWindow: InspectorObservedWindow;
  };
  initiator: {
    type: string;
    source: InspectorEvidenceState;
    identityEvidence: InspectorEvidenceState;
    authenticationEvidence: InspectorEvidenceState;
    authorizationEvidence: InspectorEvidenceState;
    actor: { id: string; name: string | null; role: string } | null;
    sourceService: string;
    destinationService: string;
    triggeringOperation: string;
    authenticationContext: string;
    evidenceSource: string;
    correlationId: string;
    traceId: null;
    jobName: string | null;
    callbackEvidence: {
      requestReceived: InspectorEvidenceState;
      senderAuthentication: InspectorEvidenceState;
      stateOrCorrelationValidation: InspectorEvidenceState;
      payloadValidation: InspectorEvidenceState;
      authoritativePaymentVerification: InspectorEvidenceState;
    };
  };
  payment: {
    evidence: InspectorEvidenceState;
    provider: string;
    paymentId: number | null;
    orderId: number | null;
    amount: string | null;
    currency: string | null;
    paymentStatus: string | null;
    orderPaymentStatus: string | null;
    orderStatus: string | null;
    finalOutcome: {
      status: string;
      evidence: InspectorEvidenceState;
      source: string | null;
    };
    transactionReference: string | null;
    verificationStatus: string;
    settlementStatus: string;
    lifecycle: InspectorTimelineEvent[];
    lifecycleLimited: boolean;
    observedLifecycleWindow: InspectorObservedWindow;
  };
  http: {
    evidence: InspectorEvidenceState;
    statusCode: number | null;
    durationMs: number | null;
    latestOutcome: string | null;
    timedOut: boolean;
    connectionError: boolean;
    failureCount: number;
    attemptsLimited: boolean;
    attempts: Array<{
      timestamp: string;
      operation: string;
      outcome: string;
      statusCode: number | null;
      durationMs: number | null;
      detailCode: string | null;
    }>;
  };
  transportEvidence: InspectorTransportEvidence;
  handshakes: {
    dns: {
      status: InspectorTransportStatus;
      evidence: InspectorEvidenceState;
      destinationReference: string;
      durationMs: number | null;
      errorCode: string | null;
      cacheOrReuse: "UNKNOWN";
      collectionSource: string;
      collectionMethod: string;
    };
    tcp: {
      status: InspectorTransportStatus;
      evidence: InspectorEvidenceState;
      destinationReference: string;
      durationMs: number | null;
      errorCode: string | null;
      connectionReused: boolean | null;
      collectionSource: string;
      collectionMethod: string;
    };
    tls: {
      status: InspectorTransportStatus;
      evidence: InspectorEvidenceState;
      destinationReference: string;
      durationMs: number | null;
      errorCode: string | null;
      connectionReused: boolean | null;
      tlsVersion: string | null;
      cipherSuite: string | null;
      certificateValidation: string | null;
      collectionSource: string;
      collectionMethod: string;
    };
    authenticationExchange: {
      status: InspectorEvidenceState;
      outcome: string | null;
      evidence: string | null;
    };
  };
  authentication: {
    evidence: InspectorEvidenceState;
    events: Array<{
      eventId: string;
      requestId: string | null;
      timestamp: string;
      operation: string;
      outcome: string;
      httpStatus: number | null;
      durationMs: number | null;
      detailCode: string | null;
      evidenceSource: "SANITIZED_PAYMENT_EVENT";
    }>;
  };
  network: {
    evidence: InspectorEvidenceState;
    hostAgentId: string | null;
    hostAgentLabel: string | null;
    collectorIdentityEvidence: InspectorEvidenceState;
    collectorAuthenticationEvidence: InspectorEvidenceState;
    collectorEvidenceSource: string;
    contextWindowSeconds: number | null;
    attribution: "TEMPORAL_CONTEXT_ONLY";
    hostSamples: Array<Record<string, string | null>>;
    probeSamples: Array<Record<string, string | number | null>>;
    alerts: Array<Record<string, string | number | null>>;
  };
  error: {
    evidence: InspectorEvidenceState;
    classification:
      | "CONFIRMED_PAYMENT_FAILURE"
      | "REQUEST_FAILURE"
      | "NO_CONFIRMED_PAYMENT_FAILURE"
      | "UNKNOWN_UNCLASSIFIED";
    summary: string;
    confirmedPaymentFailure: boolean;
    primaryFailure: InspectorTimelineEvent | null;
    requestFailureCount: number;
    requestFailuresLimited: boolean;
    recoveredFailureCount: number;
    requestFailures: InspectorTimelineEvent[];
    diagnostics: {
      nonFatalCount: number;
      nonFatalCodes: string[];
      informationalCount: number;
      unclassifiedCount: number;
      limited: boolean;
    };
  };
  timeline: InspectorTimelineEvent[];
  pagination: {
    page: number;
    pageSize: number;
    totalEvents: number;
    hasMore: boolean;
    limited: boolean;
  };
  limitations: string[];
};

export function requestInspectorHref(requestId: string) {
  return `/admin/payment-control/requests/${encodeURIComponent(requestId)}`;
}
