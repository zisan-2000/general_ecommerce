"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  InspectorEvidenceState,
  TechnicalInspectorResponse,
} from "@/lib/payment-control/inspector-types";
import { requestInspectorHref } from "@/lib/payment-control/inspector-types";

const panel = "rounded-lg border bg-card p-4 space-y-4";
const button = "rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

function utc(value: string | null) {
  return value
    ? `${new Date(value).toLocaleString(undefined, { timeZone: "UTC" })} UTC`
    : "N/A";
}

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function Evidence({ value }: { value: InspectorEvidenceState }) {
  return (
    <span className="inline-flex rounded bg-muted px-2 py-1 text-xs font-semibold">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Facts({ values }: { values: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {values.map(([label, value]) => (
        <div className="rounded border p-3" key={label}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold">{display(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function JsonNode({ label, value, depth = 0 }: {
  label?: string;
  value: unknown;
  depth?: number;
}) {
  if (value === null || typeof value !== "object") {
    return (
      <div className="break-all font-mono text-xs">
        {label !== undefined && <span className="text-primary">{label}: </span>}
        <span>{JSON.stringify(value)}</span>
      </div>
    );
  }
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  return (
    <details open={depth < 2} className={depth ? "ml-4" : ""}>
      <summary className="cursor-pointer break-all font-mono text-xs font-semibold">
        {label ?? "root"} {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
      </summary>
      <div className="space-y-1 border-l pl-2">
        {entries.map(([key, item]) => (
          <JsonNode key={key} label={key} value={item} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

async function readInspector(requestId: string, pageNumber: number) {
  const response = await fetch(
    `/api/admin/payment-control/requests/${encodeURIComponent(requestId)}?page=${pageNumber}`,
    { cache: "no-store" },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string" ? body.error : "Technical inspector request failed",
    );
  }
  return body as TechnicalInspectorResponse;
}

export default function TechnicalInspector({ requestId }: { requestId: string }) {
  const [data, setData] = useState<TechnicalInspectorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/admin/payment-control/requests/${encodeURIComponent(requestId)}?page=1`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Technical inspector request failed",
          );
        }
        return body as TechnicalInspectorResponse;
      })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Technical inspector request failed");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestId]);

  const json = useMemo(() => (data ? JSON.stringify(data, null, 2) : ""), [data]);

  async function loadMore() {
    if (!data?.pagination.hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const next = await readInspector(requestId, data.pagination.page + 1);
      const timeline = Array.from(
        new Map([...data.timeline, ...next.timeline].map((event) => [event.id, event])).values(),
      );
      setData({ ...next, timeline });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load more events");
    } finally {
      setLoadingMore(false);
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setNotice("Sanitized JSON copied.");
    } catch {
      setNotice("Clipboard access is unavailable in this browser context.");
    }
  }

  function downloadJson() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payment-request-${requestId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (loading) {
    return <main className="p-6" aria-busy="true"><p role="status">Loading technical request details…</p></main>;
  }
  if (error && !data) {
    return <main className="space-y-4 p-6"><h1 className="text-xl font-semibold">Payment &amp; Network Technical Inspector</h1>
      <p role="alert" className="text-destructive">{error}</p><Link className="text-primary underline" href="/admin/payment-control">Back to Payment Control Center</Link></main>;
  }
  if (!data) return null;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Link className="text-sm text-primary underline" href="/admin/payment-control">← Payment Control Center</Link>
        <h1 className="text-2xl font-bold">Payment &amp; Network Technical Inspector</h1>
        <p className="break-all font-mono text-sm">Request ID: {data.requestId}</p>
        <p className="text-xs text-muted-foreground">Read-only sanitized evidence · Generated {utc(data.generatedAt)}</p>
      </header>

      {error && <p role="alert" className="rounded border border-destructive p-3 text-destructive">{error}</p>}
      <section className={panel}><h2 className="text-lg font-semibold">Request overview</h2>
        <Facts values={[["Provider", data.overview.provider], ["Primary request type", data.overview.primaryRequestType],
          ["Type evidence", data.overview.requestTypeEvidence], ["Request outcome", data.overview.requestOutcome],
          ["Outcome evidence", data.overview.requestOutcomeEvidence],
          ["Request timing evidence", data.overview.requestTiming.evidence],
          ["Recorded request duration", data.overview.requestTiming.durationMs === null ? null : `${data.overview.requestTiming.durationMs} ms`],
          ["Recorded request start", utc(data.overview.requestTiming.startTime)], ["Recorded request end", utc(data.overview.requestTiming.endTime)],
          ["Timing source operation", data.overview.requestTiming.sourceOperation],
          ["Observed-window evidence", data.overview.observedRequestWindow.evidence],
          ["Observed event window", data.overview.observedRequestWindow.windowMs === null ? null : `${data.overview.observedRequestWindow.windowMs} ms`],
          ["First observed event", utc(data.overview.observedRequestWindow.startTime)], ["Last observed event", utc(data.overview.observedRequestWindow.endTime)],
          ["Operations", data.overview.operations.join(", ")], ["Recorded events", data.pagination.totalEvents]]} />
        <p className="text-xs text-muted-foreground">Recorded request timing is shown only when the primary operation has explicit start, completion and duration fields. The observed event window is derived from event timestamps and is not a processing duration.</p>
      </section>

      <section className={panel}><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Initiator and routing</h2><Evidence value={data.initiator.source} /></div>
        <Facts values={[["Initiator type", data.initiator.type], ["Actor", data.initiator.actor?.name ?? data.initiator.actor?.id],
          ["Actor role", data.initiator.actor?.role], ["Identity evidence", data.initiator.identityEvidence],
          ["Authentication evidence", data.initiator.authenticationEvidence], ["Authorization evidence", data.initiator.authorizationEvidence],
          ["Source service", data.initiator.sourceService],
          ["Destination service", data.initiator.destinationService], ["Triggering operation", data.initiator.triggeringOperation],
          ["Authentication context", data.initiator.authenticationContext], ["Evidence source", data.initiator.evidenceSource],
          ["Job name", data.initiator.jobName], ["Correlation ID", data.initiator.correlationId], ["Trace ID", data.initiator.traceId]]} />
        {data.initiator.type === "PAYMENT_GATEWAY_CALLBACK" && <Facts values={[
          ["Callback request received", data.initiator.callbackEvidence.requestReceived],
          ["Callback sender authentication", data.initiator.callbackEvidence.senderAuthentication],
          ["Callback state/correlation validation", data.initiator.callbackEvidence.stateOrCorrelationValidation],
          ["Callback payload validation", data.initiator.callbackEvidence.payloadValidation],
          ["Authoritative payment verification", data.initiator.callbackEvidence.authoritativePaymentVerification],
        ]} />}
        <p className="text-xs text-muted-foreground">Evidence describes only the named claim. A gateway payment verification does not authenticate who sent its callback request; historical actor records without request-time evidence remain unverified.</p>
      </section>

      <section className={panel}><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Payment gateway information</h2><Evidence value={data.payment.evidence} /></div>
        <Facts values={[["Gateway", data.payment.provider], ["Payment ID", data.payment.paymentId], ["Order ID", data.payment.orderId],
          ["Amount", data.payment.amount && data.payment.currency ? `${data.payment.amount} ${data.payment.currency}` : null],
          ["Payment status", data.payment.paymentStatus], ["Order payment status", data.payment.orderPaymentStatus],
          ["Order status", data.payment.orderStatus], ["Masked transaction reference", data.payment.transactionReference],
          ["Payment final outcome", data.payment.finalOutcome.status], ["Outcome evidence", data.payment.finalOutcome.evidence],
          ["Verification", data.payment.verificationStatus], ["Settlement", data.payment.settlementStatus],
          ["Lifecycle-window evidence", data.payment.observedLifecycleWindow.evidence],
          ["Observed lifecycle window", data.payment.observedLifecycleWindow.windowMs === null ? null : `${data.payment.observedLifecycleWindow.windowMs} ms`],
          ["Lifecycle first event", utc(data.payment.observedLifecycleWindow.startTime)],
          ["Lifecycle last event", utc(data.payment.observedLifecycleWindow.endTime)]]} />
        <p className="text-xs text-muted-foreground">The payment lifecycle window is derived from linked event timestamps; it is not a gateway or application processing duration.</p>
      </section>

      <section className={panel}><h2 className="text-lg font-semibold">Related payment lifecycle</h2>
        <p className="text-xs text-muted-foreground">Recorded events linked by Payment ID, or by the stored provider/reference when available. This does not merge unrelated requests by time alone.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Related payment lifecycle events</caption><thead><tr>
          {["Timestamp (UTC)", "Request", "Operation", "Outcome", "HTTP", "Diagnostic"].map((heading) => <th className="border-b p-2" scope="col" key={heading}>{heading}</th>)}
        </tr></thead><tbody>{data.payment.lifecycle.map((event) => <tr className="border-b" key={event.id}>
          <td className="p-2">{utc(event.timestamp)}</td><td className="p-2">{event.requestId
            ? <Link className="break-all text-primary underline" href={requestInspectorHref(event.requestId)} target="_blank" rel="noopener noreferrer">{event.requestId.slice(0, 8)}</Link>
            : "N/A"}</td><td className="p-2">{event.stage}</td><td className="p-2">{event.outcome}</td>
          <td className="p-2">{display(event.httpStatus)}</td><td className="p-2">{event.detailCode ?? event.gatewayStatus ?? "N/A"}</td></tr>)}</tbody></table></div>
        {!data.payment.lifecycle.length && <p className="text-muted-foreground">No linked payment lifecycle was recorded.</p>}
        {data.payment.lifecycleLimited && <p className="text-xs text-muted-foreground">Showing the first 100 linked lifecycle events.</p>}
      </section>

      <section className={panel}><h2 className="text-lg font-semibold">Request lifecycle timeline</h2>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Request lifecycle events</caption><thead><tr>
          {['Timestamp (UTC)', 'Stage', 'Outcome', 'HTTP', 'Duration', 'Diagnostic'].map((heading) => <th className="border-b p-2" scope="col" key={heading}>{heading}</th>)}
        </tr></thead><tbody>{data.timeline.map((event) => <tr className="border-b" key={event.id}>
          <td className="p-2">{utc(event.timestamp)}</td><td className="p-2">{event.stage}</td><td className="p-2">{event.outcome}</td>
          <td className="p-2">{display(event.httpStatus)}</td><td className="p-2">{event.durationMs === null ? "N/A" : `${event.durationMs} ms`}</td>
          <td className="p-2">{event.detailCode ?? event.gatewayStatus ?? "N/A"}</td></tr>)}</tbody></table></div>
        {!data.timeline.length && <p className="text-muted-foreground">No recorded timeline events.</p>}
        {data.pagination.hasMore && <button className={button} disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Load more events"}</button>}
        {data.pagination.limited && !data.pagination.hasMore && <p className="text-xs text-muted-foreground">Timeline browsing is limited to the first 1,000 recorded events.</p>}
      </section>

      <section className={panel}><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">HTTP and connection diagnostics</h2><Evidence value={data.http.evidence} /></div>
        <Facts values={[["Latest HTTP outcome", data.http.latestOutcome], ["HTTP status", data.http.statusCode],
          ["HTTP operation duration", data.http.durationMs === null ? null : `${data.http.durationMs} ms`],
          ["Latest result timed out", data.http.timedOut], ["Latest connection error", data.http.connectionError],
          ["Recorded HTTP results", data.http.attempts.length], ["HTTP failures", data.http.failureCount]]} />
        <p className="text-xs text-muted-foreground">HTTP duration belongs only to the latest recorded HTTP operation and is not the callback or payment lifecycle duration.</p>
        {data.http.attemptsLimited && <p className="text-xs text-muted-foreground">HTTP result counts are limited to the bounded 1,000-event request summary.</p>}
      </section>

      <section className={panel}><h2 className="text-lg font-semibold">Handshake information</h2>
        <Facts values={[["DNS status", data.handshakes.dns.status], ["DNS evidence", data.handshakes.dns.evidence],
          ["DNS destination", data.handshakes.dns.destinationReference], ["DNS duration", data.handshakes.dns.durationMs === null ? null : `${data.handshakes.dns.durationMs} ms`],
          ["DNS cache/reuse", data.handshakes.dns.cacheOrReuse], ["DNS collection", `${data.handshakes.dns.collectionSource} · ${data.handshakes.dns.collectionMethod}`],
          ["TCP status", data.handshakes.tcp.status], ["TCP evidence", data.handshakes.tcp.evidence],
          ["TCP destination", data.handshakes.tcp.destinationReference], ["TCP duration", data.handshakes.tcp.durationMs === null ? null : `${data.handshakes.tcp.durationMs} ms`],
          ["TCP reused connection", data.handshakes.tcp.connectionReused], ["TCP collection", `${data.handshakes.tcp.collectionSource} · ${data.handshakes.tcp.collectionMethod}`],
          ["TLS status", data.handshakes.tls.status], ["TLS evidence", data.handshakes.tls.evidence],
          ["TLS destination", data.handshakes.tls.destinationReference], ["TLS duration", data.handshakes.tls.durationMs === null ? null : `${data.handshakes.tls.durationMs} ms`],
          ["TLS version", data.handshakes.tls.tlsVersion], ["Cipher suite", data.handshakes.tls.cipherSuite],
          ["Certificate validation", data.handshakes.tls.certificateValidation],
          ["TLS collection", `${data.handshakes.tls.collectionSource} · ${data.handshakes.tls.collectionMethod}`],
          ["Authentication exchange", `${data.handshakes.authenticationExchange.status}${data.handshakes.authenticationExchange.outcome ? ` · ${data.handshakes.authenticationExchange.outcome}` : ""}`]]} />
        <p className="text-xs text-muted-foreground">This summary shows one HTTP attempt only. Multiple attempts are listed separately below. N/A means unavailable; HTTP success does not prove measured handshake timing.</p>
      </section>

      <section className={panel}><h2 className="text-lg font-semibold">Network handshake evidence by HTTP attempt</h2>
        <Facts values={[["Evidence storage", data.transportEvidence?.storage ?? "NOT_COLLECTED"],
          ["Current monitoring mode", data.transportEvidence?.currentConfiguration.mode],
          ["Current configuration status", data.transportEvidence?.currentConfiguration.reason],
          ["Approved providers", data.transportEvidence?.currentConfiguration.allowedProviders?.join(", ") || "None"],
          ["Approved operations", data.transportEvidence?.currentConfiguration.allowedOperations?.join(", ") || "None"],
          ["Current Node runtime", data.transportEvidence?.currentConfiguration.nodeVersion],
          ["Recorded transport attempts", data.transportEvidence?.attempts.length ?? 0],
          ["Inbound request", data.transportEvidence?.inbound.requestKind],
          ["Inbound TLS termination (operator configuration)", data.transportEvidence?.inbound.tlsTermination],
          ["TLS termination evidence", data.transportEvidence?.inbound.tlsTerminationEvidence],
          ["Trusted reverse proxy connection", data.transportEvidence?.inbound.trustedReverseProxyConnection],
          ["Application-side inbound handshake", data.transportEvidence?.inbound.applicationHandshakeVisibility],
          ["Authenticated proxy measurements", data.transportEvidence?.inbound.trustedProxyMeasurements]]} />
        <Facts values={[["Capture completeness", data.transportEvidence?.collectionHealth?.completeness ?? "NOT_GUARANTEED"],
          ["Queue counter scope", data.transportEvidence?.collectionHealth?.scope ?? "UNAVAILABLE"],
          ["Queued evidence", data.transportEvidence?.collectionHealth?.queueDepth],
          ["Dropped evidence", data.transportEvidence?.collectionHealth?.dropped],
          ["Rejected evidence", data.transportEvidence?.collectionHealth?.rejected],
          ["Storage write errors", data.transportEvidence?.collectionHealth?.writeErrors],
          ["Background drain errors", data.transportEvidence?.collectionHealth?.drainErrors]]} />
        <p className="text-xs text-muted-foreground">Counters describe this process only and reset on restart. Zero drops do not prove complete capture across processes or before restart. Expiry, ring eviction and unavailable instrumentation can also remove evidence.</p>
        {data.transportEvidence?.attempts.map((attempt) => <article key={attempt.attemptId} className="space-y-3 rounded border p-3">
          <h3 className="font-semibold">{attempt.provider} · {attempt.operation}</h3>
          <Facts values={[["Request ID", attempt.requestId], ["HTTP attempt ID", attempt.attemptId],
            ["Connection ID", attempt.connectionId], ["Destination origin", attempt.destinationOrigin],
            ["Connection", attempt.connectionReused === true ? "REUSED" : attempt.connectionReused === false ? "NEW" : "UNKNOWN"],
            ["Collection method", attempt.collectionMethod], ["Attribution evidence", attempt.attribution],
            ["Request timing source", attempt.requestTimingSource],
            ["Request start", utc(attempt.startedAt)], ["Request completion (headers/error)", utc(attempt.completedAt)],
            ["HTTP attempt outcome", attempt.requestOutcome], ["Connection/request error", attempt.errorCode],
            ["TLS version", attempt.connectionEvidence?.tls.tlsVersion], ["Cipher suite", attempt.connectionEvidence?.tls.cipherSuite],
            ["ALPN protocol", attempt.connectionEvidence?.tls.alpnProtocol],
            ["Certificate validated", attempt.connectionEvidence?.tls.certificateValidated],
            ["TLS session resumed (connection handshake)", attempt.connectionEvidence?.tls.sessionResumed]]} />
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Current HTTP attempt handshake evidence</caption>
            <thead><tr>{["Stage", "Evidence", "Measured duration", "Start (UTC)", "End (UTC)", "Error"].map((heading) => <th key={heading} scope="col" className="border-b p-2">{heading}</th>)}</tr></thead>
            <tbody>{(["dns", "tcp", "tls"] as const).map((stage) => <tr key={stage} className="border-b">
              <th scope="row" className="p-2">{stage.toUpperCase()}</th><td className="p-2">{attempt[stage].status}</td>
              <td className="p-2">{attempt[stage].durationMs === null ? "N/A" : `${attempt[stage].durationMs} ms`}</td>
              <td className="p-2">{utc(attempt[stage].startTime)}</td><td className="p-2">{utc(attempt[stage].endTime)}</td>
              <td className="p-2">{display(attempt[stage].errorCode)}</td>
            </tr>)}</tbody></table></div>
          {attempt.connectionEvidence && <details><summary className="cursor-pointer text-sm font-medium">Connection evidence snapshot (previous handshake for reused connections)</summary>
            <div className="mt-2"><JsonNode value={attempt.connectionEvidence} /></div></details>}
        </article>)}
        {!data.transportEvidence?.attempts.length && <p className="text-sm text-muted-foreground">No retained transport evidence. Monitoring may be disabled, unavailable, or outside retention. No timing is inferred.</p>}
        {data.transportEvidence?.limited && <p className="text-sm text-muted-foreground">Transport history is limited to the first 100 retained attempts.</p>}
        <p className="text-xs text-muted-foreground">OBSERVED means measured events; REUSED means no new lookup/handshake. DNS is OS name resolution, not wire DNS latency. TLS timing is the TCP connect → secureConnect event interval. TCP/TLS connection reuse and TLS session resumption are separate facts. Host/probe context does not establish payment transport timings.</p>
      </section>

      <section className={panel}><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Authentication events</h2><Evidence value={data.authentication.evidence} /></div>
        {data.authentication.events.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Sanitized authentication events</caption><thead><tr>
          {["Timestamp (UTC)", "Outcome", "HTTP", "Duration", "Diagnostic"].map((heading) => <th className="border-b p-2" scope="col" key={heading}>{heading}</th>)}
        </tr></thead><tbody>{data.authentication.events.map((event) => <tr className="border-b" key={event.eventId}>
          <td className="p-2">{utc(event.timestamp)}</td><td className="p-2">{event.outcome}</td><td className="p-2">{display(event.httpStatus)}</td>
          <td className="p-2">{event.durationMs === null ? "N/A" : `${event.durationMs} ms`}</td><td className="p-2">{event.detailCode ?? "N/A"}</td>
        </tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No authentication API event is recorded for this Request ID.</p>}
        <p className="text-xs text-muted-foreground">Only sanitized event status and timing are shown. Authentication bodies, tokens and headers are excluded.</p>
      </section>

      <section className={panel}><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Network measurements</h2><Evidence value={data.network.evidence} /></div>
        <Facts values={[["Collector", data.network.hostAgentLabel ?? data.network.hostAgentId], ["Context window", data.network.contextWindowSeconds === null ? null : `±${data.network.contextWindowSeconds}s`],
          ["Collector identity evidence", data.network.collectorIdentityEvidence],
          ["Collector authentication evidence", data.network.collectorAuthenticationEvidence],
          ["Collector evidence source", data.network.collectorEvidenceSource],
          ["Host samples", data.network.hostSamples.length], ["Probe samples", data.network.probeSamples.length], ["Correlated alerts", data.network.alerts.length],
          ["Attribution", data.network.attribution]]} />
        <p className="text-xs text-muted-foreground">Nearby host/probe measurements are temporal context only and are not proof of a payment-specific failure.</p>
        <details><summary className="cursor-pointer font-medium">Recorded network context</summary><div className="mt-3"><JsonNode value={{ hostSamples: data.network.hostSamples, probeSamples: data.network.probeSamples, alerts: data.network.alerts }} /></div></details>
      </section>

      <section className={panel}><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Error and diagnostic classification</h2><Evidence value={data.error.evidence} /></div>
        <Facts values={[["Classification", data.error.classification], ["Summary", data.error.summary],
          ["Confirmed payment failure", data.error.confirmedPaymentFailure], ["Request/HTTP failures", data.error.requestFailureCount],
          ["Recovered/historical failures", data.error.recoveredFailureCount], ["Non-fatal diagnostics", data.error.diagnostics.nonFatalCount],
          ["Informational diagnostics", data.error.diagnostics.informationalCount], ["Unknown/unclassified diagnostics", data.error.diagnostics.unclassifiedCount]]} />
        {data.error.primaryFailure && <div><h3 className="font-medium">Primary confirmed/request failure</h3>
          <Facts values={[["Operation", data.error.primaryFailure.stage], ["Outcome", data.error.primaryFailure.outcome],
            ["Code", data.error.primaryFailure.detailCode], ["HTTP status", data.error.primaryFailure.httpStatus],
            ["Timestamp", utc(data.error.primaryFailure.timestamp)]]} /></div>}
        {data.error.diagnostics.nonFatalCodes.length > 0 && <details><summary className="cursor-pointer font-medium">Non-fatal diagnostic codes ({data.error.diagnostics.nonFatalCount})</summary>
          <ul className="mt-2 list-disc pl-5 text-sm">{data.error.diagnostics.nonFatalCodes.map((code) => <li key={code}>{code}</li>)}</ul></details>}
        {data.error.requestFailures.length > 0 && <details><summary className="cursor-pointer font-medium">Recorded request/HTTP failure history ({data.error.requestFailureCount})</summary>
          <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Recorded request and HTTP failures</caption><thead><tr>
            {["Timestamp (UTC)", "Operation", "Outcome", "HTTP", "Code"].map((heading) => <th className="border-b p-2" scope="col" key={heading}>{heading}</th>)}
          </tr></thead><tbody>{data.error.requestFailures.map((failure) => <tr className="border-b" key={failure.id}>
            <td className="p-2">{utc(failure.timestamp)}</td><td className="p-2">{failure.stage}</td><td className="p-2">{failure.outcome}</td>
            <td className="p-2">{display(failure.httpStatus)}</td><td className="p-2">{failure.detailCode ?? failure.gatewayStatus ?? "N/A"}</td>
          </tr>)}</tbody></table></div></details>}
        {data.error.requestFailuresLimited && <p className="text-xs text-muted-foreground">Failure history displays at most 20 entries and its count may be bounded by the 1,000-event request summary.</p>}
        {data.error.diagnostics.limited && <p className="text-xs text-muted-foreground">Diagnostic classification is limited to the bounded 1,000-event request summary.</p>}
      </section>

      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Structured JSON</h2>
        <div className="flex gap-2"><button className={button} onClick={copyJson}>Copy JSON</button><button className={button} onClick={downloadJson}>Download JSON</button></div></div>
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <div className="max-h-[42rem] overflow-auto rounded bg-muted/40 p-3"><JsonNode value={data} /></div>
      </section>

      <section className={panel}><h2 className="text-lg font-semibold">Evidence limitations</h2><ul className="list-disc space-y-1 pl-5 text-sm">
        {data.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section>
    </main>
  );
}
