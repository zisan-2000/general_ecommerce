// Standalone privileged agent; never imported by a Next.js request handler.
// Start explicitly with a dedicated, minimal environment. Does not load .env.
import { mkdir } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { executeCapture, cleanupCaptureTemps, type CaptureJob } from "./lib/payment-capture-runner";
import { requireCaptureEnabled, approvedCaptureIps, type CaptureProvider } from "../lib/payment-control/capture-policy";
import { diagnosticLimits } from "../lib/payment-control/diagnostic-policy";
async function main() {
  requireCaptureEnabled();
  const origin = new URL(process.env.PAYMENT_CAPTURE_APP_ORIGIN ?? "");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
    !(origin.protocol === "https:" || origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))) throw new Error("INVALID_AGENT_ORIGIN");
  const token = process.env.PAYMENT_CAPTURE_AGENT_TOKEN ?? "", agentId = process.env.PAYMENT_CAPTURE_AGENT_ID ?? "";
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token) || !/^[A-Za-z0-9_-]{1,64}$/.test(agentId)) throw new Error("INVALID_AGENT_AUTHENTICATION");
  const config = { root: process.env.PAYMENT_CAPTURE_TEMP_DIR ?? "", dumpcap: process.env.PAYMENT_CAPTURE_DUMPCAP ?? "",
    tshark: process.env.PAYMENT_CAPTURE_TSHARK ?? "", interfaceId: process.env.PAYMENT_CAPTURE_INTERFACE ?? "" };
  if (![config.root, config.dumpcap, config.tshark].every(isAbsolute)) throw new Error("ABSOLUTE_AGENT_PATHS_REQUIRED");
  await mkdir(config.root, { recursive: true, mode: 0o700 });
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort()); process.once("SIGTERM", () => controller.abort());
  const headers = { Authorization: `Bearer ${token}`, "X-Capture-Agent-Id": agentId };
  let lastCleanup = 0;
  while (!controller.signal.aborted) {
    try {
      if (Date.now() - lastCleanup > 300000) { await cleanupCaptureTemps(config.root); lastCleanup = Date.now(); }
      const response = await fetch(new URL("/api/payment-diagnostics/capture-agent", origin),
        { headers, redirect: "error", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      if (!response.ok) throw new Error("AGENT_POLL_REJECTED");
      const { job } = await response.json() as { job: (CaptureJob & { provider: CaptureProvider }) | null };
      if (job) {
        const target = new URL(`/api/payment-diagnostics/capture-agent/${job.id}`, origin);
        try {
          const localIps = approvedCaptureIps(job.provider);
          const localLimits = diagnosticLimits();
          if (job.seconds > localLimits.seconds || job.maxBytes > localLimits.bytes) throw new Error("CAPTURE_PROCESS_FAILED");
          // Both application policy and the independently configured agent must
          // approve every destination. A remote job cannot expand local scope.
          if (!Array.isArray(job.approvedIps) || job.approvedIps.some(ip => !localIps.includes(ip))) throw new Error("CAPTURE_PROCESS_FAILED");
          const result = await executeCapture(job, config, controller.signal);
          const upload = await fetch(target, { method: "POST", headers: { ...headers, "Content-Type": "application/x-pcapng",
            "X-Capture-Retransmissions": String(result.retransmissions) }, body: new Uint8Array(result.data), redirect: "error",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
          if (!upload.ok) throw new Error("CAPTURE_INVALID_FILE");
        } catch (error) {
          const known = new Set(["CAPTURE_TIMEOUT", "CAPTURE_SIZE_LIMIT", "CAPTURE_INTERFACE_UNAVAILABLE", "CAPTURE_TOOL_UNAVAILABLE", "CAPTURE_ABORTED", "CAPTURE_ANALYSIS_FAILED"]);
          const code = error instanceof Error && known.has(error.message) ? error.message : "CAPTURE_PROCESS_FAILED";
          await fetch(target, { method: "POST", headers: { ...headers, "X-Capture-Error": code }, redirect: "error", signal: AbortSignal.timeout(5000) }).catch(() => {});
          console.warn("Payment capture job did not complete");
        }
      }
    } catch { if (!controller.signal.aborted) console.warn("Payment capture control plane unavailable"); }
    if (!controller.signal.aborted) await new Promise<void>(accept => {
      const done = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", done); accept(); };
      const timer = setTimeout(done, 5000); controller.signal.addEventListener("abort", done, { once: true });
    });
  }
}
void main().catch(() => { console.error("Payment capture agent configuration rejected"); process.exitCode = 1; });
