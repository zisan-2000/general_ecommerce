import fs from "fs/promises";
import path from "path";
import { del, get, put } from "@vercel/blob";

const LOCAL_UPLOAD_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "upload");
const LOCAL_CHAT_UPLOAD_ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), ".private-upload");
const PRIVATE_PREFIXES = new Set([
  "chat-attachments",
  "delivery-proofs",
  "delivery-man-documents",
  "digital-assets",
  "investor-kyc",
  "investor-payout-proof",
  "paymentScreenshot",
  "scm-grn",
  "scm-material",
  "scm-proposals",
]);

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function blobToken(relPath: string) {
  return relPath.startsWith("chat-attachments/")
    ? process.env.CHAT_ATTACHMENT_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
    : process.env.BLOB_READ_WRITE_TOKEN;
}

function requireProductionBlobStorage(relPath: string) {
  if (isProduction() && !blobToken(relPath)) {
    throw new Error(
      relPath.startsWith("chat-attachments/")
        ? "Private chat storage is not configured. Set CHAT_ATTACHMENT_BLOB_READ_WRITE_TOKEN for a private store."
        : "Production upload storage is not configured. Set BLOB_READ_WRITE_TOKEN.",
    );
  }
}

function validRelativePath(relPath: string) {
  const segments = relPath.replace(/\\/g, "/").split("/");
  return (
    segments.length > 0 &&
    segments.every(
      (segment) =>
        Boolean(segment) &&
        segment !== "." &&
        segment !== ".." &&
        /^[a-zA-Z0-9_.-]+$/.test(segment),
    )
  );
}

function normalizeRelativePath(relPath: string) {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!validRelativePath(normalized)) {
    throw new Error("Invalid upload storage path.");
  }
  return normalized;
}

function localPath(relPath: string) {
  const root = relPath.startsWith("chat-attachments/") ? LOCAL_CHAT_UPLOAD_ROOT : LOCAL_UPLOAD_ROOT;
  const target = path.resolve(/* turbopackIgnore: true */ root, relPath);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid local upload storage path.");
  }
  return target;
}

function blobPath(relPath: string) {
  return `upload/${relPath}`;
}

export function isPrivateUploadPath(relPath: string) {
  const [prefix] = normalizeRelativePath(relPath).split("/");
  return PRIVATE_PREFIXES.has(prefix);
}

export async function storeUpload(input: {
  relPath: string;
  data: Buffer;
  contentType: string;
}) {
  const relPath = normalizeRelativePath(input.relPath);
  requireProductionBlobStorage(relPath);

  if (blobToken(relPath)) {
    await put(blobPath(relPath), input.data, {
      token: blobToken(relPath),
      access: isPrivateUploadPath(relPath) ? "private" : "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: isPrivateUploadPath(relPath) ? 60 : 31_536_000,
      contentType: input.contentType,
    });
    return;
  }

  const target = localPath(relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, input.data, { flag: "wx" });
}

export async function readUpload(relPathInput: string) {
  const relPath = normalizeRelativePath(relPathInput);
  requireProductionBlobStorage(relPath);

  if (blobToken(relPath)) {
    const result = await get(blobPath(relPath), {
      token: blobToken(relPath),
      access: isPrivateUploadPath(relPath) ? "private" : "public",
      useCache: !isPrivateUploadPath(relPath),
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      body: result.stream,
      contentType: result.blob.contentType,
    };
  }

  try {
    const data = await fs.readFile(localPath(relPath));
    return { body: new Uint8Array(data), contentType: null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteUpload(relPathInput: string) {
  const relPath = normalizeRelativePath(relPathInput);
  requireProductionBlobStorage(relPath);

  if (blobToken(relPath)) {
    await del(blobPath(relPath), { token: blobToken(relPath) });
    return;
  }

  try {
    await fs.unlink(localPath(relPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

