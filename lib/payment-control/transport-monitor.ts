import "server-only";
import type { Agent } from "undici";
import { TransportObserver, approvedTransportOrigin, type TransportScope } from "./transport-observer";
import type { TransportOperation, TransportProvider } from "./transport-types";
import { enqueueTransportEvidence } from "./transport-storage";
import { transportConfiguration, transportScopeAllowed } from "./transport-config";
import { createDiagnosticSubscriptions, ensureDiagnosticSubscriptions, type DiagnosticSubscriptions } from "./transport-diagnostics";

type RuntimeState = { observer: TransportObserver; subscribed: boolean; subscriptions?: DiagnosticSubscriptions; agent: Promise<Agent> | null };
const globals = globalThis as typeof globalThis & { __paymentTransportV1?: RuntimeState };
function state() {
  return globals.__paymentTransportV1 ??= { observer: new TransportObserver(), subscribed: false, agent: null };
}

function subscribe(runtime: RuntimeState) {
  // An older hot-reloaded implementation did not retain listener references.
  // Refuse new capture until restart rather than install duplicate listeners.
  if (runtime.subscribed && !runtime.subscriptions) return false;
  // beforeConnect/connectError do not establish request ownership; trailers are
  // not a handshake boundary. Only the explicitly registered channels are used.
  runtime.subscriptions ??= createDiagnosticSubscriptions();
  runtime.subscribed = ensureDiagnosticSubscriptions(runtime.subscriptions, runtime.observer);
  return runtime.subscribed;
}

export type PaymentTransportCapture = {
  scope: TransportScope;
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  finish: (error?: unknown) => void;
};
export async function beginPaymentTransport(provider: TransportProvider, operation: TransportOperation, requestId: string, input: string | URL): Promise<PaymentTransportCapture | null> {
  try {
    const config = transportConfiguration();
    if (config.mode === "off" || !transportScopeAllowed(config, provider, operation)) return null;
    const origin = approvedTransportOrigin(provider, input);
    if (!origin) return null;
    const runtime = state();
    if (!subscribe(runtime)) return null;
    const scope = runtime.observer.begin(provider, operation, requestId, origin, config.mode);
    if (!scope) return null;
    let finished = false;
    return {
      scope,
      run: <T>(fn: () => Promise<T>): Promise<T> => {
        let invoked = false;
        let result: Promise<T> | undefined;
        try {
          return runtime.observer.scopes.run(scope, () => { invoked = true; result = fn(); return result; });
        } catch (error) {
          // If the HTTP operation has already started, return its original
          // promise/error. Only a context failure BEFORE invocation can bypass
          // the unavailable context and dispatch the original operation once.
          if (result) return result;
          if (invoked) throw error;
          return fn();
        }
      },
      finish: (error) => {
        if (finished) return;
        finished = true;
        try { enqueueTransportEvidence(runtime.observer.complete(scope, error)); }
        catch {
          try { runtime.observer.discard(scope); } catch { /* never fail a payment */ }
        }
      },
    };
  } catch { return null; }
}

export async function paymentTransportDispatcher(capture: PaymentTransportCapture | null) {
  let runtime: RuntimeState | undefined;
  try {
    if (!capture || capture.scope.mode !== "instrumented") return undefined;
    const config = transportConfiguration();
    if (config.mode !== "instrumented" || !transportScopeAllowed(config, capture.scope.provider, capture.scope.operation)) return undefined;
    const target = runtime = state();
    target.agent ??= import("./transport-connector").then(({ createInstrumentedAgent }) => createInstrumentedAgent(target.observer));
    return await target.agent;
  } catch {
    // No dispatch has occurred yet. An unavailable monitoring dependency must
    // leave the original transport available, without issuing any retry.
    try { if (runtime) runtime.agent = null; } catch { /* best effort */ }
    try { if (capture) capture.scope.mode = "passive"; } catch { /* best effort */ }
    return undefined;
  }
}
