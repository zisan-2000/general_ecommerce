// Diagnostic interpretation only. Never changes gateway request/verification rules.
export const epsDiagnosticAdapter = {
  provider: "EPS", environment: "sandbox",
  verificationContract: "EPS server STATUS: exact Success, matching merchant reference and amount; conflicting error fields reject settlement.",
  operations: { AUTH: "AUTH", INITIALIZE: "INITIALIZE", STATUS_QUERY: "STATUS", VERIFY: "STATUS_VERIFICATION_RESULT",
    CALLBACK: "CALLBACK", SETTLEMENT: "SETTLEMENT", FRONTEND: "FRONTEND", DIAGNOSTIC: "BACKEND_DIAGNOSTIC" },
} as const;
export const aiblDiagnosticAdapter = {
  provider: "AIBL_WALLET", environment: "uat",
  verificationContract: "AIBL server VERIFY: exact issued code/message and validated transaction; request bound to stored initialization and authoritative amount. No echoed amount/currency is inferred.",
  // Existing AIBL bankRequest deliberately records /verify HTTP as STATUS_QUERY.
  // Retain that transport operation and expose its provider-specific meaning.
  operations: { AUTH: "TOKEN", INITIALIZE: "ORDER_INITIALIZATION", STATUS_QUERY: "VERIFY_REQUEST", VERIFY: "VERIFY_RESULT",
    CALLBACK: "CALLBACK", SETTLEMENT: "SETTLEMENT", FRONTEND: "FRONTEND", DIAGNOSTIC: "BACKEND_DIAGNOSTIC" },
} as const;
export function paymentDiagnosticAdapter(provider: string) {
  if (provider === "EPS") return epsDiagnosticAdapter;
  if (provider === "AIBL_WALLET") return aiblDiagnosticAdapter;
  throw new Error("UNSUPPORTED_DIAGNOSTIC_PROVIDER");
}
export function diagnosticStage(provider: string, operation: string, detailCode: string | null) {
  if (detailCode === "FRONTEND_REDIRECT_REQUESTED" || detailCode === "FRONTEND_REDIRECT_FAILED") return "HOSTED_REDIRECT_CLIENT_REPORTED";
  if (detailCode?.startsWith("INITIATOR_CRON_")) return "RECONCILIATION_INITIATOR";
  const profile = paymentDiagnosticAdapter(provider);
  return profile.operations[operation as keyof typeof profile.operations] ?? "OTHER_RECORDED_OPERATION";
}
