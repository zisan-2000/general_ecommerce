"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatRequestError, createChatMessageId, fetchChatJson } from "@/lib/chat-client";
import { logChatAvailability } from "@/lib/chat-availability-diagnostics";
import {
  CHAT_AGENT_HEARTBEAT_MS,
  CHAT_AGENT_IDLE_MS,
  type AgentPresenceResponse,
  type AgentPresenceTrigger,
  isAgentPresenceResponse,
} from "@/lib/chat-availability";

const PRESENCE_URL = "/api/admin/chats/presence";
type ActivityClock = { wall: number; monotonic: number };
const activityClock = (): ActivityClock => ({ wall: Date.now(), monotonic: performance.now() });
// Include wall time so a sleeping/frozen browser cannot extend the idle limit
// on platforms where performance.now() does not advance during system sleep.
const elapsed = (clock: ActivityClock) => Math.max(0, Date.now() - clock.wall, performance.now() - clock.monotonic);
type Workspace = {
  id: string; revision: number; enabled: boolean;
  lease: { clock: ActivityClock; duration: number; activity: ActivityClock | null } | null;
  away: { revision: number; inFlight: boolean; confirmed: boolean } | null;
};
const leaseRemaining = (workspace: Workspace) => workspace.lease
  ? Math.max(0, workspace.lease.duration - elapsed(workspace.lease.clock)) : 0;

function presenceFailureMessage(failure: ChatRequestError): string {
  if (failure.code === "CHAT_PRESENCE_SCHEMA_UNAVAILABLE") {
    return "Support presence storage is not ready. Ask an administrator to check the chat-agent-presence migration.";
  }
  if (failure.status === 401) return "Your session could not be verified. Sign in again before choosing Available.";
  if (failure.status === 403) return "Chat-management permission is required to accept support chats.";
  return "Support status could not be confirmed. Check your connection and support service, then try again.";
}

// Status belongs to this support workspace, not to merely having an admin login.
export default function AgentAvailabilityControl({ userId }: { userId: string | null }) {
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("Choose Available when you are ready to answer customer chats.");
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const lastActivityRef = useRef<ActivityClock | null>(null);
  const heartbeatBusyRef = useRef(false);
  const resumeHeartbeatRef = useRef<() => void>(() => {});
  const lastHeartbeatAttemptRef = useRef<ActivityClock | null>(null);
  const controlBusyRef = useRef(false);
  const epochRef = useRef(0);

  const leaveWorkspace = useCallback((trigger: AgentPresenceTrigger, reason: string) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const epoch = epochRef.current;
    // pagehide, effect cleanup and offline can describe the same departure.
    // One terminal revision per workspace; a failed write can retry that same
    // tombstone, but never generate increasingly newer Away mutations.
    if (workspace.away?.inFlight || workspace.away?.confirmed) {
      logChatAvailability("away-request-suppressed", {
        workspaceId: workspace.id, trigger, revision: workspace.away.revision, action: "away",
        reason: workspace.away.inFlight ? "already-in-flight" : "already-confirmed",
      });
      return;
    }
    workspace.enabled = false;
    workspace.lease = null;
    setAvailable(false);
    setNotice(reason);
    const away = workspace.away ?? { revision: ++workspace.revision, inFlight: false, confirmed: false };
    workspace.away = away;
    away.inFlight = true;
    const revision = away.revision;
    logChatAvailability("agent-away", { workspaceId: workspace.id, trigger, action: "away", reason, revision, available: false });
    // Best effort only: server lease expiry covers offline/closed/crashed tabs.
    return fetchChatJson<AgentPresenceResponse>(PRESENCE_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ id: workspace.id, revision, action: "away", trigger }),
    }, isAgentPresenceResponse).then((result) => {
      // A higher server revision also confirms this old departure cannot revive
      // the workspace. Do not mutate the current (possibly newer) workspace UI.
      away.confirmed = !result.available && result.revision >= revision;
      logChatAvailability(away.confirmed ? "away-write-confirmed" : "away-write-unconfirmed", {
        workspaceId: workspace.id, trigger, action: "away",
        revision, serverRevision: result.revision, available: result.available, presenceReason: result.reason,
      });
      if (!away.confirmed && trigger === "manual-away" && epoch === epochRef.current && workspace === workspaceRef.current) {
        setError("The server could not confirm Away. Please try again.");
      }
    }).catch((error: unknown) => {
      const failure = error instanceof ChatRequestError ? error : new ChatRequestError("unexpected");
      logChatAvailability("away-write-unconfirmed", {
        workspaceId: workspace.id, trigger, action: "away", revision, httpStatus: failure.status, errorKind: failure.kind,
      });
      if (trigger === "manual-away" && epoch === epochRef.current && workspace === workspaceRef.current) {
        setError(presenceFailureMessage(failure));
      }
    }).finally(() => { away.inFlight = false; });
  }, []);

  const sendPresence = useCallback(async (action: "available" | "heartbeat", trigger: AgentPresenceTrigger) => {
    const workspace = workspaceRef.current;
    if (!userId || !workspace || workspace.away) return;
    const epoch = epochRef.current;
    const revision = ++workspace.revision;
    const startedAt = activityClock();
    const requestActivity = lastActivityRef.current;
    const idleSeconds = Math.min(CHAT_AGENT_IDLE_MS / 1000,
      requestActivity ? Math.floor(elapsed(requestActivity) / 1000) : CHAT_AGENT_IDLE_MS / 1000);
    logChatAvailability("presence-request", { workspaceId: workspace.id, trigger, action, revision, idleSeconds, visibility: document.visibilityState });
    try {
      const result = await fetchChatJson<AgentPresenceResponse>(PRESENCE_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspace.id, revision, action, idleSeconds, trigger }),
      }, isAgentPresenceResponse);
      if (epoch !== epochRef.current || workspace !== workspaceRef.current || revision !== workspace.revision) {
        logChatAvailability("presence-response-ignored", { workspaceId: workspace.id, trigger, action, revision, reason: "superseded-request" });
        return;
      }
      logChatAvailability("presence-confirmed", {
        workspaceId: workspace.id, trigger,
        action, revision, serverRevision: result.revision, available: result.available,
        availableForMs: result.availableForMs, presenceReason: result.reason,
      });
      if (!navigator.onLine) {
        void leaveWorkspace("request-offline", "Network disconnected. Reconnect and choose Available again.");
        return;
      }
      if (!lastActivityRef.current || elapsed(lastActivityRef.current) >= CHAT_AGENT_IDLE_MS) {
        void leaveWorkspace("request-idle", "You were set to Away after 5 minutes without support-page activity.");
        return;
      }
      if (result.revision !== revision || !result.available) {
        workspace.enabled = false;
        workspace.lease = null;
        setAvailable(false);
        setError(null);
        setNotice(result.reason === "REVOKED" ? "This workspace was revoked by logout. Choose Available again after signing in."
          : result.reason === "IDLE_EXPIRED" ? "Your 5-minute inactivity limit ended. Choose Available again when ready."
          : "The server ended this workspace's availability. Choose Available again when ready.");
        return;
      }
      const remaining = Math.max(0, result.availableForMs - elapsed(startedAt));
      if (remaining === 0) {
        void leaveWorkspace("request-lease-expired", "The verified presence lease expired before it could be confirmed. Choose Available again.");
        return;
      }
      workspace.enabled = true;
      workspace.lease = { clock: activityClock(), duration: remaining, activity: requestActivity };
      setAvailable(true);
      setError(null);
      setNotice("You are accepting chats. Tab switches do not end availability; the 5-minute activity limit still applies.");
    } catch (error: unknown) {
      if (epoch !== epochRef.current || workspace !== workspaceRef.current || revision !== workspace.revision) return;
      const failure = error instanceof ChatRequestError ? error : new ChatRequestError("unexpected");
      logChatAvailability("presence-request-failed", {
        workspaceId: workspace.id, trigger,
        action, revision, httpStatus: failure.status, errorKind: failure.kind,
        reason: failure.code, availableForMs: leaseRemaining(workspace),
      });
      const retryable = ["network", "timeout", "server", "rate-limit", "unexpected"].includes(failure.kind);
      if (action === "heartbeat" && retryable && navigator.onLine && workspace.enabled && leaseRemaining(workspace) > 0) {
        // A failed refresh is not an explicit Away. Keep the opt-in, display
        // unknown status and retry, bounded by the last server-confirmed lease.
        setNotice("Heartbeat could not be confirmed. Retrying while the last verified lease remains valid.");
      } else {
        void leaveWorkspace(!navigator.onLine ? "network-offline" : "request-failed",
          !navigator.onLine ? "Network disconnected. Choose Available again after reconnecting."
          : action === "heartbeat" ? "The verified lease or chat access ended. Choose Available again when ready."
          : "This availability change could not be confirmed. Please try again.");
      }
      setError(presenceFailureMessage(failure));
    }
  }, [leaveWorkspace, userId]);

  const changeAvailability = async (next: boolean) => {
    if (!userId || controlBusyRef.current) return;
    if (next && document.visibilityState !== "visible") return;
    if (next && !navigator.onLine) {
      setError("You are offline. Reconnect before choosing Available.");
      return;
    }
    controlBusyRef.current = true;
    const epoch = epochRef.current;
    setSaving(true);
    setError(null);
    try {
      if (next) {
        // A new explicit opt-in has a new ID; terminal logout leases cannot revive.
        if (workspaceRef.current) void leaveWorkspace("switch-workspace", "Switching support availability…");
        workspaceRef.current = { id: createChatMessageId(), revision: 0, enabled: false, lease: null, away: null };
        lastActivityRef.current = activityClock();
        lastHeartbeatAttemptRef.current = activityClock();
        await sendPresence("available", "manual-available");
      } else {
        await leaveWorkspace("manual-away", "You chose Away. You are not accepting chats in this workspace.");
      }
    } catch {
      if (epoch === epochRef.current) setError("Support status could not be updated. Please try again.");
    } finally {
      if (epoch === epochRef.current) {
        controlBusyRef.current = false;
        setSaving(false);
      }
    }
  };

  useEffect(() => {
    epochRef.current += 1;
    workspaceRef.current = null;
    lastActivityRef.current = null;
    heartbeatBusyRef.current = false;
    lastHeartbeatAttemptRef.current = null;
    controlBusyRef.current = false;
    setAvailable(false);
    setSaving(false);
    setError(null);
    setNotice("Choose Available when you are ready to answer customer chats.");
    if (!userId) return;
    const activity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      const workspace = workspaceRef.current;
      if (workspace?.enabled && lastActivityRef.current && elapsed(lastActivityRef.current) >= CHAT_AGENT_IDLE_MS) {
        // A throttled timer must not let new input resurrect an already idle
        // workspace. Explicit Available is required after the five-minute limit.
        setError(null);
        void leaveWorkspace("idle-input", "Your 5-minute inactivity limit ended. Choose Available again when ready.");
      }
      lastActivityRef.current = activityClock();
      if (workspace?.enabled && leaseRemaining(workspace) <= CHAT_AGENT_HEARTBEAT_MS) resumeHeartbeatRef.current();
    };
    const visibility = () => {
      logChatAvailability("agent-visibility", {
        workspaceId: workspaceRef.current?.id,
        visibility: document.visibilityState,
        reason: "visibility-is-not-activity-or-away",
      });
      // Focus/visibility never reset activity. The periodic idle/lease checks
      // below and the server's expiry rules remain authoritative while hidden.
      if (document.visibilityState === "visible") resumeHeartbeatRef.current();
    };
    // Listen to actual input, not scroll/focus events generated by UI code.
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "touchmove"] as const;
    for (const event of events) window.addEventListener(event, activity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    const pageHide = () => { void leaveWorkspace("pagehide", "This support workspace was closed."); };
    window.addEventListener("pagehide", pageHide);
    const offline = () => {
      if (!workspaceRef.current) return;
      void leaveWorkspace("network-offline", "You were set to Away because the network connection was lost.");
      setError("You are offline. Reconnect and choose Available again when ready.");
    };
    const online = () => {
      if (!workspaceRef.current || workspaceRef.current.enabled) return;
      // Retry the best-effort Away write. Reconnecting must not automatically
      // resurrect the old lease or opt an agent back into accepting chats.
      void leaveWorkspace("network-restored", "Connection restored. Choose Available again when ready.");
      setError(null);
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    const interval = setInterval(() => {
      const workspace = workspaceRef.current;
      if (!workspace?.enabled) return;
      if (!navigator.onLine) {
        offline();
        return;
      }
      if (!lastActivityRef.current || elapsed(lastActivityRef.current) >= CHAT_AGENT_IDLE_MS) {
        setError(null);
        void leaveWorkspace("idle-timer", "You were set to Away after 5 minutes without support-page activity.");
        return;
      }
      if (leaseRemaining(workspace) <= 0) {
        if (heartbeatBusyRef.current) {
          // The in-flight, timeout-bounded renewal may already have committed.
          // Show unknown while awaiting its ack; do not cancel it with Away.
          // This does not extend the server lease or claim Available past expiry.
          setError("Waiting for the in-flight heartbeat to confirm support availability.");
          return;
        }
        void leaveWorkspace("lease-expired", "The verified heartbeat lease expired. Choose Available again when ready.");
        setError("Support presence could not be confirmed before the lease expired.");
        return;
      }
      // Real activity after a near-idle heartbeat needs an early renewal, not a
      // wait until the next 25-second tick. No activity means no idle extension.
      if (leaseRemaining(workspace) <= CHAT_AGENT_HEARTBEAT_MS
        && workspace.lease?.activity !== lastActivityRef.current) resumeHeartbeatRef.current();
    }, 5000);
    return () => {
      void leaveWorkspace("workspace-cleanup", "You left the support workspace.");
      epochRef.current += 1;
      clearInterval(interval);
      for (const event of events) window.removeEventListener(event, activity, { capture: true });
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [leaveWorkspace, userId]);

  useEffect(() => {
    if (!available || !userId) return;
    const epoch = epochRef.current;
    // Start the cadence after the explicit Available request succeeds, rather
    // than deriving it from a five-second interval started on page mount.
    const heartbeat = (trigger: AgentPresenceTrigger) => {
      if (!workspaceRef.current?.enabled || heartbeatBusyRef.current) return;
      if (!navigator.onLine || !lastActivityRef.current || elapsed(lastActivityRef.current) >= CHAT_AGENT_IDLE_MS
        || leaseRemaining(workspaceRef.current) <= 0) {
        void leaveWorkspace(!navigator.onLine ? "network-offline" : "heartbeat-expired",
          !navigator.onLine ? "Network disconnected. Reconnect and choose Available again."
          : "The idle or heartbeat lease expired. Choose Available again when ready.");
        return;
      }
      // A visibility/focus catch-up may renew early, but repeated focus events
      // must not flood the endpoint. It is not a new activity/Available action.
      if (lastHeartbeatAttemptRef.current && elapsed(lastHeartbeatAttemptRef.current) < 5_000) return;
      heartbeatBusyRef.current = true;
      lastHeartbeatAttemptRef.current = activityClock();
      void sendPresence("heartbeat", trigger).finally(() => {
        if (epoch === epochRef.current) heartbeatBusyRef.current = false;
      });
    };
    const resumeHeartbeat = () => heartbeat("heartbeat-resume");
    resumeHeartbeatRef.current = resumeHeartbeat;
    const interval = setInterval(() => heartbeat("heartbeat-timer"), CHAT_AGENT_HEARTBEAT_MS);
    return () => {
      clearInterval(interval);
      if (resumeHeartbeatRef.current === resumeHeartbeat) resumeHeartbeatRef.current = () => {};
    };
  }, [available, leaveWorkspace, sendPresence, userId]);

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">Your support availability</p>
        <p role="status" aria-live="polite" className="text-sm">
          {saving ? "Updating availability…" : error ? "Status unavailable" : available ? "Available for chats" : "Away — not accepting chats"}
        </p>
        <p className="text-xs text-muted-foreground">{notice}</p>
        <p className="text-xs text-muted-foreground">5-minute limit since your last real interaction with this support page. Heartbeats, focus and tab switches do not reset it.</p>
        <p className="text-xs text-muted-foreground">Switching tabs does not immediately set you Away. Closing/leaving this page, logout or a lost presence lease ends this workspace.</p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2" aria-label="Support availability controls" aria-busy={saving}>
        <Button type="button" aria-pressed={available && !error} disabled={!userId || saving || (available && !error)} onClick={() => void changeAvailability(true)}>
          {saving && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />} Available
        </Button>
        <Button type="button" variant="outline" aria-pressed={!available} disabled={!userId || saving} onClick={() => void changeAvailability(false)}>
          Away
        </Button>
      </div>
    </Card>
  );
}
