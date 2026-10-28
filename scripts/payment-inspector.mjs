import { writeFile } from "node:fs/promises";
import { parseInspectorArguments, inspectLocalPaymentRequest, safeInspectorFailure } from "./lib/payment-inspector.ts";

try {
  const options = parseInspectorArguments(process.argv.slice(2));
  if (!options) {
    process.stdout.write(JSON.stringify({
      usage: "npm run --silent inspect:payment -- --request-id <full-UUID> [--page 1..20] [--output <new-file.json>]",
      connection: "PAYMENT_INSPECTOR_DATABASE_URL (process environment only; no .env loading)",
      secureWindowsPrompt: ".\\scripts\\Invoke-PaymentInspector.ps1 -RequestId <full-UUID> [-OutputFile <new-file.json>]",
      safety: "Local PostgreSQL only, verified read-only transaction, recorded evidence only. Existing files are never overwritten.",
    }, null, 2) + "\n");
  } else {
    const report = await inspectLocalPaymentRequest(options, process.env.PAYMENT_INSPECTOR_DATABASE_URL);
    const json = JSON.stringify(report, null, 2) + "\n";
    if (options.output) await writeFile(options.output, json, { flag: "wx", mode: 0o600 });
    process.stdout.write(json);
  }
} catch (error) {
  process.stderr.write(JSON.stringify(safeInspectorFailure(error)) + "\n");
  process.exitCode = 1;
}
