import { createHash } from "node:crypto";
import type { PaymentInvestigation } from "./investigation";
export function evidenceManifest(report: PaymentInvestigation) {
  const json = JSON.stringify(report, null, 2);
  return { report, manifest: { algorithm: "SHA-256", scope: "UTF8_JSON_STRINGIFY_REPORT_2_SPACES", sha256: createHash("sha256").update(json).digest("hex"),
    generatedAt: report.generatedAt, traceId: report.payment.traceId,
    note: "Checksum detects changed export bytes; it is not an independent signature or proof of completeness." } };
}
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function investigationCsv(report: PaymentInvestigation) {
  const rows = [["Trace ID", "Gateway", "Environment", "UTC", "Category", "Severity", "Confidence", "Component", "Evidence IDs", "Recommended action", "Bank confirmation required"],
    ...report.analysis.findings.map(f => [report.payment.traceId, report.payment.provider, report.payment.environment,
      report.generatedAt, f.category, f.severity, f.confidence, f.component, f.evidence.join(";"), f.recommendedAction, f.bankConfirmationRequired])];
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
export async function investigationPdf(report: PaymentInvestigation) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]), y = 792;
  const line = (text: string, size = 9) => {
    // Report vocabulary is English; replace any historical non-WinAnsi data.
    const safe = text.replace(/[^\x20-\x7E]/g, "?");
    let row = "";
    for (const word of safe.split(" ")) {
      if (font.widthOfTextAtSize(row + " " + word, size) > 490) { draw(row, size); row = word; }
      else row += (row ? " " : "") + word;
    }
    draw(row, size);
  };
  const draw = (text: string, size: number) => {
    if (y < 55) { page = pdf.addPage([595, 842]); y = 792; }
    page.drawText(text, { x: 50, y, size, font, color: rgb(.08, .12, .2) }); y -= size + 6;
  };
  line("Deshi Plus - Payment Investigation Evidence", 17);
  line(`Trace: ${report.payment.traceId}`); line(`UTC generated: ${report.generatedAt}`);
  line(`Gateway: ${report.payment.provider} / ${report.payment.environment}`);
  if (report.adapter) line(report.adapter.verificationContract);
  line(`Reference: ${report.payment.reference ?? "NOT_OBSERVED"}`);
  line(`Payment: ${report.payment.status}; Order payment: ${report.payment.orderPaymentStatus}`);
  line(`Amount: ${report.payment.amount ?? "NOT_OBSERVED"} ${report.payment.currency ?? "NOT_OBSERVED"}`);
  line(`Assessment: ${report.analysis.result}; bank internal cause: UNKNOWN`);
  line(`Evidence: ${report.events.length} retained events; ${report.transport.attempts.length} transport attempts; limited: ${report.limited || report.transport.limited}`);
  line(`Report SHA-256: ${evidenceManifest(report).manifest.sha256}`);
  line("Findings", 13);
  for (const f of report.analysis.findings) {
    line(`${f.category} | ${f.severity} | ${f.confidence}`, 10); line(f.explanation);
    line(`Component: ${f.component}; merchant check: ${f.merchantCheck}; bank logs needed: ${f.bankConfirmationRequired}`);
    line(`Evidence: ${f.evidence.join(", ") || "NOT_OBSERVED"}`); line(`Action: ${f.recommendedAction}`);
  }
  line("Read-only consistency checks", 13);
  for (const c of report.checks) { line(`${c.code}: ${c.status}`); line(c.explanation); }
  line("UTC event timeline (complete retained window)", 13);
  for (const e of report.events) line(`${e.createdAt} ${e.source} ${e.gatewayStage || e.operation} ${e.outcome} HTTP:${e.httpStatus ?? "N/A"} ${e.source === "CLIENT_REPORTED" ? "client-elapsed" : "duration/HTTP-headers"}:${e.durationMs ?? "N/A"}ms code:${e.detailCode ?? "N/A"}`);
  line("Unassigned order-level browser reports", 13);
  line("These client reports are not attributed to this payment attempt.");
  for (const e of report.orderBrowserReports?.events ?? []) line(`${e.createdAt} CLIENT_REPORTED ${e.detailCode ?? "UNKNOWN"} elapsed:${e.durationMs ?? "N/A"}ms`);
  line("Measured connection evidence", 13);
  for (const a of report.transport.attempts) {
    line(`Request ${a.requestId}; attempt ${a.attemptId}; attribution ${a.attribution}`);
    line(`DNS ${a.dns.status}/${a.dns.durationMs ?? "N/A"}ms; TCP ${a.tcp.status}/${a.tcp.durationMs ?? "N/A"}ms; TLS ${a.tls.status}/${a.tls.durationMs ?? "N/A"}ms; error ${a.errorCode ?? "N/A"}`);
  }
  line("Packet evidence manifest", 13);
  line(`Availability: ${report.captureEvidence.availability}; limited: ${report.captureEvidence.limited}`);
  for (const job of report.captureEvidence.jobs) line(`Capture ${job.id}: ${job.status}; packets ${job.packetCount ?? "NOT_OBSERVED"}; SHA-256 ${job.sha256 ?? "NOT_AVAILABLE"}`);
  line("Visibility and confidence limits", 13);
  for (const text of report.limitations) line(text);
  pdf.setTitle("Deshi Plus Payment Investigation"); pdf.setCreationDate(new Date(report.generatedAt));
  for (const [index, sheet] of pdf.getPages().entries()) sheet.drawText(`Deshi Plus | Restricted | ${index + 1}/${pdf.getPageCount()}`, { x: 50, y: 25, size: 8, font });
  return pdf.save();
}
