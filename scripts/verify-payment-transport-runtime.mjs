import { createRequire } from "node:module";
import { transportRuntimeStatus } from "../lib/payment-control/transport-config.ts";

// No dotenv, application bootstrap, bank requests, flags or database access.
const require = createRequire(import.meta.url);
const agentVersion = require("undici/package.json").version;
const runtime = transportRuntimeStatus();
const compatible = runtime.compatible && agentVersion === "6.29.1";
console.log(JSON.stringify({ phase: process.argv[2] ?? "current-process", nodeExecutable: process.execPath,
  nodeVersion: process.versions.node, nativeUndiciVersion: process.versions.undici ?? null,
  connectorUndiciVersion: agentVersion, compatible,
  reason: !runtime.compatible ? runtime.reason : agentVersion !== "6.29.1" ? "UNREVIEWED_CONNECTOR_VERSION" : runtime.reason,
  requiredNode: ">=24.22.1 <25", requiredNativeUndici: ">=7.30.1 <8", reviewedConnector: "6.29.1",
}, null, 2));
if (!compatible) process.exitCode = 1;
