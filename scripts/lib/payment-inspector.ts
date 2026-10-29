import "../payment-inspector-env-guard.mjs";
import { Prisma, PrismaClient } from "../../generated/prisma";
import { readTechnicalRequestInspector, type InspectorReadDependencies } from "../../lib/payment-control/request-inspector-reader";
import { readStoredTransportEvidence } from "../../lib/payment-control/transport-reader";
import type { TechnicalInspectorResponse } from "../../lib/payment-control/inspector-types";

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class InspectorCommandError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
type TargetDiagnostics = {
  checks: {
    TARGET_ROW_VALID: boolean;
    TARGET_DATABASE_MATCH: boolean;
    TARGET_READ_ONLY: boolean;
    TARGET_SERVER_LOOPBACK: boolean;
  };
  serverAddressCategory: "IPV4_LOOPBACK" | "IPV6_LOOPBACK" | "IPV4_MAPPED_LOOPBACK" | "UNNORMALIZED_LOOPBACK" | "OTHER_OR_UNAVAILABLE";
};
class InspectorTargetRejected extends InspectorCommandError {
  constructor(readonly diagnostics: TargetDiagnostics) { super("READ_ONLY_LOCAL_TARGET_REJECTED"); }
}
export type InspectorOptions = { requestId: string; page: number; output?: string };
export function parseInspectorArguments(args: string[]): InspectorOptions | null {
  if (args.length === 1 && args[0] === "--help") return null;
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]; const value = args[index + 1];
    if (!["--request-id", "--page", "--output"].includes(key) || !value || value.startsWith("--") || values.has(key)) {
      throw new InspectorCommandError("INVALID_ARGUMENTS");
    }
    values.set(key, value);
  }
  const requestId = values.get("--request-id") ?? "";
  const page = values.get("--page") ?? "1";
  if (!uuidPattern.test(requestId)) throw new InspectorCommandError("INVALID_REQUEST_ID");
  if (!/^(?:[1-9]|1[0-9]|20)$/.test(page)) throw new InspectorCommandError("INVALID_TIMELINE_PAGE");
  const output = values.get("--output");
  if (output && (!/\.json$/i.test(output) || /[\x00-\x1f]/.test(output))) throw new InspectorCommandError("INVALID_OUTPUT_FILE");
  return { requestId, page: Number(page), ...(output ? { output } : {}) };
}

export function validateInspectorDatabaseUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    if (!["postgresql:", "postgres:"].includes(url.protocol) || !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.hash || !url.username || !["/gen_eco", "/gen_eco_transport_uat"].includes(url.pathname)) throw new Error();
    for (const [key, entry] of url.searchParams) {
      if (!(key === "schema" && entry === "public" || key === "connect_timeout" && /^[1-5]$/.test(entry) ||
        key === "connection_limit" && entry === "1")) throw new Error();
      if (url.searchParams.getAll(key).length !== 1) throw new Error();
    }
    url.searchParams.set("connect_timeout", "3"); url.searchParams.set("connection_limit", "1");
    return { url: url.toString(), database: url.pathname.slice(1) };
  } catch { throw new InspectorCommandError("LOCAL_DATABASE_CONFIGURATION_REQUIRED"); }
}

// Capabilities exposed to the shared reader exclude mutations and arbitrary SQL.
function readModels(tx: Prisma.TransactionClient): InspectorReadDependencies["prisma"] {
  return {
    paymentEvent: { count: tx.paymentEvent.count.bind(tx.paymentEvent), findMany: tx.paymentEvent.findMany.bind(tx.paymentEvent), findFirst: tx.paymentEvent.findFirst.bind(tx.paymentEvent) },
    payment: { findUnique: tx.payment.findUnique.bind(tx.payment) },
    networkMonitorAgent: { findUnique: tx.networkMonitorAgent.findUnique.bind(tx.networkMonitorAgent) },
    networkHostSample: { findMany: tx.networkHostSample.findMany.bind(tx.networkHostSample) },
    networkProbeSample: { findMany: tx.networkProbeSample.findMany.bind(tx.networkProbeSample) },
    networkMonitorAlert: { findMany: tx.networkMonitorAlert.findMany.bind(tx.networkMonitorAlert) },
  };
}

export async function inspectLocalPaymentRequest(
  options: InspectorOptions,
  databaseUrl: string | undefined,
  connect: (url: string) => Pick<PrismaClient, "$transaction" | "$disconnect"> =
    (url) => new PrismaClient({ datasources: { db: { url } }, log: [] }),
) {
  // Revalidate even for callers other than the command-line parser.
  parseInspectorArguments(["--request-id", options.requestId, "--page", String(options.page)]);
  const config = validateInspectorDatabaseUrl(databaseUrl);
  const db = connect(config.url);
  try {
    const inspector = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      // inet::text includes /32 or /128. host(inet) supplies an exact address
      // for the strict loopback comparison below, without broadening approval.
      const targets = await tx.$queryRaw<Array<{ database: string; readOnly: string; address: string | null }>>(Prisma.sql`
        SELECT current_database() AS "database", current_setting('transaction_read_only') AS "readOnly",
          host(inet_server_addr()) AS "address"
      `);
      const target = targets.length === 1 ? targets[0] : undefined;
      const checks = {
        TARGET_ROW_VALID: !!target && typeof target === "object" && !Array.isArray(target),
        TARGET_DATABASE_MATCH: target?.database === config.database,
        TARGET_READ_ONLY: target?.readOnly === "on",
        TARGET_SERVER_LOOPBACK: ["127.0.0.1", "::1"].includes(target?.address ?? ""),
      };
      if (!Object.values(checks).every(Boolean)) {
        const address = target?.address;
        const serverAddressCategory: TargetDiagnostics["serverAddressCategory"] = address === "127.0.0.1" ? "IPV4_LOOPBACK"
          : address === "::1" ? "IPV6_LOOPBACK"
          : address === "::ffff:127.0.0.1" || address === "::ffff:7f00:1" ? "IPV4_MAPPED_LOOPBACK"
          : address === "127.0.0.1/32" || address === "::1/128" ? "UNNORMALIZED_LOOPBACK" : "OTHER_OR_UNAVAILABLE";
        // Fixed classifications and booleans only; never retain raw server values.
        throw new InspectorTargetRejected({ checks, serverAddressCategory });
      }
      return readTechnicalRequestInspector({
        prisma: readModels(tx), uuidPattern,
        // Do not print database/third-party exception messages, even on failure.
        PaymentControlError: class extends Error { constructor(_message: string, readonly status = 400) { super("INSPECTOR_READ_FAILED"); } },
        // Historical rows remain readable while collection is OFF. Never starts a collector.
        readTransportEvidence: async (requestId) => {
          // A missing/older transport table must not poison the read-only snapshot.
          await tx.$executeRaw`SAVEPOINT inspector_transport_read`;
          const result = await readStoredTransportEvidence(tx, requestId, true);
          if (result.storage === "UNAVAILABLE") await tx.$executeRaw`ROLLBACK TO SAVEPOINT inspector_transport_read`;
          await tx.$executeRaw`RELEASE SAVEPOINT inspector_transport_read`;
          return result;
        },
      }, options.requestId, new URLSearchParams({ page: String(options.page) }));
    }, { isolationLevel: "RepeatableRead", maxWait: 3000, timeout: 15000 });
    return terminalInspectorReport(inspector);
  } finally { await db.$disconnect(); }
}

export function terminalInspectorReport(inspector: TechnicalInspectorResponse) {
  return {
    format: "LOCAL_PAYMENT_INSPECTOR",
    readOnly: true,
    inspectorSchemaVersion: inspector.schemaVersion,
    requestId: inspector.requestId,
    requestProvider: inspector.overview.provider,
    apiCalls: inspector.http.attempts.map((call) => ({
      ...call, requestId: inspector.requestId,
      httpAttemptId: null, method: null, sanitizedEndpoint: null,
      source: { service: null, evidence: "NOT_RECORDED", address: null },
      destination: { origin: null, evidence: "NOT_RECORDED" },
      availability: { method: "NOT_RECORDED", endpointPath: "NOT_RECORDED", httpAttemptCorrelation: "UNAVAILABLE" },
    })),
    // Keep independently recorded attempts separate: never join by timestamp or operation guesses.
    transportAttempts: inspector.transportEvidence.attempts,
    inspector,
    limitations: [
      "HTTP methods and endpoint paths are not stored by the existing PaymentEvent/transport schema; they are not reconstructed from current gateway configuration.",
      "PaymentEvent HTTP results have no recorded HTTP Attempt ID. Transport attempts carry their own attemptId and sanitized destinationOrigin; these records are not joined speculatively.",
      "currentConfiguration describes this CLI process, not the historical Next.js process. Process-local queue health is unavailable to this separate process.",
      "Only the requested timeline page is returned (50 rows, pages 1–20); HTTP summary, transport and payment lifecycle limits remain those of Inspector v1.4.",
    ],
  };
}

export function safeInspectorFailure(error: unknown) {
  if (error instanceof InspectorTargetRejected) return { error: error.code, diagnostics: error.diagnostics };
  if (error instanceof InspectorCommandError) return { error: error.code };
  if (error && typeof error === "object" && "status" in error && error.status === 404) return { error: "RECORDED_REQUEST_NOT_FOUND" };
  if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") return { error: "OUTPUT_FILE_ALREADY_EXISTS" };
  return { error: "INSPECTOR_READ_OR_EXPORT_FAILED" };
}
