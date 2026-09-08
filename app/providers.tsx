"use client";

import { SessionProvider } from "next-auth/react";
import {
  StorefrontSettingsProvider,
  type StorefrontCurrencySettings,
} from "@/providers/storefront-settings-provider";

export function Providers({
  children,
  storefrontSettings,
}: {
  children: React.ReactNode;
  storefrontSettings?: Partial<StorefrontCurrencySettings>;
}) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <StorefrontSettingsProvider settings={storefrontSettings}>
        {children}
      </StorefrontSettingsProvider>
    </SessionProvider>
  );
}
