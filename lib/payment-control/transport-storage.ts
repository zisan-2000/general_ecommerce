import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { sanitizeTransportEvidence } from "./transport-sanitizer";
import type { TransportAttemptEvidence } from "./transport-types";
import { TransportEvidenceQueue } from "./transport-queue";

const MAX_READ = 100;
const globals = globalThis as typeof globalThis & { __paymentTransportQueueV2?: TransportEvidenceQueue };
function queueState() {
  return globals.__paymentTransportQueueV2 ??= new TransportEvidenceQueue({
    sanitize: sanitizeTransportEvidence, write: persistTransportAttempt, schedule: setImmediate,
  });
}
function collectionHealth() {
  try { return globals.__paymentTransportQueueV2?.snapshot() ?? null; }
  catch { return null; }
}

export function enqueueTransportEvidence(attempts: TransportAttemptEvidence[]) {
  try {
    if (process.env.PAYMENT_TRANSPORT_STORAGE_ENABLED !== "true") return;
    queueState().enqueue(attempts);
  } catch { /* instrumentation must never propagate into payment execution */ }
}
async function persistTransportAttempt(attempt: TransportAttemptEvidence): Promise<"INSERTED" | "DUPLICATE"> {
  return prisma.$transaction(async (tx): Promise<"INSERTED" | "DUPLICATE"> => {
    // Serialize ONLY transport writers across processes. READ COMMITTED ensures
    // the next statement sees duplicates committed by the preceding lock owner.
    // Neither lock namespace nor this table is used for payment settlement.
    await tx.$queryRaw(Prisma.sql`SELECT
      set_config('lock_timeout', '250ms', true) AS "lockTimeout",
      set_config('statement_timeout', '500ms', true) AS "statementTimeout"`);
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(1784484441, 4)::text AS "lock"`);
    // Duplicate detection occurs under the lock before nextval is evaluated.
    // A duplicate does not consume/overwrite a different ring slot or refresh TTL.
    // Parameterized SQL works before Prisma client regeneration too. Missing
    // migration is caught; Payment, Order and PaymentEvent are never written.
    const inserted = await tx.$executeRaw(Prisma.sql`
      INSERT INTO "PaymentTransportEvidence"
        ("slot", "attemptId", "requestId", "connectionId", "provider", "operation", "startedAt", "expiresAt", "evidence")
      SELECT (nextval('"PaymentTransportEvidence_slot_seq"') % 10000)::integer,
        ${attempt.attemptId}, ${attempt.requestId}, ${attempt.connectionId}, ${attempt.provider}, ${attempt.operation},
        ${new Date(attempt.startedAt)}, NOW() + INTERVAL '7 days', ${JSON.stringify(attempt)}::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM "PaymentTransportEvidence" WHERE "attemptId" = ${attempt.attemptId})
      ON CONFLICT ("slot") DO UPDATE SET
        "attemptId" = EXCLUDED."attemptId", "requestId" = EXCLUDED."requestId", "connectionId" = EXCLUDED."connectionId",
        "provider" = EXCLUDED."provider", "operation" = EXCLUDED."operation", "startedAt" = EXCLUDED."startedAt",
        "expiresAt" = EXCLUDED."expiresAt", "evidence" = EXCLUDED."evidence"
    `);
    if (inserted !== 0 && inserted !== 1) throw new Error("INVALID_TRANSPORT_WRITE_COUNT");
    return inserted === 0 ? "DUPLICATE" : "INSERTED";
  }, { isolationLevel: "ReadCommitted", maxWait: 250, timeout: 1500 });
}

export async function readTransportEvidence(requestId: string) {
  try {
    if (process.env.PAYMENT_TRANSPORT_STORAGE_ENABLED !== "true") {
      return { storage: "NOT_COLLECTED" as const, attempts: [] as TransportAttemptEvidence[], limited: false,
        collectionHealth: collectionHealth() };
    }
    const rows = await prisma.$queryRaw<Array<{ evidence: unknown }>>(Prisma.sql`
      SELECT "evidence" FROM "PaymentTransportEvidence"
      WHERE "requestId" = ${requestId} AND "expiresAt" > NOW()
      ORDER BY "startedAt" ASC, "attemptId" ASC LIMIT ${MAX_READ + 1}
    `);
    return { storage: "AVAILABLE" as const,
      attempts: rows.slice(0, MAX_READ).flatMap((row) => {
        const safe = sanitizeTransportEvidence(row.evidence);
        return safe?.requestId === requestId ? [safe] : [];
      }), limited: rows.length > MAX_READ, collectionHealth: collectionHealth() };
  } catch {
    return { storage: "UNAVAILABLE" as const, attempts: [] as TransportAttemptEvidence[], limited: false,
      collectionHealth: collectionHealth() };
  }
}

export async function pruneTransportEvidence() {
  // Only called by the authenticated maintenance route, in bounded batches.
  return prisma.$executeRaw(Prisma.sql`
    DELETE FROM "PaymentTransportEvidence" WHERE "slot" IN (
      SELECT "slot" FROM "PaymentTransportEvidence" WHERE "expiresAt" <= NOW()
      ORDER BY "expiresAt" ASC LIMIT 1000
    )
  `);
}
