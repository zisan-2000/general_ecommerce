import type {
  AttributeType,
  Prisma,
  PrismaClient,
} from "../../generated/prisma";
import type { StoreFeatureKey } from "../../lib/store-features";
import type { StoreType } from "../../lib/site-settings";
import { seedUniversalStorefront, UNIVERSAL_CATEGORIES } from "./universal";

export const STORE_PRESET_KEYS = ["tech", "fashion", "grocery", "book"] as const;
export type StorePresetKey = (typeof STORE_PRESET_KEYS)[number];

type PresetAttribute = {
  name: string;
  type: AttributeType;
  unit?: string;
  values?: readonly string[];
  variant?: boolean;
};

type StorePreset = {
  storeType: StoreType;
  categories: readonly { name: string; slug: string }[];
  features: Readonly<Record<StoreFeatureKey, boolean>>;
  attributes: readonly PresetAttribute[];
};

const CORE_FEATURES = {
  PC_BUILDER: false,
  BOOKS: false,
  AUTHORS: false,
  COMPARE: true,
  DIGITAL_PRODUCTS: false,
  SERVICE_PRODUCTS: false,
  BUNDLES: true,
} as const satisfies Record<StoreFeatureKey, boolean>;

export const STORE_PRESETS = {
  tech: {
    storeType: "TECH",
    categories: [
      { name: "Laptops", slug: "laptop" },
      { name: "Desktop PCs", slug: "desktop-pc" },
      { name: "Components", slug: "components" },
      { name: "Accessories", slug: "accessories" },
      { name: "Monitors", slug: "monitor" },
    ],
    features: {
      ...CORE_FEATURES,
      PC_BUILDER: true,
      DIGITAL_PRODUCTS: true,
      SERVICE_PRODUCTS: true,
    },
    attributes: [
      { name: "Processor", type: "TEXT" },
      { name: "RAM", type: "SELECT", unit: "GB", values: ["8", "16", "32", "64"], variant: true },
      { name: "Storage", type: "SELECT", unit: "GB", values: ["256", "512", "1024", "2048"], variant: true },
      { name: "GPU", type: "TEXT" },
      { name: "Screen Size", type: "NUMBER", unit: "inch" },
    ],
  },
  fashion: {
    storeType: "FASHION",
    categories: [
      { name: "Men", slug: "men" },
      { name: "Women", slug: "women" },
      { name: "Kids", slug: "kids" },
      { name: "Footwear", slug: "footwear" },
      { name: "Accessories", slug: "accessories" },
    ],
    features: CORE_FEATURES,
    attributes: [
      { name: "Color", type: "COLOR", values: ["Black", "White", "Blue", "Red"], variant: true },
      { name: "Size", type: "SELECT", values: ["XS", "S", "M", "L", "XL", "XXL"], variant: true },
      { name: "Material", type: "TEXT" },
      { name: "Gender", type: "SELECT", values: ["Men", "Women", "Unisex", "Kids"] },
    ],
  },
  grocery: {
    storeType: "GROCERY",
    categories: [
      { name: "Food", slug: "food" },
      { name: "Beverages", slug: "beverages" },
      { name: "Fresh Produce", slug: "fresh-produce" },
      { name: "Household", slug: "household" },
      { name: "Personal Care", slug: "personal-care" },
    ],
    features: { ...CORE_FEATURES, COMPARE: false },
    attributes: [
      { name: "Weight", type: "NUMBER", unit: "kg", variant: true },
      { name: "Pack Size", type: "SELECT", values: ["Single", "2 Pack", "6 Pack", "12 Pack"], variant: true },
      { name: "Organic", type: "BOOLEAN" },
      { name: "Origin", type: "TEXT" },
    ],
  },
  book: {
    storeType: "BOOK",
    categories: [
      { name: "Books", slug: "books-media" },
      { name: "Fiction", slug: "fiction" },
      { name: "Non-fiction", slug: "non-fiction" },
      { name: "Children's Books", slug: "children-books" },
      { name: "Academic", slug: "academic-books" },
    ],
    features: {
      ...CORE_FEATURES,
      BOOKS: true,
      AUTHORS: true,
      COMPARE: false,
      DIGITAL_PRODUCTS: true,
    },
    attributes: [
      { name: "Language", type: "SELECT", values: ["Bangla", "English", "Arabic"] },
      { name: "Binding", type: "SELECT", values: ["Paperback", "Hardcover", "E-book"] },
      { name: "Publication Year", type: "NUMBER", unit: "year" },
      { name: "ISBN", type: "TEXT" },
    ],
  },
} as const satisfies Record<StorePresetKey, StorePreset>;

export function parseStorePreset(value: unknown): StorePresetKey {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (STORE_PRESET_KEYS.includes(normalized as StorePresetKey)) {
    return normalized as StorePresetKey;
  }
  throw new Error(`STORE_PRESET must be one of: ${STORE_PRESET_KEYS.join(", ")}.`);
}

export const PRESET_CATEGORY_SLUGS = Array.from(
  new Set([
    ...UNIVERSAL_CATEGORIES.map(({ slug }) => slug),
    ...Object.values(STORE_PRESETS).flatMap((preset) => preset.categories.map(({ slug }) => slug)),
  ]),
);

type PresetClient = PrismaClient | Prisma.TransactionClient;

export async function seedStorePreset(db: PresetClient, key: StorePresetKey) {
  const preset: StorePreset = STORE_PRESETS[key];
  await seedUniversalStorefront(db);

  const settings = await db.sitesettings.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (!settings) throw new Error("Store preset requires site settings.");
  await db.sitesettings.update({ where: { id: settings.id }, data: { storeType: preset.storeType } });

  await db.category.updateMany({
    where: { slug: { in: PRESET_CATEGORY_SLUGS } },
    data: { isActive: false, showInHeader: false, showInFooter: false, featured: false },
  });

  const categories = [];
  for (const [index, category] of preset.categories.entries()) {
    categories.push(await db.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        parentId: null,
        deleted: false,
        isActive: true,
        showInHeader: true,
        showInFooter: true,
        featured: true,
        sortOrder: (index + 1) * 10,
      },
      create: {
        ...category,
        deleted: false,
        isActive: true,
        showInHeader: true,
        showInFooter: true,
        featured: true,
        sortOrder: (index + 1) * 10,
      },
      select: { id: true, slug: true },
    }));
  }

  for (const [key, enabled] of Object.entries(preset.features) as Array<[StoreFeatureKey, boolean]>) {
    await db.storeFeature.upsert({ where: { key }, update: { enabled }, create: { key, enabled } });
  }

  for (const [sortOrder, definition] of preset.attributes.entries()) {
    let attribute = await db.attribute.findFirst({
      where: { name: { equals: definition.name, mode: "insensitive" } },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!attribute) {
      attribute = await db.attribute.create({
        data: { name: definition.name, type: definition.type, unit: definition.unit ?? null },
        select: { id: true },
      });
    }

    if (definition.values?.length) {
      const existing = await db.attributeValue.findMany({
        where: { attributeId: attribute.id },
        select: { value: true },
      });
      const known = new Set(existing.map(({ value }) => value.toLocaleLowerCase("en-US")));
      const missing = definition.values.filter((value) => !known.has(value.toLocaleLowerCase("en-US")));
      if (missing.length) {
        await db.attributeValue.createMany({ data: missing.map((value) => ({ attributeId: attribute.id, value })) });
      }
    }

    for (const category of categories) {
      await db.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: category.id, attributeId: attribute.id } },
        update: { isFilterable: true, isVariant: definition.variant ?? false, sortOrder },
        create: {
          categoryId: category.id,
          attributeId: attribute.id,
          isRequired: false,
          isFilterable: true,
          isVariant: definition.variant ?? false,
          sortOrder,
        },
      });
    }
  }

  return { preset: key, storeType: preset.storeType, categories: categories.length, attributes: preset.attributes.length };
}
