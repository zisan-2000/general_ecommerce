"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { MonitorConfiguration, Target } from "@/lib/network-monitor/types";
const endpoint = "/api/admin/payment-control/network/config";
const input = "w-full rounded border bg-background p-2 text-sm";
const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
async function request(body?: unknown): Promise<MonitorConfiguration> {
  const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15000), ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Configuration unavailable");
  return value;
}
function TargetEditor({ agentId, target, busy, save }: { agentId: string; target?: Target; busy: boolean; save: (body: unknown) => Promise<void> }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void save({ action: "TARGET", agentId, targetId: target?.id, version: target?.version, label: data.get("label"), address: data.get("address"),
      protocol: data.get("protocol"), port: Number(data.get("port")), intervalSeconds: Number(data.get("intervalSeconds")),
      timeoutMs: Number(data.get("timeoutMs")), enabled: data.get("enabled") === "on" });
  }
  return <form onSubmit={submit} className="rounded border p-3 space-y-3">
    <p className="font-medium">{target ? "Edit approved target" : "Add target (disabled by default)"}</p>
    <div className="grid gap-3 md:grid-cols-3">
      <label>Non-sensitive label<input className={input} name="label" required minLength={3} maxLength={100} defaultValue={target?.label || "Local development"} /></label>
      <label>IP literal<input className={input} name="address" required defaultValue={target?.address || "127.0.0.1"} /></label>
      <label>Protocol<select className={input} name="protocol" defaultValue={target?.protocol || "TCP"}><option>TCP</option><option>ICMP</option></select></label>
      <label>TCP port<input className={input} name="port" type="number" min={1} max={65535} defaultValue={target?.port ?? 3000} /></label>
      <label>Interval (seconds)<input className={input} name="intervalSeconds" required type="number" min={60} max={3600} defaultValue={target?.intervalSeconds ?? 60} /></label>
      <label>Timeout (ms)<input className={input} name="timeoutMs" required type="number" min={100} max={5000} defaultValue={target?.timeoutMs ?? 3000} /></label>
    </div>
    <label className="flex gap-2"><input type="checkbox" name="enabled" defaultChecked={target?.enabled ?? false} /> Enable this approved target</label>
    <button className={button} disabled={busy}>Save target</button>
  </form>;
}
export default function NetworkMonitorSettings({ onSaved }: { onSaved: () => void }) {
  const [config, setConfig] = useState<MonitorConfiguration | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request().then((value) => { if (active) setConfig(value); }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : "Configuration unavailable"); });
    return () => { active = false; };
  }, []);
  async function save(body: unknown) {
    setBusy(true); setError("");
    try { await request(body); setConfig(await request()); onSaved(); }
    catch (error) { setError(error instanceof Error ? error.message : "Configuration update failed"); }
    finally { setBusy(false); }
  }
  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void save({ action: "AGENT", agentId: data.get("agentId"), label: data.get("label"), enabled: false });
  }
  return <section className="space-y-4 text-sm" aria-label="Collector configuration">
    <p>Server approval policy is independent of dashboard settings. Current permission: localhost TCP 3000, at least 60 seconds. EPS/SSLCommerz probes require separate permission. Credentials are configured outside this dashboard.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!config && !error && <p role="status">Loading collector configuration…</p>}
    {config && <>
      <p>Server allowlist: {config.allowedProbes.map((p) => `${p.protocol} ${p.address}${p.port === null ? "" : ":" + p.port} (≥${p.minIntervalSeconds}s)`).join("; ") || "No probes approved"}</p>
      <form onSubmit={register} className="flex flex-wrap gap-3 items-end">
        <label>New collector ID<input className={input} name="agentId" required pattern="[A-Za-z0-9_-]{1,64}" placeholder="windows-local" /></label>
        <label>Non-sensitive label<input className={input} name="label" required minLength={3} maxLength={100} placeholder="Development PC" /></label>
        <button className={button} disabled={busy}>Register disabled collector</button>
      </form>
      {config.agents.map((agent) => <article key={agent.id} className="rounded border p-4 space-y-3">
        <p className="font-semibold">{agent.label} · {agent.id} · {agent.enabled ? "Enabled" : "Disabled"}</p>
        <button className={button} disabled={busy} onClick={() => void save({ action: "AGENT", agentId: agent.id, label: agent.label, enabled: !agent.enabled })}>{agent.enabled ? "Disable collector" : "Enable collector"}</button>
        <p>Last observed: {agent.lastObservedAt ? new Date(agent.lastObservedAt).toISOString() : "N/A"}. A cached approval lease expires within 180 seconds when the app is unreachable; reachable disabled collectors stop probing on their next config refresh.</p>
        {agent.targets.map((target) => <TargetEditor key={target.id + ":" + target.version} agentId={agent.id} target={target} busy={busy} save={save} />)}
        {agent.targets.length < 4 && <TargetEditor agentId={agent.id} busy={busy} save={save} />}
      </article>)}
    </>}
  </section>;
}
