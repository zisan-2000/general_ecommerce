import { PrismaClient } from "../generated/prisma";
import { STORE_FEATURE_KEYS } from "../lib/store-features";
import { SITE_SETTINGS_DEFAULTS } from "../lib/site-settings";

const prisma = new PrismaClient();
const REQUIRED_CATEGORY_SLUGS = [
  "general",
  "home-living",
  "fashion",
  "books-media",
  "services",
] as const;

async function main() {
  const [settings, categories, featureCount, demoUsers] = await Promise.all([
    prisma.sitesettings.findFirst({ orderBy: { id: "asc" } }),
    prisma.category.findMany({
      where: { slug: { in: [...REQUIRED_CATEGORY_SLUGS] } },
      select: {
        slug: true,
        deleted: true,
        isActive: true,
        showInHeader: true,
        showInFooter: true,
      },
    }),
    prisma.storeFeature.count({
      where: { key: { in: STORE_FEATURE_KEYS } },
    }),
    prisma.user.count({
      where: {
        email: {
          in: [
            "admin@example.com",
            "customer.one@storefront.demo",
            "customer.two@storefront.demo",
            "yousuf@z.shoes.com",
            "mahin@z.shoes.com",
            "salehin@z.shoes.com",
          ],
        },
      },
    }),
  ]);

  if (!settings) throw new Error("Universal seed verification failed: site settings missing.");
  if (!settings.storeName || !settings.storeName.trim()) {
    throw new Error("Universal seed verification failed: store name is empty.");
  }
  if (settings.storeType !== SITE_SETTINGS_DEFAULTS.storeType) {
    throw new Error(`Universal seed verification failed: expected GENERAL store type, got ${settings.storeType}.`);
  }

  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  for (const slug of REQUIRED_CATEGORY_SLUGS) {
    const category = bySlug.get(slug);
    if (!category) throw new Error(`Universal seed verification failed: missing ${slug} category.`);
    if (category.deleted || !category.isActive || !category.showInHeader || !category.showInFooter) {
      throw new Error(`Universal seed verification failed: ${slug} category is not storefront-ready.`);
    }
  }

  if (featureCount !== STORE_FEATURE_KEYS.length) {
    throw new Error(
      `Universal seed verification failed: expected ${STORE_FEATURE_KEYS.length} feature rows, found ${featureCount}.`,
    );
  }

  if (demoUsers !== 0) {
    throw new Error(
      `Universal seed verification failed: safe default seed created ${demoUsers} known demo credential account(s).`,
    );
  }

  const duplicateCategories = await prisma.category.groupBy({
    by: ["slug"],
    where: { slug: { in: [...REQUIRED_CATEGORY_SLUGS] } },
    _count: { _all: true },
    having: { id: { _count: { gt: 1 } } },
  });
  if (duplicateCategories.length) {
    throw new Error("Universal seed verification failed: duplicate baseline category slugs detected.");
  }

  console.log("Universal seed database verification passed.", {
    storeName: settings.storeName,
    storeType: settings.storeType,
    categories: REQUIRED_CATEGORY_SLUGS.length,
    featureRows: featureCount,
    demoCredentialAccounts: demoUsers,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
