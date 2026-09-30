export const STOREFRONT_PAGE_SIZE = 24;
export function storefrontPage(value: unknown) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100_000) : 1;
}
