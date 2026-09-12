import { PC_BUILDER_SLOTS } from "./pc-builder-core";

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stringOptions(options: unknown) {
  if (!options || typeof options !== "object" || Array.isArray(options)) return {};

  return Object.fromEntries(
    Object.entries(options as Record<string, unknown>).flatMap(([name, value]) =>
      name !== "__meta" && typeof value === "string" && value.trim()
        ? [[name.trim(), value.trim()] as const]
        : [],
    ),
  );
}

function slotForCategory(categorySlug: string | null | undefined) {
  const slug = String(categorySlug ?? "").trim().toLocaleLowerCase();
  return PC_BUILDER_SLOTS.find((slot) => slot.categorySlug === slug)?.key ?? null;
}

/**
 * Variant choices are compatibility data too. In particular, RAM products
 * commonly call DDR4/DDR5 simply "Type" in their sellable variant setup.
 */
export function mergePcBuilderVariantAttributes(
  categorySlug: string | null | undefined,
  attributes: Record<string, string>,
  options: unknown,
) {
  const variantAttributes = stringOptions(options);
  const merged = { ...attributes, ...variantAttributes };

  if (slotForCategory(categorySlug) === "memory") {
    const entries = Object.entries(merged);
    const hasCanonicalMemoryType = entries.some(([name]) =>
      ["memory type", "ram type"].includes(normalizedName(name)),
    );
    const genericType = Object.entries(variantAttributes).find(
      ([name]) => normalizedName(name) === "type",
    )?.[1];

    if (!hasCanonicalMemoryType && genericType) {
      merged["Memory Type"] = genericType;
    }
  }

  return merged;
}
