import "server-only";
import { isAbsolute, resolve, relative, sep } from "node:path";
import { mkdir, lstat, open, rename, readFile, unlink, realpath } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { sanitizePcapng } from "./pcapng";
export async function evidenceDirectory() {
  const configured = process.env.PAYMENT_DIAGNOSTICS_EVIDENCE_DIR;
  if (!configured || !isAbsolute(configured)) throw new Error("PRIVATE_EVIDENCE_STORAGE_REQUIRED");
  const root = resolve(configured);
  // These are runtime security comparisons/directory metadata, not application
  // assets. Prevent Turbopack from bundling public/private storage contents.
  const publicRoot = resolve(/* turbopackIgnore: true */ process.cwd(), "public");
  const inside = (parent: string, target: string) => {
    const rel = relative(parent, target);
    return !rel || !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep);
  };
  if (inside(publicRoot, root) || root === resolve(/* turbopackIgnore: true */ process.cwd())) throw new Error("UNSAFE_EVIDENCE_DIRECTORY");
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink()) throw new Error("UNSAFE_EVIDENCE_DIRECTORY");
  const actual = await realpath(root), actualPublic = await realpath(publicRoot);
  if (inside(actualPublic, actual)) throw new Error("UNSAFE_EVIDENCE_DIRECTORY");
  return actual;
}
async function evidencePath(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("INVALID_EVIDENCE_ID");
  return resolve(await evidenceDirectory(), `${id}.pcapng`);
}
export async function saveCaptureEvidence(id: string, data: Buffer, ips: string[]) {
  const safe = sanitizePcapng(data, ips);
  const file = await evidencePath(id), temp = file + `.${randomUUID()}.tmp`;
  const handle = await open(temp, "wx", 0o600);
  try {
    try { await handle.writeFile(safe.data); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temp, file);
  } catch (error) { await unlink(temp).catch(() => {}); throw error; }
  return safe;
}
export async function readCaptureEvidence(id: string, bytes: number, sha256: string) {
  const file = await evidencePath(id), stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes || stat.size > 2097152) throw new Error("EVIDENCE_INTEGRITY_FAILED");
  const data = await readFile(file);
  if (createHash("sha256").update(data).digest("hex") !== sha256) throw new Error("EVIDENCE_INTEGRITY_FAILED");
  return data;
}
export async function deleteCaptureEvidence(id: string) {
  try { await unlink(await evidencePath(id)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
