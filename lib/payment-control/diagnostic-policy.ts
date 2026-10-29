// Shared, pure policy. Trace IDs are stable per internal attempt, including historical
// attempts; request IDs still identify individual calls. No financial row is mutated.
export function paymentTraceId(paymentId: number) {
  if (!Number.isSafeInteger(paymentId) || paymentId < 1) throw new Error("INVALID_PAYMENT_ID");
  return `d3500000-0000-4000-8000-${paymentId.toString(16).padStart(12, "0")}`;
}
export function tracePaymentId(trace: string) {
  if (!/^d3500000-0000-4000-8000-[0-9a-f]{12}$/.test(trace)) return null;
  const id = Number.parseInt(trace.slice(-12), 16);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
export function diagnosticsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.PAYMENT_DIAGNOSTICS_ENABLED === "true";
}
export function diagnosticLimits(env: NodeJS.ProcessEnv = process.env) {
  const bounded = (key: string, fallback: number, min: number, max: number) => {
    const raw = env[key];
    const n = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error("INVALID_DIAGNOSTIC_LIMIT");
    return n;
  };
  return { retentionDays: bounded("PAYMENT_DIAGNOSTICS_RETENTION_DAYS", 7, 1, 30),
    seconds: bounded("PAYMENT_DIAGNOSTICS_MAX_CAPTURE_SECONDS", 30, 1, 60),
    bytes: bounded("PAYMENT_DIAGNOSTICS_MAX_CAPTURE_BYTES", 1048576, 65536, 2097152) };
}
export const frontendDiagnosticCodes = ["FRONTEND_VALIDATION_PASSED", "FRONTEND_API_FAILED",
  "FRONTEND_NETWORK_INTERRUPTED", "FRONTEND_REDIRECT_REQUESTED", "FRONTEND_REDIRECT_FAILED"] as const;
export type FrontendDiagnosticCode = typeof frontendDiagnosticCodes[number];
export const diagnosticLimitations = [
  "Absence of a diagnostic event does not prove that an operation did not run. Logging may be disabled, lost or expired.",
  "HTTP latency measures fetch to response headers (TTFB), not full response-body processing. HTTP success is not payment verification.",
  "DNS is OS resolution timing. Reused sockets have no new DNS/TCP/TLS handshake. See request inspectors for measured connection evidence.",
  "Packet capture sees only traffic visible on the capture interface. Browser-to-bank hosted traffic is outside backend visibility.",
  "Capture is destination-and-time scoped; shared connections and concurrent requests prevent exact packet-to-payment attribution.",
  "TLS is never decrypted. Stored captures contain network/TCP headers only. DNS and TLS bodies are excluded.",
  "Retransmissions are capture observations, not proof of packet loss or bank fault. TLS verification failure and timeout do not identify bank internal causes.",
  "Historical authorization, commit timing and missing callbacks cannot be reconstructed without recorded evidence. Bank internal causes require bank-side logs.",
  "Browser diagnostics are untrusted client reports; they cannot authorize payments or establish a confirmed financial outcome.",
] as const;
