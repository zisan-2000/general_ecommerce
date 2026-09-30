import type { StorefrontCatalogData } from "./storefront-catalog";

export type FilterGroup = {
  name: string;
  title: string;
  boolean?: boolean;
  values: Array<{ value: string; productCount: number }>;
};
export const FACET_PAGE_SIZE = 8;

export function catalogFacetPage(
  facets: Pick<StorefrontCatalogData["facets"], "attributes" | "variantOptions" | "specificationGroups">,
  offset = 0,
) {
  const groups: FilterGroup[] = [
    ...facets.attributes.map((group) => ({
      name: `attr_${group.id}`,
      title: `${group.name}${group.unit ? ` (${group.unit})` : ""}`,
      boolean: group.type === "BOOLEAN",
      values: group.values,
    })),
    ...facets.variantOptions.map((group) => ({ name: `variant_${group.name}`, title: group.name, values: group.values })),
    ...facets.specificationGroups.map((group) => ({ name: `spec_${group.key}`, title: `${group.group} · ${group.label}`, values: group.values })),
  ];
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
  return {
    groups: groups.slice(start, start + FACET_PAGE_SIZE),
    nextOffset: start + FACET_PAGE_SIZE < groups.length ? start + FACET_PAGE_SIZE : null,
  };
}
