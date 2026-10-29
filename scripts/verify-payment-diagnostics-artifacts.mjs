import { readdir, readFile } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
const root = resolve(".next/payment-diagnostics-verification-build/server");
let checked = 0;
const unexpected = new Set();
async function walk(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && entry.name.endsWith(".nft.json")) {
      const manifest = JSON.parse(await readFile(path, "utf8")); checked++;
      for (const relative of manifest.files || []) {
        const file = resolve(dirname(path), relative), name = basename(file), portable = file.replaceAll("\\", "/");
        if (name.startsWith(".env") || /\.pcap(?:ng)?(?:\.|$)/i.test(name) || /\/(?:\.private-upload|\.payment-evidence)\//.test(portable)) unexpected.add(file);
      }
    }
  }
}
try {
  await walk(root);
  if (!checked) throw new Error("NO_SERVER_TRACING_MANIFESTS");
  // Deliberately report counts only; do not expose private filenames/contents.
  console.log(JSON.stringify({ checkedServerManifests: checked, unexpectedPrivateOrEnvironmentFiles: unexpected.size }));
  if (unexpected.size) process.exitCode = 1;
} catch { console.error("Deployment artifact privacy validation unavailable; complete the isolated build first"); process.exitCode = 1; }
