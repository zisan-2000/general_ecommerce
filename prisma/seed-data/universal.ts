import type { Prisma, PrismaClient } from "../../generated/prisma";
import {
  DEFAULT_STORE_FEATURES,
  STORE_FEATURE_KEYS,
} from "../../lib/store-features";
import { SITE_SETTINGS_DEFAULTS } from "../../lib/site-settings";

const UNIVERSAL_CATEGORIES = [
  { name: "General", slug: "general", sortOrder: 10, featured: true },
  { name: "Home & Living", slug: "home-living", sortOrder: 20, featured: true },
  { name: "Fashion", slug: "fashion", sortOrder: 30, featured: true },
  { name: "Books & Media", slug: "books-media", sortOrder: 40, featured: true },
  { name: "Services", slug: "services", sortOrder: 50, featured: true },
] as const;

type ExistingStoreSettings = {
  storeName: string | null;
  siteTitle: string | null;
  currency: string | null;
  currencyPosition: string | null;
  timezone: string | null;
  locale: string | null;
  storeType: string | null;
};

type UniversalSeedClient = PrismaClient | Prisma.TransactionClient;

function blank(value: string | null | undefined) {
  return !value || !value.trim();
}

export function getUniversalSettingsBackfill(settings: ExistingStoreSettings) {
  const storeName = settings.storeName?.trim() ?? "";
  const siteTitle = settings.siteTitle?.trim() ?? "";
  const resolvedName = storeName || siteTitle || SITE_SETTINGS_DEFAULTS.storeName;

  return {
    ...(storeName ? {} : { storeName: resolvedName }),
    ...(siteTitle ? {} : { siteTitle: resolvedName }),
    ...(blank(settings.currency)
      ? { currency: SITE_SETTINGS_DEFAULTS.currency }
      : {}),
    ...(blank(settings.currencyPosition)
      ? { currencyPosition: SITE_SETTINGS_DEFAULTS.currencyPosition }
      : {}),
    ...(blank(settings.timezone)
      ? { timezone: SITE_SETTINGS_DEFAULTS.timezone }
      : {}),
    ...(blank(settings.locale) ? { locale: SITE_SETTINGS_DEFAULTS.locale } : {}),
    ...(blank(settings.storeType)
      ? { storeType: SITE_SETTINGS_DEFAULTS.storeType }
      : {}),
  };
}

export async function seedUniversalStorefront(prisma: UniversalSeedClient) {
  const existingSettings = await prisma.sitesettings.findFirst({
    orderBy: { id: "asc" },
    select: {
      id: true,
      storeName: true,
      siteTitle: true,
      currency: true,
      currencyPosition: true,
      timezone: true,
      locale: true,
      storeType: true,
    },
  });

  let settingsBackfilled = false;

  if (!existingSettings) {
    await prisma.sitesettings.create({
      data: {
        siteTitle: SITE_SETTINGS_DEFAULTS.storeName,
        storeName: SITE_SETTINGS_DEFAULTS.storeName,
        storeTagline: SITE_SETTINGS_DEFAULTS.storeTagline,
        defaultSeoTitle: SITE_SETTINGS_DEFAULTS.storeName,
        defaultSeoDescription: SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
        defaultSeoKeywords: ["online store", "products", "shopping"],
        currency: SITE_SETTINGS_DEFAULTS.currency,
        currencyPosition: SITE_SETTINGS_DEFAULTS.currencyPosition,
        timezone: SITE_SETTINGS_DEFAULTS.timezone,
        locale: SITE_SETTINGS_DEFAULTS.locale,
        storeType: SITE_SETTINGS_DEFAULTS.storeType,
        logo: SITE_SETTINGS_DEFAULTS.logo,
        favicon: SITE_SETTINGS_DEFAULTS.favicon,
        footerDescription: SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
      },
    });
  } else {
    const settingsBackfill = getUniversalSettingsBackfill(existingSettings);
    if (Object.keys(settingsBackfill).length > 0) {
      await prisma.sitesettings.update({
        where: { id: existingSettings.id },
        data: settingsBackfill,
      });
      settingsBackfilled = true;
    }
  }

  for (const category of UNIVERSAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        deleted: false,
        isActive: true,
        showInHeader: true,
        showInFooter: true,
        featured: category.featured,
        sortOrder: category.sortOrder,
      },
      create: {
        name: category.name,
        slug: category.slug,
        deleted: false,
        isActive: true,
        showInHeader: true,
        showInFooter: true,
        featured: category.featured,
        sortOrder: category.sortOrder,
      },
    });
  }

  await prisma.storeFeature.createMany({
    data: STORE_FEATURE_KEYS.map((key) => ({
      key,
      enabled: DEFAULT_STORE_FEATURES[key],
    })),
    skipDuplicates: true,
  });

  return {
    categoriesEnsured: UNIVERSAL_CATEGORIES.length,
    settingsCreated: !existingSettings,
    settingsBackfilled,
    featureDefaultsEnsured: STORE_FEATURE_KEYS.length,
  };
}
