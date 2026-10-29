// Explicitly opted-in integration test. Captures only our controlled loopback
// HTTPS fixture. No dotenv, gateway hostname, bank credential or database.
import assert from "node:assert/strict";
import test from "node:test";
import { createServer, get } from "node:https";
import { Socket } from "node:net";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { executeCapture, runCaptureProcess } from "../scripts/lib/payment-capture-runner.ts";
import { sanitizePcapng } from "../lib/payment-control/pcapng.ts";
const optedIn = process.env.PAYMENT_CAPTURE_LOCAL_UAT === "true";
test("real Dumpcap/TShark captures bounded controlled loopback TLS traffic and strips application payloads", {
  skip: !optedIn ? "LOCAL_CAPTURE_NOT_AUTHORIZED: explicit opt-in and loopback interface required" : false, timeout: 30000,
}, async t => {
  const config = { dumpcap: process.env.PAYMENT_CAPTURE_DUMPCAP || "", tshark: process.env.PAYMENT_CAPTURE_TSHARK || "",
    interfaceId: process.env.PAYMENT_CAPTURE_TEST_INTERFACE || "" };
  const listed = await runCaptureProcess(config.dumpcap, ["-D"], { timeoutMs: 5000 });
  assert.ok(listed.output.split(/\r?\n/).some(line => line.startsWith(config.interfaceId + ". ") && /loopback/i.test(line)),
    "Only an explicitly selected loopback interface is authorized for this test");
  const cert = readFileSync(new URL("./fixtures/payment-transport/localhost-cert.pem", import.meta.url));
  const key = readFileSync(new URL("./fixtures/payment-transport/localhost-key.pem", import.meta.url));
  let received = 0, blocked = 0;
  const server = createServer({ cert, key }, (_request, response) => { received++; response.end("CONTROLLED_LOCAL_PAYMENT_FIXTURE_ONLY"); });
  try { await new Promise((accept, reject) => { server.once("error", reject); server.listen(443, "127.0.0.1", accept); }); }
  catch (error) { if (error.code === "EADDRINUSE") { t.skip("CONTROLLED_PORT_UNAVAILABLE: existing listener was not changed"); return; } throw error; }
  const connect = Socket.prototype.connect;
  Socket.prototype.connect = function (...args) {
    const opts = Array.isArray(args[0]) ? args[0][0] : args[0];
    const host = typeof opts === "object" ? opts.host ?? opts.hostname : args[1];
    if (!["127.0.0.1", "localhost", "::1"].includes(host)) { blocked++; throw new Error("LOCAL_CAPTURE_EXTERNAL_NETWORK_BLOCKED"); }
    return Reflect.apply(connect, this, args);
  };
  const root = await mkdtemp(join(tmpdir(), "payment-local-capture-"));
  const tick = setInterval(() => {
    get({ hostname: "127.0.0.1", port: 443, servername: "localhost", ca: cert, rejectUnauthorized: true, agent: false, timeout: 500 },
      response => response.resume()).on("error", () => {});
  }, 80);
  try {
    const result = await executeCapture({ id: "22222222-2222-4222-8222-222222222222", kind: "CAPTURE", seconds: 2,
      maxBytes: 262144, approvedIps: ["127.0.0.1"] }, { ...config, root });
    assert.ok(received > 0); assert.ok(result.packetCount > 0); assert.equal(blocked, 0);
    assert.ok(result.data.length <= 262144); assert.ok(!result.data.includes(Buffer.from("CONTROLLED_LOCAL_PAYMENT_FIXTURE_ONLY")));
    assert.equal(sanitizePcapng(result.data, ["127.0.0.1"]).sha256, result.sha256);
    assert.deepEqual(await readdir(root), []);
    t.diagnostic(`Controlled packets: ${result.packetCount}; derived bytes: ${result.data.length}; SHA-256: ${result.sha256}; TShark retransmission observations: ${result.retransmissions}`);
  } finally {
    clearInterval(tick); Socket.prototype.connect = connect;
    await new Promise(accept => server.close(accept));
    const rel = relative(resolve(tmpdir()), resolve(root));
    assert.ok(rel && !rel.startsWith("..") && !isAbsolute(rel));
    await rm(root, { recursive: true, force: true });
  }
});
