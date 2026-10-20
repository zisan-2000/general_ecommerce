"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventRow } from "@/lib/payment-control/types";
import type { HostSample, NetworkData, ProbeSample } from "@/lib/network-monitor/types";
import NetworkMonitorSettings from "./NetworkMonitorSettings";
const input = "rounded border bg-background px-3 py-2 text-sm";
const button = input + " disabled:opacity-50";
const panel = "rounded-lg border bg-card p-4 space-y-4";
const time = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { timeZone: "UTC" }) + " UTC" : "N/A";
const ms = (value: number | null) => value === null ? "N/A" : value.toFixed(2) + " ms";
const count = (value: string | number | null | undefined) => value === null || value === undefined ? "N/A" : String(value);
function safeChartCount(value: string | null) { if (value === null) return null; const n = Number(value); return Number.isSafeInteger(n) ? n : null; }
type ChartRow = { at: number; [key: string]: number | null };
function gaps(rows: ChartRow[], maxGapMs: number) {
  const sorted = [...rows].sort((a, b) => a.at - b.at); const result: ChartRow[] = [];
  for (const row of sorted) {
    const previous = result[result.length - 1];
    if (previous && row.at - previous.at > maxGapMs) {
      const gap: ChartRow = { at: previous.at + 1 };
      for (const key of Object.keys(row)) { if (key !== "at") gap[key] = null; }
      result.push(gap);
    }
    result.push(row);
  }
  return result;
}
function Trend({ title, rows, lines, gapMs }: { title: string; rows: ChartRow[]; lines: Array<{ key: string; label: string; color: string }>; gapMs: number }) {
  return <section aria-label={title} className="rounded border p-3"><h4 className="font-medium">{title}</h4>
    {rows.length ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={gaps(rows, gapMs)} accessibilityLayer>
      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="at" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(n: number) => new Date(n).toISOString().slice(11, 19)} />
      <YAxis /><Tooltip labelFormatter={(value) => time(new Date(Number(value)).toISOString())} /><Legend />
      {lines.map((line) => <Line key={line.key} dataKey={line.key} name={line.label} stroke={line.color} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />)}
    </LineChart></ResponsiveContainer></div> : <p className="py-6 text-muted-foreground">N/A · No recorded measurements.</p>}
  </section>;
}
function Metrics({ values }: { values: Array<[string, string]> }) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{values.map(([label, value]) => <div key={label} className="rounded border p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>;
}
function Table({ caption, headings, children }: { caption: string; headings: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="text-left font-medium py-2">{caption}</caption><thead><tr>{headings.map((h) => <th key={h} scope="col" className="border-b p-2">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
function HostTable({ rows }: { rows: HostSample[] }) {
  const cell = (delta: string | null, total: string | null) => `${count(delta)} (total ${count(total)})`;
  return <Table caption="Selected interface / host-wide TCP history" headings={["Observed / interval start (UTC)", "State", "NIC sent", "NIC received", "NIC discarded", "Host IPv4 TCP retransmissions", "Host IPv4 connection failures"]}>
    {rows.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{time(row.observedAt)}<br />{time(row.intervalStartAt)}</td><td className="p-2">{row.counterState}</td>
      <td className="p-2">{cell(row.sentDelta, row.packetsSent)}</td><td className="p-2">{cell(row.receivedDelta, row.packetsReceived)}</td><td className="p-2">{cell(row.droppedDelta, row.packetsDropped)}</td>
      <td className="p-2">{cell(row.retransmissionsDelta, row.tcpRetransmissions)}</td><td className="p-2">{cell(row.connectionFailuresDelta, row.tcpConnectionFailures)}</td></tr>)}
  </Table>;
}
function ProbeTable({ rows }: { rows: ProbeSample[] }) {
  return <Table caption="Approved probe history" headings={["Completed (UTC)", "Target / configuration", "Outcome", "Latency", "Attempt elapsed", "Error code"]}>
    {rows.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{time(row.completedAt)}</td><td className="p-2">{row.targetLabel} · {row.protocol} {row.address}:{row.port ?? "—"} · v{row.targetVersion}</td>
      <td className="p-2">{row.outcome}</td><td className="p-2">{ms(row.latencyMs)}</td><td className="p-2">{ms(row.elapsedMs)}</td><td className="p-2">{row.errorCode || "N/A"}</td></tr>)}
  </Table>;
}
function ApiTable({ rows, onRequest, onPayment }: { rows: EventRow[]; onRequest: (id: string) => void; onPayment: (id: number) => void }) {
  return <Table caption="Payment API observations · all gateways/hosts" headings={["Time (UTC)", "Gateway / phase", "Payment", "Request ID / host binding", "HTTP / outcome", "Latency", "Error code"]}>
    {rows.map((row) => <tr key={row.id} className="border-b"><td className="p-2">{time(row.createdAt)}</td><td className="p-2">{row.provider} · {row.operation}</td>
      <td className="p-2">{row.paymentId ? <button className="underline" onClick={() => onPayment(row.paymentId!)}>#{row.paymentId}</button> : "Unlinked"}</td>
      <td className="p-2">{row.requestId ? <button className="underline break-all" onClick={() => onRequest(row.requestId!)}>{row.requestId}</button> : "N/A"}<br />{row.networkAgentId || "Host N/A"}</td>
      <td className="p-2">{row.httpStatus ?? "N/A"} · {row.outcome}</td><td className="p-2">{ms(row.durationMs)}</td><td className="p-2">{row.detailCode || "N/A"}</td></tr>)}
  </Table>;
}
export default function NetworkMonitoringPanel({ initialRequestId, onPayment }: { initialRequestId?: string; onPayment: (id: number) => void }) {
  const [agentId, setAgentId] = useState(""); const [hours, setHours] = useState("1"); const [page, setPage] = useState(1);
  const [source, setSource] = useState<"host" | "probe" | "api">("host"); const [live, setLive] = useState(true);
  const [requestId, setRequestId] = useState(initialRequestId || ""); const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<NetworkData | null>(null); const [error, setError] = useState(""); const [settings, setSettings] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let inFlight = false;
    async function load() {
      if (inFlight || controller.signal.aborted) return;
      if (document.hidden) { if (live) timer = setTimeout(() => void load(), 10000); return; }
      inFlight = true;
      const params = new URLSearchParams({ hours, page: String(page) });
      if (agentId) params.set("agentId", agentId); if (requestId) params.set("requestId", requestId);
      try {
        const response = await fetch("/api/admin/payment-control/network?" + params, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Monitoring unavailable");
        if (!controller.signal.aborted) { setData(value); setError(""); }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Monitoring unavailable"); }
      finally { inFlight = false; if (live && !controller.signal.aborted) timer = setTimeout(() => void load(), 10000); }
    }
    function visible() { if (!document.hidden) { if (timer) clearTimeout(timer); void load(); } }
    void load(); if (live) document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [agentId, hours, page, requestId, live, refresh]);
  function correlate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setRequestId(String(new FormData(event.currentTarget).get("requestId") || "").trim()); }
  const currentHost = data?.hosts[0];
  return <section className="space-y-4" aria-label="Advanced network monitoring">
    <div className={panel}><h2 className="font-semibold">Advanced network monitoring</h2>
      <p className="text-sm text-muted-foreground">Host, probe and Payment API measurements have separate scopes. Only recorded observations appear. TCP packet loss and packet counts are N/A. No EPS/SSLCommerz/AIBL internal network metrics are inferred.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Collector<select className={input + " block"} value={agentId} onChange={(e) => { setAgentId(e.target.value); setPage(1); }}><option value="">First registered collector</option>{data?.agents.map((a) => <option key={a.id} value={a.id}>{a.label} · {a.enabled ? "enabled" : "disabled"}</option>)}</select></label>
        <label className="text-sm">Monitoring range<select className={input + " block"} value={hours} onChange={(e) => { setHours(e.target.value); setPage(1); }}>{[1, 6, 24, 168].map((n) => <option key={n} value={n}>{n} hours</option>)}</select></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Refresh every 10 seconds</label>
        <button className={button} onClick={() => setRefresh((n) => n + 1)}>Refresh measurements</button>
        <button className={button} aria-expanded={settings} onClick={() => setSettings((value) => !value)}>Collector settings</button>
      </div>
      <p className="text-xs">Dashboard refresh reads stored data; it never runs probes. Collector observations: ≥60s. Monitoring uses its own filters; payment history filters above do not apply. Last successful refresh: {time(data?.range.end || null)}.</p>
      {error && <p role="alert" className="text-destructive">{error} · Previous measurements, if shown, are cached.</p>}
      {!data && !error && <p role="status">Loading network measurements…</p>}
      {settings && <NetworkMonitorSettings onSaved={() => setRefresh((n) => n + 1)} />}
    </div>
    {data && <>
      <section className={panel}><h3 className="font-semibold">Host level · {data.agents.find((a) => a.id === data.agentId)?.label || "No collector registered"}</h3>
        <p className="text-sm">{data.hostStale ? "STALE / unavailable" : "Recent observation"} · {time(currentHost?.observedAt || null)} · {currentHost?.counterState || "N/A"}. NIC discards are OS counters, not path packet loss. TCP counters cover the entire Windows host’s IPv4 stack.</p>
        <Metrics values={[["Selected NIC packets sent (total)", count(currentHost?.packetsSent)], ["Selected NIC packets received (total)", count(currentHost?.packetsReceived)],
          ["Selected NIC packets discarded (total)", count(currentHost?.packetsDropped)], ["End-to-end packet loss", "N/A"],
          ["Host IPv4 TCP retransmissions (total)", count(currentHost?.tcpRetransmissions)], ["Host IPv4 TCP connection failures (total)", count(currentHost?.tcpConnectionFailures)],
          ["Interval TCP retransmissions", count(currentHost?.retransmissionsDelta)], ["Interval connection failures", count(currentHost?.connectionFailuresDelta)]]} />
        <Trend title="Selected NIC packet deltas per observed interval" rows={data.hosts.map((h) => ({ at: Date.parse(h.observedAt), sent: safeChartCount(h.sentDelta), received: safeChartCount(h.receivedDelta), discarded: safeChartCount(h.droppedDelta) }))}
          gapMs={150000} lines={[{ key: "sent", label: "Sent", color: "#2563eb" }, { key: "received", label: "Received", color: "#16a34a" }, { key: "discarded", label: "NIC discards", color: "#dc2626" }]} />
        <Trend title="Host IPv4 TCP deltas per observed interval" rows={data.hosts.map((h) => ({ at: Date.parse(h.observedAt), retransmissions: safeChartCount(h.retransmissionsDelta), failures: safeChartCount(h.connectionFailuresDelta) }))}
          gapMs={150000} lines={[{ key: "retransmissions", label: "Retransmissions", color: "#9333ea" }, { key: "failures", label: "Failed connections", color: "#dc2626" }]} />
        <p className="text-xs">First sample, restart, scope change or counter reset: delta N/A. Missing interface configuration: NIC N/A. Large counters remain exact in tables; values outside JavaScript’s safe integer range are omitted from charts. Loopback probes may not appear on a selected physical NIC.</p>
      </section>
      <section className={panel}><h3 className="font-semibold">Probe level · independently approved targets</h3>
        {!data.targets.length && <p>No probe targets configured. N/A.</p>}
        {data.targets.map((t) => <article key={t.id} className="space-y-3 rounded border p-3"><h4 className="font-medium">{t.label} · {t.protocol} {t.address}{t.port === null ? "" : ":" + t.port} · {t.enabled ? "enabled" : "disabled"} · {t.stale ? "STALE / N/A" : "recent"}</h4>
          <Metrics values={[["Measured connection latency (average)", ms(t.averageLatencyMs)], ["Adjacent latency jitter", ms(t.jitterMs)], ["Recorded attempts / timeouts", `${t.attempts} / ${t.timeouts}`],
            ["Unsuccessful attempts (not lost packets)", String(t.failures)], ["ICMP echo attempts", count(t.echoAttempts)], ["ICMP echo replies", count(t.echoReplies)],
            ["Probe packets sent / received / dropped", "N/A"], ["ICMP echo no-reply rate", t.packetLossPct === null ? "N/A" : t.packetLossPct.toFixed(2) + "%"]]} />
          <p className="text-xs">Interval {t.intervalSeconds}s · timeout {t.timeoutMs}ms · latest outcome {t.latest?.outcome || "N/A"} · current configuration v{t.version} · jitter pairs {t.jitterPairs}. TCP connection success does not measure loss. ICMP no-reply rate requires a separately approved ICMP target; it cannot identify where a packet was lost.</p>
          <Trend title={t.label + " measured latency (ms)"} rows={data.probes.filter((p) => p.targetId === t.id && p.targetVersion === t.version).map((p) => ({ at: Date.parse(p.completedAt), latency: p.latencyMs }))}
            gapMs={t.intervalSeconds * 2500} lines={[{ key: "latency", label: "Latency ms", color: "#2563eb" }]} />
        </article>)}
      </section>
      <section className={panel}><h3 className="font-semibold">Payment API level · EPS / SSLCommerz / AIBL Wallet</h3>
        <Metrics values={[["Recorded requests in range", String(data.api.count)], ["Average fetch-to-headers", ms(data.api.averageMs)], ["Maximum fetch-to-headers", ms(data.api.maxMs)], ["API packet counts / packet loss", "N/A"]]} />
        <div className="flex flex-wrap gap-3 text-sm">{data.api.summary.map((s) => <span key={s.provider + s.outcome}>{s.provider} {s.outcome}: {s._count._all}</span>)}</div>
        <Trend title="Payment API response / failure elapsed (ms)" rows={data.apiEvents.map((e) => ({ at: Date.parse(e.requestCompletedAt || e.createdAt), EPS: e.provider === "EPS" ? e.durationMs : null, SSLCOMMERZ: e.provider === "SSLCOMMERZ" ? e.durationMs : null, AIBL_WALLET: e.provider === "AIBL_WALLET" ? e.durationMs : null }))}
          gapMs={120000} lines={[{ key: "EPS", label: "EPS elapsed ms", color: "#2563eb" }, { key: "SSLCOMMERZ", label: "SSLCommerz elapsed ms", color: "#9333ea" }, { key: "AIBL_WALLET", label: "AIBL elapsed ms", color: "#0891b2" }]} />
      </section>
      <section className={panel}><h3 className="font-semibold">Network alert history (latest 100)</h3>
        <p className="text-xs">Probe latency threshold {data.thresholds.probeLatencyMs}ms · API threshold {data.thresholds.apiLatencyMs}ms · approved ICMP no-reply threshold {data.thresholds.lossPct}% with at least {data.thresholds.minimumLossSamples} recent samples. Collector ingestion evaluates host/probe alerts; dashboard refresh evaluates the latest API outcomes. Missing data does not resolve an alert. No external notifications are sent.</p>
        <Table caption="Open and resolved alerts" headings={["Scope / collector", "Alert / target", "Status", "Last triggering value / threshold", "Timeline (UTC)", "Triggering Request ID"]}>{data.alerts.map((a) => <tr key={a.id} className="border-b">
          <td className="p-2">{a.scope} · {a.agentId || "Host N/A"}</td><td className="p-2">{a.code}<br />{data.targets.find((t) => t.id === a.targetId)?.label || a.targetId || "—"}</td><td className="p-2">{a.status} · {a.occurrences} observations</td>
          <td className="p-2">{count(a.value)} / {count(a.threshold)}</td><td className="p-2">First: {time(a.firstSeenAt)}<br />Latest observation: {time(a.lastSeenAt)}<br />Resolved: {time(a.resolvedAt)}</td><td className="p-2">{a.requestId ? <button className="underline break-all" onClick={() => setRequestId(a.requestId!)}>{a.requestId}</button> : "N/A"}</td></tr>)}</Table>
        {!data.alerts.length && <p>No recorded alerts.</p>}
      </section>
      <section className={panel}><h3 className="font-semibold">Request ID correlation</h3>
        <form onSubmit={correlate} className="flex flex-wrap gap-2"><label className="flex-1">Exact payment Request ID<input key={requestId} name="requestId" className={input + " w-full"} defaultValue={requestId} placeholder="UUID from payment timeline" maxLength={36} /></label><button className={button}>Find context</button><button type="button" className={button} onClick={() => setRequestId("")}>Clear</button></form>
        {data.correlation && <><p className="text-sm">{data.correlation.available ? `Explicit host ${data.correlation.agentId}, request ${time(data.correlation.requestStartedAt)} – ${time(data.correlation.requestCompletedAt)}; context ±${data.correlation.windowSeconds}s.` : "Host correlation N/A: no completed request with explicit host binding and timing. Legacy/unbound data is retained."} Nearby OS/probe measurements show temporal context, not proof of a payment-specific network cause.</p>
          <ApiTable rows={data.correlation.events} onRequest={setRequestId} onPayment={onPayment} />
          <HostTable rows={data.correlation.hostSamples} /><ProbeTable rows={data.correlation.probeSamples} />
          {!data.correlation.events.length && <p>Request ID not found.</p>}
        </>}
      </section>
      <section className={panel}><h3 className="font-semibold">Historical measurements</h3>
        <p className="text-xs">Charts/statistics use up to the latest {data.sampleLimit} observations per scope in this range; probe statistics use the current target version only. API totals/average/max use the full range. Full retained history is paginated below. No automatic deletion runs.</p>
        <label>Source<select className={input + " ml-2"} value={source} onChange={(e) => { setSource(e.target.value as typeof source); setPage(1); }}><option value="host">Host</option><option value="probe">Probe</option><option value="api">Payment API (all hosts)</option></select></label>
        {source === "host" ? <HostTable rows={data.hostHistory} /> : source === "probe" ? <ProbeTable rows={data.probeHistory} /> : <ApiTable rows={data.apiHistory} onRequest={setRequestId} onPayment={onPayment} />}
        <div className="flex gap-3 items-center"><button className={button} disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {data.page} · {data.totals[source]} records</span><button className={button} disabled={data.page >= 10000 || data.page * data.pageSize >= data.totals[source]} onClick={() => setPage((p) => p + 1)}>Next</button></div>
      </section>
    </>}
  </section>;
}
