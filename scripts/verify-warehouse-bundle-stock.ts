// Mutating verification is deliberately restricted to an isolated local database.
import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";
import { deductVariantInventory, recordPreassembledBundleAssembly, reservePreassembledBundleInventory } from "../lib/inventory";

loadEnvConfig(process.cwd());
const target = new URL(process.env.DATABASE_URL!);
assert.equal(process.env.ALLOW_BUNDLE_STOCK_VERIFICATION, "true");
assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
assert.match(target.pathname, /^\/bundle_e2e_[a-z0-9_]+$/);
assert.notEqual(process.env.NODE_ENV, "production");
const prisma = new PrismaClient();
const fixturePath = ".next/warehouse-bundle-verification/fixtures.json";
const base = "http://localhost:3001";

async function setup() {
  const marker = `warehouse-bundle-verification-${Date.now()}`;
  const password = randomBytes(24).toString("base64url");
  const fixtures = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { name: "Warehouse bundle verification", slug: marker } });
    const warehouses = await Promise.all(["A", "B"].map((label) => tx.warehouse.create({
      data: { name: `Warehouse bundle verification ${label}`, code: `${marker}-${label}` },
    })));
    const permission = await tx.permission.upsert({ where: { key: "inventory.manage" }, update: {}, create: { key: "inventory.manage" } });
    const panelPermission = await tx.permission.upsert({ where: { key: "admin.panel.access" }, update: {}, create: { key: "admin.panel.access" } });
    const scopedRole = await tx.role.create({ data: { name: marker, label: "Verification inventory staff",
      rolePermissions: { create: [permission, panelPermission].map((entry) => ({ permissionId: entry.id })) },
    } });
    const superRole = await tx.role.findUniqueOrThrow({ where: { name: "superadmin" } });
    const users = await Promise.all([superRole, scopedRole, null].map((role, index) => tx.user.create({ data: {
      name: "Warehouse verification", email: `${marker}-${index}@example.invalid`, role: index === 2 ? "user" : "admin",
      passwordHash: bcrypt.hashSync(password, 10),
      ...(role ? { userRoles: { create: { roleId: role.id, scopeType: index ? "WAREHOUSE" : "GLOBAL",
        ...(index ? { warehouseId: warehouses[0].id } : {}) } } } : {}),
    } })));
    const products = await Promise.all(["shirt", "mug"].map((label, index) => tx.product.create({ data: {
      name: `Warehouse verification ${label}`, slug: `${marker}-${label}`, sku: `${marker}-${label}`, type: "PHYSICAL",
      categoryId: category.id, description: "Isolated verification fixture", basePrice: 100, currency: "BDT", gallery: [],
      variants: { create: { sku: `${marker}-${label}-default`, price: 100, currency: "BDT", options: {}, isDefault: true,
        stock: index ? 104 : 110, stockLevels: { create: warehouses.map((warehouse, warehouseIndex) => ({
          warehouseId: warehouse.id, quantity: warehouseIndex ? 100 : index ? 4 : 10,
        })) } } },
    }, include: { variants: true } })));
    const bundles = await Promise.all(["PREASSEMBLED", "VIRTUAL"].map((mode) => tx.product.create({ data: {
      name: `Warehouse verification ${mode}`, slug: `${marker}-${mode.toLowerCase()}`, sku: `${marker}-${mode}`,
      type: "BUNDLE", categoryId: category.id, description: "Isolated verification fixture", basePrice: 250,
      currency: "BDT", gallery: [], bundleFulfillmentMode: mode as "PREASSEMBLED" | "VIRTUAL",
      bundleWarehouseId: warehouses[0].id, bundleStockLimit: mode === "PREASSEMBLED" ? 2 : null,
      bundleGroups: { create: products.map((product, index) => ({ name: product.name, selectionType: "FIXED",
        pricingMode: "AUTOMATIC", required: true, sortOrder: index,
        defaultQuantity: index ? 1 : 2, minQuantity: index ? 1 : 2, maxQuantity: index ? 1 : 2,
        options: { create: { productId: product.id, variantId: product.variants[0].id, isDefault: true } },
      })) },
    } })));
    for (const [index, product] of products.entries()) await deductVariantInventory({ tx, productId: product.id,
      productVariantId: product.variants[0].id, warehouseId: warehouses[0].id, quantity: index ? 3 : 6, reason: marker });
    await recordPreassembledBundleAssembly({ tx, bundleId: bundles[0].id, warehouseId: warehouses[0].id, quantity: 3, reason: marker });
    const order = await tx.order.create({ data: { name: marker, phone_number: "01000000000", country: "BD", district: "Dhaka",
      area: "Test", address_details: "Isolated fixture", payment_method: "SSLCommerz", total: 250,
      shipping_cost: 0, grand_total: 250, fulfillmentWarehouseId: warehouses[0].id } });
    await reservePreassembledBundleInventory({ tx, bundleId: bundles[0].id, warehouseId: warehouses[0].id,
      orderId: order.id, quantity: 1, reason: marker, expiresAt: new Date(Date.now() + 3600000) });
    return { database: target.pathname.slice(1), marker, password, users: users.map(({ id, email }) => ({ id, email })),
      warehouseIds: warehouses.map((row) => row.id), bundleIds: bundles.map((row) => row.id),
      variantIds: products.map((row) => row.variants[0].id), orderId: order.id };
  }, { timeout: 60000 });
  mkdirSync(".next/warehouse-bundle-verification", { recursive: true });
  writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));
  console.log("Isolated warehouse fixtures ready", { database: fixtures.database, bundles: fixtures.bundleIds, warehouses: fixtures.warehouseIds });
}

function fixture() {
  const value = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(value.database, target.pathname.slice(1));
  return value;
}

async function http() {
  const fixtures = fixture();
  const cookies = new Map<string, string>();
  async function request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`${base}${path}`, { method, redirect: "manual", headers: {
      Cookie: Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; "),
      ...(body ? { "Content-Type": body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json" } : {}),
    }, body: body ? body instanceof URLSearchParams ? body.toString() : JSON.stringify(body) : undefined });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"); const separator = pair.indexOf("=");
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return { status: response.status, data: await response.json().catch(() => null), cache: response.headers.get("cache-control") };
  }
  async function login(index: number) {
    cookies.clear();
    const csrf = await request("/api/auth/csrf");
    await request("/api/auth/callback/credentials", "POST", new URLSearchParams({ csrfToken: csrf.data.csrfToken,
      email: fixtures.users[index].email, password: fixtures.password, callbackUrl: base, json: "true" }));
    assert.equal((await request("/api/auth/session")).data.user.id, fixtures.users[index].id);
  }
  const root = "/api/admin/warehouse/bundle-stock";
  assert.equal((await request(root)).status, 401);
  await login(2);
  assert.equal((await request(root)).status, 403);
  console.log("PASS: Anonymous and non-inventory users are rejected");
  await login(1);
  const scoped = await request(`${root}?search=${fixtures.marker}`);
  assert.equal(scoped.status, 200, JSON.stringify(scoped.data));
  assert.equal(scoped.data.rows.length, 2);
  assert.ok(scoped.data.rows.every((row: { warehouse: { id: number } }) => row.warehouse.id === fixtures.warehouseIds[0]));
  assert.deepEqual(scoped.data.warehouses.map((row: { id: number }) => row.id), [fixtures.warehouseIds[0]]);
  assert.equal((await request(`${root}?warehouseId=${fixtures.warehouseIds[1]}`)).status, 403);
  assert.equal((await request(`${root}?bundleId=${fixtures.bundleIds[0]}&warehouseId=${fixtures.warehouseIds[1]}`)).status, 403);
  console.log("PASS: Warehouse-scoped staff cannot read another warehouse or its history");
  await login(0);
  const list = await request(`${root}?search=${fixtures.marker}`);
  assert.match(list.cache!, /private, no-store/);
  const physical = list.data.rows.find((row: { bundleId: number }) => row.bundleId === fixtures.bundleIds[0]);
  const virtual = list.data.rows.find((row: { bundleId: number }) => row.bundleId === fixtures.bundleIds[1]);
  const stored = await prisma.bundleStockLevel.findUniqueOrThrow({ where: {
    productId_warehouseId: { productId: fixtures.bundleIds[0], warehouseId: fixtures.warehouseIds[0] },
  } });
  const componentStock = await prisma.stockLevel.findMany({ where: {
    warehouseId: fixtures.warehouseIds[0], productVariantId: { in: fixtures.variantIds },
  } });
  const componentAvailable = fixtures.variantIds.map((id: number) => {
    const level = componentStock.find((entry) => entry.productVariantId === id)!;
    return Math.max(0, level.quantity - level.reserved);
  });
  const componentCapacity = Math.min(Math.floor(componentAvailable[0] / 2), componentAvailable[1]);
  const available = Math.max(0, stored.quantity - stored.reserved);
  assert.deepEqual([physical.quantity, physical.reserved, physical.available, physical.saleLimit, physical.orderAvailability],
    [stored.quantity, stored.reserved, available, 2, Math.min(available, 2)]);
  assert.deepEqual([virtual.quantity, virtual.componentCapacity, virtual.orderAvailability], [null, componentCapacity, componentCapacity]);
  const detail = await request(`${root}?bundleId=${fixtures.bundleIds[0]}&warehouseId=${fixtures.warehouseIds[0]}`);
  assert.equal(detail.data.reservations[0].quantity, 1);
  assert.ok(detail.data.logs.some((row: { kind: string }) => row.kind === "finished"));
  assert.deepEqual(detail.data.components.map((row: { available: number }) => row.available), componentAvailable);
  assert.equal((await request(`${root}?page=NaN`)).status, 400);
  assert.equal((await request(`${root}?page=9007199254740991`)).status, 400);
  assert.equal((await request(`${root}?warehouseId=-1`)).status, 400);
  assert.equal((await request(`${root}?bundleId=${fixtures.bundleIds[0]}`)).status, 400);
  const noMatch = await request(`${root}?search=${fixtures.marker}&warehouseId=${fixtures.warehouseIds[1]}`);
  assert.equal(noMatch.data.rows.length, 0);
  assert.ok(noMatch.data.warehouses.some((row: { id: number }) => row.id === fixtures.warehouseIds[0]));
  for (const action of ["assembly", "adjustment"]) {
    const rejected = await request(`/api/admin/products/bundles/${fixtures.bundleIds[0]}/${action}`, "POST",
      { warehouseId: fixtures.warehouseIds[1], quantity: 1, reason: "wrong warehouse test" });
    assert.equal(rejected.status, 400);
    assert.match(rejected.data.error, /warehouse changed/);
  }
  const reservedProtection = await request(`/api/admin/products/bundles/${fixtures.bundleIds[0]}/adjustment`, "POST",
    { warehouseId: fixtures.warehouseIds[0], quantity: available + 1, reason: "reserved protection test" });
  assert.equal(reservedProtection.status, 400);
  assert.match(reservedProtection.data.error, /unreserved/);
  console.log("PASS: DB balances, virtual capacity, reservation/history, filters, validation and stale-warehouse/reserved-stock guards");
  const deletion = await request(`/api/admin/products/bundles/${fixtures.bundleIds[0]}`, "DELETE");
  assert.equal(deletion.status, 400);
  assert.match(deletion.data.error, /finished bundle stock and reservations/);
  // Simulate an archived bundle left by older versions, in this isolated fixture only.
  await prisma.product.update({ where: { id: fixtures.bundleIds[0] }, data: { deleted: true, available: false } });
  const archived = await request(`${root}?bundleId=${fixtures.bundleIds[0]}&warehouseId=${fixtures.warehouseIds[0]}`);
  assert.equal(archived.status, 200);
  assert.equal(archived.data.row.archived, true);
  assert.equal(archived.data.row.quantity, stored.quantity);
  assert.equal(archived.data.row.orderAvailability, 0);
  assert.equal(archived.data.row.componentCapacity, null);
  const archivedList = await request(`${root}?search=${fixtures.marker}`);
  assert.ok(archivedList.data.rows.some((row: { bundleId: number; archived: boolean }) => row.bundleId === fixtures.bundleIds[0] && row.archived));
  const forbiddenAssembly = await request(`/api/admin/products/bundles/${fixtures.bundleIds[0]}/assembly`, "POST",
    { warehouseId: fixtures.warehouseIds[0], quantity: 1 });
  assert.equal(forbiddenAssembly.status, 404);
  const out = await request(`/api/admin/products/bundles/${fixtures.bundleIds[0]}/adjustment`, "POST",
    { warehouseId: fixtures.warehouseIds[0], quantity: 1, reason: "Archived fixture stock-out verification" });
  assert.equal(out.status, 200, JSON.stringify(out.data));
  assert.deepEqual([out.data.stock.quantity, out.data.stock.reserved], [stored.quantity - 1, stored.reserved]);
  console.log("PASS: Stock-bearing deletion blocked; archived stock remains visible, forbids assembly and permits audited unreserved stock-out");
}

async function serve() {
  process.env.WAREHOUSE_BUNDLE_VERIFY = "true";
  process.env.NEXTAUTH_URL = base;
  const { default: next } = await import("next");
  const { default: config } = await import("../next.config");
  const app = next({ dev: true, dir: process.cwd(), hostname: "localhost", port: 3001, webpack: true,
    conf: { ...config, distDir: ".next/warehouse-bundle-verification-build", typescript: { ...config.typescript,
      tsconfigPath: "tsconfig.warehouse-verification.json" } } });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  server.listen(3001, "localhost", () => console.log(`Warehouse verification server: ${base} (isolated DB only)`));
  process.on("SIGINT", () => { server.close(); void app.close().finally(() => process.exit()); });
}

async function snapshot() {
  const fixtures = fixture();
  const state = {
    stock: await prisma.bundleStockLevel.findMany({ where: { productId: { in: fixtures.bundleIds } }, select: { productId: true, warehouseId: true, quantity: true, reserved: true } }),
    components: await prisma.stockLevel.findMany({ where: { productVariantId: { in: fixtures.variantIds } }, select: { warehouseId: true, productVariantId: true, quantity: true, reserved: true } }),
  };
  const phase = process.argv[3];
  if (phase === "assembled" || phase === "adjusted") {
    assert.deepEqual([state.stock[0].quantity, state.stock[0].reserved], [phase === "assembled" ? 4 : 3, 1]);
    for (const [index, variantId] of fixtures.variantIds.entries()) {
      assert.equal(state.components.find((row) => row.productVariantId === variantId && row.warehouseId === fixtures.warehouseIds[0])?.quantity, index ? 0 : 2);
      assert.equal(state.components.find((row) => row.productVariantId === variantId && row.warehouseId === fixtures.warehouseIds[1])?.quantity, 100);
    }
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: fixtures.bundleIds[0] }, select: { bundleStockLimit: true } })).bundleStockLimit, 2);
    console.log(`PASS: Browser ${phase} movement matches DB; reserved stock, sale cap and other warehouse are unchanged`);
  }
  console.log(JSON.stringify(state, null, 2));
}

async function secure() {
  const fixtures = fixture();
  await prisma.user.updateMany({ where: { id: { in: fixtures.users.map((user: { id: string }) => user.id) } },
    data: { banned: true, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12) } });
  delete fixtures.password;
  writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));
  console.log("Verification accounts disabled; temporary plaintext credentials removed. Test data remains only in the isolated database.");
}

async function main() {
  switch (process.argv[2]) {
    case "setup": await setup(); break;
    case "http": await http(); break;
    case "serve": await serve(); break;
    case "snapshot": await snapshot(); break;
    case "secure": await secure(); break;
    default: throw new Error("Use setup, serve, http, snapshot or secure");
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
