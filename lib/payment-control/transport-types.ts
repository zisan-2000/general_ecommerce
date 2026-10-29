// Serializable, sanitized evidence only. This module is also safe to import in the UI.
export type HandshakeStatus = "OBSERVED" | "REUSED" | "NOT_APPLICABLE" | "NOT_COLLECTED" | "NOT_OBSERVABLE" | "FAILED";
export type TransportMode = "off" | "passive" | "instrumented";
export type TransportProvider = "AIBL_WALLET" | "EPS" | "SSLCOMMERZ";
export type TransportOperation = "AUTH" | "INITIALIZE" | "STATUS_QUERY" | "VERIFY";
export type TransportMetric = {
  status: HandshakeStatus;
  startTime: string | null;
  endTime: string | null;
  durationMs: number | null;
  errorCode: string | null;
};
export type ConnectionEvidence = {
  connectionId: string;
  collectionMethod: "UNDICI_INSTRUMENTED_CONNECTOR" | "UNDICI_PASSIVE_DIAGNOSTICS";
  dns: TransportMetric & { measurementType: "OS_NAME_RESOLUTION"; resolutionOccurred: boolean; family: 4 | 6 | null };
  tcp: TransportMetric;
  tcpAttempts: Array<TransportMetric & { family: 4 | 6 | null }>;
  tcpAttemptsLimited: boolean;
  tls: TransportMetric & {
    measurementType: "TCP_CONNECT_TO_SECURE_CONNECT";
    tlsVersion: string | null;
    cipherSuite: string | null;
    alpnProtocol: "http/1.1" | "h2" | null;
    certificateValidated: boolean | null;
    sessionResumed: boolean | null;
  };
};
export type TransportAttemptEvidence = {
  version: 1;
  provider: TransportProvider;
  operation: TransportOperation;
  requestId: string;
  attemptId: string;
  connectionId: string | null;
  destinationOrigin: string;
  startedAt: string;
  completedAt: string;
  requestTimingSource: "UNDICI_REQUEST_EVENTS" | "MONITORING_SCOPE";
  connectionReused: boolean | null;
  attribution: "SOCKET_CORRELATED" | "ERROR_OBJECT_CORRELATED" | "UNATTRIBUTED" | "UNSUPPORTED_HTTP2";
  collectionMethod: "UNDICI_INSTRUMENTED_CONNECTOR" | "UNDICI_PASSIVE_DIAGNOSTICS";
  requestOutcome: "HTTP_RESPONSE" | "REQUEST_ERROR" | "ABORTED" | "NOT_OBSERVED";
  errorCode: string | null;
  // These are per-attempt metrics. REUSED always has null timestamps/duration.
  dns: TransportMetric;
  tcp: TransportMetric;
  tls: TransportMetric;
  // Previous timings, if referenced, belong only to this connection snapshot.
  connectionEvidence: ConnectionEvidence | null;
};
export type InspectorTransportEvidence = {
  collectionHealth?: {
    accepted: number; persisted: number; duplicates: number; dropped: number; rejected: number;
    sanitizerErrors: number; writeErrors: number; drainErrors: number; queueDepth: number; inFlight: boolean;
    scope: "CURRENT_PROCESS_ONLY"; completeness: "BEST_EFFORT_NOT_GUARANTEED";
  } | null;
  currentConfiguration: { mode: TransportMode; reason: string; nodeVersion: string; nativeUndiciVersion: string | null; connectorUndiciVersion: "6.29.1";
    allowedProviders?: TransportProvider[]; allowedOperations?: TransportOperation[] };
  storage: "AVAILABLE" | "NOT_COLLECTED" | "UNAVAILABLE";
  attempts: TransportAttemptEvidence[];
  limited: boolean;
  inbound: {
    requestKind: "INCOMING_CALLBACK" | "NOT_A_CALLBACK";
    tlsTermination: "UNKNOWN" | "UPSTREAM_PROXY";
    tlsTerminationEvidence: "OPERATOR_CONFIGURATION" | "UNAVAILABLE";
    trustedReverseProxyConnection: "NOT_COLLECTED";
    applicationHandshakeVisibility: "NOT_OBSERVABLE";
    trustedProxyMeasurements: "NOT_COLLECTED";
    senderAuthentication: "UNAVAILABLE";
  };
};
