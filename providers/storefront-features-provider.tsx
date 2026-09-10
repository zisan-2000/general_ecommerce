"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  STORE_FEATURE_KEYS,
  type StoreFeatureKey,
} from "@/lib/store-features";

export type StorefrontFeatureFlags = Record<StoreFeatureKey, boolean>;

export const STOREFRONT_FEATURES_CHANGED_EVENT =
  "storefront-features-changed";

const DISABLED_FEATURES = Object.fromEntries(
  STORE_FEATURE_KEYS.map((key) => [key, false]),
) as StorefrontFeatureFlags;

const StorefrontFeaturesContext =
  createContext<StorefrontFeatureFlags>(DISABLED_FEATURES);

function normalizeFeatureFlags(value: unknown): StorefrontFeatureFlags | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!STORE_FEATURE_KEYS.every((key) => typeof record[key] === "boolean")) {
    return null;
  }
  return Object.fromEntries(
    STORE_FEATURE_KEYS.map((key) => [key, record[key]]),
  ) as StorefrontFeatureFlags;
}

export function StorefrontFeaturesProvider({
  initialFeatures,
  children,
}: {
  initialFeatures: StorefrontFeatureFlags;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [features, setFeatures] = useState(initialFeatures);

  const refreshFeatures = useCallback(async () => {
    try {
      const response = await fetch("/api/store-features", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { features?: unknown };
      const next = normalizeFeatureFlags(payload.features);
      if (next) setFeatures(next);
    } catch {
      // Keep the server-rendered snapshot when a background refresh fails.
    }
  }, []);

  useEffect(() => {
    void refreshFeatures();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshFeatures();
    };
    const refresh = () => void refreshFeatures();

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener(STOREFRONT_FEATURES_CHANGED_EVENT, refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener(STOREFRONT_FEATURES_CHANGED_EVENT, refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname, refreshFeatures]);

  const value = useMemo(() => features, [features]);
  return (
    <StorefrontFeaturesContext.Provider value={value}>
      {children}
    </StorefrontFeaturesContext.Provider>
  );
}

export function useStorefrontFeatures() {
  return useContext(StorefrontFeaturesContext);
}
