/* eslint-disable @typescript-eslint/no-require-imports -- synchronous test-only Node bootstrap */
const net = require("node:net");
const dns = require("node:dns");
const http = require("node:http");
const loopback = (host) => ["localhost", "127.0.0.1", "::1"].includes(host);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof options === "object" ? options.host ?? options.hostname : args[1];
  if (!loopback(host)) throw new Error("LOCAL_UAT_EXTERNAL_NETWORK_BLOCKED");
  return Reflect.apply(connect, this, args);
};
const lookup = dns.lookup;
dns.lookup = function (hostname, ...args) {
  if (!loopback(hostname)) throw new Error("LOCAL_UAT_EXTERNAL_DNS_BLOCKED");
  return Reflect.apply(lookup, this, [hostname, ...args]);
};
const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, ...args) {
  if (event === "request") {
    const [req, res] = args;
    const path = new URL(req.url, "http://127.0.0.1").pathname;
    if (!["GET", "HEAD"].includes(req.method) || /^\/api\/(?:cron|aibl-wallet|eps|sslcommerz)(?:\/|$)/.test(path) || path === "/api/auth/signout") {
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end('{"error":"LOCAL_UAT_MUTATION_OR_GATEWAY_ROUTE_BLOCKED"}'); return true;
    }
  }
  return Reflect.apply(emit, this, [event, ...args]);
};
