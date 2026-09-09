import type { PrismaClient } from "../../generated/prisma";
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

export async function seedUniversalStorefront(prisma: PrismaClient) {
  const existingSettings = await prisma.sitesettings.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });

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
    featureDefaultsEnsured: STORE_FEATURE_KEYS.length,
  };
}
