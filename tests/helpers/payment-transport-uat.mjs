import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute actual application source with an exact import boundary. No app bootstrap,
// dotenv, default Prisma singleton, gateway module or global dispatcher is loaded.
export function loadTransportSource(path, imports, extras = {}, exposePersistence = false) {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsModule = { exports: {} };
  const context = vm.createContext({
    module: commonJsModule, exports: commonJsModule.exports,
    process: { env: { NODE_ENV: "test", PAYMENT_TRANSPORT_STORAGE_ENABLED: "true" } },
    Date, performance, URL, structuredClone, setImmediate, Buffer,
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error("UAT_UNAPPROVED_IMPORT");
    }, ...extras,
  }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(code + (exposePersistence ? "\nexports.persistForUat = persistTransportAttempt;" : ""),
    { filename: path }).runInContext(context);
  return commonJsModule.exports;
}
