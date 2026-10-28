import { channel } from "node:diagnostics_channel";

type Listener = (message: unknown) => void;
export type DiagnosticChannel = { subscribe: (listener: Listener) => void; unsubscribe: (listener: Listener) => unknown };
export type DiagnosticSubscriptions = {
  status: "IDLE" | "REGISTERING" | "SUBSCRIBED" | "ROLLBACK_PENDING";
  listeners: Array<{ target: DiagnosticChannel; listener: Listener }>;
  observerErrors: number;
  subscriptionErrors: number;
};
export function createDiagnosticSubscriptions(): DiagnosticSubscriptions {
  return { status: "IDLE", listeners: [], observerErrors: 0, subscriptionErrors: 0 };
}
const events = [
  ["undici:request:create", "create"], ["undici:request:headers", "headers"],
  ["undici:request:error", "error"], ["undici:client:connected", "connected"],
  ["undici:client:sendHeaders", "sendHeaders"],
] as const;
function rollback(state: DiagnosticSubscriptions) {
  state.listeners = state.listeners.filter(({ target, listener }) => {
    try { target.unsubscribe(listener); return false; } catch { return true; }
  });
  state.status = state.listeners.length ? "ROLLBACK_PENDING" : "IDLE";
}

export function ensureDiagnosticSubscriptions(state: DiagnosticSubscriptions,
  observer: { handle: (event: string, message: unknown) => void },
  getChannel: (name: string) => DiagnosticChannel = channel) {
  if (state.status === "SUBSCRIBED") return true;
  // Registration is synchronous; reentrant/concurrent calls cannot add duplicates.
  if (state.status === "REGISTERING") return false;
  if (state.status === "ROLLBACK_PENDING") {
    rollback(state);
    if (state.listeners.length) return false;
  }
  state.status = "REGISTERING";
  try {
    for (const [name, event] of events) {
      const target = getChannel(name);
      const listener: Listener = (message) => {
        // Diagnostics subscriber exceptions otherwise reach uncaughtException.
        // Do not inspect/log messages, headers or request bodies here.
        try { observer.handle(event, message); }
        catch {
          try { state.observerErrors = Math.min(Number.MAX_SAFE_INTEGER, state.observerErrors + 1); }
          catch { /* Even a damaged/frozen counter must not escape the subscriber. */ }
        }
      };
      // Include the current registration in rollback even if subscribe adds the
      // listener and then throws. Never remove another subscriber's listener.
      state.listeners.push({ target, listener });
      target.subscribe(listener);
    }
    state.status = "SUBSCRIBED";
    return true;
  } catch {
    state.subscriptionErrors = Math.min(Number.MAX_SAFE_INTEGER, state.subscriptionErrors + 1);
    rollback(state);
    return false;
  }
}
