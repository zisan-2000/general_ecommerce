// CLI-process-only boundary. Generated Prisma probes .env during import even
// with an explicit datasource URL. Never read those files in this inspector.
import fs from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { syncBuiltinESMExports } from "node:module";
// Generated-client debug logs must not expose the explicit datasource URL.
delete process.env.DEBUG;
process.env.PAYMENT_TRANSPORT_MONITORING_MODE = "off";
process.env.PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED = "false";
process.env.PAYMENT_TRANSPORT_STORAGE_ENABLED = "false";
const isEnvFile = (path) => {
  try { return /^\.env(?:\..*)?$/i.test(basename(path instanceof URL ? fileURLToPath(path) : String(path))); }
  catch { return false; }
};
const exists = fs.existsSync;
fs.existsSync = function (path) { return isEnvFile(path) ? false : Reflect.apply(exists, this, arguments); };
for (const name of ["readFileSync", "readFile", "openSync", "open"]) {
  const original = fs[name];
  fs[name] = function (path) {
    if (isEnvFile(path)) throw new Error("INSPECTOR_ENV_FILE_ACCESS_BLOCKED");
    return Reflect.apply(original, this, arguments);
  };
}
for (const name of ["readFile", "open"]) {
  const original = fs.promises[name];
  fs.promises[name] = function (path) {
    if (isEnvFile(path)) return Promise.reject(new Error("INSPECTOR_ENV_FILE_ACCESS_BLOCKED"));
    return Reflect.apply(original, this, arguments);
  };
}
syncBuiltinESMExports();
