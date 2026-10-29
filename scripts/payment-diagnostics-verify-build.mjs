import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const guard = fileURLToPath(new URL("../tests/helpers/payment-transport-build-guard.cjs", import.meta.url)).replaceAll("\\", "/");
const env = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  PAYMENT_DIAGNOSTICS_VERIFY_BUILD: "true", WAREHOUSE_BUNDLE_VERIFY: "false",
  DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline_build?connect_timeout=1",
  PAYMENT_DIAGNOSTICS_ENABLED: "false", PAYMENT_NETWORK_CAPTURE_ENABLED: "false", NEXT_PUBLIC_PAYMENT_DIAGNOSTICS_ENABLED: "false",
  PAYMENT_TRANSPORT_MONITORING_MODE: "off", PAYMENT_TRANSPORT_STORAGE_ENABLED: "false", PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED: "false",
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=6144 --require="${guard}"`,
};
for (const key of ["EPS_USERNAME", "EPS_PASSWORD", "EPS_HASH_KEY", "EPS_MERCHANT_ID", "EPS_STORE_ID", "AIBL_WALLET_API_USER",
  "AIBL_WALLET_API_PASS", "AIBL_WALLET_ACCESS_KEY", "AIBL_WALLET_MERCHANT_ID"]) env[key] = "";
const child = spawn(process.execPath, ["--max-old-space-size=6144", fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)),
  "build", "--turbopack"], { cwd: root, env, stdio: "inherit", windowsHide: true });
child.once("error", () => { console.error("Diagnostic verification build could not start"); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
