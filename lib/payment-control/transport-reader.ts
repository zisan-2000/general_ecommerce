import { Prisma } from "@/generated/prisma";
import { sanitizeTransportEvidence } from "./transport-sanitizer";
import type { InspectorTransportEvidence, TransportAttemptEvidence } from "./transport-types";

export async function readStoredTransportEvidence(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  requestId: string,
  enabled: boolean,
  collectionHealth: InspectorTransportEvidence["collectionHealth"] = null,
) {
  const empty = { attempts: [] as TransportAttemptEvidence[], limited: false, collectionHealth };
  if (!enabled) return { ...empty, storage: "NOT_COLLECTED" as const };
  try {
    const rows = await client.$queryRaw<Array<{ evidence: unknown }>>(Prisma.sql`
      SELECT "evidence" FROM "PaymentTransportEvidence"
      WHERE "requestId" = ${requestId} AND "expiresAt" > NOW()
      ORDER BY "startedAt" ASC, "attemptId" ASC LIMIT 101
    `);
    return {
      storage: "AVAILABLE" as const,
      attempts: rows.slice(0, 100).flatMap((row) => {
        const safe = sanitizeTransportEvidence(row.evidence);
        return safe?.requestId === requestId ? [safe] : [];
      }),
      limited: rows.length > 100,
      collectionHealth,
    };
  } catch {
    return { ...empty, storage: "UNAVAILABLE" as const };
  }
}
