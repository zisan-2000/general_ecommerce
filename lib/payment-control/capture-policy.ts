import { isIP } from "node:net";
import { diagnosticLimits } from "./diagnostic-policy";
export const captureProviders = ["EPS", "AIBL_WALLET"] as const;
export const captureOperations = ["AUTH", "INITIALIZE", "STATUS_QUERY", "VERIFY"] as const;
export type CaptureProvider = typeof captureProviders[number];
export function approvedCaptureIps(provider: CaptureProvider, env: NodeJS.ProcessEnv = process.env): string[] {
  const parsed: unknown = JSON.parse(env.PAYMENT_CAPTURE_GATEWAY_IPS_JSON || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_CAPTURE_POLICY");
  const ips: unknown = (parsed as Record<string, unknown>)[provider];
  if (!Array.isArray(ips) || !ips.length || ips.length > 8) throw new Error("CAPTURE_TARGET_NOT_APPROVED");
  return ips.map((value: unknown) => {
    // Public IPv4 only for the first deployment. Explicitly reject special-use,
    // private, link-local and multicast destinations. Never resolve a user URL.
    if (typeof value !== "string" || isIP(value) !== 4) throw new Error("UNSAFE_CAPTURE_TARGET");
    const [a, b, c] = value.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 ||
      a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113)
      throw new Error("UNSAFE_CAPTURE_TARGET");
    return value;
  });
}
export function captureFilter(ips: readonly string[]) {
  if (!ips.length || ips.some(ip => isIP(ip) !== 4)) throw new Error("INVALID_CAPTURE_FILTER");
  return `tcp port 443 and (${ips.map(ip => `host ${ip}`).join(" or ")})`;
}
export function requireCaptureEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.PAYMENT_DIAGNOSTICS_ENABLED !== "true" || env.PAYMENT_NETWORK_CAPTURE_ENABLED !== "true") throw new Error("CAPTURE_DISABLED");
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || env.SSLKEYLOGFILE || /--tls-keylog(?:=|\s)/.test(env.NODE_OPTIONS ?? ""))
    throw new Error("INSECURE_CAPTURE_TLS_CONFIGURATION");
  if (!env.PAYMENT_DIAGNOSTICS_EVIDENCE_DIR) throw new Error("PRIVATE_EVIDENCE_STORAGE_REQUIRED");
  return diagnosticLimits(env);
}
