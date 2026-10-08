"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createChatMessageId, fetchChatJson } from "@/lib/chat-client";
import {
  CHAT_AGENT_HEARTBEAT_MS,
  CHAT_AGENT_IDLE_MS,
  type AgentPresenceAction,
  type AgentPresenceResponse,
  isAgentPresenceResponse,
} from "@/lib/chat-availability";

const PRESENCE_URL = "/api/admin/chats/presence";
type Workspace = { id: string; revision: number; enabled: boolean };

// Status belongs to this support workspace, not to merely having an admin login.
export default function AgentAvailabilityControl({ userId }: { userId: string | null }) {
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("Choose Available when you are ready to answer customer chats.");
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const lastActivityRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const heartbeatBusyRef = useRef(false);
  const controlBusyRef = useRef(false);
  const epochRef = useRef(0);

  const leaveWorkspace = useCallback((reason: string) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.enabled = false;
    setAvailable(false);
    setNotice(reason);
    const revision = ++workspace.revision;
    // Best effort only: server lease expiry covers offline/closed/crashed tabs.
    void fetchChatJson<AgentPresenceResponse>(PRESENCE_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ id: workspace.id, revision, action: "away" }),
    }, isAgentPresenceResponse).catch(() => {});
  }, []);

  const sendPresence = useCallback(async (action: AgentPresenceAction) => {
    const workspace = workspaceRef.current;
    if (!userId || !workspace) return;
    const epoch = epochRef.current;
    const revision = ++workspace.revision;
    const idleSeconds = Math.min(300, Math.max(0, Math.floor((performance.now() - lastActivityRef.current) / 1000)));
    try {
      const result = await fetchChatJson<AgentPresenceResponse>(PRESENCE_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: workspace.id, revision, action, idleSeconds }),
      }, isAgentPresenceResponse);
      if (epoch !== epochRef.current || workspace !== workspaceRef.current || revision !== workspace.revision) return;
      if (result.revision !== revision || document.visibilityState !== "visible") {
        leaveWorkspace("You are Away. Choose Available again when ready.");
        return;
      }
      workspace.enabled = result.available;
      setAvailable(result.available);
      setError(null);
      setNotice(result.available
        ? "You are accepting chats while this support page stays visible and active."
        : "Your availability ended. Choose Available again when ready.");
    } catch {
      if (epoch !== epochRef.current || workspace !== workspaceRef.current || revision !== workspace.revision) return;
      leaveWorkspace("Availability could not be confirmed. Choose Available again after reconnecting.");
      setError("Support status could not be updated. Check your connection and chat-management permission, then try again.");
    }
  }, [leaveWorkspace, userId]);

  const changeAvailability = async (next: boolean) => {
    if (!userId || controlBusyRef.current) return;
    if (next && document.visibilityState !== "visible") return;
    controlBusyRef.current = true;
    const epoch = epochRef.current;
    setSaving(true);
    setError(null);
    try {
      if (next) {
        // A new explicit opt-in has a new ID; terminal logout leases cannot revive.
        if (workspaceRef.current) leaveWorkspace("Switching support availability…");
        workspaceRef.current = { id: createChatMessageId(), revision: 0, enabled: false };
        lastActivityRef.current = performance.now();
        lastHeartbeatRef.current = performance.now();
        await sendPresence("available");
      } else {
        if (workspaceRef.current) workspaceRef.current.enabled = false;
        setAvailable(false);
        await sendPresence("away");
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
    heartbeatBusyRef.current = false;
    controlBusyRef.current = false;
    setAvailable(false);
    setSaving(false);
    setError(null);
    setNotice("Choose Available when you are ready to answer customer chats.");
    if (!userId) return;
    const epoch = epochRef.current;
    const activity = (event: Event) => {
      if (event.isTrusted && document.visibilityState === "visible") lastActivityRef.current = performance.now();
    };
    const hide = () => {
      if (document.visibilityState !== "visible") leaveWorkspace("You were set to Away because this support page was hidden.");
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll"] as const;
    for (const event of events) window.addEventListener(event, activity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", hide);
    const pageHide = () => leaveWorkspace("This support workspace was closed.");
    window.addEventListener("pagehide", pageHide);
    const interval = setInterval(() => {
      const workspace = workspaceRef.current;
      if (!workspace?.enabled) return;
      if (document.visibilityState !== "visible" || performance.now() - lastActivityRef.current >= CHAT_AGENT_IDLE_MS) {
        leaveWorkspace("You were set to Away after inactivity. Choose Available again when ready.");
        return;
      }
      if (heartbeatBusyRef.current || performance.now() - lastHeartbeatRef.current < CHAT_AGENT_HEARTBEAT_MS) return;
      heartbeatBusyRef.current = true;
      lastHeartbeatRef.current = performance.now();
      void sendPresence("heartbeat").finally(() => {
        if (epoch === epochRef.current) heartbeatBusyRef.current = false;
      });
    }, 5000);
    return () => {
      leaveWorkspace("You left the support workspace.");
      epochRef.current += 1;
      clearInterval(interval);
      for (const event of events) window.removeEventListener(event, activity, { capture: true });
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", pageHide);
    };
  }, [leaveWorkspace, sendPresence, userId]);

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">Your support availability</p>
        <p role="status" aria-live="polite" className="text-sm">
          {saving ? "Updating availability…" : error ? "Status unavailable" : available ? "Available for chats" : "Away — not accepting chats"}
        </p>
        <p className="text-xs text-muted-foreground">{notice}</p>
        <p className="text-xs text-muted-foreground">5-minute idle limit. Leaving or hiding this page sets this workspace to Away.</p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2" aria-label="Support availability controls" aria-busy={saving}>
        <Button type="button" aria-pressed={available} disabled={!userId || saving || available} onClick={() => void changeAvailability(true)}>
          {saving && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />} Available
        </Button>
        <Button type="button" variant="outline" aria-pressed={!available} disabled={!userId || saving} onClick={() => void changeAvailability(false)}>
          Away
        </Button>
      </div>
    </Card>
  );
}
