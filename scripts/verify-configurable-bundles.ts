import { loadEnvConfig } from "@next/env";
import { prisma } from "@/lib/prisma";
import { configurableBundleInclude, resolveBundleConfiguration } from "@/lib/configurable-bundle";

loadEnvConfig(process.cwd());

async function main() {
  const bundles = await prisma.product.findMany({
    where: { type: "BUNDLE", deleted: false },
    select: {
      id: true,
      name: true,
      sku: true,
      available: true,
      bundleWarehouseId: true,
      bundleFulfillmentMode: true,
      bundleWarehouse: { select: { id: true } },
      variants: { select: { id: true } },
      bundleGroups: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          selectionType: true,
          required: true,
          minSelect: true,
          maxSelect: true,
          options: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              isDefault: true,
              product: { select: { type: true, available: true, deleted: true } },
              variant: { select: { productId: true, active: true } },
            },
          },
        },
      },
    },
  });

  const errors: string[] = [];
  for (const bundle of bundles) {
    if (bundle.variants.length > 0) {
      errors.push(`${bundle.name}: bundle inventory must not use parent product variants`);
    }
    if (!bundle.bundleWarehouseId || !bundle.bundleWarehouse) errors.push(`${bundle.name}: fulfillment warehouse is missing`);
    if (bundle.bundleGroups.length < 2) {
      errors.push(`${bundle.name}: requires at least two selection groups`);
    }
    for (const group of bundle.bundleGroups) {
      const defaultCount = group.options.filter((option) => option.isDefault).length;
      const minimum = group.required ? Math.max(1, group.minSelect) : group.minSelect;
      if (group.options.length === 0) errors.push(`${bundle.name}/${group.name}: has no choices`);
      if (defaultCount < minimum || defaultCount > group.maxSelect) {
        errors.push(`${bundle.name}/${group.name}: invalid default selection count`);
      }
      if (group.selectionType === "FIXED" && group.options.length !== 1) {
        errors.push(`${bundle.name}/${group.name}: fixed group must have one choice`);
      }
      for (const option of group.options) {
        if (!option.product.available || option.product.deleted || option.product.type === "BUNDLE") {
          errors.push(`${bundle.name}/${group.name}: choice ${option.id} points to an unavailable/nested product`);
        }
        if (option.product.type === "PHYSICAL" && !option.variantId) {
          errors.push(`${bundle.name}/${group.name}: physical choice ${option.id} is not pinned to a variant`);
        }
        if (
          option.variant &&
          (option.variant.productId !== option.productId || !option.variant.active)
        ) {
          errors.push(`${bundle.name}/${group.name}: choice ${option.id} has an invalid variant`);
        }
      }
    }
  }

  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'CartItem_user_product_line_null_variant_key'
  `;
  if (indexes.length !== 1) errors.push("Configured-bundle cart uniqueness index is missing");

  const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
    SELECT conname FROM pg_constraint WHERE conname IN (
      'BundleStockLevel_quantity_nonnegative_check',
      'BundleStockLevel_reserved_nonnegative_check',
      'BundleStockLevel_reserved_lte_quantity_check',
      'BundleStockReservation_quantity_positive_check'
    )
  `;
  if (constraints.length !== 4) errors.push("Finished bundle stock/reservation safety constraints are missing");
  const invalidStock = await prisma.bundleStockLevel.count({ where: { OR: [{ quantity: { lt: 0 } }, { reserved: { lt: 0 } }] } });
  if (invalidStock) errors.push("Invalid finished bundle stock records exist");
  for (const bundle of bundles) {
    const configuration = await prisma.product.findUniqueOrThrow({ where: { id: bundle.id }, include: configurableBundleInclude });
    try {
      resolveBundleConfiguration({ bundle: configuration, strictWarehouseStock: true });
    } catch (error) {
      errors.push(`${bundle.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configurable bundle database verification failed:\n- ${errors.join("\n- ")}`);
  }

  console.log(
    `✅ Bundle database infrastructure verified (warehouse, finished stock, reservations, cart uniqueness): ${bundles.length} bundle(s), ${bundles.reduce(
      (total, bundle) => total + bundle.bundleGroups.length,
      0,
    )} group(s).`,
  );
  for (const bundle of bundles) {
    console.log(
      `  - #${bundle.id} ${bundle.name} (${bundle.sku ?? "no SKU"}): ${bundle.bundleGroups.length} groups`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
