import type { Prisma, PrismaClient } from "../generated/prisma";
import {
  STOREFRONT_BANNERS,
  STOREFRONT_BRANDS,
  STOREFRONT_CATEGORIES,
} from "../prisma/seed-data/storefront/constants";

export const LEGACY_TECH_CATEGORY_SLUGS = Array.from(
  new Set(STOREFRONT_CATEGORIES.map((category) => category.slug)),
);

export const LEGACY_TECH_BRAND_SLUGS = Array.from(
  new Set(STOREFRONT_BRANDS.map((brand) => brand.slug)),
);

export const LEGACY_TECH_BANNER_TITLES = Array.from(
  new Set(STOREFRONT_BANNERS.map((banner) => banner.title)),
);

export const LEGACY_TECH_BANNER_IMAGES = Array.from(
  new Set(STOREFRONT_BANNERS.map((banner) => banner.image)),
);

type DbClient = PrismaClient | Prisma.TransactionClient;

export type LegacyTechDemoState = Awaited<
  ReturnType<typeof collectLegacyTechDemoState>
>;

function containsTechHub(value: string | null | undefined) {
  return /techhub/i.test(value ?? "");
}

export async function collectLegacyTechDemoState(db: DbClient) {
  const settings = await db.sitesettings.findFirst({
    orderBy: { id: "asc" },
    select: {
      id: true,
      storeName: true,
      siteTitle: true,
      storeType: true,
      defaultSeoTitle: true,
      defaultOgImage: true,
      logo: true,
    },
  });

  const categories = await db.category.findMany({
    where: { slug: { in: LEGACY_TECH_CATEGORY_SLUGS } },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      deleted: true,
      isActive: true,
      showInHeader: true,
      showInFooter: true,
      featured: true,
    },
  });
  const categoryIds = categories.map((category) => category.id);

  const [
    totalProducts,
    availableProducts,
    activeBanners,
    matchingBrands,
    featuredReviews,
    pcBuilder,
  ] = await Promise.all([
    categoryIds.length
      ? db.product.count({
          where: { categoryId: { in: categoryIds }, deleted: false },
        })
      : Promise.resolve(0),
    categoryIds.length
      ? db.product.count({
          where: {
            categoryId: { in: categoryIds },
            deleted: false,
            available: true,
          },
        })
      : Promise.resolve(0),
    db.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { in: LEGACY_TECH_BANNER_TITLES } },
          { image: { in: LEGACY_TECH_BANNER_IMAGES } },
        ],
      },
      orderBy: [{ type: "asc" }, { position: "asc" }, { id: "asc" }],
      select: { id: true, title: true, type: true, image: true },
    }),
    db.brand.findMany({
      where: {
        slug: { in: LEGACY_TECH_BRAND_SLUGS },
        deleted: false,
      },
      orderBy: { id: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    categoryIds.length
      ? db.review.count({
          where: {
            feature: true,
            product: { categoryId: { in: categoryIds } },
          },
        })
      : Promise.resolve(0),
    db.storeFeature.findFirst({
      where: { key: "PC_BUILDER" },
      select: { enabled: true },
    }),
  ]);

  const storefrontVisibleCategories = categories.filter(
    (category) =>
      !category.deleted &&
      category.isActive &&
      (category.showInHeader || category.showInFooter || category.featured),
  );

  const identityLooksLikeDemo =
    containsTechHub(settings?.storeName) ||
    containsTechHub(settings?.siteTitle) ||
    containsTechHub(settings?.defaultSeoTitle) ||
    containsTechHub(settings?.defaultOgImage) ||
    containsTechHub(settings?.logo);

  const fingerprintScore =
    (identityLooksLikeDemo ? 4 : 0) +
    (activeBanners.length >= 2 ? 3 : activeBanners.length ? 1 : 0) +
    (storefrontVisibleCategories.length >= 8
      ? 3
      : storefrontVisibleCategories.length >= 3
        ? 1
        : 0) +
    (availableProducts >= 5 ? 2 : availableProducts ? 1 : 0) +
    (matchingBrands.length >= 3 ? 1 : 0);

  return {
    settings,
    identityLooksLikeDemo,
    fingerprintScore,
    looksLikeLegacyTechDemo: identityLooksLikeDemo && fingerprintScore >= 5,
    categories,
    storefrontVisibleCategories,
    categoryIds,
    totalProducts,
    availableProducts,
    activeBanners,
    matchingBrands,
    featuredReviews,
    pcBuilderEnabled: pcBuilder?.enabled ?? null,
  };
}

export function printLegacyTechDemoAudit(state: LegacyTechDemoState) {
  console.log("Legacy TechHub demo audit", {
    storeName: state.settings?.storeName ?? null,
    siteTitle: state.settings?.siteTitle ?? null,
    storeType: state.settings?.storeType ?? null,
    fingerprintScore: state.fingerprintScore,
    looksLikeLegacyTechDemo: state.looksLikeLegacyTechDemo,
    matchingCategories: state.categories.length,
    storefrontVisibleTechCategories: state.storefrontVisibleCategories.length,
    techProducts: state.totalProducts,
    availableTechProducts: state.availableProducts,
    activeTechDemoBanners: state.activeBanners.length,
    matchingLegacyBrands: state.matchingBrands.length,
    featuredTechReviews: state.featuredReviews,
    pcBuilderEnabled: state.pcBuilderEnabled,
  });

  if (state.storefrontVisibleCategories.length) {
    console.log(
      "Visible legacy tech categories:",
      state.storefrontVisibleCategories.map((category) => category.slug).join(", "),
    );
  }

  if (state.activeBanners.length) {
    console.log(
      "Active legacy tech banners:",
      state.activeBanners.map((banner) => banner.title).join(" | "),
    );
  }

  if (state.matchingBrands.length) {
    console.log(
      "Legacy demo brand fingerprints (preserved for safe reuse):",
      state.matchingBrands.map((brand) => brand.slug).join(", "),
    );
  }
}

export function assertLegacyTechDemoReset(state: LegacyTechDemoState) {
  const failures: string[] = [];

  if (!state.settings) failures.push("site settings are missing");
  if (state.identityLooksLikeDemo) failures.push("TechHub identity is still configured");
  if (state.settings?.storeType !== "GENERAL") {
    failures.push(`store type is ${state.settings?.storeType ?? "null"}, expected GENERAL`);
  }
  if (state.storefrontVisibleCategories.length) {
    failures.push(
      `${state.storefrontVisibleCategories.length} legacy tech categories are still storefront-visible`,
    );
  }
  if (state.availableProducts) {
    failures.push(`${state.availableProducts} legacy tech products are still available`);
  }
  if (state.activeBanners.length) {
    failures.push(`${state.activeBanners.length} legacy tech demo banners are still active`);
  }
  if (state.featuredReviews) {
    failures.push(`${state.featuredReviews} legacy tech reviews are still featured`);
  }
  if (state.pcBuilderEnabled !== false) {
    failures.push("PC Builder is not explicitly disabled");
  }

  if (failures.length) {
    throw new Error(`Legacy TechHub reset verification failed: ${failures.join("; ")}.`);
  }
}
