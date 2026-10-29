import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDiagnosticAccess, auditDiagnosticAction } from "@/lib/payment-control/diagnostic-authorization";
import { readCaptureEvidence } from "@/lib/payment-control/capture-storage";
import { PaymentControlError, paymentControlErrorResponse } from "@/lib/payment-control/authorization";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireDiagnosticAccess(request, "payments.diagnostics.evidence");
    const { id } = await context.params;
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new PaymentControlError("Invalid capture ID");
    const job = await prisma.paymentDiagnosticCapture.findFirst({ where: { id, status: "COMPLETE", kind: "CAPTURE", expiresAt: { gt: new Date() } } });
    if (!job?.sha256 || !job.bytes) throw new PaymentControlError("Restricted evidence is unavailable or expired", 404);
    const data = await readCaptureEvidence(id, job.bytes, job.sha256);
    await auditDiagnosticAction(access.userId!, "PCAPNG_EXPORTED", id);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/x-pcapng",
      "Content-Disposition": `attachment; filename="capture-${id}.pcapng"`, "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "X-Evidence-SHA256": job.sha256 } });
  } catch (error) { return paymentControlErrorResponse(error); }
}
