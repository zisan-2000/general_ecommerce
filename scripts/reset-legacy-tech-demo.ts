import nextEnv from "@next/env";
import { PrismaClient } from "../generated/prisma";
import { SITE_SETTINGS_DEFAULTS } from "../lib/site-settings";
import { seedUniversalStorefront } from "../prisma/seed-data/universal";
import {
  assertLegacyTechDemoReset,
  collectLegacyTechDemoState,
  LEGACY_TECH_BANNER_IMAGES,
  LEGACY_TECH_BANNER_TITLES,
  LEGACY_TECH_BRAND_SLUGS,
  LEGACY_TECH_CATEGORY_SLUGS,
  printLegacyTechDemoAudit,
} from "./legacy-tech-demo-state";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

function requireExplicitResetAuthorization() {
  if (process.env.ALLOW_UNIVERSAL_RESET !== "true") {
    throw new Error(
      "Reset blocked. Take a database backup, then set ALLOW_UNIVERSAL_RESET=true to confirm this one-time conversion.",
    );
  }
}

async function main() {
  requireExplicitResetAuthorization();

  const before = await collectLegacyTechDemoState(prisma);
  printLegacyTechDemoAudit(before);

  if (!before.looksLikeLegacyTechDemo) {
    throw new Error(
      "Reset blocked because the database does not match the legacy TechHub demo with high confidence.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const legacyCategories = await tx.category.findMany({
      where: { slug: { in: LEGACY_TECH_CATEGORY_SLUGS } },
      select: { id: true },
    });
    const categoryIds = legacyCategories.map((category) => category.id);

    if (categoryIds.length) {
      await tx.review.updateMany({
        where: {
          feature: true,
          product: { categoryId: { in: categoryIds } },
        },
        data: { feature: false },
      });

      await tx.product.updateMany({
        where: {
          categoryId: { in: categoryIds },
          deleted: false,
        },
        data: {
          deleted: true,
          available: false,
          featured: false,
          flashSaleEnabled: false,
        },
      });
    }

    await tx.category.updateMany({
      where: { slug: { in: LEGACY_TECH_CATEGORY_SLUGS } },
      data: {
        isActive: false,
        showInHeader: false,
        showInFooter: false,
        featured: false,
      },
    });

    await tx.banner.updateMany({
      where: {
        isActive: true,
        OR: [
          { title: { in: LEGACY_TECH_BANNER_TITLES } },
          { image: { in: LEGACY_TECH_BANNER_IMAGES } },
        ],
      },
      data: { isActive: false },
    });

    await tx.brand.updateMany({
      where: {
        slug: { in: LEGACY_TECH_BRAND_SLUGS },
        deleted: false,
        products: { none: { deleted: false } },
      },
      data: { deleted: true },
    });

    const settings = await tx.sitesettings.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });

    if (settings) {
      await tx.sitesettings.update({
        where: { id: settings.id },
        data: {
          siteTitle: SITE_SETTINGS_DEFAULTS.storeName,
          storeName: SITE_SETTINGS_DEFAULTS.storeName,
          storeTagline: SITE_SETTINGS_DEFAULTS.storeTagline,
          defaultSeoTitle: SITE_SETTINGS_DEFAULTS.storeName,
          defaultSeoDescription: SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
          defaultSeoKeywords: ["online store", "products", "shopping"],
          defaultOgImage: null,
          logo: SITE_SETTINGS_DEFAULTS.logo,
          favicon: SITE_SETTINGS_DEFAULTS.favicon,
          currency: SITE_SETTINGS_DEFAULTS.currency,
          currencyPosition: SITE_SETTINGS_DEFAULTS.currencyPosition,
          timezone: SITE_SETTINGS_DEFAULTS.timezone,
          locale: SITE_SETTINGS_DEFAULTS.locale,
          storeType: SITE_SETTINGS_DEFAULTS.storeType,
          footerDescription: SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
        },
      });
    }

    await tx.storeFeature.upsert({
      where: { key: "PC_BUILDER" },
      update: { enabled: false },
      create: { key: "PC_BUILDER", enabled: false },
    });

    await seedUniversalStorefront(tx as never);
  });

  const after = await collectLegacyTechDemoState(prisma);
  assertLegacyTechDemoReset(after);
  printLegacyTechDemoAudit(after);

  console.log(
    "Legacy TechHub demo storefront was converted to the neutral universal baseline without deleting historical rows.",
  );
}

main()
  .catch((error) => {
    console.error("Legacy TechHub demo reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
