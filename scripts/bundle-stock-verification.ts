import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";
import {
  cleanupExpiredInventoryReservations,
  commitOrderInventoryReservations,
  deductBundleInventory,
  deductPreassembledBundleInventory,
  deductVariantInventory,
  recordPreassembledBundleAssembly,
  reservePreassembledBundleInventory,
  restoreOrderInventory,
} from "../lib/inventory";
import { configurableBundleInclude, resolveBundleConfiguration } from "../lib/configurable-bundle";
import { transitionOrderStatusWithInventory } from "../lib/order-inventory-lifecycle";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ errorFormat: "minimal" });
const fixtureFile = ".next/bundle-stock-verification/fixtures.json";
const orderData = {
  name: "Bundle Verification", phone_number: "01000000000", country: "BD",
  district: "Dhaka", area: "Verification", address_details: "Isolated test database",
  payment_method: "CashOnDelivery", total: 500, shipping_cost: 0, grand_total: 500,
};

function requireIsolatedDatabase() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(process.env.ALLOW_BUNDLE_STOCK_VERIFICATION, "true");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/bundle_e2e_[a-z0-9_]+$/);
  assert.notEqual(process.env.NODE_ENV, "production");
  return target.pathname.slice(1);
}

async function setupFixtures() {
  const database = requireIsolatedDatabase();
  const password = randomBytes(24).toString("base64url");
  const fixtures = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: { name: "Bundle verification", slug: "bundle-verification" } });
    const warehouse = await tx.warehouse.create({ data: { name: "Bundle Test Warehouse A", code: "BUNDLE-TEST-A" } });
    const otherWarehouse = await tx.warehouse.create({ data: { name: "Bundle Test Warehouse B", code: "BUNDLE-TEST-B" } });
    await tx.shippingRate.create({ data: { country: "BD", district: "Dhaka", area: "Dhaka", baseCost: 60, priority: 0 } });
    const products = [];
    for (const [index, label] of ["shirt", "mug"].entries()) {
      const product = await tx.product.create({ data: {
        name: `Bundle verification ${label}`, slug: `bundle-verification-${label}`,
        sku: `BUNDLE-TEST-${label.toUpperCase()}`, type: "PHYSICAL", categoryId: category.id,
        description: "Isolated database fixture", basePrice: index ? 100 : 200,
        currency: "BDT", gallery: [],
        variants: { create: {
          sku: `BUNDLE-TEST-${label.toUpperCase()}-DEFAULT`, price: index ? 100 : 200,
          currency: "BDT", options: {}, isDefault: true, stock: index ? 104 : 110,
          stockLevels: { create: [
            { warehouseId: warehouse.id, quantity: index ? 4 : 10 },
            { warehouseId: otherWarehouse.id, quantity: 100 },
          ] },
        } },
      }, include: { variants: true } });
      products.push({ id: product.id, variantId: product.variants[0].id, label });
    }
    const role = await tx.role.upsert({ where: { name: "superadmin" }, update: {}, create: { name: "superadmin", label: "Super admin" } });
    const user = await tx.user.create({ data: {
      email: "bundle-stock-verification@example.invalid", name: "Bundle Verification Admin",
      passwordHash: await bcrypt.hash(password, 12), role: "admin",
      userRoles: { create: { roleId: role.id, scopeType: "GLOBAL" } },
    } });
    return { database, categoryId: category.id, warehouseId: warehouse.id,
      otherWarehouseId: otherWarehouse.id, products, userId: user.id, email: user.email, password };
  });
  mkdirSync(".next/bundle-stock-verification", { recursive: true });
  writeFileSync(fixtureFile, JSON.stringify(fixtures, null, 2));
  console.log("Isolated browser fixtures ready.", { database, categoryId: fixtures.categoryId, warehouseId: fixtures.warehouseId, products: fixtures.products });
}

async function databaseTests() {
  const database = requireIsolatedDatabase();
  const fixtures = JSON.parse(readFileSync(fixtureFile, "utf8"));
  assert.equal(fixtures.database, database);
  const marker = new Error("ROLLBACK_VERIFICATION_FIXTURES");
  const passed: string[] = [];
  await prisma.$transaction(async (tx) => {
    // The browser scenario deliberately changes component counts; normalize
    // only inside this rollback-only transaction so database tests are rerunnable.
    for (const [index, product] of fixtures.products.entries()) {
      await tx.stockLevel.updateMany({
        where: { warehouseId: fixtures.warehouseId, productVariantId: product.variantId },
        data: { quantity: index ? 4 : 10, reserved: 0 },
      });
    }
    const groups = fixtures.products.map((product: { id: number; variantId: number }, index: number) => ({
      name: `Component ${index + 1}`, sortOrder: index, selectionType: "FIXED" as const,
      defaultQuantity: index ? 1 : 2, minQuantity: index ? 1 : 2, maxQuantity: index ? 1 : 2,
      options: { create: { productId: product.id, variantId: product.variantId, isDefault: true } },
    }));
    const bundle = await tx.product.create({ data: {
      name: "Transaction bundle test", slug: "transaction-bundle-test", sku: "TRANSACTION-BUNDLE-TEST",
      type: "BUNDLE", categoryId: fixtures.categoryId, description: "Rolled back verification",
      basePrice: 500, currency: "BDT", gallery: [], bundleWarehouseId: fixtures.warehouseId,
      bundleFulfillmentMode: "PREASSEMBLED", bundleGroups: { create: groups },
    } });
    const stock = async () => tx.bundleStockLevel.findUniqueOrThrow({ where: {
      productId_warehouseId: { productId: bundle.id, warehouseId: fixtures.warehouseId },
    } });
    const order = async () => tx.order.create({ data: { ...orderData, fulfillmentWarehouseId: fixtures.warehouseId,
      orderItems: { create: { productId: bundle.id, quantity: 1, price: 500 } },
    } });
    const loaded = await tx.product.findUniqueOrThrow({ where: { id: bundle.id }, include: configurableBundleInclude });
    assert.equal(resolveBundleConfiguration({ bundle: loaded, strictWarehouseStock: true }).availableQuantity, 0);
    const componentCapacity = resolveBundleConfiguration({ bundle: { ...loaded, bundleFulfillmentMode: "VIRTUAL" }, strictWarehouseStock: true }).availableQuantity;
    assert.equal(componentCapacity, 4);
    passed.push("Unassembled bundle unavailable; assembly capacity uses only selected warehouse");
    for (const [index, product] of fixtures.products.entries()) {
      await deductVariantInventory({ tx, productId: product.id, productVariantId: product.variantId,
        warehouseId: fixtures.warehouseId, quantity: index ? 3 : 6, reason: "Verification assembly" });
    }
    await recordPreassembledBundleAssembly({ tx, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 3, reason: "Verification" });
    assert.equal((await stock()).quantity, 3);
    const levels = await tx.stockLevel.findMany({ where: { productVariantId: { in: fixtures.products.map((p: {variantId: number}) => p.variantId) } } });
    assert.deepEqual(levels.filter((level) => level.warehouseId === fixtures.warehouseId).map((level) => level.quantity).sort((a,b) => a-b), [1, 4]);
    assert.ok(levels.filter((level) => level.warehouseId === fixtures.otherWarehouseId).every((level) => level.quantity === 100));
    passed.push("Assembly consumes 6 shirts/3 mugs, adds 3 finished bundles, preserves other warehouse");
    const sale = await order();
    await deductPreassembledBundleInventory({ tx, orderId: sale.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 2, reason: "Verification COD sale" });
    assert.equal((await stock()).quantity, 1);
    await transitionOrderStatusWithInventory({ tx, orderId: sale.id, nextStatus: "CANCELLED", reason: "Verification cancellation" });
    const repeat = await transitionOrderStatusWithInventory({ tx, orderId: sale.id, nextStatus: "CANCELLED", reason: "Verification retry" });
    assert.equal((await stock()).quantity, 3);
    assert.equal(repeat.inventory.restoredPreassembledBundleQuantity, 0);
    assert.equal(await tx.inventoryLog.count({ where: { orderId: sale.id, variantId: { not: null } } }), 0);
    passed.push("COD sale deducts finished stock; cancellation restores once, without component rededuction");
    await tx.product.update({ where: { id: bundle.id }, data: { bundleStockLimit: 5 } });
    const capped = await order();
    await deductBundleInventory({ tx, orderId: capped.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 1, reason: "Verification cap" });
    await deductPreassembledBundleInventory({ tx, orderId: capped.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 1, reason: "Verification capped sale" });
    await tx.product.update({ where: { id: bundle.id }, data: { bundleStockLimit: null } });
    await restoreOrderInventory({ tx, orderId: capped.id, reason: "Cap removed before cancellation" });
    assert.equal((await stock()).quantity, 3);
    assert.equal((await tx.product.findUniqueOrThrow({ where: { id: bundle.id } })).bundleStockLimit, null);
    passed.push("Clearing sale cap does not block restoration or recreate the removed cap");
    const payment = await order();
    await reservePreassembledBundleInventory({ tx, orderId: payment.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 2, reason: "SSL reservation" });
    assert.deepEqual([(await stock()).quantity, (await stock()).reserved], [3, 2]);
    await assert.rejects(deductPreassembledBundleInventory({ tx, orderId: payment.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 2, reason: "Oversell attempt" }), /stock changed/);
    const capture = await commitOrderInventoryReservations({ tx, orderId: payment.id, reason: "SSL capture" });
    assert.equal(capture.committedBundleQuantity, 2);
    assert.deepEqual([(await stock()).quantity, (await stock()).reserved], [1, 0]);
    assert.equal((await commitOrderInventoryReservations({ tx, orderId: payment.id, reason: "Capture retry" })).committedBundleQuantity, 0);
    await transitionOrderStatusWithInventory({ tx, orderId: payment.id, nextStatus: "RETURNED", reason: "Verification return" });
    assert.equal((await stock()).quantity, 3);
    passed.push("SSL reserve/capture respects held stock; capture retry and returned-stock restoration are safe");
    const failedPayment = await order();
    await reservePreassembledBundleInventory({ tx, orderId: failedPayment.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 2, reason: "Failed SSL payment" });
    await transitionOrderStatusWithInventory({ tx, orderId: failedPayment.id, nextStatus: "FAILED", reason: "Failed payment release" });
    assert.deepEqual([(await stock()).quantity, (await stock()).reserved], [3, 0]);
    passed.push("Failed payment releases reservation without adding stock twice");
    const expired = await order();
    await reservePreassembledBundleInventory({ tx, orderId: expired.id, bundleId: bundle.id, warehouseId: fixtures.warehouseId, quantity: 1, reason: "Expired SSL payment", expiresAt: new Date(Date.now() - 60000) });
    const expiredResult = await cleanupExpiredInventoryReservations({ tx });
    assert.equal(expiredResult.releasedOrders, 1);
    assert.equal((await tx.order.findUniqueOrThrow({ where: { id: expired.id } })).status, "FAILED");
    assert.deepEqual([(await stock()).quantity, (await stock()).reserved], [3, 0]);
    assert.equal((await cleanupExpiredInventoryReservations({ tx })).releasedOrders, 0);
    passed.push("Expired SSL hold releases stock and fails the unpaid order exactly once");
    throw marker;
  }, { timeout: 60000 }).catch((error) => { if (error !== marker) throw error; });
  assert.equal(await prisma.product.count({ where: { slug: "transaction-bundle-test" } }), 0);
  for (const result of passed) console.log(`PASS: ${result}`);
  console.log(`Database integration verification: ${passed.length} scenarios passed; transaction fixtures rolled back.`);
}

async function snapshot() {
  const database = requireIsolatedDatabase();
  const fixtures = JSON.parse(readFileSync(fixtureFile, "utf8"));
  assert.equal(fixtures.database, database);
  const bundles = await prisma.product.findMany({ where: { type: "BUNDLE", categoryId: fixtures.categoryId }, include: configurableBundleInclude });
  console.log(JSON.stringify({ database,
    components: await prisma.stockLevel.findMany({ where: { productVariantId: { in: fixtures.products.map((product: {variantId: number}) => product.variantId) } }, select: { warehouseId: true, productVariantId: true, quantity: true, reserved: true } }),
    bundles: bundles.map((bundle) => ({ id: bundle.id, name: bundle.name, slug: bundle.slug,
      mode: bundle.bundleFulfillmentMode, cap: bundle.bundleStockLimit, stock: bundle.assembledStockLevels,
      available: resolveBundleConfiguration({ bundle, strictWarehouseStock: true }).availableQuantity })),
    orders: await prisma.order.findMany({ where: { name: orderData.name }, select: { id: true, status: true, fulfillmentWarehouseId: true } }),
  }, null, 2));
}

async function main() {
  switch (process.argv[2]) {
    case "setup": await setupFixtures(); break;
    case "db": await databaseTests(); break;
    case "snapshot": await snapshot(); break;
    default: throw new Error("Use setup, db, or snapshot.");
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
