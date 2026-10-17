import type { PrismaConfig } from "prisma";

// Explicit opt-in config for a disposable LOCAL gen_eco database only.
// Does not import the normal config or load any .env files.
const localResetUrl = process.env.LOCAL_RESET_DATABASE_URL;
if (!localResetUrl || process.env.NODE_ENV === "production") {
  throw new Error("Local reset requires LOCAL_RESET_DATABASE_URL and a non-production process.");
}
let target: URL;
try { target = new URL(localResetUrl); }
catch { throw new Error("Invalid local reset database URL."); }
if (!["postgresql:", "postgres:"].includes(target.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    target.pathname !== "/gen_eco" || target.hash ||
    [...target.searchParams].some(([key, value]) => key !== "schema" || value !== "public")) {
  throw new Error("Reset blocked: only a loopback PostgreSQL gen_eco database with the public schema is allowed.");
}
// The schema also references DATABASE_URL. Keep both URL sources pinned to the
// checked target inside this CLI process; never fall back to an application secret.
process.env.DATABASE_URL = localResetUrl;

export default {
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: { url: localResetUrl },
  migrations: { path: "prisma/migrations-release" },
  experimental: { externalTables: true },
  tables: { external: ["public.PcBuildCartItem", "public.PcBuildOrderItem", "public.PcBuilderSavedBuild"] },
} satisfies PrismaConfig;
