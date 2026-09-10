"use client";

import { SessionProvider } from "next-auth/react";
import {
  StorefrontSettingsProvider,
  type StorefrontCurrencySettings,
} from "@/providers/storefront-settings-provider";
import {
  StorefrontFeaturesProvider,
  type StorefrontFeatureFlags,
} from "@/providers/storefront-features-provider";

export function Providers({
  children,
  storefrontSettings,
  storefrontFeatures,
}: {
  children: React.ReactNode;
  storefrontSettings?: Partial<StorefrontCurrencySettings>;
  storefrontFeatures: StorefrontFeatureFlags;
}) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <StorefrontFeaturesProvider initialFeatures={storefrontFeatures}>
        <StorefrontSettingsProvider settings={storefrontSettings}>
          {children}
        </StorefrontSettingsProvider>
      </StorefrontFeaturesProvider>
    </SessionProvider>
  );
}
