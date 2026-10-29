import { lookup } from "node:dns";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Socket } from "node:net";
import type { TLSSocket } from "node:tls";
import { Agent, buildConnector } from "undici";
import { gatewayOrigins, ObservedConnection, observeIpLiteral, transportErrorCode, type TransportObserver } from "./transport-observer";

type Lookup = NonNullable<import("node:net").TcpNetConnectOpts["lookup"]>;
type ReturningConnector = (options: buildConnector.Options, callback: buildConnector.Callback) => Socket | TLSSocket;

function tlsMetadata(socket: TLSSocket) {
  const cipher = socket.getCipher()?.standardName ?? socket.getCipher()?.name ?? null;
  const version = socket.getProtocol();
  const expiry = Date.parse(socket.getPeerCertificate?.()?.valid_to ?? "");
  return {
    tlsVersion: version === "TLSv1.2" || version === "TLSv1.3" ? version : null,
    cipherSuite: cipher && /^(TLS_|ECDHE-|DHE-|AES|CHACHA20)[A-Z0-9_-]{1,72}$/.test(cipher) ? cipher : null,
    alpnProtocol: socket.alpnProtocol === "http/1.1" || socket.alpnProtocol === "h2" ? socket.alpnProtocol : null,
    certificateValidated: socket.authorized === true,
    sessionResumed: socket.isSessionReused(),
    certificateExpiresAt: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
  } as const;
}

// Called only behind the opt-in + approval gate. No global dispatcher mutation.
// Keep a single standard connector/session cache for all calls on this Agent.
export function createObservedConnector(observer: TransportObserver, makeConnector: typeof buildConnector = buildConnector,
  resolve: Lookup = lookup) {
  const connections = new AsyncLocalStorage<ObservedConnection>();
  const measuredLookup: Lookup = (hostname, options, callback) => {
    let connection: ObservedConnection | undefined;
    try { connection = connections.getStore(); connection?.beginDns(); } catch { /* observability only */ }
    // Forward the original options (including all/family/order) and callback args.
    resolve(hostname, options, (error, address, family) => {
      try {
        const families = Array.isArray(address) ? [...new Set(address.map((entry) => entry.family))] : [];
        connection?.endDns(error, family ?? (families.length === 1 ? families[0] : null));
      } catch { /* observability only */ }
      callback(error, address, family);
    });
  };
  // Undici 6.29.1's reviewed connector implementation returns the created socket.
  // Its type declaration says void. This version is pinned and must be reviewed
  // before upgrade; it lets us observe events before connect/secureConnect occur.
  // Independent unobserved connector: fallback never inherits a stale telemetry
  // ALS context or measured lookup. Both retain identical standard TLS defaults.
  const unobserved = makeConnector({ lookup: resolve, allowH2: false }) as unknown as ReturningConnector;
  let standard: ReturningConnector | undefined;
  try { standard = makeConnector({ lookup: measuredLookup, allowH2: false }) as unknown as ReturningConnector; }
  catch { /* monitoring initialization failed before any network dispatch */ }
  const connect: buildConnector.connector = (options, callback) => {
    const hostname = options.hostname.includes(":") ? `[${options.hostname}]` : options.hostname;
    const origin = new URL(`${options.protocol}//${hostname}:${options.port || "443"}`).origin;
    const allowed = Object.values(gatewayOrigins).some((origins) => origins.includes(origin));
    if (!allowed || options.httpSocket) {
      // No proxy tunnels/upgraded sockets or unapproved destinations in this mode.
      callback(Object.assign(new Error("Unsupported monitored transport"), { code: "UNSUPPORTED_TRANSPORT" }), null);
      return;
    }
    if (!standard) return unobserved(options, callback);
    const measured = standard;
    let connection: ObservedConnection;
    try { connection = new ObservedConnection(origin, true); observeIpLiteral(connection, options.hostname); }
    catch { return unobserved(options, callback); }
    let invoked = false;
    let socket: Socket | TLSSocket | undefined;
    let dispatchFailure: { error: unknown } | undefined;
    const completed: buildConnector.Callback = (...args) => {
      const [error, connectedSocket] = args;
      try {
        if (error) { connection.failed(error); observer.attachError(error, connection); }
        else if (connectedSocket && "getProtocol" in connectedSocket) connection.secure(tlsMetadata(connectedSocket));
      } catch { /* telemetry failure cannot change connector completion */ }
      callback(...args);
    };
    try {
      connections.run(connection, () => {
        invoked = true;
        try { socket = measured(options, completed); }
        catch (error) { dispatchFailure = { error }; throw error; }
      });
    } catch (error) {
      // Only monitoring failure BEFORE invocation can select the fallback.
      // After invocation, never dispatch again, including synchronous network or
      // callback errors. A context failure after return keeps the original socket.
      if (!invoked) return unobserved(options, callback);
      if (dispatchFailure) throw dispatchFailure.error;
      if (!socket) throw error;
    }
    if (!socket) return;
    const observedSocket = socket;
    try {
      observer.attachSocket(observedSocket, connection);
      // Node 22+/24: the address is kept only transiently to match the winning
      // address attempt. No IP address is serialized or persisted.
      observedSocket.on("connectionAttempt", (address: string, _port: number, family: number) => {
        try { connection.beginTcp(address, family); } catch { /* best effort */ }
      });
      observedSocket.on("connectionAttemptFailed", (address: string, _port: number, _family: number, error: Error) => {
        try { connection.endTcp(address, error); } catch { /* best effort */ }
      });
      observedSocket.on("connectionAttemptTimeout", (address: string) => {
        try { connection.endTcp(address, { code: "ETIMEDOUT" }); } catch { /* best effort */ }
      });
      observedSocket.once("connect", () => {
        try { connection.connected(observedSocket.remoteAddress, options.protocol === "https:"); } catch { /* best effort */ }
      });
      observedSocket.once("error", (error) => {
        try {
          // Never persist error.message/stack, certificate objects or socket data.
          connection.failed(error);
          if (!connection.established && (transportErrorCode(error).includes("CERT") || transportErrorCode(error).includes("SIGNATURE"))) {
            connection.evidence.tls.certificateValidated = false;
          }
          observer.attachError(error, connection);
        } catch { /* best effort */ }
      });
    } catch { /* connector still owns/returns the socket; no payment fallback */ }
  };
  return connect;
}

export function createInstrumentedAgent(observer: TransportObserver) {
  return new Agent({ connect: createObservedConnector(observer), allowH2: false });
}
