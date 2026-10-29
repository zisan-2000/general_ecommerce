// Creates its OWN temporary PostgreSQL cluster on a free loopback port.
// Never reads .env or DATABASE_URL, and never connects to an existing database.
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readdir, rm, realpath } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import * as crypto from "node:crypto";
import ts from "typescript";
import * as policy from "../lib/payment-control/diagnostic-policy.ts";
import * as capturePolicy from "../lib/payment-control/capture-policy.ts";
import * as engine from "../lib/payment-control/investigation-engine.ts";
import * as consistency from "../lib/payment-control/consistency.ts";
import * as diagnosticAdapters from "../lib/payment-control/diagnostic-adapters.ts";
const optedIn = process.env.PAYMENT_DIAGNOSTICS_LOCAL_POSTGRES === "true";
class ControlError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function load(path, imports, fixtureEnv) {
  const commonJsModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new vm.Script(code).runInContext(vm.createContext({ module: commonJsModule, exports: commonJsModule.exports,
    process: fixtureEnv ? { env: fixtureEnv } : process, Date, Set, Map, Buffer, URL, URLSearchParams, console,
    Response, TextDecoder, AbortSignal, AbortController, performance,
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      if (name in imports) return imports[name];
      throw new Error("Isolated PostgreSQL test blocked import: " + name);
    } }));
  return commonJsModule.exports;
}
async function command(binary, args, allowedCodes = [0]) {
  return new Promise((accept, reject) => {
    const env = {};
    for (const key of ["SystemRoot", "WINDIR", "PATH", "TEMP", "TMP"]) if (process.env[key]) env[key] = process.env[key];
    // A Windows PostgreSQL daemon may inherit unused pipe handles from pg_ctl.
    // Its own -l log file is private; do not attach Node pipes to daemon startup.
    const daemonStart = args.at(-1) === "start";
    const child = spawn(binary, args, { shell: false, windowsHide: true, env, stdio: daemonStart ? "ignore" : ["ignore", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.stdout?.on("data", data => { output = (output + data.toString()).slice(-65536); });
    child.stderr?.on("data", data => { output = (output + data.toString()).slice(-65536); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => { clearTimeout(timer); if (allowedCodes.includes(code)) accept({ code, output });
      else reject(new Error(`ISOLATED_POSTGRES_COMMAND_FAILED (${code}): ${output.slice(-1500)}`)); });
  });
}
test("fresh isolated PostgreSQL validates release migrations, read-only investigations and capture claim concurrency", {
  skip: !optedIn ? "ISOLATED_POSTGRES_NOT_REQUESTED: no existing DB or .env fallback" : false, timeout: 180000,
}, async t => {
  const bin = process.env.PAYMENT_DIAGNOSTICS_TEST_PG_BIN || "";
  assert.ok(isAbsolute(bin), "Explicit PostgreSQL binary directory required");
  const exe = name => join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  const root = await mkdtemp(join(tmpdir(), "deshi-payment-postgres-")), data = join(root, "cluster");
  const user = "diag_" + crypto.randomBytes(6).toString("hex"), dbName = "diagnostics_isolated_uat";
  const socket = createServer();
  await new Promise(accept => socket.listen(0, "127.0.0.1", accept));
  const port = socket.address().port; await new Promise(accept => socket.close(accept));
  let client, initialized = false;
  try {
    await command(exe("initdb"), ["-D", data, "-U", user, "--auth=trust", "--encoding=UTF8", "--locale=C"]); initialized = true;
    await command(exe("pg_ctl"), ["-D", data, "-w", "-t", "20", "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "start"]);
    const connection = ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", user, "-v", "ON_ERROR_STOP=1"];
    // Verify the actual server data directory before even creating the test DB.
    const identity = await command(exe("psql"), [...connection, "-d", "postgres", "-A", "-t", "-c", "SELECT current_setting('data_directory')"]);
    assert.equal(await realpath(identity.output.trim()), await realpath(data));
    await command(exe("psql"), [...connection, "-d", "postgres", "-c", `CREATE DATABASE ${dbName}`]);
    const migrations = (await readdir(resolve("prisma/migrations-release"), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name).sort();
    for (const name of migrations) await command(exe("psql"), [...connection, "-d", dbName, "-f", resolve("prisma/migrations-release", name, "migration.sql")]);
    t.diagnostic(`Applied ${migrations.length} release migrations to a newly initialized temporary PostgreSQL cluster; no existing database connected.`);
    const require = createRequire(import.meta.url);
    const generated = require("../generated/prisma/index.js");
    const { PrismaClient, Prisma } = generated;
    client = new PrismaClient({ datasources: { db: { url: `postgresql://${user}@127.0.0.1:${port}/${dbName}?schema=public&connection_limit=4` } }, log: [] });
    const connected = await client.$queryRaw`SELECT current_database() AS db, inet_server_port() AS port, current_setting('data_directory') AS data`;
    assert.equal(connected[0].db, dbName); assert.equal(connected[0].port, port); assert.equal(await realpath(connected[0].data), await realpath(data));
    await client.user.create({ data: { id: "diagnostic-staff", email: user + "@example.invalid", banned: false } });
    const order = await client.order.create({ data: { name: "SYNTHETIC DIAGNOSTIC FIXTURE", phone_number: "00000000000", country: "Bangladesh",
      district: "FIXTURE", area: "FIXTURE", address_details: "FIXTURE", payment_method: "EPS:1", total: "100.00", shipping_cost: "0", grand_total: "100.00" } });
    const payment = await client.payment.create({ data: { orderId: order.id, provider: "EPS", externalId: "97000000000001234567890", amount: "100.00", currency: "BDT", status: "INITIATED" } });
    const requestId = crypto.randomUUID();
    await client.paymentEvent.create({ data: { paymentId: payment.id, orderId: order.id, provider: "EPS", requestId, operation: "INITIALIZE", outcome: "SUCCESS" } });
    const capture = load("lib/payment-control/capture.ts", { "@/generated/prisma": { Prisma }, "@/lib/prisma": { prisma: client },
      "./authorization": { PaymentControlError: ControlError }, "./capture-policy": capturePolicy });
    const reader = load("lib/payment-control/investigation.ts", { "@/generated/prisma": { Prisma }, "@/lib/prisma": { prisma: client },
      "./authorization": { PaymentControlError: ControlError }, "./diagnostic-policy": policy, "./consistency": consistency, "./investigation-engine": engine,
      "./transport-storage": { readTransportEvidence: async () => ({ storage: "NOT_COLLECTED", attempts: [], limited: false }) },
      "./capture": capture, "./diagnostic-adapters": diagnosticAdapters,
      "@/lib/eps-settings": { epsObject: value => value && typeof value === "object" && !Array.isArray(value) ? value : {} } });
    await t.test("actual Prisma reader executes read-only SQL and preserves financial fixture bytes", async () => {
      const before = JSON.stringify(await client.payment.findUnique({ where: { id: payment.id }, include: { order: true } }));
      const report = await reader.getPaymentInvestigation(payment.id);
      assert.equal(report.payment.traceId, policy.paymentTraceId(payment.id)); assert.equal(report.captureEvidence.availability, "AVAILABLE");
      assert.equal(JSON.stringify(await client.payment.findUnique({ where: { id: payment.id }, include: { order: true } })), before);
      assert.equal(report.events.length, 1);
    });
    await t.test("real database captured/unpaid mismatch is detected without repair", async () => {
      await client.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED" } });
      assert.equal((await reader.getPaymentInvestigation(payment.id)).checks.find(c => c.code === "PAYMENT_ORDER_CONSISTENCY").status, "FAIL");
      assert.equal((await client.order.findUnique({ where: { id: order.id } })).paymentStatus, "UNPAID");
      await client.payment.update({ where: { id: payment.id }, data: { status: "INITIATED" } });
    });
    const inventory = load("lib/inventory.ts", { "@/generated/prisma": generated,
      "@/lib/report-history": { captureVariantInventoryDailySnapshots: async () => {} } });
    const lifecycle = load("lib/order-inventory-lifecycle.ts", { "@/generated/prisma": generated, "@/lib/inventory": inventory });
    const aiblSettings = await import("../lib/aibl-wallet-settings.ts");
    const category = await client.category.create({ data: { name: "SYNTHETIC", slug: "diagnostic-fixture" } });
    async function stockedAttempt(provider, label, failNotification = false) {
      const product = await client.product.create({ data: { name: label, slug: label, categoryId: category.id, description: "SYNTHETIC", basePrice: "50", currency: "BDT", gallery: [] } });
      const variant = await client.productVariant.create({ data: { productId: product.id, sku: label, price: "50", currency: "BDT", stock: 4, options: {} } });
      const targetOrder = await client.order.create({ data: { name: "SYNTHETIC", phone_number: "00000000000", country: "Bangladesh", district: "FIXTURE", area: "FIXTURE",
        address_details: "FIXTURE", payment_method: `${provider}:17`, total: "100", shipping_cost: "0", grand_total: "100",
        orderItems: { create: { productId: product.id, variantId: variant.id, quantity: 2, price: "50", currency: "BDT" } } } });
      const holds = [];
      for (const suffix of ["A", "B"]) {
        const warehouse = await client.warehouse.create({ data: { name: label + suffix, code: label + suffix } });
        const level = await client.stockLevel.create({ data: { warehouseId: warehouse.id, productVariantId: variant.id, quantity: 3, reserved: 1 } });
        const hold = await client.inventoryReservation.create({ data: { orderId: targetOrder.id, stockLevelId: level.id, quantity: 1 } });
        holds.push([hold.id, level.id, variant.id, product.id, warehouse.id, 1]);
      }
      const bill = provider === "EPS" ? "97" + String(targetOrder.id).padStart(21, "0") : "AI" + String(Date.now()) + crypto.randomBytes(8).toString("hex");
      const env = { EPS_ENV: "sandbox", EPS_USERNAME: "OFFLINE_USER", EPS_PASSWORD: "OFFLINE_NOT_A_PASSWORD", EPS_HASH_KEY: "OFFLINE_NOT_A_KEY", EPS_MERCHANT_ID: "OFFLINE", EPS_STORE_ID: "OFFLINE",
        AIBL_WALLET_ENV: "uat", AIBL_WALLET_API_BASE_URL: "https://iwtest.aibl.com.bd/iwPGAPI/", AIBL_WALLET_HOSTED_BASE_URL: "https://iwtest.aibl.com.bd/iwepayuat/epayment/",
        AIBL_WALLET_API_USER: "OFFLINE", AIBL_WALLET_API_PASS: "OFFLINE_NOT_A_PASSWORD", AIBL_WALLET_MERCHANT_ID: "OFFLINE", AIBL_WALLET_ACCESS_KEY: "OFFLINE_NOT_A_KEY" };
      const adapters = { "@/generated/prisma": generated, "@/lib/prisma": { prisma: client }, "@/lib/inventory": inventory,
        "@/lib/order-inventory-lifecycle": lifecycle, "@/lib/order-admin-notifications": { createOrderAdminNotifications: async () => { if (failNotification) throw new Error("SYNTHETIC_POST_COMMIT_FAILURE"); } },
        "@/lib/business-network/commission": { syncCommissionEntriesForOrderStatus: async () => {} },
        "@/lib/seo-url": { resolveSeoSiteUrl: () => "https://fixture.example" }, "@/lib/eps-settings": { epsObject: value => value || {} },
        "@/lib/aibl-wallet-settings": aiblSettings,
        "@/lib/payment-control/telemetry": { recordPaymentEvent: async () => {}, paymentFetch: async (_context, operation) => new Response(JSON.stringify(
          operation === "AUTH" ? { token: "OFFLINE_TOKEN" } : provider === "EPS" ? { MerchantTransactionId: bill, TotalAmount: "100.00", Status: "Success" }
            : { code: 200, msg: "Order Verified", transactionID: label + "_TRANSACTION" }), { headers: { "Content-Type": "application/json" } }) },
      };
      const gateway = load(provider === "EPS" ? "lib/eps.ts" : "lib/aibl-wallet.ts", adapters, env);
      const fingerprint = provider === "EPS" ? gateway.epsConfig().accountFingerprint : gateway.aiblWalletConfig().accountFingerprint;
      const attempt = await client.payment.create({ data: { orderId: targetOrder.id, provider, externalId: bill, amount: "100", currency: "BDT", status: "INITIATED",
        paymentGatewayData: { gatewayId: 17, accountFingerprint: fingerprint, initializationValidated: true, bankOrderId: label + "_BANK_ORDER",
          inventorySnapshot: { variants: holds, bundles: [] }, inventoryMode: "RESERVATION" } } });
      const settle = () => provider === "EPS" ? gateway.reconcileEpsPayment(bill) : gateway.reconcileAiblWalletPayment(bill);
      return { attempt, targetOrder, variant, settle };
    }
    for (const provider of ["EPS", "AIBL_WALLET"]) await t.test(`${provider}: actual PostgreSQL settlement race commits two warehouse reservations exactly once with a mock gateway`, async () => {
      const fixture = await stockedAttempt(provider, provider.toLowerCase() + "_native_race");
      const results = await Promise.all([fixture.settle(), fixture.settle()]); assert.ok(results.every(r => r.status === "success"));
      assert.equal((await client.payment.findUnique({ where: { id: fixture.attempt.id } })).status, "CAPTURED");
      assert.equal((await client.order.findUnique({ where: { id: fixture.targetOrder.id } })).paymentStatus, "PAID");
      assert.equal(await client.inventoryReservation.count({ where: { orderId: fixture.targetOrder.id } }), 0);
      const levels = await client.stockLevel.findMany({ where: { productVariantId: fixture.variant.id } });
      assert.ok(levels.every(level => level.quantity === 2 && level.reserved === 0));
      const ledger = await client.inventoryLog.aggregate({ where: { orderId: fixture.targetOrder.id }, _sum: { change: true }, _count: { _all: true } });
      assert.equal(ledger._sum.change, -2); assert.equal(ledger._count._all, 2);
      const assessment = await reader.getPaymentInvestigation(fixture.attempt.id);
      assert.equal(assessment.checks.find(c => c.code === "INVENTORY_COMMIT_LEDGER").status, "PASS");
      assert.equal(assessment.checks.find(c => c.code === "MULTI_WAREHOUSE_STOCK_MISMATCH").status, "PASS");
    });
    await t.test("actual PostgreSQL post-commit exception rolls payment, order, warehouse stock and ledger back together", async () => {
      const fixture = await stockedAttempt("EPS", "eps_native_rollback", true);
      await assert.rejects(fixture.settle());
      assert.equal((await client.payment.findUnique({ where: { id: fixture.attempt.id } })).status, "INITIATED");
      assert.equal((await client.order.findUnique({ where: { id: fixture.targetOrder.id } })).paymentStatus, "UNPAID");
      assert.equal(await client.inventoryReservation.count({ where: { orderId: fixture.targetOrder.id } }), 2);
      assert.equal(await client.inventoryLog.count({ where: { orderId: fixture.targetOrder.id } }), 0);
      assert.ok((await client.stockLevel.findMany({ where: { productVariantId: fixture.variant.id } })).every(level => level.quantity === 3 && level.reserved === 1));
    });
    const saved = { ...process.env };
    Object.assign(process.env, { PAYMENT_DIAGNOSTICS_ENABLED: "true", PAYMENT_NETWORK_CAPTURE_ENABLED: "true", PAYMENT_DIAGNOSTICS_EVIDENCE_DIR: join(root, "evidence"),
      PAYMENT_CAPTURE_AGENT_ID: "isolated-diagnostic-agent", PAYMENT_CAPTURE_GATEWAY_IPS_JSON: '{"EPS":["8.8.8.8"]}' });
    try {
      await t.test("concurrent real advisory-lock claims return one running readiness job", async () => {
        await capture.requestCapture({ paymentId: payment.id, kind: "READINESS", operation: "AUTH" }, "diagnostic-staff");
        const claims = await Promise.all(Array.from({ length: 6 }, () => capture.claimCaptureJob("isolated-diagnostic-agent")));
        assert.equal(claims.filter(Boolean).length, 1);
        assert.equal(await client.paymentDiagnosticCapture.count({ where: { status: "RUNNING" } }), 1);
        assert.equal(await client.activityLog.count({ where: { action: "CAPTURE_REQUESTED" } }), 1);
      });
      await t.test("real readiness prerequisite and provider operation guards prevent capture dispatch", async () => {
        await client.paymentDiagnosticCapture.updateMany({ data: { status: "FAILED" } });
        await capture.requestCapture({ paymentId: payment.id, kind: "CAPTURE", operation: "INITIALIZE" }, "diagnostic-staff");
        assert.equal(await capture.claimCaptureJob("isolated-diagnostic-agent"), null);
        assert.equal(await client.paymentDiagnosticCapture.count({ where: { errorCode: "READINESS_REQUIRED" } }), 1);
        await assert.rejects(capture.requestCapture({ paymentId: payment.id, kind: "CAPTURE", operation: "VERIFY" }, "diagnostic-staff"), e => e.status === 400);
      });
      await t.test("database check constraints reject capture limits and checkout lookup index exists", async () => {
        const job = await client.paymentDiagnosticCapture.findFirst();
        await assert.rejects(client.$executeRaw`UPDATE "PaymentDiagnosticCapture" SET "seconds"=999 WHERE "id"=${job.id}`);
        const index = await client.$queryRaw`SELECT indexname FROM pg_indexes WHERE indexname='Order_checkoutIdempotency_key_idx'`;
        assert.equal(index.length, 1);
      });
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  } finally {
    await client?.$disconnect();
    let stopped = !initialized;
    if (initialized) {
      const status = await command(exe("pg_ctl"), ["-D", data, "status"], [0, 3]);
      if (status.code === 0) await command(exe("pg_ctl"), ["-D", data, "-w", "-t", "20", "-m", "fast", "stop"]);
      stopped = (await command(exe("pg_ctl"), ["-D", data, "status"], [0, 3])).code === 3;
    }
    const rel = relative(resolve(tmpdir()), resolve(root));
    assert.ok(stopped && rel && !rel.startsWith("..") && !isAbsolute(rel), "Only a stopped, test-owned cluster can be cleaned");
    await rm(root, { recursive: true, force: true });
  }
});
