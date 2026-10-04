import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { policyKinds } from "../lib/policy-content";

const base = "http://localhost:3000";
const marker = "policy-verification-";
const manifest = join(tmpdir(), "general-ecommerce-policy-test.json");
const stateFile = join(tmpdir(), "general-ecommerce-policy-browser.json");

async function cleanup(userId: string, roleId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  assert.ok(user?.email.startsWith(marker) && role?.name === "superadmin", "Only delete this script's test user");
  await prisma.activityLog.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    const ids = JSON.parse(await readFile(manifest, "utf8"));
    await cleanup(ids.userId, ids.roleId);
    await Promise.all([unlink(manifest), unlink(stateFile)]);
    console.log("Temporary policy verification account and browser state removed.");
    return;
  }
  const token = randomUUID();
  const password = randomUUID();
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "superadmin" } });
  const user = await prisma.user.create({ data: { email: `${marker}${token}@example.invalid`, name: "Policy verification", role: "staff", passwordHash: await bcrypt.hash(password, 10), userRoles: { create: { roleId: role.id } } } });
  const createdIds: string[] = [];
  const jar = new Map<string, string>();
  let retain = false;
  try {
    async function request(path: string, init: RequestInit = {}) {
      const response = await fetch(base + path, { ...init, headers: { ...init.headers, Cookie: Array.from(jar, ([key, value]) => `${key}=${value}`).join("; ") }, redirect: "manual" });
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(";", 1)[0];
        const index = pair.indexOf("=");
        jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return response;
    }
    assert.equal((await fetch(base + "/api/admin/policies")).status, 401);
    for (const method of ["POST", "PUT", "DELETE"]) {
      const path = method === "POST" ? "/api/admin/policies" : "/api/admin/policies/nonexistent";
      assert.equal((await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : "{}" })).status, 401);
    }
    const csrf = await (await request("/api/auth/csrf")).json();
    const login = await request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: base + "/admin/settings/policies", json: "true" }).toString() });
    assert.ok(login.status === 200 || login.status === 302);
    const session = await (await request("/api/auth/session")).json();
    assert.equal(session.user.id, user.id);
    assert.ok(session.user.globalPermissions.includes("settings.manage"));
    assert.equal((await request("/api/admin/policies")).status, 200);
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    assert.equal((await request("/api/admin/policies")).status, 403);
    for (const method of ["POST", "PUT", "DELETE"]) {
      assert.equal((await request(method === "POST" ? "/api/admin/policies" : "/api/admin/policies/nonexistent", { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : "{}" })).status, 403);
    }
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    const invalid = await request("/api/admin/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "sitemap", locale: "en", title: "Unsafe link", content: "", linkUrl: "javascript:alert(1)" }) });
    assert.equal(invalid.status, 400);
    for (const kind of policyKinds) {
      const title = `${marker}${kind}-${token}`;
      const data = { kind, locale: "en", title, content: "Verification body\nSecond line", category: "Verification", linkUrl: kind === "sitemap" ? "/ecommerce/products" : null, sortOrder: 9999, isPublished: false, effectiveDate: "2026-10-04" };
      const create = await request("/api/admin/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      assert.equal(create.status, 201, await create.clone().text());
      const record = await create.json();
      createdIds.push(record.id);
      assert.equal((await prisma.storePolicyContent.findUniqueOrThrow({ where: { id: record.id } })).title, title);
      assert.ok(!(await (await fetch(base + `/ecommerce/${kind}`, { headers: { Cookie: "storefront-locale=en" } })).text()).includes(title), "Draft must not be exposed");
      const updatedTitle = title + "-updated";
      const update = await request(`/api/admin/policies/${record.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, title: updatedTitle, isPublished: true }) });
      assert.equal(update.status, 200);
      assert.ok((await (await fetch(base + `/ecommerce/${kind}`, { headers: { Cookie: "storefront-locale=en" } })).text()).includes(updatedTitle), "Published update must render");
      const remove = await request(`/api/admin/policies/${record.id}`, { method: "DELETE" });
      assert.equal(remove.status, 200);
      assert.equal(await prisma.storePolicyContent.findUnique({ where: { id: record.id } }), null);
      assert.ok(!(await (await fetch(base + `/ecommerce/${kind}`, { headers: { Cookie: "storefront-locale=en" } })).text()).includes(updatedTitle), "Deleted content must disappear");
      console.log(`${kind}: create, draft visibility, publish/update, database persistence and delete passed.`);
    }
    assert.equal((await request("/api/admin/policies/nonexistent", { method: "DELETE" })).status, 404);
    if (process.argv.includes("--browser-session")) {
      await writeFile(stateFile, JSON.stringify({ cookies: Array.from(jar, ([name, value]) => ({ name, value, domain: "localhost", path: "/", expires: -1, httpOnly: name.includes("session-token"), secure: false, sameSite: "Lax" })), origins: [] }));
      await writeFile(manifest, JSON.stringify({ userId: user.id, roleId: role.id }));
      retain = true;
      console.log(`Browser state saved to ${stateFile}. Run with --cleanup after browser verification.`);
    }
  } finally {
    await prisma.storePolicyContent.deleteMany({ where: { id: { in: createdIds } } });
    if (!retain) await cleanup(user.id, role.id);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
