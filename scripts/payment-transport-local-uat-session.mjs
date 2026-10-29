import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import { testUrl, verifyConnectedTarget } from "../tests/helpers/payment-transport-postgres-target.mjs";
import { transportRuntimeStatus } from "../lib/payment-control/transport-config.ts";

const runId = process.argv[2];
const runtimeOnly = process.argv[3] === "--runtime-only";
if (!/^[a-zA-Z0-9-]{8,80}$/.test(runId ?? "")) throw new Error("LOCAL_UAT_INVALID_RUN_ID");
const runDirectory = resolve(tmpdir(), "deshiplus-local-uat", runId);
await mkdir(runDirectory, { recursive: true });
const save = (name, value) => writeFile(join(runDirectory, name), JSON.stringify(value, null, 2));
const exists = async (name) => { try { await access(join(runDirectory, name)); return true; } catch { return false; } };
let app; let server;
try {
  if (!transportRuntimeStatus().compatible) throw new Error("LOCAL_UAT_PATCHED_RUNTIME_REQUIRED");
  let url;
  if (runtimeOnly) {
    // Explicitly unavailable DB, solely to verify the actual Next process and
    // unauthenticated boundaries while the operator's secure prompt is pending.
    // No authentication attempt against PostgreSQL and no original DB fallback.
    url = "postgresql://unavailable@127.0.0.1:1/gen_eco_transport_uat?connect_timeout=1";
    await save("postgres.json", { status: "NOT_TESTED", reason: "SECURE_UAT_CONNECTION_UNAVAILABLE" });
  } else {
  url = testUrl(process.env.PAYMENT_TRANSPORT_UAT_DATABASE_URL);
  // Independent read-only verification before executing any integration writer.
  const db = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try { await db.$transaction((tx) => verifyConnectedTarget(tx, Prisma.sql), { timeout: 3000 }); }
  finally { await db.$disconnect(); }
  await save("connection.json", { verified: true, database: "gen_eco_transport_uat", node: process.versions.node, undici: process.versions.undici });
  const result = await new Promise((done) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--test", "--test-reporter=tap",
      "tests/payment-transport-postgres-target.test.mjs", "tests/payment-transport-postgres-integration.test.mjs"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = ""; child.stdout.on("data", (part) => { stdout = (stdout + part).slice(-200000); });
    child.stderr.resume(); const timer = setTimeout(() => child.kill(), 75000);
    child.once("error", () => { clearTimeout(timer); done({ exitCode: 1, reason: "LOCAL_UAT_TEST_PROCESS_FAILED" }); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      const count = (name) => Number(stdout.match(new RegExp(`^# ${name} (\\d+)$`, "m"))?.[1] ?? -1);
      done({ exitCode: code ?? 1, tests: count("tests"), passed: count("pass"), failed: count("fail"), skipped: count("skipped"),
        diagnosticCodes: [...new Set(stdout.match(/\bUAT_[A-Z_]+\b/g) ?? [])] });
    });
  });
  await save("postgres.json", result);
  if (result.exitCode !== 0 || result.skipped !== 0) throw new Error("LOCAL_UAT_POSTGRES_NOT_PASS");
  console.log("LOCAL_UAT_POSTGRES_PASS; waiting for guarded build and browser checks.");
  }
  const deadline = Date.now() + 900000;
  while (!await exists("build-ready.flag")) {
    if (Date.now() > deadline || await exists("stop.flag")) throw new Error("LOCAL_UAT_BUILD_WAIT_ENDED");
    await new Promise((done) => setTimeout(done, 1000));
  }
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = url;
  process.env.PAYMENT_TRANSPORT_MONITORING_MODE = "off";
  // Read retained evidence through the real Inspector while capture stays OFF.
  process.env.PAYMENT_TRANSPORT_STORAGE_ENABLED = runtimeOnly ? "false" : "true";
  process.env.PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED = "false";
  process.env.PAYMENT_TRANSPORT_ALLOWED_PROVIDERS = "";
  process.env.PAYMENT_TRANSPORT_ALLOWED_OPERATIONS = "";
  process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex"); // Disposable local cookie isolation, never persisted.
  process.env.NEXTAUTH_URL = "http://127.0.0.1:4104";
  process.env.NEXTAUTH_URL_INTERNAL = process.env.NEXTAUTH_URL;
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  await import("./payment-transport-local-server-guard.cjs");
  const diagnostics = { databaseErrors: 0, otherErrors: 0, warnings: 0 };
  // Never persist raw Next/Prisma output. Keep visible failure counts, not values.
  console.error = (...args) => {
    if (args.some((arg) => /prisma|database|P100[0-9]|P202[12]/i.test(String(arg)))) diagnostics.databaseErrors++;
    else diagnostics.otherErrors++;
  };
  console.warn = () => { diagnostics.warnings++; };
  console.log = () => {};
  const { default: next } = await import("next");
  app = next({ dev: false, dir: process.cwd(), hostname: "127.0.0.1", port: 4104 });
  await app.prepare();
  const handle = app.getRequestHandler();
  server = createServer((req, res) => handle(req, res));
  await new Promise((done, reject) => { server.once("error", reject); server.listen(4104, "127.0.0.1", done); });
  await save("server.json", { pid: process.pid, executable: process.execPath, node: process.versions.node,
    nativeUndici: process.versions.undici, npmUndici: "6.29.1", framework: "next", hostname: "127.0.0.1", port: 4104,
    database: "gen_eco_transport_uat", connectedTargetVerified: !runtimeOnly, runtimeOnly,
    monitoring: "off", evidenceReadEnabled: !runtimeOnly, mutationsBlocked: true });
  while (!await exists("stop.flag")) {
    if (Date.now() > deadline) break;
    await save("server-health.json", diagnostics);
    await new Promise((done) => setTimeout(done, 1000));
  }
  server.closeAllConnections(); await new Promise((done) => server.close(done)); server = null;
  await app.close(); app = null;
  await save("cleanup.json", { serverStopped: true, mutatingRequestsBlocked: true, diagnostics });
} catch (error) {
  const code = error?.code === "P1000" ? "LOCAL_UAT_DATABASE_AUTHENTICATION_FAILED" : error?.code === "P1001" ? "LOCAL_UAT_DATABASE_UNREACHABLE"
    : error instanceof Error && /^(LOCAL_UAT|UAT)_[A-Z_]+$/.test(error.message) ? error.message : "LOCAL_UAT_FAILED_REDACTED";
  await save("failure.json", { code, ...(error?.diagnostic ? { targetChecks: error.diagnostic.checks } : {}) }); process.exitCode = 1;
} finally {
  if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
  await app?.close();
  delete process.env.PAYMENT_TRANSPORT_UAT_DATABASE_URL; delete process.env.DATABASE_URL;
  // Only this owned fixture process exits; no existing dev server is stopped.
  setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
}
