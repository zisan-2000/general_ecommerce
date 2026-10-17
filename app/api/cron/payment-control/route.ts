import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { compareGatewayPayment } from "@/lib/payment-control/reconciliation";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.PAYMENT_CONTROL_RECONCILIATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Payment control reconciliation is not enabled" }, { status: 503 });
  }
  try {
    // Oldest/never-checked first, not Payment.updatedAt: compare is read-only.
    // Small sequential batches; no DB transaction spans a provider request.
    const candidates = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      SELECT p."id" FROM "Payment" p
      LEFT JOIN LATERAL (
        SELECT MAX(r."createdAt") AS "checkedAt" FROM "PaymentReconciliation" r WHERE r."paymentId" = p."id"
      ) r ON true
      WHERE p."orderId" IS NOT NULL AND p."externalId" IS NOT NULL
        AND p."provider" IN ('EPS', 'SSLCOMMERZ', 'AIBL_WALLET')
        AND p."createdAt" > NOW() - INTERVAL '90 days'
        AND p."createdAt" < NOW() - INTERVAL '1 minute'
        AND (r."checkedAt" IS NULL OR r."checkedAt" < NOW() - INTERVAL '5 minutes')
      ORDER BY r."checkedAt" ASC NULLS FIRST, p."id" ASC LIMIT 3
    `);
    const results: Record<string, number> = {};
    for (const payment of candidates) {
      try {
        const comparison = await compareGatewayPayment(payment.id, "system:payment-control-cron");
        results[comparison.result] = (results[comparison.result] ?? 0) + 1;
      } catch { results.ERROR = (results.ERROR ?? 0) + 1; }
    }
    return NextResponse.json({ checked: candidates.length, results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Payment control reconciliation could not complete" }, { status: 500 });
  }
}
