import { unstable_cache } from "next/cache.js";
import { cache } from "react";
import { decodeCacheValue, encodeCacheValue } from "./compressed-cache-value";

export function compressedCache<Args extends unknown[], Result>(
  read: (...args: Args) => Promise<Result>,
  keys: string[],
  options: { revalidate: number; tags: string[] },
) {
  const readEncoded = unstable_cache(
    async (...args: Args) => encodeCacheValue(await read(...args)),
    keys,
    options,
  );
  return cache(async (...args: Args): Promise<Result> => {
    const encoded = await readEncoded(...args);
    // Extremely large, incompressible results bypass persistent storage.
    return encoded === null ? read(...args) : decodeCacheValue<Result>(encoded);
  });
}
