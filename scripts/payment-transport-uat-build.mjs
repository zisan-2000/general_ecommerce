import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

// No dotenv loading and no DB authentication: native Prisma cannot reach any
// real database with this deliberately unusable process-scoped URL. JS sockets
// additionally block external hosts and PostgreSQL throughout the build tree.
const guard = fileURLToPath(new URL("../tests/helpers/payment-transport-build-guard.cjs", import.meta.url)).replaceAll("\\", "/");
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
if (!existsSync(npmCli)) throw new Error("UAT_NPM_CLI_UNAVAILABLE");
const child = spawn(process.execPath, [npmCli, "run", "build"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env,
    DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline_build?connect_timeout=1",
    PAYMENT_TRANSPORT_MONITORING_MODE: "off", PAYMENT_TRANSPORT_STORAGE_ENABLED: "false",
    PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: "false", NEXT_TELEMETRY_DISABLED: "1",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require="${guard}"`,
  },
});
child.once("error", () => { console.error("UAT_BUILD_PROCESS_FAILED"); process.exitCode = 1; });
child.once("exit", (code) => { process.exitCode = code ?? 1; });
