"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export type StorefrontCurrencySettings = {
  currency: string;
  currencyPosition: "BEFORE" | "AFTER";
  locale: string;
};

type StorefrontSettingsContextValue = StorefrontCurrencySettings & {
  formatCurrency: (value: number) => string;
};

const DEFAULT_SETTINGS: StorefrontCurrencySettings = {
  currency: "BDT",
  currencyPosition: "BEFORE",
  locale: "en-BD",
};

const StorefrontSettingsContext = createContext<StorefrontSettingsContextValue | null>(
  null,
);

function buildCurrencyParts(settings: StorefrontCurrencySettings) {
  const safeCurrency = /^[A-Z]{3}$/.test(settings.currency)
    ? settings.currency
    : DEFAULT_SETTINGS.currency;
  const safePosition =
    settings.currencyPosition === "AFTER" ? "AFTER" : "BEFORE";

  let safeLocale = settings.locale;
  try {
    safeLocale = new Intl.Locale(settings.locale).baseName;
  } catch {
    safeLocale = DEFAULT_SETTINGS.locale;
  }

  const currencyFormatter = new Intl.NumberFormat(safeLocale, {
    style: "currency",
    currency: safeCurrency,
    currencyDisplay: "narrowSymbol",
  });
  const currencyToken =
    currencyFormatter.formatToParts(0).find((part) => part.type === "currency")
      ?.value ?? safeCurrency;
  const fractionDigits =
    currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2;
  const numberFormatter = new Intl.NumberFormat(safeLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(2, fractionDigits),
  });

  return {
    currency: safeCurrency,
    currencyPosition: safePosition as "BEFORE" | "AFTER",
    locale: safeLocale,
    currencyToken,
    numberFormatter,
  };
}

export function StorefrontSettingsProvider({
  settings,
  children,
}: {
  settings?: Partial<StorefrontCurrencySettings>;
  children: ReactNode;
}) {
  const resolved = useMemo(
    () =>
      buildCurrencyParts({
        currency: String(settings?.currency ?? DEFAULT_SETTINGS.currency).toUpperCase(),
        currencyPosition:
          settings?.currencyPosition === "AFTER" ? "AFTER" : "BEFORE",
        locale: settings?.locale ?? DEFAULT_SETTINGS.locale,
      }),
    [settings?.currency, settings?.currencyPosition, settings?.locale],
  );

  const formatCurrency = useCallback(
    (value: number) => {
      const amount = Number.isFinite(value) ? value : 0;
      const formattedAmount = resolved.numberFormatter.format(amount);
      return resolved.currencyPosition === "AFTER"
        ? `${formattedAmount} ${resolved.currencyToken}`
        : `${resolved.currencyToken}${formattedAmount}`;
    },
    [resolved],
  );

  const value = useMemo<StorefrontSettingsContextValue>(
    () => ({
      currency: resolved.currency,
      currencyPosition: resolved.currencyPosition,
      locale: resolved.locale,
      formatCurrency,
    }),
    [formatCurrency, resolved],
  );

  return (
    <StorefrontSettingsContext.Provider value={value}>
      {children}
    </StorefrontSettingsContext.Provider>
  );
}

export function useStorefrontSettings() {
  const context = useContext(StorefrontSettingsContext);
  if (context) return context;

  const fallback = buildCurrencyParts(DEFAULT_SETTINGS);
  return {
    currency: fallback.currency,
    currencyPosition: fallback.currencyPosition,
    locale: fallback.locale,
    formatCurrency: (value: number) => {
      const amount = Number.isFinite(value) ? value : 0;
      const formattedAmount = fallback.numberFormatter.format(amount);
      return fallback.currencyPosition === "AFTER"
        ? `${formattedAmount} ${fallback.currencyToken}`
        : `${fallback.currencyToken}${formattedAmount}`;
    },
  } satisfies StorefrontSettingsContextValue;
}
