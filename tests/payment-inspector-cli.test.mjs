import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import net from "node:net";
import dns from "node:dns";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parseInspectorArguments, validateInspectorDatabaseUrl, inspectLocalPaymentRequest, safeInspectorFailure } from "../scripts/lib/payment-inspector.ts";
import { TransportObserver } from "../lib/payment-control/transport-observer.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const url = "postgresql://offline:OFFLINE_SECRET@127.0.0.1:1/gen_eco_transport_uat?schema=public";
const options = { requestId, page: 1 };
const forbidden = [];
const originalFetch = globalThis.fetch;
const originalConnect = net.Socket.prototype.connect;
const originalLookup = dns.lookup;
globalThis.fetch = () => { forbidden.push("fetch"); throw new Error("OFFLINE_NETWORK_BLOCKED"); };
net.Socket.prototype.connect = function () { forbidden.push("socket"); throw new Error("OFFLINE_NETWORK_BLOCKED"); };
dns.lookup = () => { forbidden.push("dns"); throw new Error("OFFLINE_NETWORK_BLOCKED"); };
after(() => {
  globalThis.fetch = originalFetch; net.Socket.prototype.connect = originalConnect; dns.lookup = originalLookup;
  assert.deepEqual(forbidden, []);
});

test("the CLI process blocks generated Prisma and other loaders from reading .env files", async () => {
  for (const name of [".env", ".env.local", ".env.production"]) {
    assert.equal(existsSync(new URL(`../${name}`, import.meta.url)), false);
    assert.throws(() => readFileSync(new URL(`../${name}`, import.meta.url)), /INSPECTOR_ENV_FILE_ACCESS_BLOCKED/);
    await assert.rejects(readFile(new URL(`../${name}`, import.meta.url)), /INSPECTOR_ENV_FILE_ACCESS_BLOCKED/);
  }
});

function fixture({ target = {}, targetRows, inetText = "127.0.0.1/32", missing = false, transport = [], transportFailure = false } = {}) {
  const calls = []; let disconnected = false;
  const event = { id: "recorded-event", requestId, provider: "AIBL_WALLET", operation: "INITIALIZE", outcome: "HTTP_SUCCESS",
    httpStatus: 200, durationMs: 83, createdAt: new Date("2026-10-26T00:00:00.000Z"),
    requestStartedAt: null, requestCompletedAt: null, networkAgentId: null,
    paymentId: null, orderId: null, actorUserId: null, transactionId: "FULL_BANK_REFERENCE_MUST_NOT_APPEAR",
    gatewayStatus: "SUCCESS", detailCode: null,
    rawPayload: { SESSIONKEY: "SECRET_SESSION", access_token: "SECRET_TOKEN" }, cookies: "SECRET_COOKIE" };
  const tx = {
    async $executeRaw(strings) { calls.push(strings.join("?")); return 0; },
    async $queryRaw(query) {
      calls.push(query.sql);
      if (query.sql.includes("current_database")) {
        if (targetRows !== undefined) return targetRows;
        // PostgreSQL's explicit inet::text cast retains /32 or /128, whereas
        // host(inet) returns just the address. Model both to catch this regression.
        const host = new Map([["127.0.0.1/32", "127.0.0.1"], ["::1/128", "::1"]]).get(inetText) ?? inetText;
        const address = query.sql.includes("host(inet_server_addr())") ? host : inetText;
        return [{ database: "gen_eco_transport_uat", readOnly: "on", address, ...target }];
      }
      assert.ok(query.sql.includes('"PaymentTransportEvidence"'));
      assert.deepEqual(query.values, [requestId]);
      if (transportFailure) throw new Error("SECRET_CONNECTION_STRING");
      return transport.map((evidence) => ({ evidence }));
    },
    paymentEvent: {
      async count() { calls.push("count"); return missing ? 0 : 1; },
      async findMany() { return missing ? [] : [event]; },
      async findFirst({ where }) {
        if (missing || where.paymentId || where.actorUserId || where.outcome && !where.outcome.in.includes("HTTP_SUCCESS")) return null;
        return event;
      },
    },
    payment: { async findUnique() { throw new Error("Unexpected payment read"); } },
    networkMonitorAgent: { async findUnique() { return null; } },
    networkHostSample: { async findMany() { return []; } },
    networkProbeSample: { async findMany() { return []; } },
    networkMonitorAlert: { async findMany() { return []; } },
  };
  const client = {
    async $transaction(callback, config) {
      assert.equal(config.isolationLevel, "RepeatableRead");
      return callback(tx);
    },
    async $disconnect() { disconnected = true; },
  };
  return { calls, connect: () => client, get disconnected() { return disconnected; } };
}

test("arguments accept a full Request ID, bounded timeline page and optional JSON export", () => {
  assert.deepEqual(parseInspectorArguments(["--request-id", requestId, "--page", "2", "--output", "report.json"]), { ...options, page: 2, output: "report.json" });
  assert.equal(parseInspectorArguments(["--help"]), null);
});
for (const args of [[], ["--request-id", "short-id"], ["--request-id", requestId, "--page", "21"],
  ["--request-id", requestId, "--page", "1.0"], ["--request-id", requestId, "--request-id", requestId],
  ["--request-id", requestId, "--output", ".env"], ["--request-id", requestId, "--unknown", "x"]]) {
  test(`invalid command arguments are rejected: ${args[2] || "request-id"} ${args[3] || ""}`, () => {
    assert.throws(() => parseInspectorArguments(args));
  });
}

test("database configuration accepts only explicit local databases and bounded connection options", () => {
  assert.equal(validateInspectorDatabaseUrl(url).database, "gen_eco_transport_uat");
  assert.equal(validateInspectorDatabaseUrl(url.replace("gen_eco_transport_uat", "gen_eco")).database, "gen_eco");
  assert.equal(new URL(validateInspectorDatabaseUrl(url.replace("127.0.0.1", "[::1]")).url).hostname, "[::1]");
  for (const bad of [undefined, "not-a-url", url.replace("127.0.0.1", "bank.example"), url.replace("gen_eco_transport_uat", "production"),
    url.replace("127.0.0.1", "localhost"), url.replace("127.0.0.1", "127.0.0.2"), url.replace("127.0.0.1", "[::ffff:127.0.0.1]"),
    url.replace("gen_eco_transport_uat", "gen_eco_backup"),
    url + "&options=unsafe", url + "&schema=private", url + "#fragment", url.replace("postgresql:", "https:")]) {
    assert.throws(() => validateInspectorDatabaseUrl(bad), { code: "LOCAL_DATABASE_CONFIGURATION_REQUIRED" });
  }
});

for (const database of ["gen_eco", "gen_eco_transport_uat"]) {
  for (const [inetText, host] of [["127.0.0.1/32", "127.0.0.1"], ["::1/128", "::1"]]) {
    test(`PostgreSQL host() permits read-only ${database} on exact ${host}, without relaxing the address guard`, async () => {
      assert.equal(["127.0.0.1", "::1"].includes(inetText), false, "legacy inet::text fails the exact-address check");
      const f = fixture({ target: { database }, inetText });
      const connection = url.replace("gen_eco_transport_uat", database).replace("127.0.0.1", host === "::1" ? "[::1]" : host);
      const report = await inspectLocalPaymentRequest(options, connection, f.connect);
      assert.equal(report.readOnly, true);
      assert.equal(report.requestId, requestId);
      assert.equal(f.calls[0], "SET TRANSACTION READ ONLY");
      assert.match(f.calls[2], /host\(inet_server_addr\(\)\) AS "address"/);
      assert.doesNotMatch(f.calls[2], /inet_server_addr\(\)::text/);
      assert.ok(f.calls.indexOf("count") > 2);
      assert.equal(f.disconnected, true);
    });
  }
}

test("shared Inspector v1.4 runs after READ ONLY and connected-target verification, without exposing payloads", async () => {
  const f = fixture(); const report = await inspectLocalPaymentRequest(options, url, f.connect);
  assert.equal(report.inspectorSchemaVersion, "1.4");
  assert.equal(report.readOnly, true);
  assert.ok(f.calls[0].includes("SET TRANSACTION READ ONLY"));
  assert.ok(f.calls[2].includes("current_database"));
  assert.ok(f.calls.indexOf("count") > 2);
  assert.equal(report.apiCalls[0].statusCode, 200);
  assert.equal(report.apiCalls[0].durationMs, 83);
  assert.equal(report.apiCalls[0].method, null);
  assert.equal(report.apiCalls[0].sanitizedEndpoint, null);
  assert.equal(report.apiCalls[0].httpAttemptId, null);
  assert.equal(report.apiCalls[0].source.evidence, "NOT_RECORDED");
  assert.equal(report.apiCalls[0].destination.evidence, "NOT_RECORDED");
  assert.equal(report.apiCalls[0].availability.method, "NOT_RECORDED");
  assert.equal(report.inspector.handshakes.dns.evidence, "NOT_COLLECTED");
  assert.equal(report.inspector.timeline.length, 1);
  assert.equal(report.inspector.transportEvidence.collectionHealth, null);
  assert.equal(report.inspector.transportEvidence.currentConfiguration.mode, "off");
  for (const secret of ["FULL_BANK_REFERENCE_MUST_NOT_APPEAR", "SECRET_SESSION", "SECRET_TOKEN", "SECRET_COOKIE", "OFFLINE_SECRET", "rawPayload", "SESSIONKEY"]) {
    assert.equal(JSON.stringify(report).includes(secret), false);
  }
  assert.equal(f.disconnected, true);
});

for (const target of [{ database: "production" }, { database: "gen_eco" }, { database: null },
  { readOnly: "off" }, { readOnly: null }, { readOnly: true },
  { address: "192.0.2.1" }, { address: "2001:db8::1" }, { address: "127.0.0.2" }, { address: "::ffff:127.0.0.1" },
  { address: "127.0.0.1/32" }, { address: "::1/128" }, { address: null }]) {
  test(`connected target guard fails closed: ${Object.keys(target)[0]} ${Object.values(target)[0]}`, async () => {
    const f = fixture({ target });
    await assert.rejects(inspectLocalPaymentRequest(options, url, f.connect), (error) => {
      const result = safeInspectorFailure(error);
      assert.equal(result.error, "READ_ONLY_LOCAL_TARGET_REJECTED");
      assert.deepEqual(result.diagnostics.checks, {
        TARGET_ROW_VALID: true,
        TARGET_DATABASE_MATCH: !Object.hasOwn(target, "database"),
        TARGET_READ_ONLY: !Object.hasOwn(target, "readOnly"),
        TARGET_SERVER_LOOPBACK: !Object.hasOwn(target, "address"),
      });
      return true;
    });
    assert.equal(f.calls.includes("count"), false);
    assert.equal(f.disconnected, true);
  });
}

for (const targetRows of [[], [null], [{}, {}]]) {
  test(`ambiguous or absent connected-target metadata is diagnosed before reads (${targetRows.length} rows)`, async () => {
    const f = fixture({ targetRows });
    await assert.rejects(inspectLocalPaymentRequest(options, url, f.connect), (error) => {
      assert.deepEqual(safeInspectorFailure(error).diagnostics.checks, {
        TARGET_ROW_VALID: false, TARGET_DATABASE_MATCH: false, TARGET_READ_ONLY: false, TARGET_SERVER_LOOPBACK: false,
      });
      return true;
    });
    assert.equal(f.calls.includes("count"), false);
    assert.equal(f.disconnected, true);
  });
}

test("rejection diagnostics classify addresses without disclosing raw target values", async () => {
  for (const [address, category] of [
    ["::ffff:127.0.0.1", "IPV4_MAPPED_LOOPBACK"], ["::ffff:7f00:1", "IPV4_MAPPED_LOOPBACK"],
    ["127.0.0.1/32", "UNNORMALIZED_LOOPBACK"], ["::1/128", "UNNORMALIZED_LOOPBACK"],
    ["SECRET_SENTINEL_postgresql://user:password@host/db", "OTHER_OR_UNAVAILABLE"],
  ]) {
    const f = fixture({ target: { address, database: "SECRET_DATABASE", readOnly: "SECRET_STATE" } });
    await assert.rejects(inspectLocalPaymentRequest(options, url, f.connect), (error) => {
      const result = safeInspectorFailure(error);
      assert.equal(result.diagnostics.serverAddressCategory, category);
      assert.equal(result.diagnostics.checks.TARGET_SERVER_LOOPBACK, false);
      assert.doesNotMatch(JSON.stringify(result), /SECRET_|postgresql:|password|127\.0\.0\.1|::ffff/);
      return true;
    });
  }
});

test("Windows launcher retains secure prompt, literal loopback and exact database allowlist", () => {
  const source = readFileSync(new URL("../scripts/Invoke-PaymentInspector.ps1", import.meta.url), "utf8");
  assert.match(source, /ValidateSet\('gen_eco', 'gen_eco_transport_uat'\)/);
  assert.match(source, /127\.0\.0\.1:5432\/\{2\}\?schema=public/);
  assert.match(source, /Read-Host[^\r\n]*-AsSecureString/);
  assert.match(source, /EnvironmentVariables\['PAYMENT_INSPECTOR_DATABASE_URL'\]/);
  assert.match(source, /EnvironmentVariables\.Remove\('DATABASE_URL'\)/);
  assert.doesNotMatch(source, /--(?:skip|disable|bypass)[-\w]*(?:guard|target|readonly)/i);
});

test("actual PowerShell error formatter preserves only fixed, typed target diagnostics", () => {
  const script = fileURLToPath(new URL("./payment-inspector-launcher.test.ps1", import.meta.url));
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", script], {
    encoding: "utf8", timeout: 20000, windowsHide: true,
  });
  assert.equal(result.status, 0, "Isolated PowerShell formatter regression failed");
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(result.stdout).result, "PASS");
});

test("invalid input fails before connection and missing requests produce a safe not-found code", async () => {
  await assert.rejects(inspectLocalPaymentRequest({ ...options, requestId: "bad" }, url, () => { throw new Error("Should not connect"); }), /INVALID_REQUEST_ID/);
  const f = fixture({ missing: true });
  try { await inspectLocalPaymentRequest(options, url, f.connect); assert.fail("Expected missing request"); }
  catch (error) { assert.deepEqual(safeInspectorFailure(error), { error: "RECORDED_REQUEST_NOT_FOUND" }); }
  assert.equal(f.disconnected, true);
});

test("missing transport storage remains unavailable and rolls back only the read savepoint", async () => {
  const f = fixture({ transportFailure: true });
  const report = await inspectLocalPaymentRequest(options, url, f.connect);
  assert.equal(report.inspector.transportEvidence.storage, "UNAVAILABLE");
  assert.deepEqual(report.transportAttempts, []);
  assert.ok(f.calls.some((call) => call.includes("ROLLBACK TO SAVEPOINT inspector_transport_read")));
  assert.equal(JSON.stringify(report).includes("SECRET_CONNECTION_STRING"), false);
});

test("recorded transport origin and attempt ID stay separate from unmatched HTTP results", async () => {
  const observer = new TransportObserver();
  const scope = observer.begin("AIBL_WALLET", "INITIALIZE", requestId, "https://iwtest.aibl.com.bd", "passive");
  const attempt = observer.complete(scope)[0];
  const f = fixture({ transport: [
    { ...attempt, access_token: "SECRET_TOKEN", rawPayload: "SECRET_PAYLOAD" },
    { ...attempt, requestId: "22222222-2222-4222-8222-222222222222" },
    { ...attempt, destinationOrigin: "https://iwtest.aibl.com.bd/?token=SECRET_TOKEN" },
  ] });
  const report = await inspectLocalPaymentRequest(options, url, f.connect);
  assert.equal(report.transportAttempts.length, 1);
  assert.equal(report.transportAttempts[0].attemptId, attempt.attemptId);
  assert.equal(report.transportAttempts[0].destinationOrigin, "https://iwtest.aibl.com.bd");
  assert.equal(report.apiCalls[0].httpAttemptId, null);
  assert.equal(JSON.stringify(report).includes("SECRET_TOKEN"), false);
  assert.equal(JSON.stringify(report).includes("SECRET_PAYLOAD"), false);
});

async function command(args, environment, f, existing = false) {
  let stdout = ""; let stderr = ""; let exitCode = 0; const writes = [];
  const source = readFileSync(new URL("../scripts/payment-inspector.mjs", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = {
    "./lib/payment-inspector.ts": { parseInspectorArguments, safeInspectorFailure,
      inspectLocalPaymentRequest: (opts, connection) => inspectLocalPaymentRequest(opts, connection, f.connect) },
    "node:fs/promises": { async writeFile(path, data, config) {
      assert.equal(config.flag, "wx"); assert.equal(config.mode, 0o600);
      if (existing) throw new Error("SECRET_EXISTING_FILE_ERROR");
      writes.push({ path, data });
    } },
  };
  const context = vm.createContext({ exports: {}, process: { argv: ["node", "script", ...args], env: environment,
    stdout: { write(value) { stdout += value; } }, stderr: { write(value) { stderr += value; } },
    set exitCode(value) { exitCode = value; } },
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unapproved CLI import: ${name}`); return imports[name]; },
  });
  await new vm.Script(`(async () => { ${compiled}\n})()`).runInContext(context);
  return { stdout, stderr, exitCode, writes };
}

test("terminal stdout is JSON and optional file export contains the same sanitized document", async () => {
  const result = await command(["--request-id", requestId, "--output", "report.json"], { PAYMENT_INSPECTOR_DATABASE_URL: url }, fixture());
  assert.equal(JSON.parse(result.stdout).requestId, requestId);
  assert.equal(result.writes[0].data, result.stdout);
  assert.equal(result.stderr, ""); assert.equal(result.exitCode, 0);
});

test("help never connects; no .env/DATABASE_URL fallback and export failures never leak errors", async () => {
  const help = await command(["--help"], {}, { connect() { assert.fail("Help connected"); } });
  assert.ok(JSON.parse(help.stdout).usage);
  const missing = await command(["--request-id", requestId], { DATABASE_URL: "SECRET_MAIN_DATABASE" }, { connect() { assert.fail("Fallback connected"); } });
  assert.equal(missing.exitCode, 1); assert.equal(missing.stdout, "");
  assert.deepEqual(JSON.parse(missing.stderr), { error: "LOCAL_DATABASE_CONFIGURATION_REQUIRED" });
  const failed = await command(["--request-id", requestId, "--output", "report.json"], { PAYMENT_INSPECTOR_DATABASE_URL: url }, fixture(), true);
  assert.equal(failed.exitCode, 1); assert.equal(failed.stdout, ""); assert.deepEqual(failed.writes, []);
  assert.deepEqual(JSON.parse(failed.stderr), { error: "INSPECTOR_READ_OR_EXPORT_FAILED" });
});

test("the real terminal entry point returns JSON help and fails safely without its explicit connection", () => {
  const script = fileURLToPath(new URL("../scripts/payment-inspector.mjs", import.meta.url));
  const env = { ...process.env, PAYMENT_INSPECTOR_DATABASE_URL: "", DATABASE_URL: "SECRET_FALLBACK_MUST_NOT_BE_USED", DEBUG: "prisma:*" };
  const help = spawnSync(process.execPath, ["--import", "tsx", script, "--help"], { env, encoding: "utf8", timeout: 15000 });
  assert.equal(help.status, 0); assert.equal(help.stderr, ""); assert.ok(JSON.parse(help.stdout).usage);
  const failure = spawnSync(process.execPath, ["--import", "tsx", script, "--request-id", requestId], { env, encoding: "utf8", timeout: 15000 });
  assert.equal(failure.status, 1); assert.equal(failure.stdout, "");
  assert.deepEqual(JSON.parse(failure.stderr), { error: "LOCAL_DATABASE_CONFIGURATION_REQUIRED" });
});
