"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DashboardData, DisputeRow, EventRow, PaymentDetail, PaymentRow, RefundRow, StaffOption, SimulationRun } from "@/lib/payment-control/types";

const api = "/api/admin/payment-control";
const NetworkMonitoringPanel = dynamic(() => import("./NetworkMonitoringPanel"), { ssr: false, loading: () => <p role="status">Loading network monitoring…</p> });
const inputClass = "w-full rounded border bg-background px-3 py-2 text-sm";
const buttonClass = "rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";
const panelClass = "rounded-lg border bg-card p-4 space-y-4";
type Tab = "history" | "alerts" | "network" | "disputes" | "refunds" | "simulations";

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Payment control request failed");
  if (value === null) throw new Error("Invalid payment control response");
  return value as T;
}
const postJson = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function message(error: unknown) { return error instanceof Error ? error.message : "Operation failed"; }
function newRequestKey() {
  // getRandomValues also supports an admin opened over a development LAN origin.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function date(value: string | null) { return value ? new Date(value).toLocaleString(undefined, { timeZone: "UTC" }) + " UTC" : "—"; }
function metric(value: number | null) { return value === null ? "—" : Math.round(value) + " ms"; }
function Badge({ children }: { children: string }) {
  return <span className="inline-block rounded bg-muted px-2 py-1 text-xs font-medium">{children.replaceAll("_", " ")}</span>;
}
function PaymentTable({ payments, onSelect }: { payments: PaymentRow[]; onSelect: (id: number) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">Payment history</caption>
    <thead><tr>{["Transaction", "Order", "Gateway", "Amount", "Payment / Order", "Created"].map((title) => <th key={title} scope="col" className="border-b p-2">{title}</th>)}</tr></thead>
    <tbody>{payments.map((p) => <tr key={p.id} className="border-b">
      <td className="p-2"><button className="text-primary underline" onClick={() => onSelect(p.id)}>{p.externalId || "#" + p.id}</button></td>
      <td className="p-2">#{p.orderId}</td><td className="p-2">{p.provider}</td><td className="p-2">{p.amount} {p.currency}</td>
      <td className="p-2"><Badge>{p.status}</Badge> / {p.order?.paymentStatus}</td><td className="p-2">{date(p.createdAt)}</td>
    </tr>)}</tbody></table>{payments.length === 0 && <p className="py-6 text-muted-foreground">No payments match these filters.</p>}</div>;
}
function EventTable({ events, onSelect, onRequest }: { events: EventRow[]; onSelect?: (id: number) => void; onRequest?: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <caption className="sr-only">Payment event timeline</caption>
    <thead><tr>{["Time", "Gateway / Transaction", "Phase", "Result", "HTTP", "Latency", "Detail"].map((t) => <th scope="col" className="border-b p-2" key={t}>{t}</th>)}</tr></thead>
    <tbody>{events.map((e) => <tr key={e.id} className="border-b">
      <td className="p-2">{date(e.createdAt)}</td><td className="p-2">{e.provider}<br />{e.paymentId && onSelect
        ? <button className="text-primary underline" onClick={() => onSelect(e.paymentId!)}>{e.transactionId || "#" + e.paymentId}</button> : e.transactionId || "Unlinked attempt"}
        {e.orderId && <span className="block text-xs">Order #{e.orderId}</span>}</td>
      <td className="p-2">{e.operation}{e.requestId && (onRequest ? <button className="block text-xs underline" title={e.requestId} onClick={() => onRequest(e.requestId!)}>Request {e.requestId.slice(0, 8)}</button> : <span className="block text-xs text-muted-foreground" title={e.requestId}>Request {e.requestId.slice(0, 8)}</span>)}</td><td className="p-2"><Badge>{e.outcome}</Badge></td><td className="p-2">{e.httpStatus ?? "—"}</td>
      <td className="p-2">{metric(e.durationMs)}</td><td className="p-2">{e.detailCode || e.gatewayStatus || "—"}</td>
    </tr>)}</tbody></table>{events.length === 0 && <p className="py-4 text-muted-foreground">No recorded events.</p>}</div>;
}
function Pager({ page, total, size = 25, onPage }: { page: number; total: number; size?: number; onPage: (page: number) => void }) {
  return <div className="flex items-center gap-3"><button className={buttonClass} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span className="text-sm">Page {page} · {total} records</span><button className={buttonClass} disabled={page * size >= total} onClick={() => onPage(page + 1)}>Next</button></div>;
}
function DisputeEditor({ dispute, staff, onSaved }: { dispute: DisputeRow; staff: StaffOption[]; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    const evidenceNote = String(form.get("evidenceNote") || "");
    const hasEvidence = evidenceNote || form.get("evidenceLabel") || form.get("evidenceUrl");
    try {
      await readJson(api + "/disputes/" + encodeURIComponent(dispute.id), { ...postJson({
        version: dispute.version, status: form.get("status"), assignedToId: form.get("assignedToId") || null,
        resolution: form.get("resolution"), ...(hasEvidence ? { evidence: { label: form.get("evidenceLabel"), note: evidenceNote, url: form.get("evidenceUrl") } } : {}),
      }), method: "PATCH" });
      onSaved();
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <article className="rounded border p-4 space-y-3">
    <h4 className="font-medium">{dispute.category.replaceAll("_", " ")} · <Badge>{dispute.status}</Badge></h4>
    <p className="whitespace-pre-wrap text-sm">{dispute.complaint}</p>
    <p className="text-xs text-muted-foreground">Assigned: {dispute.assignedTo?.name || dispute.assignedToId || "Unassigned"} · Updated {date(dispute.updatedAt)}</p>
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Status<select name="status" defaultValue={dispute.status} className={inputClass}>
        {["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="text-sm">Assigned staff<select name="assignedToId" defaultValue={dispute.assignedToId || ""} className={inputClass}>
          <option value="">Unassigned</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name || person.id}</option>)}
          {dispute.assignedToId && !staff.some((s) => s.id === dispute.assignedToId) && <option value={dispute.assignedToId}>{dispute.assignedTo?.name || dispute.assignedToId}</option>}
        </select></label></div>
      <label className="block text-sm">Resolution (at least 10 characters to resolve/reject)<textarea name="resolution" defaultValue={dispute.resolution || ""} maxLength={2000} className={inputClass} /></label>
      <details><summary className="cursor-pointer text-sm">Add evidence</summary><div className="mt-2 space-y-2">
        <label className="block text-sm">Evidence label<input name="evidenceLabel" maxLength={120} className={inputClass} /></label>
        <label className="block text-sm">Evidence note<textarea name="evidenceNote" maxLength={2000} className={inputClass} /></label>
        <label className="block text-sm">Access-controlled HTTPS evidence link (optional)<input name="evidenceUrl" type="url" maxLength={1000} className={inputClass} /></label>
      </div></details>
      <p className="text-xs text-muted-foreground">Never enter passwords, tokens, card/account numbers, PIN or CVV. Evidence links are references only; this screen does not upload files.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<button className={buttonClass} disabled={busy}>{busy ? "Saving…" : "Save dispute"}</button>
    </form>
    {dispute.evidence?.map((e) => <div className="rounded bg-muted p-2 text-sm" key={e.id}><strong>{e.label}</strong><p className="whitespace-pre-wrap">{e.note}</p>
      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">Open evidence</a>}</div>)}
    <details><summary className="cursor-pointer text-sm">Case activity (latest 100)</summary><ul className="mt-2 space-y-1 text-xs">
      {dispute.activities?.map((a) => <li key={a.id}>{date(a.createdAt)} · {a.action} · {a.fromStatus || "—"} → {a.toStatus}
        {a.resolution && <p className="whitespace-pre-wrap">{a.resolution}</p>}</li>)}</ul></details>
  </article>;
}
function DetailPanel({ detail, staff, onRefresh, onMore, onRequest }: { detail: PaymentDetail; staff: StaffOption[]; onRefresh: () => void; onMore: () => Promise<void>; onRequest: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const retryKey = useRef<{ fingerprint: string; key: string } | null>(null);
  async function compare() {
    setBusy(true); setNotice("");
    try {
      const result = await readJson<{ reconciliation: { result: string } }>(api + "/" + detail.payment.id, postJson({}));
      setNotice("Comparison recorded: " + result.reconciliation.result);
      onRefresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  async function verifyAibl() {
    setBusy(true); setNotice("");
    try {
      const result = await readJson<{ status: string; message: string }>("/api/aibl-wallet/status",
        postJson({ orderId: detail.payment.orderId, tranId: detail.payment.externalId }));
      setNotice(`${result.status}: ${result.message}`); onRefresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = { paymentId: detail.payment.id, category: data.get("category"), complaint: data.get("complaint"), assignedToId: data.get("assignedToId") || null };
    const fingerprint = JSON.stringify(body);
    if (!retryKey.current || retryKey.current.fingerprint !== fingerprint) retryKey.current = { fingerprint, key: newRequestKey() };
    setBusy(true); setNotice("");
    try {
      await readJson(api + "/disputes", postJson({ ...body, idempotencyKey: retryKey.current.key }));
      retryKey.current = null; form.reset(); setNotice("Complaint recorded"); onRefresh();
    } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
  }
  const p = detail.payment;
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">Transaction {p.externalId || "#" + p.id}</h2>
      <p className="text-sm">Order #{p.orderId} · {p.provider} · {p.amount} {p.currency} · <Badge>{p.status}</Badge> / {p.order?.paymentStatus}</p></div>
      <button className={buttonClass} disabled={busy} onClick={compare}>Compare gateway status</button></div>
    <p className="text-sm text-muted-foreground">Comparison sends a server-side status query and records the result. It does not capture a payment, send a refund, or change inventory.</p>
    {p.provider === "AIBL_WALLET" && <section className="rounded border p-3 space-y-2 text-sm">
      <p>AIBL UAT · Bank OrderID: {detail.aibl?.bankOrderId || "N/A"} · Verified transaction: {detail.aibl?.bankTransactionId || "N/A"}</p>
      <p>Initialization validated: {detail.aibl?.initializationValidated ? "Yes" : "No"} · Review: {detail.aibl?.review || "See timeline"}</p>
      <p>Verification can capture a bank-confirmed payment and commit its reservations. Unknown outcomes remain pending.</p>
      <button className={buttonClass} disabled={busy || !["INITIATED", "AUTHORIZED"].includes(p.status)} onClick={verifyAibl}>Verify and settle pending AIBL payment</button>
    </section>}
    {notice && <p role="status" className="rounded bg-muted p-3 text-sm">{notice}</p>}
    <section className="space-y-2"><h3 className="font-semibold">Timeline</h3><EventTable events={detail.events} onRequest={onRequest} />
      {detail.nextBefore && <button className={buttonClass} disabled={busy} onClick={async () => {
        setBusy(true); try { await onMore(); } catch (error) { setNotice(message(error)); } finally { setBusy(false); }
      }}>Load older events</button>}</section>
    <section className="space-y-2"><h3 className="font-semibold">Reconciliation history (latest 50)</h3>
      {detail.reconciliations.map((r) => <div key={r.id} className="rounded border p-3 text-sm">{date(r.createdAt)} · <Badge>{r.result}</Badge>
        <p>Gateway: {r.gatewayStatus} · Database: {r.databaseStatus} / {r.orderStatus}</p>
        <p>Amount matches: {r.amountMatches === null ? "Unknown" : String(r.amountMatches)} · Reference matches: {r.referenceMatches === null ? "Unknown" : String(r.referenceMatches)}</p></div>)}
      {detail.reconciliations.length === 0 && <p className="text-sm text-muted-foreground">No comparison recorded.</p>}</section>
    <section className="space-y-3"><h3 className="font-semibold">Refund tracking</h3>
      {detail.refunds.map((r) => <p key={r.id} className="text-sm">#{r.id} · {r.amount} · {r.status} / {r.payoutStatus} · Paid {date(r.paidAt)}</p>)}
      {detail.refunds.length === 0 && <p className="text-sm text-muted-foreground">No refund requests for this order.</p>}</section>
    <section className="space-y-3"><h3 className="font-semibold">Disputes (latest 50)</h3>
      <form onSubmit={createCase} className="rounded border p-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Category<select name="category" className={inputClass}>
          {["COMPLAINT", "PAYMENT_MISMATCH", "REFUND", "DUPLICATE_CHARGE"].map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-sm">Assign staff<select name="assignedToId" className={inputClass}><option value="">Unassigned</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.name || person.id}</option>)}</select></label></div>
        <label className="block text-sm">Complaint<textarea name="complaint" required minLength={10} maxLength={2000} className={inputClass} /></label>
        <p className="text-xs text-muted-foreground">Describe the issue without credentials, tokens or sensitive payment data.</p>
        <button className={buttonClass} disabled={busy}>Open dispute</button>
      </form>
      {detail.disputes.map((d) => <DisputeEditor key={d.id + "-" + d.version} dispute={d} staff={staff} onSaved={onRefresh} />)}
    </section>
  </div>;
}

function CaseAndRefundList({ kind, refresh, canRecordRefund, staff, onSelect, onSaved }: {
  kind: "disputes" | "refunds"; refresh: number; canRecordRefund: boolean; staff: StaffOption[]; onSelect: (id: number) => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<{ disputes?: DisputeRow[]; refunds?: RefundRow[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingCase, setEditingCase] = useState<DisputeRow | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setRows(null); setError("");
    readJson<typeof rows>(api + "/" + kind + "?page=" + page + "&status=" + status, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setRows(value); }).catch((error) => { if (!controller.signal.aborted) setError(message(error)); });
    return () => controller.abort();
  }, [kind, status, page, refresh]);
  async function manageCase(id: string) {
    setBusy(true); setError("");
    try { setEditingCase((await readJson<{ dispute: DisputeRow }>(api + "/disputes/" + encodeURIComponent(id))).dispute); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function payout(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await readJson("/api/refunds/" + id + "/payout", postJson({ transactionId: form.get("transactionId") }));
      onSaved();
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  const options = kind === "disputes" ? ["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"] : ["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"];
  return <section className={panelClass}>
    <label className="block text-sm">Status<select className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
      <option value="">All statuses</option>{options.map((s) => <option key={s}>{s}</option>)}</select></label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!rows && !error && <p role="status">Loading…</p>}
    {rows?.disputes?.map((d) => <article className="rounded border p-3 space-y-2" key={d.id}>
      <button className="text-primary underline" onClick={() => onSelect(d.paymentId)}>Payment #{d.paymentId} · Order #{d.payment?.orderId}</button>
      <p className="text-sm">{d.category} · <Badge>{d.status}</Badge> · {d.assignedTo?.name || "Unassigned"}</p>
      <p className="whitespace-pre-wrap text-sm">{d.complaint}</p><p className="text-xs">{date(d.updatedAt)}</p>
      <button className={buttonClass} disabled={busy} onClick={() => manageCase(d.id)}>Manage dispute</button></article>)}
    {editingCase && <div className="space-y-2"><button className={buttonClass} onClick={() => setEditingCase(null)}>Close dispute</button>
      <DisputeEditor key={editingCase.id + "-" + editingCase.version} dispute={editingCase} staff={staff} onSaved={() => { setEditingCase(null); onSaved(); }} /></div>}
    {kind === "refunds" && <p className="text-sm text-muted-foreground">This records a payout already completed externally. It does not send money or call a gateway refund API. Approval uses the existing order refund workflow.</p>}
    {rows?.refunds?.map((r) => <article className="rounded border p-3 space-y-2" key={r.id}>
      <p>Refund #{r.id} · <Link href={"/admin/operations/orders/" + r.orderId} className="text-primary underline">Order #{r.orderId}</Link> · {r.amount} BDT</p>
      <p className="text-sm"><Badge>{r.status}</Badge> / {r.payoutStatus} · Reference: {r.payoutTransactionId || "—"}</p>
      {r.paymentId && <button className="text-primary underline text-sm" onClick={() => onSelect(r.paymentId!)}>View payment</button>}
      {canRecordRefund && r.status === "APPROVED" && r.payoutStatus === "PENDING" && <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => payout(e, r.id)}>
        <label className="text-sm">Completed external payout reference<input name="transactionId" minLength={3} maxLength={200} required className={inputClass} /></label>
        <label className="text-sm"><input type="checkbox" required className="mr-2" />I verified this payout externally</label>
        <button className={buttonClass} disabled={busy}>Record completed payout</button></form>}
    </article>)}
    {rows && (kind === "disputes" ? rows.disputes?.length === 0 : rows.refunds?.length === 0) && <p className="text-muted-foreground">No records.</p>}
    {rows && <Pager page={page} total={rows.total} onPage={setPage} />}
  </section>;
}
function SimulationPanel({ enabled, eps }: { enabled: boolean; eps: boolean }) {
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef<{ fingerprint: string; value: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    readJson<{ runs: SimulationRun[] }>(api + "/simulations", { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setRuns(data.runs); })
      .catch((error) => { if (!controller.signal.aborted) setError(message(error)); });
    return () => controller.abort();
  }, []);
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = { provider: data.get("provider"), scenario: data.get("scenario") };
    const fingerprint = JSON.stringify(body);
    if (!key.current || key.current.fingerprint !== fingerprint) key.current = { fingerprint, value: newRequestKey() };
    setBusy(true); setError("");
    try {
      const result = await readJson<{ run: SimulationRun }>(api + "/simulations", postJson({ ...body, idempotencyKey: key.current.value }));
      setRuns((previous) => [result.run, ...previous.filter((r) => r.id !== result.run.id)].slice(0, 25));
      key.current = null;
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <section className={panelClass}>
    <h2 className="font-semibold">Isolated sandbox simulations</h2>
    <p className="text-sm text-muted-foreground">Synthetic diagnostic runs. No actual gateway request, payment settlement, refund or inventory update occurs. These do not prove runtime payment success.</p>
    {!enabled && <p className="text-sm">Simulations are disabled. Enable PAYMENT_CONTROL_SANDBOX_SIMULATIONS only in a non-production environment.</p>}
    <form onSubmit={run} className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">Gateway<select name="provider" className={inputClass}><option disabled={!eps}>EPS</option><option>SSLCOMMERZ</option></select></label>
      <label className="text-sm">Scenario<select name="scenario" className={inputClass}>{["SUCCESS", "FAILED", "TIMEOUT", "DUPLICATE_CALLBACK", "REFUND", "DISPUTE"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <button className={buttonClass} disabled={!enabled || busy}>{busy ? "Recording…" : "Run diagnostic simulation"}</button>
    </form>{error && <p role="alert" className="text-destructive">{error}</p>}
    {runs.map((run) => <article className="rounded border p-3 space-y-2" key={run.id}>
      <h3 className="font-medium">{run.provider} · {run.scenario} · {date(run.createdAt)}</h3>
      <p className="text-sm">Simulated state: {run.result.paymentStatus} · Captures: {run.result.ledger.captures} · Inventory commits: {run.result.ledger.inventoryCommits} · Refunds: {run.result.ledger.refunds}</p>
      <ol className="list-inside list-decimal text-xs">{run.result.timeline.map((event) => <li key={event.sequence}>{event.operation} → {event.outcome}</li>)}</ol>
    </article>)}
  </section>;
}

export default function PaymentControlCenter() {
  const [query, setQuery] = useState("page=1");
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<Tab>("history");
  const [selectedRequest, setSelectedRequest] = useState<string | undefined>();
  function networkContext(id: string) { setSelectedRequest(id); setTab("network"); }
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    readJson<DashboardData>(api + "?" + query, { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((err) => { if (!controller.signal.aborted) { setData(null); setError(message(err)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, refresh]);
  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    const controller = new AbortController();
    setDetailLoading(true); setDetail(null); setDetailError("");
    readJson<PaymentDetail>(api + "/" + selectedId, { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setDetail(value); })
      .catch((err) => { if (!controller.signal.aborted) setDetailError(message(err)); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, refresh]);
  function reload() { setRefresh((n) => n + 1); }
  function select(id: number) { setSelectedId(id); setTab("history"); }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => { if (String(value).trim()) params.set(key, String(value).trim()); });
    params.set("page", "1"); setQuery(params.toString());
  }
  function page(next: number) { const params = new URLSearchParams(query); params.set("page", String(next)); setQuery(params.toString()); }
  async function exportCsv() {
    setExporting(true); setError("");
    try {
      const response = await fetch(api + "/export?" + query, { cache: "no-store" });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || "CSV export failed"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "payment-history.csv";
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(message(err)); } finally { setExporting(false); }
  }
  async function older() {
    if (!detail?.nextBefore) return;
    const id = detail.payment.id;
    const next = await readJson<PaymentDetail>(api + "/" + id + "?before=" + encodeURIComponent(detail.nextBefore));
    setDetail((previous) => previous?.payment.id === id ? { ...previous, events: [...previous.events, ...next.events], nextBefore: next.nextBefore } : previous);
  }
  const failedRequests = data?.network.summary.filter((row) => row.outcome !== "HTTP_SUCCESS").reduce((n, row) => n + row._count._all, 0) ?? 0;
  return <main className="p-4 md:p-6 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Payment Control Center</h1>
      <p className="text-sm text-muted-foreground">EPS Sandbox, SSLCommerz & AIBL Wallet UAT · Transaction diagnostics and staff review</p></div>
      <div className="flex gap-2"><Link className={buttonClass} href="/admin/settings/payment">Gateway settings</Link>
        <button className={buttonClass} onClick={reload} disabled={loading}>Refresh</button>
        <button className={buttonClass} onClick={exportCsv} disabled={exporting || loading}>Export filtered CSV</button></div></header>
    <form onSubmit={filter} className={panelClass}>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <label className="text-sm">Order / Transaction<input name="q" placeholder="Order ID or transaction ID" maxLength={50} className={inputClass} /></label>
        <label className="text-sm">Gateway<select name="provider" className={inputClass}><option value="">All gateways</option><option>EPS</option><option>SSLCOMMERZ</option><option>AIBL_WALLET</option></select></label>
        <label className="text-sm">Payment status<select name="status" className={inputClass}><option value="">All statuses</option>{["INITIATED", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED", "VOIDED"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="text-sm">From (UTC)<input name="from" type="date" className={inputClass} /></label>
        <label className="text-sm">To (UTC)<input name="to" type="date" className={inputClass} /></label>
        <button className={buttonClass}>Apply filters</button>
      </div><p className="text-xs text-muted-foreground">Default: last 30 days. Maximum: 90 days. Transaction filters apply to history/CSV; gateway/date apply to the summary and payment alerts. Advanced Network Monitoring has separate filters.</p>
    </form>
    {error && <p role="alert" className="rounded border border-destructive p-3 text-destructive">{error}</p>}
    {loading && <p role="status">Loading payment diagnostics…</p>}
    {data && <>
      <div className="grid gap-3 md:grid-cols-4">{[
        ["API requests", String(data.network.requests)], ["HTTP / timeout / connection failures", String(failedRequests)],
        ["Average response", metric(data.network.averageMs)], ["P95 response", metric(data.network.p95Ms)],
      ].map(([label, value]) => <div className="rounded-lg border p-4" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}</div>
      <p className="text-xs text-muted-foreground">UTC range: {date(data.range.start)} – {date(data.range.end)} · Latest recorded event: {date(data.network.latestEventAt)} · P95 uses up to 2,000 latest requests (sample: {data.network.p95SampleSize}). Latency covers fetch-to-response-headers.</p>
      <nav className="flex flex-wrap gap-2" aria-label="Payment control sections">{(["history", "alerts", "network", "disputes", "refunds", "simulations"] as Tab[]).map((t) =>
        <button className={buttonClass + (tab === t ? " bg-primary text-primary-foreground" : "")} aria-pressed={tab === t} key={t} onClick={() => setTab(t)}>
          {t[0].toUpperCase() + t.slice(1)}{t === "alerts" ? " (" + data.alerts.length + ")" : ""}</button>)}</nav>
      {tab === "history" && <section className={panelClass}><h2 className="font-semibold">Payment history</h2><PaymentTable payments={data.payments} onSelect={select} />
        <Pager page={data.page} total={data.total} size={data.pageSize} onPage={page} /></section>}
      {tab === "alerts" && <section className={panelClass}><h2 className="font-semibold">Payment alerts</h2>
        <p className="text-sm text-muted-foreground">Scanned the latest {Math.min(data.alertCandidateCount, data.alertScanLimit)} of {data.alertCandidateCount} candidates in this date range. Pending threshold: 15 minutes. Callback-missing detection needs recorded initialization events. Refresh to update; no notifications are sent externally.</p>
        {data.alerts.map((alert) => <div key={alert.kind + alert.paymentId} className="rounded border p-3 flex flex-wrap gap-3 items-center"><Badge>{alert.kind}</Badge>
          <button className="text-primary underline" onClick={() => select(alert.paymentId)}>{alert.provider} · {alert.transactionId || "#" + alert.paymentId} · Order #{alert.orderId}</button></div>)}
        {data.alerts.length === 0 && <p className="text-muted-foreground">No alerts in the scanned records.</p>}</section>}
      {tab === "network" && <NetworkMonitoringPanel key={selectedRequest || "network"} initialRequestId={selectedRequest} onPayment={select} />}
      {(tab === "disputes" || tab === "refunds") && <CaseAndRefundList key={tab} kind={tab} refresh={refresh} canRecordRefund={data.canRecordRefund} staff={data.staff} onSelect={select} onSaved={reload} />}
      {tab === "simulations" && <SimulationPanel enabled={data.simulations.enabled} eps={data.simulations.eps} />}
    </>}
    {selectedId !== null && <section className={panelClass}><div className="flex justify-between items-center"><h2 className="font-semibold">Payment details #{selectedId}</h2>
      <button className={buttonClass} onClick={() => setSelectedId(null)}>Close details</button></div>
      {detailLoading && <p role="status">Loading transaction…</p>}{detailError && <p role="alert" className="text-destructive">{detailError}</p>}
      {detail && <DetailPanel key={detail.payment.id} detail={detail} staff={data?.staff || []} onRefresh={reload} onMore={older} onRequest={networkContext} />}</section>}
  </main>;
}
