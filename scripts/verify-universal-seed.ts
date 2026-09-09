import { PrismaClient } from "../generated/prisma";
import { STORE_FEATURE_KEYS } from "../lib/store-features";
import {
  CURRENCY_POSITIONS,
  STORE_TYPES,
} from "../lib/site-settings";
import { unsafeKnownDemoAccountWhere } from "../lib/demo-credential-safety";

const prisma = new PrismaClient();
const REQUIRED_CATEGORY_SLUGS = [
  "general",
  "home-living",
  "fashion",
  "books-media",
  "services",
] as const;

function requireText(value: string | null | undefined, label: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error(`Universal seed verification failed: ${label} is empty.`);
  }
  return normalized;
}

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
      where: { key: { in: [...STORE_FEATURE_KEYS] } },
    }),
    prisma.user.count({ where: unsafeKnownDemoAccountWhere }),
  ]);

  if (!settings) {
    throw new Error("Universal seed verification failed: site settings missing.");
  }

  const storeName = requireText(settings.storeName, "store name");
  const storeType = requireText(settings.storeType, "store type").toUpperCase();
  const currency = requireText(settings.currency, "currency").toUpperCase();
  const currencyPosition = requireText(
    settings.currencyPosition,
    "currency position",
  ).toUpperCase();
  const timezone = requireText(settings.timezone, "timezone");
  const locale = requireText(settings.locale, "locale");

  if (!STORE_TYPES.includes(storeType as (typeof STORE_TYPES)[number])) {
    throw new Error(
      `Universal seed verification failed: unsupported store type ${settings.storeType}.`,
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      `Universal seed verification failed: invalid currency ${settings.currency}.`,
    );
  }
  if (
    !CURRENCY_POSITIONS.includes(
      currencyPosition as (typeof CURRENCY_POSITIONS)[number],
    )
  ) {
    throw new Error(
      `Universal seed verification failed: invalid currency position ${settings.currencyPosition}.`,
    );
  }

  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  for (const slug of REQUIRED_CATEGORY_SLUGS) {
    const category = bySlug.get(slug);
    if (!category) {
      throw new Error(
        `Universal seed verification failed: missing ${slug} category.`,
      );
    }
    if (
      storeType === "GENERAL" &&
      (category.deleted ||
        !category.isActive ||
        !category.showInHeader ||
        !category.showInFooter)
    ) {
      throw new Error(
        `Universal seed verification failed: ${slug} category is not storefront-ready.`,
      );
    }
  }

  if (featureCount !== STORE_FEATURE_KEYS.length) {
    throw new Error(
      `Universal seed verification failed: expected ${STORE_FEATURE_KEYS.length} feature rows, found ${featureCount}.`,
    );
  }

  if (demoUsers !== 0) {
    throw new Error(
      `Universal seed verification failed: ${demoUsers} unsafe known demo credential account(s) remain.`,
    );
  }

  console.log("Universal seed database verification passed.", {
    storeName,
    storeType,
    currency,
    currencyPosition,
    timezone,
    locale,
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
