import { spawn } from "node:child_process";
import { isAbsolute, resolve, relative } from "node:path";
import { mkdtemp, readFile, stat, rm, chmod, readdir, lstat } from "node:fs/promises";
import { captureFilter } from "../../lib/payment-control/capture-policy";
import { sanitizePcapng } from "../../lib/payment-control/pcapng";
export type CaptureJob = { id: string; kind: string; seconds: number; maxBytes: number; approvedIps: string[] };
export type ProcessResult = { output: string };
export async function cleanupCaptureTemps(root: string) {
  if (!isAbsolute(root)) throw new Error("ABSOLUTE_AGENT_PATHS_REQUIRED");
  const absolute = resolve(root);
  for (const entry of (await readdir(absolute, { withFileTypes: true })).slice(0, 1000)) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^capture-[A-Za-z0-9]{6}$/.test(entry.name)) continue;
    const target = resolve(absolute, entry.name), info = await lstat(target), rel = relative(absolute, target);
    if (info.isDirectory() && !info.isSymbolicLink() && Date.now() - info.mtimeMs > 600000 && rel && !rel.startsWith("..") && !isAbsolute(rel))
      await rm(target, { recursive: true, force: true });
  }
}
export type ProcessRunner = (binary: string, args: string[], options: { timeoutMs: number; signal?: AbortSignal; maxOutput?: number }) => Promise<ProcessResult>;
export const runCaptureProcess: ProcessRunner = (binary, args, options) => new Promise((accept, reject) => {
  if (!isAbsolute(binary) || /\.(cmd|bat|ps1)$/i.test(binary)) { reject(new Error("CAPTURE_TOOL_UNAVAILABLE")); return; }
  // Explicit env projection prevents SSLKEYLOGFILE, NODE_OPTIONS, gateway/auth
  // credentials and user-controlled shell settings from entering capture tools.
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const key of ["SystemRoot", "WINDIR", "PATH", "TEMP", "TMP", "LANG"]) if (process.env[key]) env[key] = process.env[key];
  const child = spawn(binary, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env });
  let output = "", bytes = 0, failure: string | null = null;
  const kill = (reason: string) => { failure ??= reason; child.kill("SIGKILL"); };
  const timer = setTimeout(() => kill("CAPTURE_TIMEOUT"), options.timeoutMs);
  const abort = () => kill("CAPTURE_ABORTED");
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  child.stdout.on("data", (data: Buffer) => {
    bytes += data.length;
    if (bytes > (options.maxOutput ?? 65536)) kill("CAPTURE_ANALYSIS_FAILED");
    else output += data.toString("utf8");
  });
  // Never retain or print tool stderr: it can contain paths and machine data.
  child.stderr.on("data", (data: Buffer) => {
    bytes += data.length;
    if (bytes > (options.maxOutput ?? 65536)) kill("CAPTURE_PROCESS_FAILED");
  });
  const cleanup = () => { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); };
  child.once("error", () => { cleanup(); reject(new Error("CAPTURE_TOOL_UNAVAILABLE")); });
  child.once("close", code => {
    cleanup();
    if (failure || code !== 0) reject(new Error(failure ?? "CAPTURE_PROCESS_FAILED"));
    else accept({ output });
  });
});
export async function executeCapture(job: CaptureJob, config: { root: string; dumpcap: string; tshark: string; interfaceId: string },
  signal?: AbortSignal, run: ProcessRunner = runCaptureProcess) {
  if (!/^[a-f0-9-]{36}$/.test(job.id) || !["READINESS", "CAPTURE"].includes(job.kind) ||
    !Number.isSafeInteger(job.seconds) || job.seconds < 1 || job.seconds > 60 || !Number.isSafeInteger(job.maxBytes) ||
    job.maxBytes < 65536 || job.maxBytes > 2097152 || !/^[1-9]\d{0,2}$/.test(config.interfaceId) || !isAbsolute(config.root)) throw new Error("CAPTURE_INTERFACE_UNAVAILABLE");
  const root = resolve(config.root), folder = await mkdtemp(resolve(root, "capture-"));
  await chmod(folder, 0o700);
  try {
    const listed = await run(config.dumpcap, ["-D"], { timeoutMs: 5000, signal });
    if (!listed.output.split(/\r?\n/).some(line => line.startsWith(config.interfaceId + ". "))) throw new Error("CAPTURE_INTERFACE_UNAVAILABLE");
    const raw = resolve(folder, "raw.pcapng"), safePath = resolve(folder, "headers.pcapng");
    const capture = async (file: string, seconds: number) => {
      // Active file-size watcher and dumpcap's own independent stop conditions.
      const controller = new AbortController(); let oversized = false;
      const abort = () => controller.abort(); signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const watcher = setInterval(() => { void stat(file).then(s => {
        if (s.size > job.maxBytes) { oversized = true; controller.abort(); }
      }).catch(() => {}); }, 100);
      try {
        await run(config.dumpcap, ["-i", config.interfaceId, "-p", "-n", "-s", "256", "-B", "1", "-f", captureFilter(job.approvedIps),
          "-a", `duration:${seconds}`, "-a", `filesize:${Math.max(1, Math.floor(job.maxBytes / 1024) - 1)}`, "-w", file],
        { timeoutMs: seconds * 1000 + 5000, signal: controller.signal });
      } finally { clearInterval(watcher); signal?.removeEventListener("abort", abort); }
      if (oversized || (await stat(file)).size > job.maxBytes) throw new Error("CAPTURE_SIZE_LIMIT");
      return sanitizePcapng(await readFile(file), job.approvedIps);
    };
    // Actual interface open + clean process completion + parsed output, every
    // time. A console banner or enumerated interface alone is not readiness.
    const readiness = await capture(raw, 1);
    const result = job.kind === "READINESS" ? readiness : await capture(raw, job.seconds);
    // raw packets never leave this isolated temporary directory.
    const { writeFile } = await import("node:fs/promises");
    await writeFile(safePath, result.data, { mode: 0o600 });
    const analyzed = await run(config.tshark, ["-n", "-o", "tls.keylog_file:", "-r", safePath, "-Y",
      "tcp.analysis.retransmission || tcp.analysis.fast_retransmission || tcp.analysis.spurious_retransmission",
      "-T", "fields", "-e", "frame.number"], { timeoutMs: 5000, signal, maxOutput: 131072 });
    const frames = analyzed.output.trim() ? analyzed.output.trim().split(/\r?\n/) : [];
    if (frames.some(v => !/^\d+$/.test(v)) || frames.length > result.packetCount) throw new Error("CAPTURE_ANALYSIS_FAILED");
    return { data: result.data, packetCount: result.packetCount, sha256: result.sha256, retransmissions: frames.length };
  } finally {
    // The only recursively removed target is this mkdtemp child of the explicit
    // private agent root. Validate absolute containment before recursive removal.
    const rel = relative(root, resolve(folder));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) await rm(folder, { recursive: true, force: true });
  }
}
