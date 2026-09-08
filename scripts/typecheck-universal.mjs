import { spawnSync } from "node:child_process";

const ALLOWED_BASELINE_FILES = new Set([
  "app/api/business/invoices/[id]/route.ts",
  "app/api/business/orders/[id]/route.ts",
  "app/business/(portal)/invoices/[id]/page.tsx",
  "app/business/(portal)/orders/[id]/page.tsx",
  "app/business/(portal)/partner/leads/[id]/page.tsx",
  "app/business/(portal)/partner/settlements/[id]/page.tsx",
  "app/business/(portal)/purchase-orders/[id]/page.tsx",
  "app/business/(portal)/quotations/[id]/page.tsx",
  "app/business/(portal)/rfqs/[id]/page.tsx",
  "app/business/apply/success/page.tsx",
]);

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "--noEmit", "--pretty", "false"],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=6144",
    },
  },
);

const output = `${result.stdout || ""}${result.stderr || ""}`.trim();

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status === 0) {
  console.log("TypeScript: PASS (no diagnostics)");
  process.exit(0);
}

const diagnosticLines = output
  .split(/\r?\n/)
  .filter((line) => /\.(?:ts|tsx)\(\d+,\d+\): error TS\d+:/.test(line));

const unexpected = diagnosticLines.filter((line) => {
  const match = line.match(/^(.*?\.(?:ts|tsx))\(\d+,\d+\): error TS\d+:/);
  return !match || !ALLOWED_BASELINE_FILES.has(match[1].replace(/\\/g, "/"));
});

if (unexpected.length > 0 || diagnosticLines.length === 0) {
  console.error("TypeScript: FAIL — new or unrecognized diagnostics detected.");
  console.error(output);
  process.exit(1);
}

console.warn(
  `TypeScript: PASS with ${diagnosticLines.length} explicitly allowlisted pre-existing Business Network diagnostic(s).`,
);
for (const line of diagnosticLines) console.warn(`  ${line}`);
