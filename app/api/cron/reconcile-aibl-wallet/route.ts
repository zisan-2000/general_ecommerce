import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileAiblWalletPayment } from "@/lib/aibl-wallet";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || ""); const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  const results = { checked: 0, success: 0, pending: 0, errors: 0 };
  try {
    const payments = await prisma.payment.findMany({ where: { provider: "AIBL_WALLET", orderId: { not: null },
      status: { in: ["INITIATED", "AUTHORIZED"] }, updatedAt: { lt: new Date(Date.now() - 60000) } }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 5 });
    for (const payment of payments) {
      if (!payment.externalId) continue;
      results.checked++;
      try { const result = await reconcileAiblWalletPayment(payment.externalId, request); results[result.status]++; }
      catch { results.errors++; }
      // Failed/missing-OrderID checks rotate to the back of the bounded queue.
      await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["INITIATED", "AUTHORIZED"] } }, data: { updatedAt: new Date() } });
    }
    // No guessed terminal status or timeout-driven stock release.
    revalidateStorefrontCatalog();
    return NextResponse.json(results, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "AIBL reconciliation could not complete", ...results }, { status: 500 }); }
}
