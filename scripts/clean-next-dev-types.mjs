import { rmSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const projectRoot = resolve(process.cwd());
const generatedDevTypes = resolve(projectRoot, ".next", "dev", "types");
const relativeTarget = relative(projectRoot, generatedDevTypes)
  .split(sep)
  .join("/");

if (relativeTarget !== ".next/dev/types") {
  throw new Error(`Refusing to remove unexpected path: ${generatedDevTypes}`);
}

rmSync(generatedDevTypes, { recursive: true, force: true });
console.log("Removed stale Next.js development route types, if present.");
