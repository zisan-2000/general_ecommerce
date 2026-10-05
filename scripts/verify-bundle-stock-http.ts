import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient({ errorFormat: "minimal" });
const fixtures = JSON.parse(readFileSync(".next/bundle-stock-verification/fixtures.json", "utf8"));
const base = process.env.BUNDLE_VERIFICATION_BASE_URL ?? "http://localhost:3000";
const cookies = new Map<string, string>();

async function request(path: string, method = "GET", body?: unknown, authenticated = true) {
  const response = await fetch(`${base}${path}`, {
    method, redirect: "manual",
    headers: {
      ...(authenticated ? { Cookie: Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ") } : {}),
      ...(body ? { "Content-Type": body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json" } : {}),
    },
    body: body ? body instanceof URLSearchParams ? body.toString() : JSON.stringify(body) : undefined,
  });
  if (authenticated) for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

function editPayload(bundle: Record<string, any>) {
  return {
    name: bundle.name, sku: bundle.sku, description: bundle.description, categoryId: bundle.categoryId,
    bundleWarehouseId: bundle.bundleWarehouseId, bundleFulfillmentMode: bundle.bundleFulfillmentMode,
    bundleStockLimit: bundle.bundleStockLimit, currency: bundle.currency, available: true,
    discountType: "MANUAL", manualPrice: Number(bundle.basePrice),
    groups: bundle.bundleGroups.map((group: Record<string, any>) => ({
      name: group.name, sortOrder: group.sortOrder, selectionType: group.selectionType,
      pricingMode: group.pricingMode, required: group.required, minSelect: group.minSelect, maxSelect: group.maxSelect,
      defaultQuantity: group.defaultQuantity, minQuantity: group.minQuantity, maxQuantity: group.maxQuantity,
      allowQuantityChange: group.allowQuantityChange,
      options: group.options.map((option: Record<string, any>) => ({ productId: option.productId,
        variantId: option.variantId, isDefault: option.isDefault, priceAdjustment: Number(option.priceAdjustment) })),
    })),
  };
}

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(process.env.ALLOW_BUNDLE_STOCK_VERIFICATION, "true");
  assert.equal(target.pathname, `/${fixtures.database}`);
  assert.match(target.pathname, /^\/bundle_e2e_[a-z0-9_]+$/);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const csrf = await request("/api/auth/csrf");
  const login = await request("/api/auth/callback/credentials", "POST", new URLSearchParams({
    csrfToken: csrf.data.csrfToken, email: fixtures.email, password: fixtures.password,
    callbackUrl: base, json: "true",
  }));
  assert.equal(login.status, 200, JSON.stringify(login.data));
  const session = await request("/api/auth/session");
  assert.equal(session.data.user.id, fixtures.userId);
  const warehouses = await request("/api/admin/products/bundles/warehouses");
  assert.equal(warehouses.status, 200);
  assert.ok(warehouses.data.warehouses.some((row: { id: number }) => row.id === fixtures.warehouseId));
  console.log("PASS: Authenticated warehouse endpoint exposes the selected fulfillment warehouse");
  const bundle = await prisma.product.findUniqueOrThrow({ where: { slug: "bundle-verification" }, include: { bundleGroups: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } } } });
  const root = `/api/admin/products/bundles/${bundle.id}`;
  const order = await prisma.order.findFirst({
    where: { orderItems: { some: { productId: bundle.id } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, fulfillmentWarehouseId: true },
  });
  assert.ok(order, "The storefront checkout must create a bundle order before HTTP verification");
  assert.equal(order.fulfillmentWarehouseId, fixtures.warehouseId);
  const fulfillment = await request(`/api/orders/${order.id}/warehouse-stock`);
  assert.equal(fulfillment.status, 200, JSON.stringify(fulfillment.data));
  const selectedWarehouse = fulfillment.data.warehouses.find((row: { warehouseId: number }) => row.warehouseId === fixtures.warehouseId);
  assert.ok(selectedWarehouse?.canFulfill, "The order's assigned warehouse must expose its already allocated finished bundle stock");
  assert.ok(selectedWarehouse.availableUnits >= fulfillment.data.requiredUnits);
  assert.ok(fulfillment.data.warehouses.filter((row: { warehouseId: number }) => row.warehouseId !== fixtures.warehouseId).every((row: { canFulfill: boolean }) => !row.canFulfill),
    "A preassembled order must remain bound to its saved fulfillment warehouse");
  console.log("PASS: Shipment warehouse availability matches the preassembled order's saved warehouse and stock allocation");
  const before = await prisma.stockLevel.findMany({ where: { warehouseId: fixtures.warehouseId,
    productVariantId: { in: fixtures.products.map((product: {variantId: number}) => product.variantId) } }, orderBy: { id: "asc" } });
  const unavailableAssembly = await request(`${root}/assembly`, "POST", { quantity: 2 });
  assert.equal(unavailableAssembly.status, 400);
  assert.match(unavailableAssembly.data.error, /Insufficient component stock/);
  const after = await prisma.stockLevel.findMany({ where: { id: { in: before.map((row) => row.id) } }, orderBy: { id: "asc" } });
  assert.deepEqual(after, before);
  assert.equal((await request(`${root}/assembly`, "POST", { quantity: 1 }, false)).status, 401);
  assert.equal((await request(`${root}/adjustment`, "POST", { quantity: 1, reason: "" })).status, 400);
  console.log("PASS: Insufficient assembly rolls back; unauthenticated access and reasonless adjustment rejected");
  const payload = editPayload(bundle);
  const edit = await request(root, "PUT", { ...payload, bundleStockLimit: 5 });
  assert.equal(edit.status, 200, `Sale-cap-only edit with finished stock failed: ${JSON.stringify(edit.data)}`);
  const groupsAfter = await prisma.bundleGroup.findMany({ where: { bundleId: bundle.id }, orderBy: { sortOrder: "asc" } });
  assert.deepEqual(groupsAfter.map((group) => group.id), bundle.bundleGroups.map((group) => group.id));
  const clear = await request(root, "PUT", { ...payload, bundleStockLimit: null });
  assert.equal(clear.status, 200, JSON.stringify(clear.data));
  const blocked = await request(root, "PUT", { ...payload, groups: payload.groups.map((group: Record<string, any>, index: number) => index ? group : { ...group, defaultQuantity: 3, minQuantity: 3, maxQuantity: 3 }) });
  assert.equal(blocked.status, 400);
  console.log("PASS: Sale cap edits preserve group/cart identifiers; composition edits with finished stock rejected");
  console.log("HTTP bundle boundary verification passed.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
