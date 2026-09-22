import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const proxySource = await readFile(
  new URL("../proxy.ts", import.meta.url),
  "utf8",
);
const proxyCompiled = ts.transpileModule(
  proxySource
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
    .replace("export default async function", "async function")
    .replace("export const config", "const config"),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  },
).outputText;

async function requestThroughProxy(
  path,
  method = "GET",
  user = { role: "admin", permissions: [] },
) {
  const context = vm.createContext({
    URL,
    console,
    NextResponse: {
      next: () => ({ status: 200 }),
      json: (body, options) => ({ body, status: options.status }),
    },
    fetch: async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ user }),
    }),
    getDashboardRoute: () => "/ecommerce/user",
    hasDeliveryDashboardAccess: () => false,
    hasInvestorPortalAccess: () => false,
    hasSupplierPortalAccess: () => false,
    isAdminDeliveryRoute: () => false,
    isDeliveryAdminShellRoute: () => false,
    isLegacyDeliveryDashboardRoute: () => false,
  });
  vm.runInContext(proxyCompiled, context);
  const url = new URL(path, "http://localhost");
  return context.proxy({
    url: url.href,
    nextUrl: url,
    method,
    headers: { get: () => "" },
  });
}

test("proxy permits authenticated own history but preserves admin and detail permissions", async () => {
  assert.equal(
    (await requestThroughProxy("/api/orders?scope=own&limit=50")).status,
    200,
  );
  assert.equal(
    (await requestThroughProxy("/api/orders?scope=own", "GET", null)).status,
    401,
  );
  assert.equal((await requestThroughProxy("/api/orders?limit=50")).status, 403);
  assert.equal(
    (await requestThroughProxy("/api/orders/123?scope=own")).status,
    200,
  );
  assert.equal(
    (await requestThroughProxy("/api/orders/123?scope=own", "PATCH")).status,
    403,
  );
});

const source = await readFile(
  new URL("../app/api/orders/route-core.ts", import.meta.url),
  "utf8",
);
const handler = source.slice(
  source.indexOf("export async function GET("),
  source.indexOf("export async function POST("),
);
const compiled = ts.transpileModule(handler.replace("export async", "async"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

async function requestOrders(query, user, permissions = []) {
  const queries = [];
  const access = {
    has: (key) => permissions.includes(key),
    hasGlobal: (key) => permissions.includes(key),
  };
  const context = vm.createContext({
    URL,
    console,
    authOptions: {},
    getServerSession: async () => (user ? { user } : null),
    getAccessContext: async () => access,
    NextResponse: {
      json: (body, options) => ({ body, status: options?.status ?? 200 }),
    },
    prisma: {
      order: {
        findMany: async (query) => {
          queries.push(query);
          return [{ id: 1 }];
        },
        count: async () => 1,
      },
    },
    orderProductSelect: {},
    orderVariantSelect: {},
    orderUserSelect: {},
    redactCustomerOrder: (order) => ({ ...order, redacted: true }),
  });
  vm.runInContext(compiled, context);
  const response = await context.GET({
    url: `http://localhost/api/orders?${query}`,
  });
  return { response, queries };
}

test("staff without order permissions can read only their own customer history", async () => {
  const { response, queries } = await requestOrders(
    "scope=own&limit=50&userId=someone-else",
    { id: "shopper", role: "admin" },
  );
  assert.equal(response.status, 200);
  assert.equal(queries[0].where.userId, "shopper");
  assert.equal(response.body.orders[0].redacted, true);
});

test("own history stays scoped and redacted even for global order administrators", async () => {
  const { response, queries } = await requestOrders(
    "scope=own",
    { id: "admin" },
    ["orders.read_all"],
  );
  assert.equal(queries[0].where.userId, "admin");
  assert.equal(response.body.orders[0].redacted, true);
});

test("back-office listing still requires order permissions", async () => {
  const { response, queries } = await requestOrders("limit=50", {
    id: "shopper",
    role: "admin",
  });
  assert.equal(response.status, 403);
  assert.equal(queries.length, 0);
});

test("missing session identity cannot request unscoped customer orders", async () => {
  for (const user of [null, { name: "No ID" }]) {
    const { response, queries } = await requestOrders("scope=own", user);
    assert.equal(response.status, 401);
    assert.equal(queries.length, 0);
  }
});
