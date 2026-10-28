import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { assertConnectedTarget, testUrl, uatConnectionFromEnvironment, verifyConnectedTarget,
  UatConnectedTargetError, UAT_DATABASE } from "./helpers/payment-transport-postgres-target.mjs";
import { loadTransportSource } from "./helpers/payment-transport-uat.mjs";

// Synthetic values only; no Prisma client, dotenv, socket or real DB is opened.
const url = `postgresql://offline_fixture:offline_fixture@localhost:5432/${UAT_DATABASE}`;
const valid = { db: UAT_DATABASE, address: "127.0.0.1", port: 5432, schema: "public" };
const sql = (strings, ...values) => ({ text: strings.join("?"), values });

test("correct dedicated UAT URL is accepted with public schema and bounded pool/timeouts", () => {
  const parsed = new URL(testUrl(url));
  assert.equal(parsed.hostname, "localhost"); assert.equal(parsed.pathname, `/${UAT_DATABASE}`);
  assert.equal(parsed.searchParams.get("schema"), "public");
  assert.equal(parsed.searchParams.get("connection_limit"), "6");
});
for (const [name, input] of [
  ["original database", url.replace(UAT_DATABASE, "gen_eco")],
  ["remote hostname", url.replace("localhost", "example.invalid")],
  ["wrong port", url.replace(":5432", ":5433")],
  ["wrong schema", `${url}?schema=private`],
  ["ambiguous schema", `${url}?schema=public&schema=private`],
  ["unsafe query parameters", `${url}?options=-csearch_path%3Dprivate`],
  ["credentials missing entirely", undefined],
  ["username missing", `postgresql://localhost:5432/${UAT_DATABASE}`],
  ["malformed URL", "not a database URL"],
]) test(`URL guard rejects ${name}`, () => assert.throws(() => testUrl(input)));

for (const address of ["127.0.0.1", "::1"]) test(`connected target accepts exact ${address} loopback`, () => {
  assert.doesNotThrow(() => assertConnectedTarget({ ...valid, address }));
});
for (const [name, row, code] of [
  ["original database", { ...valid, db: "gen_eco" }, "UAT_DATABASE_MATCH"],
  ["other database", { ...valid, db: "other" }, "UAT_DATABASE_MATCH"],
  ["wrong server port", { ...valid, port: 5433 }, "UAT_PORT_MATCH"],
  ["non-numeric server port", { ...valid, port: "5432" }, "UAT_PORT_MATCH"],
  ["wrong current schema", { ...valid, schema: "private" }, "UAT_SCHEMA_MATCH"],
  ["IPv4 remote server", { ...valid, address: "192.0.2.1" }, "UAT_SERVER_LOOPBACK"],
  ["IPv6 remote server", { ...valid, address: "2001:db8::1" }, "UAT_SERVER_LOOPBACK"],
  ["other IPv4 loopback address", { ...valid, address: "127.0.0.2" }, "UAT_SERVER_LOOPBACK"],
  ["IPv4-mapped IPv6 without explicit approval", { ...valid, address: "::ffff:127.0.0.1" }, "UAT_SERVER_LOOPBACK"],
  ["missing connection metadata", undefined, "UAT_DATABASE_MATCH"],
]) test(`connected target rejects ${name} with a specific diagnostic`, () => {
  assert.throws(() => assertConnectedTarget(row), (error) => {
    assert.ok(error instanceof UatConnectedTargetError);
    assert.equal(error.diagnostic.checks[code], false); assert.match(error.message, new RegExp(code));
    return true;
  });
});

test("confirmed inet::text suffix defect is fixed by SQL host(), without accepting CIDR strings in the guard", async () => {
  for (const [raw, normalized] of [["127.0.0.1/32", "127.0.0.1"], ["::1/128", "::1"]]) {
    assert.equal(["127.0.0.1", "::1"].includes(raw), false, "legacy comparison rejects documented inet text");
    const tx = { async $queryRaw(query) {
      assert.match(query.text, /host\(inet_server_addr\(\)\) AS address/);
      assert.doesNotMatch(query.text, /inet_server_addr\(\)::text/);
      // Reproduce PostgreSQL's documented host(inet) result, not a live query.
      return [{ ...valid, address: normalized }];
    } };
    await verifyConnectedTarget(tx, sql);
    assert.throws(() => assertConnectedTarget({ ...valid, address: raw }), /UAT_SERVER_LOOPBACK/);
  }
});
test("actual connected database is authoritative even when connection URL is correct", async () => {
  testUrl(url);
  await assert.rejects(verifyConnectedTarget({ $queryRaw: async () => [{ ...valid, db: "gen_eco" }] }, sql), /UAT_DATABASE_MATCH/);
});
test("dedicated environment variable takes precedence; application DATABASE_URL is never a fallback", () => {
  const original = url.replace(UAT_DATABASE, "gen_eco");
  assert.equal(uatConnectionFromEnvironment({ PAYMENT_TRANSPORT_UAT_DATABASE_URL: url, DATABASE_URL: original }), url);
  assert.equal(uatConnectionFromEnvironment({ DATABASE_URL: url }), undefined);
  assert.equal(uatConnectionFromEnvironment({ PAYMENT_TRANSPORT_UAT_DATABASE_URL: "", DATABASE_URL: url }), "");
  const selected = uatConnectionFromEnvironment({ PAYMENT_TRANSPORT_UAT_DATABASE_URL: original, DATABASE_URL: url });
  assert.throws(() => testUrl(selected), /UAT_TARGET_REJECTED/);
});
test("target diagnostics redact arbitrary database/schema/address values, usernames and URLs", () => {
  const sentinel = "PRIVATE_SENTINEL\npostgresql://private:private@example.invalid/db";
  assert.throws(() => assertConnectedTarget({ db: sentinel, schema: sentinel, address: sentinel, port: sentinel }), (error) => {
    assert.doesNotMatch(error.message + JSON.stringify(error.diagnostic), /PRIVATE_SENTINEL|postgresql:|private:private/);
    assert.match(error.message, /Actual database: OTHER_OR_UNAVAILABLE/);
    assert.match(error.message, /Connection validation: FAILED/); return true;
  });
});
for (const [name, row] of [
  ["original DB", { ...valid, db: "gen_eco" }],
  ["remote server", { ...valid, address: "192.0.2.1" }],
  ["wrong port", { ...valid, port: 5433 }],
  ["wrong schema", { ...valid, schema: "private" }],
]) test(`actual runner aborts before writes for ${name}, preserving diagnostics through its catch`, async () => {
  let reads = 0; let writes = 0; let disconnected = false; const pending = [];
  const tx = { async $queryRaw(query) {
    reads++; assert.match(query.text, /current_database\(\)/); return [row];
  }, async $executeRaw() { writes++; throw new Error("OFFLINE_WRITE_FORBIDDEN"); } };
  class OfflineClient {
    async $transaction(work) { return work(tx); }
    async $disconnect() { disconnected = true; }
  }
  function register(name, options, work) {
    if (name.startsWith("bounded PostgreSQL")) pending.push(work({ test() { throw new Error("OFFLINE_CASE_BEFORE_VALIDATION"); } }));
  }
  loadTransportSource("tests/payment-transport-postgres-integration.test.mjs", {
    "node:assert/strict": { default: assert }, "node:test": { default: register }, "node:crypto": { randomUUID },
    "../generated/prisma/index.js": { Prisma: { sql }, PrismaClient: OfflineClient },
    "../lib/payment-control/transport-observer.ts": {},
    "../lib/payment-control/transport-sanitizer.ts": {}, "../lib/payment-control/transport-queue.ts": {},
    "./helpers/payment-transport-uat.mjs": { loadTransportSource },
    "./helpers/payment-transport-postgres-target.mjs": { testUrl, uatConnectionFromEnvironment: () => url,
      verifyConnectedTarget, UatConnectedTargetError },
  });
  assert.equal(pending.length, 1);
  await assert.rejects(pending[0], (error) => error instanceof UatConnectedTargetError && /Reason:/.test(error.message));
  assert.equal(reads, 1); assert.equal(writes, 0); assert.equal(disconnected, true);
});
