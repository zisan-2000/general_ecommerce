import type { PrismaClient } from "../../generated/prisma";

type GroceryProductKey =
  | "miniketRice"
  | "nazirshailRice"
  | "soybeanOil"
  | "mustardOil"
  | "masoorDal"
  | "atta"
  | "sugar"
  | "salt"
  | "spicePack"
  | "tea";

type BundleGroupSeed = {
  name: string;
  selectionType: "FIXED" | "PRODUCT_SELECT" | "OPTIONAL";
  quantity: number;
  required: boolean;
  options: Array<{ productKey: GroceryProductKey; isDefault: boolean }>;
};

const GROCERY_PRODUCTS: Array<{
  key: GroceryProductKey;
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  description: string;
  shortDesc: string;
  price: number;
  stock: number;
  weight: number;
}> = [
  {
    key: "miniketRice",
    name: "Daily Basket Miniket Rice 5 kg",
    slug: "daily-basket-miniket-rice-5-kg",
    sku: "GROCERY-RICE-MINIKET-5KG",
    categorySlug: "rice",
    description: "Everyday Miniket rice in a sealed 5 kg family pack.",
    shortDesc: "Miniket rice, 5 kg family pack.",
    price: 580,
    stock: 120,
    weight: 5,
  },
  {
    key: "nazirshailRice",
    name: "Daily Basket Nazirshail Rice 5 kg",
    slug: "daily-basket-nazirshail-rice-5-kg",
    sku: "GROCERY-RICE-NAZIRSHAIL-5KG",
    categorySlug: "rice",
    description: "Aromatic Nazirshail rice in a sealed 5 kg family pack.",
    shortDesc: "Nazirshail rice, 5 kg family pack.",
    price: 720,
    stock: 100,
    weight: 5,
  },
  {
    key: "soybeanOil",
    name: "Daily Basket Soybean Oil 5 litre",
    slug: "daily-basket-soybean-oil-5-litre",
    sku: "GROCERY-OIL-SOYBEAN-5L",
    categorySlug: "oil-and-ghee",
    description: "Refined soybean cooking oil in a 5 litre family container.",
    shortDesc: "Refined soybean oil, 5 litre.",
    price: 890,
    stock: 90,
    weight: 5,
  },
  {
    key: "mustardOil",
    name: "Daily Basket Mustard Oil 2 litre",
    slug: "daily-basket-mustard-oil-2-litre",
    sku: "GROCERY-OIL-MUSTARD-2L",
    categorySlug: "oil-and-ghee",
    description: "Pure mustard oil in a sealed 2 litre container.",
    shortDesc: "Pure mustard oil, 2 litre.",
    price: 620,
    stock: 90,
    weight: 2,
  },
  {
    key: "masoorDal",
    name: "Daily Basket Masoor Dal 2 kg",
    slug: "daily-basket-masoor-dal-2-kg",
    sku: "GROCERY-DAL-MASOOR-2KG",
    categorySlug: "dal-and-pulses",
    description: "Cleaned red lentils packed for regular family meals.",
    shortDesc: "Masoor dal, 2 kg pack.",
    price: 360,
    stock: 140,
    weight: 2,
  },
  {
    key: "atta",
    name: "Daily Basket Atta 2 kg",
    slug: "daily-basket-atta-2-kg",
    sku: "GROCERY-ATTA-2KG",
    categorySlug: "flour-and-atta",
    description: "Whole wheat atta in a sealed 2 kg pack.",
    shortDesc: "Whole wheat atta, 2 kg pack.",
    price: 150,
    stock: 130,
    weight: 2,
  },
  {
    key: "sugar",
    name: "Daily Basket White Sugar 2 kg",
    slug: "daily-basket-white-sugar-2-kg",
    sku: "GROCERY-SUGAR-2KG",
    categorySlug: "salt-and-sugar",
    description: "Refined white sugar in a sealed 2 kg pack.",
    shortDesc: "White sugar, 2 kg pack.",
    price: 280,
    stock: 120,
    weight: 2,
  },
  {
    key: "salt",
    name: "Daily Basket Iodized Salt 1 kg",
    slug: "daily-basket-iodized-salt-1-kg",
    sku: "GROCERY-SALT-1KG",
    categorySlug: "salt-and-sugar",
    description: "Iodized table salt in a sealed 1 kg pack.",
    shortDesc: "Iodized salt, 1 kg pack.",
    price: 45,
    stock: 180,
    weight: 1,
  },
  {
    key: "spicePack",
    name: "Daily Basket Essential Spice Pack 500 gm",
    slug: "daily-basket-essential-spice-pack-500-gm",
    sku: "GROCERY-SPICE-ESSENTIAL-500G",
    categorySlug: "spices",
    description: "A monthly cooking spice set with chilli, turmeric, coriander and cumin powder.",
    shortDesc: "Four essential cooking spices, total 500 gm.",
    price: 250,
    stock: 100,
    weight: 0.5,
  },
  {
    key: "tea",
    name: "Daily Basket Premium Tea 400 gm",
    slug: "daily-basket-premium-tea-400-gm",
    sku: "GROCERY-TEA-400G",
    categorySlug: "tea-and-coffee",
    description: "Strong black tea suitable for everyday family use.",
    shortDesc: "Premium black tea, 400 gm pack.",
    price: 220,
    stock: 100,
    weight: 0.4,
  },
];

const fixedGroup = (
  name: string,
  productKey: GroceryProductKey,
  quantity: number,
): BundleGroupSeed => ({
  name,
  selectionType: "FIXED",
  quantity,
  required: true,
  options: [{ productKey, isDefault: true }],
});

const choiceGroup = (
  name: string,
  defaultProduct: GroceryProductKey,
  alternativeProduct: GroceryProductKey,
  quantity: number,
): BundleGroupSeed => ({
  name,
  selectionType: "PRODUCT_SELECT",
  quantity,
  required: true,
  options: [
    { productKey: defaultProduct, isDefault: true },
    { productKey: alternativeProduct, isDefault: false },
  ],
});

const optionalGroup = (
  name: string,
  productKey: GroceryProductKey,
  quantity = 1,
): BundleGroupSeed => ({
  name,
  selectionType: "OPTIONAL",
  quantity,
  required: false,
  options: [{ productKey, isDefault: false }],
});

const GROCERY_BUNDLES: Array<{
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDesc: string;
  bundlePrice: number;
  stockLimit: number;
  featured: boolean;
  groups: BundleGroupSeed[];
}> = [
  {
    name: "Monthly Grocery Starter Bundle",
    slug: "monthly-grocery-starter-bundle",
    sku: "BUNDLE-GROCERY-MONTHLY-STARTER",
    description:
      "A configurable monthly bazar package for a small family. Choose rice and cooking oil, receive the core essentials, and add spices or tea when needed.",
    shortDesc: "Monthly essentials for a small family with rice and oil choices.",
    bundlePrice: 2190,
    stockLimit: 25,
    featured: true,
    groups: [
      choiceGroup("Choose rice", "miniketRice", "nazirshailRice", 1),
      choiceGroup("Choose cooking oil", "soybeanOil", "mustardOil", 1),
      fixedGroup("Masoor dal", "masoorDal", 1),
      fixedGroup("Atta", "atta", 1),
      fixedGroup("Sugar", "sugar", 1),
      fixedGroup("Salt", "salt", 1),
      optionalGroup("Add essential spices", "spicePack"),
      optionalGroup("Add premium tea", "tea"),
    ],
  },
  {
    name: "Monthly Grocery Family Bundle",
    slug: "monthly-grocery-family-bundle",
    sku: "BUNDLE-GROCERY-MONTHLY-FAMILY",
    description:
      "A configurable monthly bazar package for a regular family, including 10 kg rice, cooking oil, dal, atta, sugar, salt and essential spices.",
    shortDesc: "Balanced monthly bazar for a regular family.",
    bundlePrice: 3750,
    stockLimit: 18,
    featured: true,
    groups: [
      choiceGroup("Choose rice", "miniketRice", "nazirshailRice", 2),
      choiceGroup("Choose cooking oil", "soybeanOil", "mustardOil", 1),
      fixedGroup("Masoor dal", "masoorDal", 2),
      fixedGroup("Atta", "atta", 2),
      fixedGroup("Sugar", "sugar", 2),
      fixedGroup("Salt", "salt", 2),
      fixedGroup("Essential spices", "spicePack", 1),
      optionalGroup("Add premium tea", "tea"),
    ],
  },
  {
    name: "Monthly Grocery Large Family Bundle",
    slug: "monthly-grocery-large-family-bundle",
    sku: "BUNDLE-GROCERY-MONTHLY-LARGE",
    description:
      "A high-volume configurable monthly bazar package for a large family, with increased rice, oil, dal, atta, sugar, salt, spices and tea.",
    shortDesc: "High-volume monthly bazar for a large family.",
    bundlePrice: 6890,
    stockLimit: 12,
    featured: true,
    groups: [
      choiceGroup("Choose rice", "miniketRice", "nazirshailRice", 4),
      choiceGroup("Choose cooking oil", "soybeanOil", "mustardOil", 2),
      fixedGroup("Masoor dal", "masoorDal", 3),
      fixedGroup("Atta", "atta", 3),
      fixedGroup("Sugar", "sugar", 3),
      fixedGroup("Salt", "salt", 2),
      fixedGroup("Essential spices", "spicePack", 2),
      fixedGroup("Premium tea", "tea", 1),
    ],
  },
];

export async function seedGroceryBundles(prisma: PrismaClient) {
  await prisma.storeFeature.upsert({
    where: { key: "BUNDLES" },
    update: { enabled: true },
    create: { key: "BUNDLES", enabled: true },
  });

  const foodCategory = await prisma.category.upsert({
    where: { slug: "food" },
    update: { name: "Food", isActive: true, deleted: false, featured: true },
    create: {
      name: "Food",
      slug: "food",
      isActive: true,
      deleted: false,
      featured: true,
      showInHeader: true,
      sortOrder: 0,
    },
    select: { id: true },
  });
  const cookingCategory = await prisma.category.upsert({
    where: { slug: "cooking" },
    update: { name: "Cooking", parentId: foodCategory.id, isActive: true, deleted: false },
    create: {
      name: "Cooking",
      slug: "cooking",
      parentId: foodCategory.id,
      isActive: true,
      deleted: false,
      showInHeader: false,
      sortOrder: 2,
    },
    select: { id: true },
  });
  const breakfastCategory = await prisma.category.upsert({
    where: { slug: "breakfast" },
    update: { name: "Breakfast", parentId: foodCategory.id, isActive: true, deleted: false },
    create: {
      name: "Breakfast",
      slug: "breakfast",
      parentId: foodCategory.id,
      isActive: true,
      deleted: false,
      showInHeader: false,
      sortOrder: 5,
    },
    select: { id: true },
  });

  const categorySeeds = [
    { name: "Rice", slug: "rice", parentId: cookingCategory.id, sortOrder: 0 },
    { name: "Dal & Pulses", slug: "dal-and-pulses", parentId: cookingCategory.id, sortOrder: 1 },
    { name: "Oil & Ghee", slug: "oil-and-ghee", parentId: cookingCategory.id, sortOrder: 2 },
    { name: "Spices", slug: "spices", parentId: cookingCategory.id, sortOrder: 3 },
    { name: "Salt & Sugar", slug: "salt-and-sugar", parentId: cookingCategory.id, sortOrder: 4 },
    { name: "Flour & Atta", slug: "flour-and-atta", parentId: cookingCategory.id, sortOrder: 5 },
    { name: "Tea & Coffee", slug: "tea-and-coffee", parentId: breakfastCategory.id, sortOrder: 4 },
    { name: "Monthly Grocery Bundles", slug: "monthly-grocery-bundles", parentId: foodCategory.id, sortOrder: 20 },
  ] as const;
  const categoryIds = new Map<string, number>();
  for (const category of categorySeeds) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        parentId: category.parentId,
        isActive: true,
        deleted: false,
        featured: category.slug === "monthly-grocery-bundles",
      },
      create: {
        name: category.name,
        slug: category.slug,
        parentId: category.parentId,
        isActive: true,
        deleted: false,
        featured: category.slug === "monthly-grocery-bundles",
        showInHeader: false,
        sortOrder: category.sortOrder,
      },
      select: { id: true },
    });
    categoryIds.set(category.slug, record.id);
  }

  const brand = await prisma.brand.upsert({
    where: { name: "Daily Basket" },
    update: { slug: "daily-basket", deleted: false },
    create: { name: "Daily Basket", slug: "daily-basket", deleted: false },
    select: { id: true },
  });
  const warehouse = await prisma.warehouse.findFirst({
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  const products = new Map<
    GroceryProductKey,
    { id: number; price: number; variantId: number }
  >();

  for (const item of GROCERY_PRODUCTS) {
    const categoryId = categoryIds.get(item.categorySlug);
    if (!categoryId) throw new Error(`Missing grocery category: ${item.categorySlug}`);
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        sku: item.sku,
        type: "PHYSICAL",
        categoryId,
        brandId: brand.id,
        description: item.description,
        shortDesc: item.shortDesc,
        basePrice: item.price,
        originalPrice: null,
        currency: "BDT",
        weight: item.weight,
        available: true,
        featured: false,
        image: "/placeholder.svg",
        gallery: [],
        bundleStockLimit: null,
        deleted: false,
      },
      create: {
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        type: "PHYSICAL",
        categoryId,
        brandId: brand.id,
        description: item.description,
        shortDesc: item.shortDesc,
        basePrice: item.price,
        currency: "BDT",
        weight: item.weight,
        available: true,
        featured: false,
        image: "/placeholder.svg",
        gallery: [],
        deleted: false,
      },
      select: { id: true },
    });
    const variantSku = `${item.sku}-DEFAULT`;
    const existingVariant = await prisma.productVariant.findFirst({
      where: { productId: product.id, sku: variantSku },
      select: { id: true },
    });
    const variantData = {
      sku: variantSku,
      price: item.price,
      costPrice: Math.round(item.price * 0.78 * 100) / 100,
      currency: "BDT",
      stock: item.stock,
      options: { Pack: item.name.split(" ").slice(-2).join(" ") },
      isDefault: true,
      active: true,
      lowStockThreshold: 10,
    };
    const variant = existingVariant
      ? await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: variantData,
          select: { id: true },
        })
      : await prisma.productVariant.create({
          data: { productId: product.id, ...variantData },
          select: { id: true },
        });
    if (warehouse) {
      await prisma.stockLevel.upsert({
        where: {
          warehouseId_productVariantId: {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
          },
        },
        update: { quantity: item.stock, reserved: 0 },
        create: {
          warehouseId: warehouse.id,
          productVariantId: variant.id,
          quantity: item.stock,
          reserved: 0,
        },
      });
    }
    products.set(item.key, { id: product.id, price: item.price, variantId: variant.id });
  }

  const bundleCategoryId = categoryIds.get("monthly-grocery-bundles");
  if (!bundleCategoryId) throw new Error("Monthly grocery bundle category was not created");

  for (const bundleSeed of GROCERY_BUNDLES) {
    const regularPrice = bundleSeed.groups.reduce((total, group) => {
      const defaultOption = group.options.find((option) => option.isDefault);
      if (!defaultOption) return total;
      const product = products.get(defaultOption.productKey);
      if (!product) throw new Error(`Missing grocery product: ${defaultOption.productKey}`);
      return total + product.price * group.quantity;
    }, 0);
    if (bundleSeed.bundlePrice > regularPrice) {
      throw new Error(`${bundleSeed.name} price cannot exceed its regular component total`);
    }

    const bundle = await prisma.product.upsert({
      where: { slug: bundleSeed.slug },
      update: {
        name: bundleSeed.name,
        sku: bundleSeed.sku,
        type: "BUNDLE",
        categoryId: bundleCategoryId,
        brandId: brand.id,
        description: bundleSeed.description,
        shortDesc: bundleSeed.shortDesc,
        basePrice: bundleSeed.bundlePrice,
        originalPrice: regularPrice,
        currency: "BDT",
        available: true,
        featured: bundleSeed.featured,
        image: "/placeholder.svg",
        gallery: [],
        bundleStockLimit: bundleSeed.stockLimit,
        deleted: false,
      },
      create: {
        name: bundleSeed.name,
        slug: bundleSeed.slug,
        sku: bundleSeed.sku,
        type: "BUNDLE",
        categoryId: bundleCategoryId,
        brandId: brand.id,
        description: bundleSeed.description,
        shortDesc: bundleSeed.shortDesc,
        basePrice: bundleSeed.bundlePrice,
        originalPrice: regularPrice,
        currency: "BDT",
        available: true,
        featured: bundleSeed.featured,
        image: "/placeholder.svg",
        gallery: [],
        bundleStockLimit: bundleSeed.stockLimit,
        deleted: false,
      },
      select: { id: true },
    });

    await prisma.bundleGroup.deleteMany({ where: { bundleId: bundle.id } });
    await prisma.productBundleItem.deleteMany({ where: { bundleId: bundle.id } });
    const legacyItems = new Map<number, { quantity: number; sortOrder: number }>();

    for (const [groupIndex, groupSeed] of bundleSeed.groups.entries()) {
      const group = await prisma.bundleGroup.create({
        data: {
          bundleId: bundle.id,
          name: groupSeed.name,
          selectionType: groupSeed.selectionType,
          pricingMode: "AUTOMATIC",
          required: groupSeed.required,
          minSelect: groupSeed.required ? 1 : 0,
          maxSelect: 1,
          defaultQuantity: groupSeed.quantity,
          minQuantity: groupSeed.quantity,
          maxQuantity: groupSeed.quantity,
          allowQuantityChange: false,
          sortOrder: groupIndex,
        },
        select: { id: true },
      });
      for (const [optionIndex, optionSeed] of groupSeed.options.entries()) {
        const product = products.get(optionSeed.productKey);
        if (!product) throw new Error(`Missing grocery product: ${optionSeed.productKey}`);
        await prisma.bundleGroupOption.create({
          data: {
            groupId: group.id,
            productId: product.id,
            variantId: product.variantId,
            isDefault: optionSeed.isDefault,
            priceAdjustment: 0,
            sortOrder: optionIndex,
          },
        });
        if (optionSeed.isDefault) {
          const existing = legacyItems.get(product.id);
          legacyItems.set(product.id, {
            quantity: (existing?.quantity ?? 0) + groupSeed.quantity,
            sortOrder: existing?.sortOrder ?? groupIndex,
          });
        }
      }
    }

    await prisma.productBundleItem.createMany({
      data: Array.from(legacyItems.entries()).map(([productId, item]) => ({
        bundleId: bundle.id,
        productId,
        quantity: item.quantity,
        sortOrder: item.sortOrder,
      })),
    });
  }

  return {
    products: GROCERY_PRODUCTS.length,
    bundles: GROCERY_BUNDLES.length,
    bundleSlugs: GROCERY_BUNDLES.map((bundle) => bundle.slug),
  };
}
