import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diagnosticLimits } from "@/lib/payment-control/diagnostic-policy";
import { deleteCaptureEvidence } from "@/lib/payment-control/capture-storage";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`, actual = request.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || Buffer.byteLength(expected) !== Buffer.byteLength(actual) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const { retentionDays } = diagnosticLimits();
    const cutoff = new Date(Date.now() - retentionDays * 86400000);
    const jobs = await prisma.paymentDiagnosticCapture.findMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { createdAt: { lt: cutoff } }] },
      select: { id: true }, orderBy: { expiresAt: "asc" }, take: 100 });
    let deleted = 0;
    for (const job of jobs) {
      await deleteCaptureEvidence(job.id);
      await prisma.paymentDiagnosticCapture.delete({ where: { id: job.id } }); deleted++;
    }
    const events = await prisma.paymentEvent.findMany({ where: { operation: "FRONTEND", createdAt: { lt: cutoff } }, select: { id: true }, take: 1000 });
    const pruned = await prisma.paymentEvent.deleteMany({ where: { id: { in: events.map(e => e.id) }, operation: "FRONTEND" } });
    return NextResponse.json({ deletedCaptures: deleted, deletedFrontendEvents: pruned.count, captureBatchLimit: 100, eventBatchLimit: 1000 },
      { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Diagnostic retention unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
