"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentInvestigation } from "@/lib/payment-control/investigation";
import type { diagnosticOverview } from "@/lib/payment-control/diagnostic-overview";
type Overview = Awaited<ReturnType<typeof diagnosticOverview>>;
type Capture = { id: string; kind: string; operation: string; status: string; createdAt: string; expiresAt: string;
  packetCount: number | null; errorCode: string | null; sha256: string | null; bytes: number | null;
  summary: { resets?: number; retransmissions?: number; attribution?: string } | null };
type Captures = { jobs: Capture[]; enabled: boolean; agent: { status: string; lastSeenAt: string | null } };
const api = "/api/admin/payment-control/diagnostics";
async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Diagnostics unavailable");
  return body;
}
const percent = (value: number | null) => value === null ? "NOT_OBSERVED" : `${(value * 100).toFixed(1)}%`;
const ms = (value: number | null) => value === null ? "NOT_OBSERVED" : `${value.toFixed(1)} ms`;
export default function PaymentDiagnostics({ canCapture, canExport, canDownloadEvidence }: {
  canCapture: boolean; canExport: boolean; canDownloadEvidence: boolean;
}) {
  const [query, setQuery] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<PaymentInvestigation | null>(null);
  const [captures, setCaptures] = useState<Captures | null>(null);
  const [error, setError] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState("INITIALIZE");
  useEffect(() => {
    const controller = new AbortController(); setError(""); setOverview(null);
    void getJson<Overview>(`${api}?${query}`, controller.signal).then(setOverview).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Diagnostics unavailable");
    });
    return () => controller.abort();
  }, [query, refresh]);
  useEffect(() => {
    setDetail(null); setCaptures(null); setCaptureError("");
    if (selected === null) return;
    const controller = new AbortController();
    void getJson<PaymentInvestigation>(`${api}/${selected}`, controller.signal).then(setDetail).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Investigation unavailable");
    });
    void getJson<Captures>(`${api}/captures?paymentId=${selected}`, controller.signal).then(setCaptures).catch(e => {
      if (!controller.signal.aborted) setCaptureError(e instanceof Error ? e.message : "Capture metadata unavailable");
    });
    return () => controller.abort();
  }, [selected, refresh]);
  async function capture(kind: "READINESS" | "CAPTURE") {
    if (selected === null || busy) return;
    setBusy(true); setCaptureError("");
    try {
      const response = await fetch(`${api}/captures`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: selected, operation, kind }), signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Capture request rejected");
      setRefresh(value => value + 1);
    } catch (e) { setCaptureError(e instanceof Error ? e.message : "Capture request unavailable"); }
    finally { setBusy(false); }
  }
  return <main className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link className="text-sm underline" href="/admin/payment-control">Payment Control Center</Link>
      <h1 className="mt-2 text-2xl font-semibold">Payment Diagnostics &amp; Investigation</h1>
      <p className="mt-1 text-sm text-muted-foreground">EPS Sandbox · AIBL UAT · Read-only financial investigation · All times UTC</p></div>
      <Button variant="outline" onClick={() => setRefresh(v => v + 1)}>Refresh evidence</Button></div>
    <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3 xl:grid-cols-4" onSubmit={event => {
      event.preventDefault(); const values = new FormData(event.currentTarget), params = new URLSearchParams();
      values.forEach((value, key) => { if (String(value)) params.set(key, String(value)); });
      setSelected(null); setQuery(params.toString());
    }}>
      <label className="text-sm">Gateway<select name="provider" className="mt-1 block w-full rounded border bg-background p-2"><option value="">EPS + AIBL</option><option>EPS</option><option>AIBL_WALLET</option></select></label>
      <label className="text-sm">Order, reference or trace ID<Input name="q" maxLength={50} className="mt-1" /></label>
      <label className="text-sm">From (UTC)<Input type="date" name="from" className="mt-1" /></label>
      <label className="text-sm">To (UTC)<Input type="date" name="to" className="mt-1" /></label>
      <label className="text-sm">Payment status<select name="status" className="mt-1 block w-full rounded border bg-background p-2"><option value="">All statuses</option>{["INITIATED", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "VOIDED"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="text-sm">Event assessment<select name="result" className="mt-1 block w-full rounded border bg-background p-2"><option value="">All confidence levels</option>{["CONFIRMED", "PROBABLE", "UNKNOWN"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="text-sm">Severity<select name="severity" className="mt-1 block w-full rounded border bg-background p-2"><option value="">All severities</option>{["HIGH", "MEDIUM", "LOW"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="text-sm">Problem category<Input name="category" placeholder="e.g. DNS_FAILURE" maxLength={60} className="mt-1" /></label>
      <Button type="submit">Apply filters</Button>
    </form>
    {error ? <p role="alert" className="rounded border border-destructive p-4">{error}</p> : null}
    {!overview && !error ? <p role="status">Loading diagnostics…</p> : null}
    {overview ? <>
      <p className="text-xs text-muted-foreground">Payment counts use the payment filters. HTTP/callback event metrics use gateway and date filters; they are observations, not unique delivery counts. Missing historical data is not reconstructed.</p>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{[
        ["Attempts", overview.overview.total], ["Successful (captured/refunded)", overview.overview.successful], ["Failed", overview.overview.failed],
        ["Pending", overview.overview.pending], ["Uncertain (latest 100)", overview.overview.uncertain], ["Open dispute investigations", overview.overview.openInvestigationCases],
        ["Payment success rate", percent(overview.overview.paymentSuccessRate)], ["HTTP/transport error events", percent(overview.overview.gatewayHttpErrorRate)],
        ["Avg / P50", `${ms(overview.overview.averageMs)} / ${ms(overview.overview.p50Ms)}`],
        ["P95 / P99", `${ms(overview.overview.p95Ms)} / ${ms(overview.overview.p99Ms)}`],
        ["Callback error events", percent(overview.overview.callbackFailureRate)], ["Reconciliation errors", overview.overview.reconciliationErrors],
      ].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 break-words text-lg font-semibold">{value}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Payment investigations</CardTitle></CardHeader><CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Event assessments cover the latest {overview.scan.count} of {overview.overview.total} matching attempts, at most 100 events per attempt. Category, confidence and severity filters apply within this window. Open a payment for database and transport checks. Latency sample: {overview.overview.sampleSize}{overview.overview.latencySampleLimited ? " (limited)" : ""}.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Attempt / Order", "Gateway", "Status", "Assessment", "Categories", "Action"].map(v => <th className="p-2" key={v}>{v}</th>)}</tr></thead>
          <tbody>{overview.payments.map(p => <tr key={p.id} className="border-t"><td className="p-2">#{p.id} / #{p.orderId}<code className="mt-1 block text-xs">{p.traceId}</code></td>
            <td className="p-2">{p.provider}</td><td className="p-2">{p.status}</td><td className="p-2">{p.result}<br />{p.severity}</td>
            <td className="max-w-xs break-words p-2">{p.categories.join(", ")}</td><td className="p-2"><Button variant="outline" onClick={() => { setError(""); setSelected(p.id); }}>Investigate</Button></td></tr>)}</tbody></table></div>
        {!overview.payments.length ? <p className="mt-4">No attempts match the filters in the scanned window.</p> : null}
      </CardContent></Card>
    </> : null}
    {selected !== null && !detail && !error ? <p role="status">Loading payment evidence…</p> : null}
    {detail ? <>
      <Card><CardHeader><CardTitle>Investigation #{detail.payment.id}</CardTitle></CardHeader><CardContent className="space-y-4">
        <code className="block break-all">{detail.payment.traceId}</code>
        <p>{detail.payment.provider} / {detail.payment.environment} · Payment {detail.payment.status} · Order {detail.payment.orderStatus} / {detail.payment.orderPaymentStatus}</p>
        <p className="text-sm text-muted-foreground">{detail.adapter.verificationContract}</p>
        <p className="text-sm">Passive browser collection: {detail.passiveDiagnosticsEnabled ? "enabled" : "off"}. Bank internal root cause: UNKNOWN. Snapshot UTC: {detail.generatedAt}</p>
        {canExport ? <div className="flex gap-3">{["json", "csv", "pdf"].map(format => <a key={format} className="rounded border px-3 py-2 text-sm underline" href={`${api}/${detail.payment.id}?format=${format}`}>Export {format.toUpperCase()}</a>)}</div> : <p className="text-sm">Report export requires its dedicated permission.</p>}
        {detail.analysis.findings.map(f => <article key={f.category + f.confidence} className="rounded border p-4"><p className="font-semibold">{f.category} · {f.confidence} · {f.severity}</p>
          <p className="mt-2 text-sm">{f.explanation}</p><p className="mt-2 text-sm">Action: {f.recommendedAction}</p><p className="mt-2 break-all text-xs text-muted-foreground">Component: {f.component} · Evidence: {f.evidence.join(", ") || "NOT_OBSERVED"} · Bank logs required: {f.bankConfirmationRequired ? "Yes" : "Not established"}</p></article>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Database and verification checks</CardTitle></CardHeader><CardContent className="space-y-2">{detail.checks.map(c => <div key={c.code} className="rounded border p-3"><p className="text-sm font-medium">{c.code}: {c.status}</p><p className="mt-1 text-xs text-muted-foreground">{c.explanation}</p></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Order-level browser reports</CardTitle></CardHeader><CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Untrusted browser reports without a returned server request ID. These belong to the order and cannot be assigned to this specific attempt. Correlated browser reports appear in the event timeline.</p>
        {detail.orderBrowserReports.events.length ? detail.orderBrowserReports.events.map(e => <p className="rounded border p-3 text-sm" key={e.id}>{e.createdAt} · CLIENT_REPORTED · {e.detailCode} · Browser elapsed: {ms(e.durationMs)}</p>) : <p className="text-sm">NOT_OBSERVED</p>}
        {detail.orderBrowserReports.limited ? <p className="text-xs">Latest 50 order-level reports only.</p> : null}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>DNS / TCP / TLS / HTTP evidence</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm">Storage: {detail.transport.storage.join(", ") || "NOT_OBSERVED"}. Request coverage: {detail.transport.requestsRead}/{detail.transport.totalRequests}. Reused or unobserved handshakes have no new measured duration.</p>
        {detail.transport.attempts.length ? detail.transport.attempts.map(a => <div key={a.attemptId} className="rounded border p-3 text-sm"><Link className="underline" href={`/admin/payment-control/requests/${a.requestId}`}>Request {a.requestId}</Link>
          <p className="mt-2">DNS {a.dns.status} ({ms(a.dns.durationMs)}) · TCP {a.tcp.status} ({ms(a.tcp.durationMs)}) · TLS {a.tls.status} ({ms(a.tls.durationMs)})</p>
          <p>{a.attribution} · {a.errorCode || a.requestOutcome}</p>
          <p>Connection certificate expiry UTC: {a.connectionEvidence?.tls.certificateExpiresAt || "NOT_OBSERVED"} · Validation: {a.connectionEvidence?.tls.certificateValidated === true ? "verified" : a.connectionEvidence?.tls.certificateValidated === false ? "failed" : "NOT_OBSERVED"}</p></div>) : <p>NOT_OBSERVED — inspect a request or enable reviewed transport collection.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Controlled packet capture</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm">Agent: {captures?.agent.status || "NOT_OBSERVED"} · Last seen UTC: {captures?.agent.lastSeenAt || "NOT_OBSERVED"} · Capture: {captures?.enabled ? "enabled" : "off/unavailable"}</p>
        <p className="text-xs text-muted-foreground">A capture observes a future gateway destination/time window. The operation is an investigation label; encrypted, shared traffic cannot be assigned to an exact request. Run readiness first. Browser hosted-payment traffic is outside backend visibility.</p>
        {canCapture ? <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Operation<select value={operation} onChange={e => setOperation(e.target.value)} className="ml-2 rounded border bg-background p-2">{["AUTH", "INITIALIZE", detail.payment.provider === "EPS" ? "STATUS_QUERY" : "VERIFY"].map(v => <option key={v}>{v}</option>)}</select></label>
          <Button variant="outline" disabled={busy || !captures?.enabled} onClick={() => void capture("READINESS")}>Test readiness</Button>
          <Button disabled={busy || !captures?.enabled} onClick={() => void capture("CAPTURE")}>Request bounded capture</Button></div> : <p className="text-sm">Capture requires its dedicated permission.</p>}
        {captureError ? <p role="alert">{captureError}</p> : null}
        {captures?.jobs.map(job => <div key={job.id} className="rounded border p-3 text-sm"><p>{job.kind} / {job.operation} · {job.status} · Packets: {job.packetCount ?? "NOT_OBSERVED"}</p>
          {job.packetCount === 0 ? <p>NOT_OBSERVED — no scoped packets were captured.</p> : null}
          <p>{job.errorCode || ""} · Resets: {job.summary?.resets ?? "NOT_OBSERVED"} · Retransmission observations: {job.summary?.retransmissions ?? "NOT_OBSERVED"}</p>
          {canDownloadEvidence && job.kind === "CAPTURE" && job.status === "COMPLETE" && job.sha256 ? <a className="underline" href={`${api}/captures/${job.id}`}>Download restricted PCAPNG</a> : null}
          {job.sha256 ? <code className="mt-2 block break-all text-xs">SHA-256 {job.sha256}</code> : null}<p className="mt-1 text-xs">Expires UTC: {job.expiresAt}</p></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Retained event timeline</CardTitle></CardHeader><CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Up to 1,000 correlated events, earliest first. Complete retained window: {detail.limited ? "NO (limited)" : "query not truncated; historical collection completeness unknown"}. Client reports cannot establish server outcomes.</p>
        <div className="max-h-[36rem] overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{["UTC", "Source / Stage", "Outcome", "Code / HTTP", "Duration (HTTP: headers)", "Request"].map(v => <th className="p-2" key={v}>{v}</th>)}</tr></thead>
          <tbody>{detail.events.map(e => <tr key={e.id} className="border-t"><td className="whitespace-nowrap p-2">{e.createdAt}</td><td className="p-2">{e.source}<br />{e.gatewayStage || e.operation}<br /><span className="text-muted-foreground">Recorded: {e.operation}</span></td><td className="p-2">{e.outcome}</td>
            <td className="p-2">{e.detailCode || "—"}<br />{e.httpStatus ?? "NOT_OBSERVED"}</td><td className="p-2">{ms(e.durationMs)}</td><td className="p-2">{e.requestId ? <Link className="underline" href={`/admin/payment-control/requests/${e.requestId}`}>{e.requestId}</Link> : "NOT_OBSERVED"}</td></tr>)}</tbody></table></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Evidence limits</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm">{detail.limitations.map(text => <li key={text}>{text}</li>)}</ul></CardContent></Card>
    </> : null}
  </main>;
}
