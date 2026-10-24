"use client";

type CacheEntry<T = unknown> = {
  expiresAt: number;
  data?: T;
  promise?: Promise<T>;
};

type CachedFetchOptions = {
  ttlMs?: number;
  key?: string;
  init?: RequestInit;
  /** Inventory responses share only an in-flight request and are never retained. */
  freshness?: "metadata" | "inventory";
};

const DEFAULT_TTL_MS = 60_000;

const globalCache = globalThis as typeof globalThis & {
  __CLIENT_FETCH_CACHE__?: Map<string, CacheEntry>;
};

const cacheStore =
  globalCache.__CLIENT_FETCH_CACHE__ ??
  (globalCache.__CLIENT_FETCH_CACHE__ = new Map<string, CacheEntry>());

function buildCacheKey(url: string, init?: RequestInit, explicitKey?: string) {
  if (explicitKey) return explicitKey;
  const method = (init?.method ?? "GET").toUpperCase();
  return `${method}:${url}`;
}

export async function cachedFetchJson<T = unknown>(
  url: string,
  options: CachedFetchOptions = {}
): Promise<T> {
  const {
    ttlMs = DEFAULT_TTL_MS,
    key,
    init,
    freshness = "metadata",
  } = options;
  const effectiveTtlMs = freshness === "inventory" ? 0 : ttlMs;
  const effectiveInit =
    freshness === "inventory" ? { ...init, cache: "no-store" as const } : init;
  const method = (effectiveInit?.method ?? "GET").toUpperCase();

  if (method !== "GET") {
    const res = await fetch(url, effectiveInit);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as T;
  }

  const now = Date.now();
  const baseCacheKey = buildCacheKey(url, effectiveInit, key);
  const cacheKey =
    freshness === "inventory" ? `inventory:${baseCacheKey}` : baseCacheKey;
  const existing = cacheStore.get(cacheKey);

  if (existing?.data !== undefined && existing.expiresAt > now) {
    return existing.data as T;
  }

  if (existing?.promise) {
    return (await existing.promise) as T;
  }

  const requestPromise = fetch(url, effectiveInit)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as T;
    })
    .then((data) => {
      if (effectiveTtlMs > 0) {
        cacheStore.set(cacheKey, {
          data,
          expiresAt: Date.now() + effectiveTtlMs,
        });
      } else {
        cacheStore.delete(cacheKey);
      }
      return data;
    })
    .catch((error) => {
      cacheStore.delete(cacheKey);
      throw error;
    });

  cacheStore.set(cacheKey, {
    expiresAt: now + effectiveTtlMs,
    promise: requestPromise,
  });

  return await requestPromise;
}

export function clearCachedFetch(keyPrefix?: string) {
  if (!keyPrefix) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      cacheStore.delete(key);
    }
  }
}

