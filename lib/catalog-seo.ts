import type { CatalogFilters } from "./storefront-catalog";
const CATALOG_ATTRIBUTE_PREFIX = "attr_";
const CATALOG_VARIANT_PREFIX = "variant_";

export function catalogCanonicalUrl(filters: CatalogFilters) {
  const keepBrand = !filters.category && filters.brands.length === 1;
  return catalogUrl(filters, {
    q: "",
    brands: keepBrand ? filters.brands : [],
    attributes: {},
    variants: {},
    specifications: {},
    type: "",
    minPrice: null,
    maxPrice: null,
    inStock: false,
    featured: false,
    sort: "newest",
    page: filters.page,
    perPage: 24,
  });
}

export function isIndexableCatalogView(filters: CatalogFilters) {
  return (
    !filters.q &&
    Object.keys(filters.attributes).length === 0 &&
    Object.keys(filters.variants).length === 0 &&
    Object.keys(filters.specifications ?? {}).length === 0 &&
    filters.brands.length <= 1 &&
    !(filters.category && filters.brands.length > 0) &&
    !filters.type &&
    filters.minPrice === null &&
    filters.maxPrice === null &&
    !filters.inStock &&
    !filters.featured &&
    filters.sort === "newest" &&
    filters.perPage === 24
  );
}

export function catalogUrl(
  filters: CatalogFilters,
  overrides: Partial<CatalogFilters> = {},
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", String(next.q));
  if (next.category) params.set("category", String(next.category));
  for (const brand of next.brands) params.append("brand", brand);
  if (next.type) params.set("type", String(next.type));
  if (next.minPrice !== null) params.set("minPrice", String(next.minPrice));
  if (next.maxPrice !== null) params.set("maxPrice", String(next.maxPrice));
  for (const [attributeId, values] of Object.entries(next.attributes ?? {})) {
    for (const value of values) {
      params.append(`${CATALOG_ATTRIBUTE_PREFIX}${attributeId}`, value);
    }
  }
  for (const [name, values] of Object.entries(next.variants ?? {})) {
    for (const value of values) {
      params.append(`${CATALOG_VARIANT_PREFIX}${name}`, value);
    }
  }
  for (const [key, values] of Object.entries(next.specifications ?? {})) {
    for (const value of values) params.append(`spec_${key}`, value);
  }
  if (next.inStock) params.set("inStock", "1");
  if (next.featured) params.set("featured", "1");
  if (next.sort !== "newest") params.set("sort", String(next.sort));
  if (Number(next.page) > 1) params.set("page", String(next.page));
  if (Number(next.perPage) !== 24) params.set("perPage", String(next.perPage));
  const query = params.toString();
  return `/ecommerce/products${query ? `?${query}` : ""}`;
}
