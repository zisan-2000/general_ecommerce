export const locales = ["en", "bn", "zh", "ar", "ne", "id"] as const;

export const localeCookieName = "storefront-locale";

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const languageOptions = [
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "bn", label: "বাংলা", shortLabel: "BN" },
  { value: "zh", label: "中文", shortLabel: "中文" },
  { value: "ar", label: "العربية", shortLabel: "AR" },
  { value: "ne", label: "नेपाली", shortLabel: "NE" },
  { value: "id", label: "Bahasa Indonesia", shortLabel: "ID" },
] as const satisfies ReadonlyArray<{
  value: AppLocale;
  label: string;
  shortLabel: string;
}>;

export function getLocaleDirection(locale: AppLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isAppLocale(value: string): value is AppLocale {
  return locales.some((locale) => locale === value);
}
