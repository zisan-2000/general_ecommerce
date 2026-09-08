import fs from "node:fs";
import { execFileSync } from "node:child_process";

const carrierPath = "scripts/phase8-apply.mjs";
let carrier = fs.readFileSync(carrierPath, "utf8");
carrier = carrier.replaceAll("${label}", "\\${label}");
carrier = carrier.replaceAll("\\\\${name}", "\\\\\\${name}");
fs.writeFileSync(carrierPath, carrier);

execFileSync(process.execPath, [carrierPath], { stdio: "inherit" });

const testPath = "tests/book-module-decoupling.test.mjs";
let testSource = fs.readFileSync(testPath, "utf8");
const start = testSource.indexOf("function model(name) {");
const end = testSource.indexOf("\n}\n\n", start) + 3;
if (start < 0 || end < 3) {
  throw new Error("Could not locate generated Phase 8 model helper");
}
const replacement = `function model(name) {
  const start = schema.indexOf(\`model \${name} {\`);
  assert.ok(start >= 0, \`model \${name} must exist\`);
  const rest = schema.slice(start);
  const end = rest.indexOf("\\n}\\n");
  assert.ok(end >= 0, \`model \${name} must have a closing brace\`);
  return rest.slice(0, end + 2);
}`;
testSource = testSource.slice(0, start) + replacement + testSource.slice(end);
fs.writeFileSync(testPath, testSource);

console.log("Phase 8 materialization complete.");
