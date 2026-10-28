import type { TransportMode, TransportOperation, TransportProvider } from "./transport-types";

const providers: readonly TransportProvider[] = ["AIBL_WALLET", "EPS", "SSLCOMMERZ"];
const operations: readonly TransportOperation[] = ["AUTH", "INITIALIZE", "STATUS_QUERY", "VERIFY"];
function allowlist<T extends string>(input: string | undefined, known: readonly T[]): T[] | null {
  if (!input) return [];
  const entries = input.split(",").map((entry) => entry.trim());
  return entries.every((entry) => known.includes(entry as T)) && new Set(entries).size === entries.length ? entries as T[] : null;
}
function atLeast(version: string | undefined, major: number, minor: number, patch: number) {
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return false;
  const [a, b, c] = version.split(".").map(Number);
  return a === major && (b > minor || b === minor && c >= patch);
}
export function transportRuntimeStatus(nodeVersion = process.versions.node, nativeUndiciVersion = process.versions.undici) {
  if (!atLeast(nodeVersion, 24, 22, 1)) return { compatible: false, reason: "PATCHED_NODE_REQUIRED" };
  if (!atLeast(nativeUndiciVersion, 7, 30, 1)) return { compatible: false, reason: "PATCHED_NATIVE_UNDICI_REQUIRED" };
  return { compatible: true, reason: "PATCHED_RUNTIME" };
}
export function transportConfiguration(env: NodeJS.ProcessEnv = process.env, nodeVersion = process.versions.node,
  nativeUndiciVersion = process.versions.undici) {
  const allowedProviders = allowlist(env.PAYMENT_TRANSPORT_ALLOWED_PROVIDERS, providers);
  const allowedOperations = allowlist(env.PAYMENT_TRANSPORT_ALLOWED_OPERATIONS, operations);
  const off = (reason: string) => ({ mode: "off" as const, reason,
    allowedProviders: [] as TransportProvider[], allowedOperations: [] as TransportOperation[] });
  if (env.PAYMENT_TRANSPORT_MONITORING_MODE !== undefined && !["off", "passive", "instrumented"].includes(env.PAYMENT_TRANSPORT_MONITORING_MODE)) return off("INVALID_MODE");
  const requested: TransportMode = env.PAYMENT_TRANSPORT_MONITORING_MODE === "instrumented" ? "instrumented"
    : env.PAYMENT_TRANSPORT_MONITORING_MODE === "passive" ? "passive" : "off";
  if (requested === "off") return off("DISABLED");
  if (![undefined, "true", "false"].includes(env.PAYMENT_TRANSPORT_STORAGE_ENABLED)) return off("INVALID_STORAGE_FLAG");
  if (![undefined, "true", "false"].includes(env.PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED)) return off("INVALID_APPROVAL_FLAG");
  if (env.PAYMENT_TRANSPORT_STORAGE_ENABLED !== "true") return off("STORAGE_DISABLED");
  if (!allowedProviders) return off("INVALID_PROVIDER_ALLOWLIST");
  if (!allowedOperations) return off("INVALID_OPERATION_ALLOWLIST");
  if (!allowedProviders.length) return off("PROVIDER_ALLOWLIST_REQUIRED");
  if (!allowedOperations.length) return off("OPERATION_ALLOWLIST_REQUIRED");
  if (requested === "instrumented") {
    if (env.PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED !== "true") return off("APPROVAL_REQUIRED");
    // Only the reviewed patched Node 24 line is approved for active transport.
    const runtime = transportRuntimeStatus(nodeVersion, nativeUndiciVersion);
    if (!runtime.compatible) return off(runtime.reason);
    if (["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"].some((key) => Boolean(env[key])) ||
      env.NODE_USE_ENV_PROXY === "1" || /--use-env-proxy/.test(env.NODE_OPTIONS ?? "")) {
      return off("PROXY_TRANSPORT_REVIEW_REQUIRED");
    }
    if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") return off("INSECURE_TLS_CONFIGURATION");
  }
  return { mode: requested, reason: "ENABLED", allowedProviders, allowedOperations };
}

export function transportScopeAllowed(config: { allowedProviders?: readonly TransportProvider[];
  allowedOperations?: readonly TransportOperation[] }, provider: TransportProvider, operation: TransportOperation) {
  return Boolean(config.allowedProviders?.includes(provider) && config.allowedOperations?.includes(operation));
}

export function inboundTransportEvidence(callback: boolean, env: NodeJS.ProcessEnv = process.env) {
  // Operator configuration only; forwarded headers are not trusted evidence.
  return {
    requestKind: callback ? "INCOMING_CALLBACK" as const : "NOT_A_CALLBACK" as const,
    tlsTermination: env.PAYMENT_INBOUND_TLS_TERMINATION === "UPSTREAM_PROXY"
      ? "UPSTREAM_PROXY" as const : "UNKNOWN" as const,
    tlsTerminationEvidence: env.PAYMENT_INBOUND_TLS_TERMINATION === "UPSTREAM_PROXY"
      ? "OPERATOR_CONFIGURATION" as const : "UNAVAILABLE" as const,
    trustedReverseProxyConnection: "NOT_COLLECTED" as const,
    applicationHandshakeVisibility: "NOT_OBSERVABLE" as const,
    trustedProxyMeasurements: "NOT_COLLECTED" as const,
    senderAuthentication: "UNAVAILABLE" as const,
  };
}
