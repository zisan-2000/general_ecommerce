import { spawnSync } from "node:child_process";

const profile = process.env.SEED_PROFILE || "full-demo";
const allowed = new Set(["technology-demo", "full-demo"]);

if (!allowed.has(profile)) {
  console.error(`Unsupported demo SEED_PROFILE: ${profile}`);
  process.exit(1);
}

if (process.env.ALLOW_DEMO_CREDENTIALS !== "true") {
  console.error("Demo seed blocked: set ALLOW_DEMO_CREDENTIALS=true only in an isolated demo environment.");
  process.exit(1);
}

if (process.env.ALLOW_DESTRUCTIVE_DEMO_SEED !== "true") {
  console.error("Demo seed blocked: set ALLOW_DESTRUCTIVE_DEMO_SEED=true only when destructive demo storefront replacement is intended.");
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "prisma/seed.ts"],
  { stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
