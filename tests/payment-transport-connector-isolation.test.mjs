import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { AsyncLocalStorage } from "node:async_hooks";
import * as observed from "../lib/payment-control/transport-observer.ts";
import { loadTransportSource } from "./helpers/payment-transport-uat.mjs";

function fixture({ construction = false, ip = false, context, networkError, networkThrow,
  callbackThrow, measuredFactory = false, lookupContext = false, attach = false } = {}) {
  const counts = { measured: 0, unobserved: 0, callback: 0, lookup: 0 };
  const original = Object.assign(new Error("SYNTHETIC_NETWORK_FAILURE"), { code: "ECONNREFUSED" });
  const telemetryError = new Error("SYNTHETIC_TELEMETRY_FAILURE");
  const socket = new EventEmitter(); const connectorOptions = [];
  const lookup = (_hostname, options, callback) => { counts.lookup++; callback(null, "127.0.0.1", options.family); };
  class Context extends AsyncLocalStorage {
    run(store, work) {
      if (context === "before") throw telemetryError;
      if (context === "after") { try { super.run(store, work); } finally { throw telemetryError; } }
      return super.run(store, work);
    }
    getStore() { if (lookupContext) throw telemetryError; return super.getStore(); }
  }
  const api = loadTransportSource("lib/payment-control/transport-connector.ts", {
    "node:dns": { lookup }, "node:async_hooks": { AsyncLocalStorage: Context }, undici: {},
    "./transport-observer": { ...observed,
      ObservedConnection: construction ? class { constructor() { throw telemetryError; } } : observed.ObservedConnection,
      observeIpLiteral: ip ? () => { throw telemetryError; } : observed.observeIpLiteral,
    },
  });
  const observer = new observed.TransportObserver();
  if (attach) observer.attachSocket = () => { throw telemetryError; };
  let factories = 0; let delivered;
  const connect = api.createObservedConnector(observer, (config) => {
    const measured = factories++ === 1;
    connectorOptions.push(config);
    if (measured && measuredFactory) throw telemetryError;
    return (options, callback) => {
      counts[measured ? "measured" : "unobserved"]++;
      assert.equal(options, input, "original connector arguments retained by identity");
      if (networkThrow) throw original;
      callback(networkError ? original : null, networkError ? null : socket);
      return socket;
    };
  }, lookup);
  const input = { hostname: "iwtest.aibl.com.bd", protocol: "https:", port: "443",
    servername: "iwtest.aibl.com.bd", localAddress: "127.0.0.1", signal: { synthetic: true } };
  return { counts, original, input, connectorOptions, lookup,
    call() { return connect(input, (...args) => {
      counts.callback++; delivered = args; if (callbackThrow) throw original;
    }); }, get delivered() { return delivered; } };
}
for (const [name, options] of [
  ["constructor", { construction: true }], ["IP-literal observation", { ip: true }],
  ["context before invocation", { context: "before" }], ["measured connector initialization", { measuredFactory: true }],
]) test(`${name} failure selects exactly one unobserved connector before dispatch`, () => {
  const f = fixture(options); assert.doesNotThrow(() => f.call());
  assert.equal(f.counts.unobserved, 1); assert.equal(f.counts.measured, 0); assert.equal(f.counts.callback, 1);
  assert.equal(f.delivered[0], null);
  assert.equal(f.connectorOptions[0].lookup, f.lookup);
  for (const config of f.connectorOptions) {
    assert.equal(config.allowH2, false); assert.equal("rejectUnauthorized" in config, false);
    assert.equal("timeout" in config, false, "standard connection deadline is preserved");
  }
});
test("actual connection failure through fallback stays failed and is never retried", () => {
  const f = fixture({ construction: true, networkError: true }); f.call();
  assert.equal(f.counts.unobserved, 1); assert.equal(f.counts.callback, 1);
  assert.equal(f.delivered[0], f.original); assert.equal(f.delivered[1], null);
});
for (const context of [undefined, "after"]) test(`real synchronous connector error survives ${context ?? "normal"} context without fallback`, () => {
  const f = fixture({ context, networkThrow: true });
  assert.throws(() => f.call(), (error) => error === f.original);
  assert.equal(f.counts.measured, 1); assert.equal(f.counts.unobserved, 0); assert.equal(f.counts.callback, 0);
});
test("context failure after socket return does not dispatch or complete twice", () => {
  const f = fixture({ context: "after" }); assert.doesNotThrow(() => f.call());
  assert.equal(f.counts.measured, 1); assert.equal(f.counts.unobserved, 0); assert.equal(f.counts.callback, 1);
});
test("actual asynchronous-style callback failure remains the original failure with no retry", () => {
  const f = fixture({ context: "after", networkError: true }); f.call();
  assert.equal(f.delivered[0], f.original); assert.equal(f.counts.measured, 1);
  assert.equal(f.counts.unobserved, 0); assert.equal(f.counts.callback, 1);
});
test("callback exception is not swallowed or retried", () => {
  const f = fixture({ callbackThrow: true });
  assert.throws(() => f.call(), (error) => error === f.original);
  assert.equal(f.counts.measured, 1); assert.equal(f.counts.unobserved, 0); assert.equal(f.counts.callback, 1);
});
test("post-dispatch observer failure leaves the existing successful connection intact", () => {
  const f = fixture({ attach: true }); assert.doesNotThrow(() => f.call());
  assert.equal(f.counts.measured, 1); assert.equal(f.counts.unobserved, 0); assert.equal(f.counts.callback, 1);
});
test("lookup context failure still forwards the original DNS request and callback once", () => {
  const f = fixture({ lookupContext: true }); let completed = 0; const options = { family: 4, all: false };
  f.connectorOptions[1].lookup("localhost", options, (error, address, family) => {
    assert.equal(error, null); assert.equal(address, "127.0.0.1"); assert.equal(family, 4); completed++;
  });
  assert.equal(completed, 1); assert.equal(f.counts.lookup, 1);
});
