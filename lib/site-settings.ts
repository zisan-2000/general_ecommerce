export const STORE_TYPES = [
  "GENERAL",
  "TECH",
  "FASHION",
  "GROCERY",
  "BOOK",
] as const;

export const CURRENCY_POSITIONS = ["BEFORE", "AFTER"] as const;

export type StoreType = (typeof STORE_TYPES)[number];
export type CurrencyPosition = (typeof CURRENCY_POSITIONS)[number];

export const SITE_SETTINGS_DEFAULTS = {
  storeName: "Online Store",
  storeTagline: "Quality products, secure shopping and dependable service.",
  defaultSeoDescription:
    "Discover quality products with clear information, secure checkout and dependable delivery.",
  currency: "BDT",
  currencyPosition: "BEFORE" as CurrencyPosition,
  timezone: "Asia/Dhaka",
  locale: "en-BD",
  storeType: "GENERAL" as StoreType,
  logo: "/assets/favicon.png",
  favicon: "/assets/favicon.png",
} as const;

export type SiteSettingsInput = {
  storeName: string;
  storeTagline: string | null;
  defaultSeoTitle: string | null;
  defaultSeoDescription: string | null;
  defaultSeoKeywords: string[];
  defaultOgImage: string | null;
  favicon: string | null;
  logo: string | null;
  currency: string;
  currencyPosition: CurrencyPosition;
  timezone: string;
  locale: string;
  storeType: StoreType;
  footerDescription: string | null;
  contactNumber: string | null;
  contactEmail: string | null;
  address: string | null;
  facebookLink: string | null;
  instagramLink: string | null;
  twitterLink: string | null;
  tiktokLink: string | null;
  youtubeLink: string | null;
};

type SiteSettingsRecord = Partial<SiteSettingsInput> & {
  siteTitle?: string | null;
};

export type ResolvedSiteSettings = SiteSettingsInput & {
  siteTitle: string;
  siteDescription: string;
  ogImage: string;
};

const MAX_LENGTHS = {
  storeName: 120,
  storeTagline: 200,
  defaultSeoTitle: 160,
  defaultSeoDescription: 320,
  keyword: 64,
  image: 2048,
  footerDescription: 1000,
  contactNumber: 64,
  contactEmail: 254,
  address: 1000,
  social: 2048,
} as const;

function cleanOptional(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function isWebOrRootRelativeUrl(value: string) {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseKeywords(value: unknown) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  const unique = new Map<string, string>();
  for (const item of values) {
    const keyword = cleanOptional(item, MAX_LENGTHS.keyword);
    if (!keyword) continue;
    const key = keyword.toLocaleLowerCase("en-US");
    if (!unique.has(key)) unique.set(key, keyword);
    if (unique.size === 30) break;
  }
  return Array.from(unique.values());
}

function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function validLocale(locale: string) {
  try {
    return Boolean(new Intl.Locale(locale).baseName);
  } catch {
    return false;
  }
}

export function parseSiteSettingsInput(
  value: unknown,
): { ok: true; value: SiteSettingsInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Site settings payload must be an object" };
  }
  const body = value as Record<string, unknown>;
  const storeName = cleanOptional(
    body.storeName ?? body.siteTitle,
    MAX_LENGTHS.storeName,
  );
  if (!storeName) return { ok: false, error: "Store name is required" };

  const currency = String(body.currency ?? SITE_SETTINGS_DEFAULTS.currency)
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: "Currency must be a three-letter ISO code" };
  }

  const currencyPosition = String(
    body.currencyPosition ?? SITE_SETTINGS_DEFAULTS.currencyPosition,
  ).toUpperCase();
  if (!CURRENCY_POSITIONS.includes(currencyPosition as CurrencyPosition)) {
    return { ok: false, error: "Currency position must be BEFORE or AFTER" };
  }

  const timezone = String(body.timezone ?? SITE_SETTINGS_DEFAULTS.timezone).trim();
  if (!validTimezone(timezone)) {
    return { ok: false, error: "Timezone must be a valid IANA timezone" };
  }

  const locale = String(body.locale ?? SITE_SETTINGS_DEFAULTS.locale).trim();
  if (!validLocale(locale)) {
    return { ok: false, error: "Locale must be a valid BCP 47 locale" };
  }

  const storeType = String(body.storeType ?? SITE_SETTINGS_DEFAULTS.storeType)
    .trim()
    .toUpperCase();
  if (!STORE_TYPES.includes(storeType as StoreType)) {
    return { ok: false, error: "Store type is not supported" };
  }

  const imageFields = ["logo", "favicon", "defaultOgImage"] as const;
  const images = Object.fromEntries(
    imageFields.map((field) => [field, cleanOptional(body[field], MAX_LENGTHS.image)]),
  ) as Record<(typeof imageFields)[number], string | null>;
  for (const field of imageFields) {
    if (images[field] && !isWebOrRootRelativeUrl(images[field])) {
      return { ok: false, error: `${field} must be an HTTP(S) or root-relative URL` };
    }
  }

  const socialFields = [
    "facebookLink",
    "instagramLink",
    "twitterLink",
    "tiktokLink",
    "youtubeLink",
  ] as const;
  const social = Object.fromEntries(
    socialFields.map((field) => [field, cleanOptional(body[field], MAX_LENGTHS.social)]),
  ) as Record<(typeof socialFields)[number], string | null>;
  for (const field of socialFields) {
    if (social[field] && !isWebOrRootRelativeUrl(social[field])) {
      return { ok: false, error: `${field} must be a valid HTTP(S) URL` };
    }
  }

  const contactEmail = cleanOptional(body.contactEmail, MAX_LENGTHS.contactEmail);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Contact email is invalid" };
  }

  return {
    ok: true,
    value: {
      storeName,
      storeTagline: cleanOptional(body.storeTagline, MAX_LENGTHS.storeTagline),
      defaultSeoTitle: cleanOptional(body.defaultSeoTitle, MAX_LENGTHS.defaultSeoTitle),
      defaultSeoDescription: cleanOptional(
        body.defaultSeoDescription,
        MAX_LENGTHS.defaultSeoDescription,
      ),
      defaultSeoKeywords: parseKeywords(body.defaultSeoKeywords),
      defaultOgImage: images.defaultOgImage,
      favicon: images.favicon,
      logo: images.logo,
      currency,
      currencyPosition: currencyPosition as CurrencyPosition,
      timezone,
      locale,
      storeType: storeType as StoreType,
      footerDescription: cleanOptional(
        body.footerDescription,
        MAX_LENGTHS.footerDescription,
      ),
      contactNumber: cleanOptional(body.contactNumber, MAX_LENGTHS.contactNumber),
      contactEmail,
      address: cleanOptional(body.address, MAX_LENGTHS.address),
      ...social,
    },
  };
}

export function resolveSiteSettings(
  settings?: SiteSettingsRecord | null,
  catalogKeywords: readonly string[] = [],
): ResolvedSiteSettings {
  const storeName =
    cleanOptional(settings?.storeName, MAX_LENGTHS.storeName) ||
    cleanOptional(settings?.siteTitle, MAX_LENGTHS.storeName) ||
    SITE_SETTINGS_DEFAULTS.storeName;
  const logo = cleanOptional(settings?.logo, MAX_LENGTHS.image);
  const favicon = cleanOptional(settings?.favicon, MAX_LENGTHS.image);
  const defaultOgImage = cleanOptional(settings?.defaultOgImage, MAX_LENGTHS.image);
  const explicitKeywords = parseKeywords(settings?.defaultSeoKeywords ?? []);
  const derivedKeywords = parseKeywords([
    storeName,
    ...catalogKeywords,
    "online store",
    "ecommerce",
    "online shopping",
    "secure checkout",
  ]);
  const siteDescription =
    cleanOptional(settings?.defaultSeoDescription, MAX_LENGTHS.defaultSeoDescription) ||
    cleanOptional(settings?.footerDescription, MAX_LENGTHS.defaultSeoDescription) ||
    SITE_SETTINGS_DEFAULTS.defaultSeoDescription;
  const currency = String(settings?.currency ?? SITE_SETTINGS_DEFAULTS.currency)
    .trim()
    .toUpperCase();
  const locale = String(settings?.locale ?? SITE_SETTINGS_DEFAULTS.locale).trim();
  const timezone = String(settings?.timezone ?? SITE_SETTINGS_DEFAULTS.timezone).trim();
  const currencyPosition = String(
    settings?.currencyPosition ?? SITE_SETTINGS_DEFAULTS.currencyPosition,
  ).toUpperCase() as CurrencyPosition;
  const storeType = String(settings?.storeType ?? SITE_SETTINGS_DEFAULTS.storeType)
    .toUpperCase() as StoreType;

  return {
    storeName,
    siteTitle: storeName,
    storeTagline:
      cleanOptional(settings?.storeTagline, MAX_LENGTHS.storeTagline) ||
      SITE_SETTINGS_DEFAULTS.storeTagline,
    defaultSeoTitle:
      cleanOptional(settings?.defaultSeoTitle, MAX_LENGTHS.defaultSeoTitle) || storeName,
    defaultSeoDescription: siteDescription,
    siteDescription,
    defaultSeoKeywords: explicitKeywords.length ? explicitKeywords : derivedKeywords,
    defaultOgImage,
    ogImage: defaultOgImage || logo || SITE_SETTINGS_DEFAULTS.logo,
    favicon: favicon || logo || SITE_SETTINGS_DEFAULTS.favicon,
    logo: logo || SITE_SETTINGS_DEFAULTS.logo,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : SITE_SETTINGS_DEFAULTS.currency,
    currencyPosition: CURRENCY_POSITIONS.includes(currencyPosition)
      ? currencyPosition
      : SITE_SETTINGS_DEFAULTS.currencyPosition,
    timezone: validTimezone(timezone) ? timezone : SITE_SETTINGS_DEFAULTS.timezone,
    locale: validLocale(locale) ? locale : SITE_SETTINGS_DEFAULTS.locale,
    storeType: STORE_TYPES.includes(storeType) ? storeType : SITE_SETTINGS_DEFAULTS.storeType,
    footerDescription: cleanOptional(
      settings?.footerDescription,
      MAX_LENGTHS.footerDescription,
    ),
    contactNumber: cleanOptional(settings?.contactNumber, MAX_LENGTHS.contactNumber),
    contactEmail: cleanOptional(settings?.contactEmail, MAX_LENGTHS.contactEmail),
    address: cleanOptional(settings?.address, MAX_LENGTHS.address),
    facebookLink: cleanOptional(settings?.facebookLink, MAX_LENGTHS.social),
    instagramLink: cleanOptional(settings?.instagramLink, MAX_LENGTHS.social),
    twitterLink: cleanOptional(settings?.twitterLink, MAX_LENGTHS.social),
    tiktokLink: cleanOptional(settings?.tiktokLink, MAX_LENGTHS.social),
    youtubeLink: cleanOptional(settings?.youtubeLink, MAX_LENGTHS.social),
  };
}
