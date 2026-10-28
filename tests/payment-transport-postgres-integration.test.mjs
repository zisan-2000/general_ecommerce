import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "../generated/prisma/index.js";
import { TransportObserver } from "../lib/payment-control/transport-observer.ts";
import { sanitizeTransportEvidence } from "../lib/payment-control/transport-sanitizer.ts";
import { TransportEvidenceQueue } from "../lib/payment-control/transport-queue.ts";
import { loadTransportSource } from "./helpers/payment-transport-uat.mjs";
import { testUrl, uatConnectionFromEnvironment, verifyConnectedTarget, UatConnectedTargetError } from "./helpers/payment-transport-postgres-target.mjs";

const target = "gen_eco_transport_uat";
for (const [name, input] of [
  ["original database", "postgresql://fixture:fixture@localhost:5432/gen_eco"],
  ["remote host", `postgresql://fixture:fixture@example.invalid:5432/${target}`],
  ["wrong port", `postgresql://fixture:fixture@localhost:5433/${target}`],
  ["missing credentials/configuration", undefined],
  ["ambiguous schema parameters", `postgresql://fixture:fixture@localhost:5432/${target}?schema=public&schema=private`],
]) test(`database safety boundary rejects ${name} before opening a client`, () => assert.throws(() => testUrl(input)));

const cases = [
  "concurrent actual application writers", "advisory-lock mutual exclusion and reacquisition",
  "concurrent duplicate attempt IDs", "controlled ring rollover and slot allocation",
  "different Request IDs remain isolated", "unrelated retained evidence is not overwritten by duplicates",
  "database uniqueness constraints", "transaction timeout and lock contention",
  "graceful storage failure", "queue recovery after database failure",
  "INSERTED and DUPLICATE results", "actual Request ID read/query behavior",
  "seven-day expiry and expired-row filtering", "physical slot-cap enforcement",
  "payment/order/inventory/settlement SQL remains inaccessible",
];
const connection = uatConnectionFromEnvironment();
if (!connection) {
  for (const name of cases) test(name, { skip: "UAT_CREDENTIALS_UNAVAILABLE: no .env fallback; no database writes" }, () => {});
} else test("bounded PostgreSQL transport UAT — dedicated database only", { timeout: 45000 }, async (t) => {
  let client; let initial; let expectedSequence; let ready = false;
  const ownedRequests = Array.from({ length: 24 }, () => randomUUID());
  const ownedAttempts = new Set();
  const check = (name, work) => t.test(name, async () => {
    try { await work(); }
    catch (error) {
      if (error instanceof UatConnectedTargetError) throw error;
      throw new Error("UAT_ASSERTION_FAILED_REDACTED");
    }
  });
  const record = (requestId = ownedRequests[0]) => {
    const observer = new TransportObserver();
    const scope = observer.begin("AIBL_WALLET", "VERIFY", requestId, "https://iwtest.aibl.com.bd", "passive");
    const value = observer.complete(scope)[0]; ownedAttempts.add(value.attemptId);
    assert.ok(sanitizeTransportEvidence(value)); return value;
  };
  const verify = (tx) => verifyConnectedTarget(tx, Prisma.sql);
  const lock = (tx) => tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(1784484441, 4)::text AS lock`);
  const sequence = async (tx) => (await tx.$queryRaw(Prisma.sql`SELECT last_value::text AS value, is_called AS called FROM "PaymentTransportEvidence_slot_seq"`))[0];
  async function exclusivelyOwned(tx) {
    const [row] = await tx.$queryRaw(Prisma.sql`SELECT count(*)::integer AS count FROM "PaymentTransportEvidence"
      WHERE NOT ("requestId" IN (${Prisma.join(ownedRequests)}))`);
    if (row.count !== 0) throw new Error("UAT_FOREIGN_EVIDENCE_PRESENT");
    if (expectedSequence) assert.deepEqual(await sequence(tx), expectedSequence, "UAT_SEQUENCE_CHANGED_BY_ANOTHER_WRITER");
  }
  function permitted(query) {
    const sql = query.text ?? query.sql;
    if (typeof sql !== "string" || /;|--|\/\*|\b(?:COPY|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE)\b/i.test(sql)) throw new Error("UAT_SQL_BLOCKED");
    for (const match of sql.matchAll(/\b(?:FROM|INTO|UPDATE|TABLE)\s+"?([A-Za-z_][A-Za-z_0-9]*)/gi)) {
      // ON CONFLICT DO UPDATE SET does not name another table.
      if (!["PaymentTransportEvidence", "PaymentTransportEvidence_slot_seq", "SET"].includes(match[1])) throw new Error("UAT_SQL_BLOCKED");
    }
    return query;
  }
  async function guarded(work, options = {}, applicationTransaction = false) {
    return client.$transaction(async (tx) => {
      await verify(tx);
      await tx.$queryRaw(Prisma.sql`SELECT set_config('lock_timeout', '750ms', true), set_config('statement_timeout', '1000ms', true)`);
      let locked = false;
      if (!applicationTransaction) { await lock(tx); await exclusivelyOwned(tx); locked = true; }
      const facade = {
        $queryRaw: async (query) => {
          const result = await tx.$queryRaw(permitted(query));
          if (/pg_advisory_xact_lock/.test(query.text ?? query.sql)) {
            await exclusivelyOwned(tx); locked = true;
          }
          return result;
        },
        $executeRaw: async (query) => {
          if (!locked) throw new Error("UAT_WRITE_WITHOUT_WRITER_LOCK");
          await verify(tx); // Same connection, immediately before every write.
          return tx.$executeRaw(permitted(query));
        },
      };
      const result = await work(facade);
      expectedSequence = await sequence(tx); return result;
    }, { isolationLevel: "ReadCommitted", maxWait: 1000, timeout: 3000, ...options });
  }
  // Each actual persistence transaction verifies the connected target BEFORE its
  // lock or writes. No Prisma model access is exposed to application modules.
  const facade = {
    $transaction: (work, options) => guarded(work, options, true),
    $queryRaw: (query) => guarded((tx) => tx.$queryRaw(query)),
  };
  async function blocking(work) {
    let announce; let unlock;
    const acquired = new Promise((resolve) => { announce = resolve; });
    const released = new Promise((resolve) => { unlock = resolve; });
    const holder = client.$transaction(async (tx) => {
      await verify(tx); await lock(tx); announce(); await released;
    }, { timeout: 3000 });
    // Authentication/lock errors cannot strand the main task waiting for announce.
    await Promise.race([acquired, holder]);
    try { return await work(); } finally { unlock(); await holder; }
  }
  try {
    client = new PrismaClient({ datasources: { db: { url: testUrl(connection) } }, log: [] });
    await client.$transaction(async (tx) => {
      await verify(tx); await lock(tx);
      const [row] = await tx.$queryRaw(Prisma.sql`SELECT count(*)::integer AS count FROM "PaymentTransportEvidence"`);
      if (row.count !== 0) throw new Error("UAT_REQUIRES_EMPTY_EVIDENCE_TABLE_NO_RECORDS_REMOVED");
      initial = expectedSequence = await sequence(tx); ready = true;
    }, { timeout: 3000 });
    const storage = loadTransportSource("lib/payment-control/transport-storage.ts", {
      "server-only": {}, "@/generated/prisma": { Prisma }, "@/lib/prisma": { prisma: facade },
      "./transport-sanitizer": { sanitizeTransportEvidence }, "./transport-queue": { TransportEvidenceQueue },
    }, {}, true);
    const persist = storage.persistForUat;
    const rows = () => guarded((tx) => tx.$queryRaw(Prisma.sql`SELECT "attemptId", "requestId", "slot" FROM "PaymentTransportEvidence" ORDER BY "slot"`));
    let sentinel;
    await check(cases[0], async () => {
      const records = [record(), record(), record()];
      assert.deepEqual(await Promise.all(records.map(persist)), ["INSERTED", "INSERTED", "INSERTED"]);
      assert.equal((await rows()).length, 3);
    });
    await check(cases[1], async () => {
      await blocking(async () => {
        await client.$transaction(async (tx) => {
          await verify(tx);
          const [row] = await tx.$queryRaw(Prisma.sql`SELECT pg_try_advisory_xact_lock(1784484441, 4) AS acquired`);
          assert.equal(row.acquired, false);
        });
      });
      await guarded(async () => {}); // reacquired after holder transaction exits
    });
    await check(cases[2], async () => {
      const value = record(); const before = structuredClone(expectedSequence);
      const results = await Promise.all([persist(value), persist(value), persist(value)]);
      assert.equal(results.filter((result) => result === "INSERTED").length, 1);
      assert.equal(results.filter((result) => result === "DUPLICATE").length, 2);
      assert.equal(BigInt(expectedSequence.value) - BigInt(before.value), 1n);
    });
    await check(cases[3], async () => {
      // Only owned synthetic rows can exist under the same writer lock. Restore
      // original sequence in finally; never reset/delete an unrelated row.
      await guarded((tx) => tx.$queryRaw(Prisma.sql`SELECT setval('"PaymentTransportEvidence_slot_seq"', 9998, true)::text`));
      const a = record(); const b = record(); const c = record();
      await persist(a); await persist(b); await persist(c);
      const current = await rows();
      for (const [value, slot] of [[a, 9999], [b, 0], [c, 1]]) assert.equal(current.find((row) => row.attemptId === value.attemptId)?.slot, slot);
      sentinel = a;
    });
    await check(cases[4], async () => {
      const a = record(ownedRequests[1]); const b = record(ownedRequests[2]);
      await Promise.all([persist(a), persist(b)]);
      const result = await storage.readTransportEvidence(a.requestId);
      assert.equal(result.attempts.length, 1); assert.equal(result.attempts[0].attemptId, a.attemptId);
    });
    await check(cases[5], async () => {
      const before = await rows(); const seq = structuredClone(expectedSequence);
      assert.equal(await persist(sentinel), "DUPLICATE");
      assert.deepEqual(await rows(), before); assert.deepEqual(expectedSequence, seq);
    });
    await check(cases[6], async () => {
      const occupied = new Set((await rows()).map((row) => row.slot));
      const vacant = Array.from({ length: 32 }, (_, index) => index).find((slot) => !occupied.has(slot));
      assert.notEqual(vacant, undefined);
      await assert.rejects(guarded((tx) => tx.$executeRaw(Prisma.sql`
        INSERT INTO "PaymentTransportEvidence" SELECT ${vacant}, "attemptId", "requestId", "connectionId", "provider", "operation", "startedAt", "expiresAt", "evidence"
        FROM "PaymentTransportEvidence" WHERE "attemptId" = ${sentinel.attemptId}`)),
      (error) => error.code === "P2010" && error.meta?.code === "23505");
    });
    await check(cases[7], async () => {
      await blocking(async () => { await assert.rejects(persist(record()),
        (error) => error.code === "P2010" && error.meta?.code === "55P03"); });
      await assert.rejects(guarded(async (tx) => {
        await new Promise((resolve) => setTimeout(resolve, 180));
        await tx.$queryRaw(Prisma.sql`SELECT 1`);
      }, { timeout: 120 }), (error) => error.code === "P2028");
    });
    await check(cases[8], async () => {
      await blocking(async () => {
        const result = await storage.readTransportEvidence(ownedRequests[0]);
        assert.equal(result.storage, "UNAVAILABLE"); assert.equal(result.attempts.length, 0);
      });
    });
    await check(cases[9], async () => {
      const scheduled = [];
      const queue = new TransportEvidenceQueue({ sanitize: sanitizeTransportEvidence, write: persist, schedule: (task) => scheduled.push(task) });
      await blocking(async () => { queue.enqueue([record()]); scheduled.shift()(); await queue.waitForIdle(); });
      assert.equal(queue.snapshot().writeErrors, 1); assert.equal(queue.snapshot().persisted, 0);
      queue.enqueue([record()]); scheduled.shift()(); await queue.waitForIdle();
      assert.equal(queue.snapshot().persisted, 1); assert.equal(queue.snapshot().queueDepth, 0);
    });
    await check(cases[10], async () => {
      const value = record(); assert.equal(await persist(value), "INSERTED"); assert.equal(await persist(value), "DUPLICATE");
    });
    await check(cases[11], async () => {
      const value = record(ownedRequests[3]); await persist(value);
      const result = await storage.readTransportEvidence(value.requestId);
      assert.equal(result.storage, "AVAILABLE"); assert.equal(result.attempts.length, 1);
      assert.equal(result.attempts[0].requestId, value.requestId); assert.equal(result.limited, false);
    });
    await check(cases[12], async () => {
      const value = record(ownedRequests[4]); await persist(value);
      const [ttl] = await guarded((tx) => tx.$queryRaw(Prisma.sql`SELECT extract(epoch FROM ("expiresAt" - NOW()))::float8 AS seconds
        FROM "PaymentTransportEvidence" WHERE "attemptId" = ${value.attemptId}`));
      assert.ok(ttl.seconds > 604770 && ttl.seconds <= 604800);
      await guarded((tx) => tx.$executeRaw(Prisma.sql`UPDATE "PaymentTransportEvidence" SET "expiresAt" = NOW() - INTERVAL '1 second'
        WHERE "attemptId" = ${value.attemptId} AND "requestId" = ${value.requestId}`));
      assert.equal((await storage.readTransportEvidence(value.requestId)).attempts.length, 0);
    });
    await check(cases[13], async () => {
      for (const slot of [-1, 10000]) await assert.rejects(guarded((tx) => tx.$executeRaw(Prisma.sql`
        INSERT INTO "PaymentTransportEvidence" SELECT ${slot}, ${randomUUID()}, "requestId", "connectionId", "provider", "operation", "startedAt", "expiresAt", "evidence"
        FROM "PaymentTransportEvidence" WHERE "attemptId" = ${sentinel.attemptId}`)),
      (error) => error.code === "P2010" && error.meta?.code === "23514");
      // PK + integer range yields <=10,000 rows without inserting 10,000 records.
      const current = await rows(); assert.ok(current.length <= 10000);
      assert.equal(new Set(current.map((row) => row.slot)).size, current.length);
      assert.ok(current.every((row) => row.slot >= 0 && row.slot < 10000));
    });
    await check(cases[14], () => {
      for (const table of ["Payment", "Order", "StockLevel", "InventoryReservation", "PaymentEvent"]) {
        assert.throws(() => permitted(Prisma.sql`DELETE FROM ${Prisma.raw(`"${table}"`)}`), /UAT_SQL_BLOCKED/);
      }
      assert.deepEqual(Object.keys(facade).sort(), ["$queryRaw", "$transaction"]);
    });
  } catch (error) {
    if (error instanceof UatConnectedTargetError) throw error;
    // Prisma messages can contain a connection URL. Never surface the raw error.
    const safe = error instanceof Error && /^UAT_[A-Z_]+$/.test(error.message) ? error.message : "UAT_DATABASE_SETUP_OR_ASSERTION_FAILED";
    throw new Error(safe);
  } finally {
    if (client && ready) {
      try {
        await guarded(async (tx) => {
          if (ownedAttempts.size) await tx.$executeRaw(Prisma.sql`DELETE FROM "PaymentTransportEvidence"
            WHERE "attemptId" IN (${Prisma.join([...ownedAttempts])}) AND "requestId" IN (${Prisma.join(ownedRequests)})`);
          await tx.$queryRaw(Prisma.sql`SELECT setval('"PaymentTransportEvidence_slot_seq"', ${BigInt(initial.value)}, ${initial.called})::text`);
        });
      } catch { throw new Error("UAT_OWNED_CLEANUP_OR_SEQUENCE_RESTORE_FAILED"); }
    }
    await client?.$disconnect();
  }
});
