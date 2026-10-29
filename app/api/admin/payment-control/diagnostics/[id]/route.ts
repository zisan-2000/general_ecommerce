import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireDiagnosticAccess, auditDiagnosticAction } from "@/lib/payment-control/diagnostic-authorization";
import { paymentControlErrorResponse, positiveId, PaymentControlError } from "@/lib/payment-control/authorization";
import { getPaymentInvestigation } from "@/lib/payment-control/investigation";
import { evidenceManifest, investigationCsv, investigationPdf } from "@/lib/payment-control/investigation-report";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const format = request.nextUrl.searchParams.get("format");
    if (format && !["json", "csv", "pdf"].includes(format)) throw new PaymentControlError("Invalid report format");
    const access = await requireDiagnosticAccess(request, format ? "payments.diagnostics.export" : undefined);
    const id = positiveId((await context.params).id);
    const report = await getPaymentInvestigation(id);
    const headers: Record<string, string> = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!format) return NextResponse.json(report, { headers });
    const bundle = evidenceManifest(report);
    const body = format === "pdf" ? await investigationPdf(report) : format === "csv" ? investigationCsv(report) : JSON.stringify(bundle, null, 2);
    await auditDiagnosticAction(access.userId!, "INVESTIGATION_EXPORTED", report.payment.traceId);
    headers["Content-Disposition"] = `attachment; filename="${report.payment.traceId}.${format}"`;
    headers["Content-Type"] = format === "pdf" ? "application/pdf" : format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8";
    headers["X-Report-Payload-SHA256"] = bundle.manifest.sha256;
    headers["X-Evidence-SHA256"] = createHash("sha256").update(body).digest("hex");
    return new Response(body, { headers });
  } catch (error) { return paymentControlErrorResponse(error); }
}
