import { prisma } from "@/lib/prisma";
import {
  configurableBundleInclude,
  resolveBundleConfiguration,
} from "@/lib/configurable-bundle";

const EXPECTED_BUNDLES = [
  "monthly-grocery-starter-bundle",
  "monthly-grocery-family-bundle",
  "monthly-grocery-large-family-bundle",
] as const;

async function main() {
  const bundleFeature = await prisma.storeFeature.findUnique({
    where: { key: "BUNDLES" },
    select: { enabled: true },
  });
  const bundles = await prisma.product.findMany({
    where: {
      slug: { in: [...EXPECTED_BUNDLES] },
      type: "BUNDLE",
      deleted: false,
    },
    include: {
      category: { select: { slug: true, isActive: true, deleted: true } },
      bundleItems: { select: { id: true } },
      ...configurableBundleInclude,
    },
    orderBy: { id: "asc" },
  });
  const errors: string[] = [];
  if (!bundleFeature?.enabled) {
    errors.push("The BUNDLES storefront feature is not enabled");
  }
  const foundSlugs = new Set(bundles.map((bundle) => bundle.slug));

  for (const slug of EXPECTED_BUNDLES) {
    if (!foundSlugs.has(slug)) errors.push(`Missing grocery bundle: ${slug}`);
  }

  for (const bundle of bundles) {
    if (!bundle.available) errors.push(`${bundle.name} is not available`);
    if (!bundle.featured) errors.push(`${bundle.name} is not featured`);
    if (
      bundle.category.slug !== "monthly-grocery-bundles" ||
      !bundle.category.isActive ||
      bundle.category.deleted
    ) {
      errors.push(`${bundle.name} has an unavailable bundle category`);
    }
    if (bundle.bundleGroups.length !== 8) {
      errors.push(`${bundle.name} must have exactly 8 configuration groups`);
    }
    if (bundle.bundleItems.length < 6) {
      errors.push(`${bundle.name} has an incomplete default component list`);
    }
    try {
      const configuration = resolveBundleConfiguration({ bundle });
      if (configuration.availableQuantity < 1) {
        errors.push(`${bundle.name} has no sellable default configuration`);
      }
      if (configuration.finalPrice > configuration.regularTotal) {
        errors.push(`${bundle.name} default price exceeds its component total`);
      }
      console.log(
        `  - #${bundle.id} ${bundle.name}: BDT ${configuration.finalPrice}, stock ${configuration.availableQuantity}, ${bundle.bundleGroups.length} groups`,
      );
    } catch (error) {
      errors.push(
        `${bundle.name} cannot resolve its default configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Grocery bundle verification failed:\n- ${errors.join("\n- ")}`);
  }
  console.log(`✅ Grocery bundle database ready: ${bundles.length} bundles verified.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
