// Child-process-only build boundary. Never imported by the application.
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require needs a synchronous CommonJS bootstrap. */
const net = require("node:net");
const dns = require("node:dns");
const childProcess = require("node:child_process");
const guard = __filename.replaceAll("\\", "/");
const loopback = (host) => ["localhost", "127.0.0.1", "::1"].includes(host);
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof options === "object" ? options.host ?? options.hostname : args[1];
  const port = typeof options === "object" ? options.port : options;
  if (!loopback(host) || Number(port) === 5432) throw new Error("UAT_BUILD_NETWORK_BLOCKED");
  return Reflect.apply(originalConnect, this, args);
};
const originalLookup = dns.lookup;
dns.lookup = function (hostname, ...args) {
  if (!loopback(hostname)) throw new Error("UAT_BUILD_DNS_BLOCKED");
  return Reflect.apply(originalLookup, this, [hostname, ...args]);
};
// cross-env's build script replaces NODE_OPTIONS. Reattach the guard at every
// Node child spawn so the actual Next build and its workers retain the boundary.
const originalSpawn = childProcess.spawn;
childProcess.spawn = function (command, args, options = {}) {
  const env = { ...(options.env ?? process.env) };
  if (!(env.NODE_OPTIONS ?? "").includes(guard)) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require="${guard}"`.trim();
  return Reflect.apply(originalSpawn, this, [command, args, { ...options, env }]);
};
