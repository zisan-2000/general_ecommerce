export const locales = ["en", "bn"] as const;

export const localeCookieName = "storefront-locale";

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export function isAppLocale(value: string): value is AppLocale {
  return locales.some((locale) => locale === value);
}
