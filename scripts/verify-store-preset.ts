import { PrismaClient } from "../generated/prisma";
import { STORE_FEATURE_KEYS } from "../lib/store-features";
import {
  parseStorePreset,
  PRESET_CATEGORY_SLUGS,
  STORE_PRESETS,
} from "../prisma/seed-data/presets";

const prisma = new PrismaClient();

async function main() {
  const key = parseStorePreset(process.env.STORE_PRESET);
  const preset = STORE_PRESETS[key];
  const [settings, categories, features] = await Promise.all([
    prisma.sitesettings.findFirst({ orderBy: { id: "asc" }, select: { storeType: true } }),
    prisma.category.findMany({
      where: { slug: { in: PRESET_CATEGORY_SLUGS } },
      select: { slug: true, deleted: true, isActive: true, showInHeader: true, showInFooter: true, categoryAttributes: { select: { id: true } } },
    }),
    prisma.storeFeature.findMany({ where: { key: { in: [...STORE_FEATURE_KEYS] } }, select: { key: true, enabled: true } }),
  ]);

  const failures: string[] = [];
  if (settings?.storeType !== preset.storeType) failures.push(`store type is ${settings?.storeType ?? "missing"}`);
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const selectedSlugs = new Set<string>(preset.categories.map(({ slug }) => slug));
  for (const definition of preset.categories) {
    const category = categoryBySlug.get(definition.slug);
    if (!category || category.deleted || !category.isActive || !category.showInHeader || !category.showInFooter) {
      failures.push(`${definition.slug} is not navigation-ready`);
    } else if (category.categoryAttributes.length < preset.attributes.length) {
      failures.push(`${definition.slug} has incomplete attribute mappings`);
    }
  }
  for (const category of categories) {
    if (
      !selectedSlugs.has(category.slug) &&
      (category.isActive || category.showInHeader || category.showInFooter)
    ) {
      failures.push(`${category.slug} from another bundled preset is still visible`);
    }
  }
  const featureByKey = new Map(features.map((feature) => [feature.key, feature.enabled]));
  for (const feature of STORE_FEATURE_KEYS) {
    if (featureByKey.get(feature) !== preset.features[feature]) failures.push(`${feature} does not match the preset`);
  }
  if (failures.length) throw new Error(`Store preset verification failed: ${failures.join("; ")}.`);
  console.log("Store preset verification passed.", { preset: key, storeType: preset.storeType, categories: categories.length, features: features.length });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
