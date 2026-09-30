import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";

const compress = promisify(gzip);
const decompress = promisify(gunzip);
// Leave ample room for Next.js' JSON envelope below its 2 MB entry limit.
export const MAX_COMPRESSED_CACHE_LENGTH = 1_000_000;

export async function encodeCacheValue(value: unknown): Promise<string | null> {
  const encoded = (await compress(JSON.stringify(value))).toString("base64");
  return encoded.length <= MAX_COMPRESSED_CACHE_LENGTH ? encoded : null;
}

export async function decodeCacheValue<T>(encoded: string): Promise<T> {
  return JSON.parse((await decompress(Buffer.from(encoded, "base64"))).toString("utf8")) as T;
}
