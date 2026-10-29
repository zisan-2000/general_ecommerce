const MAX_BANNER_LINK_LENGTH = 500;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export type BannerLinkResult =
  | { ok: true; value: string | null }
  | { ok: false; value: null };

/** Banner destinations are deliberately limited to this storefront. */
export function parseBannerLink(input: unknown): BannerLinkResult {
  if (input === undefined || input === null || input === "") {
    return { ok: true, value: null };
  }
  if (typeof input !== "string") return { ok: false, value: null };

  const value = input.trim();
  if (!value) return { ok: true, value: null };
  if (
    value.length > MAX_BANNER_LINK_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return { ok: false, value: null };
  }

  try {
    const parsed = new URL(value, "https://storefront.invalid");
    if (parsed.origin !== "https://storefront.invalid") {
      return { ok: false, value: null };
    }
    return {
      ok: true,
      value: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    };
  } catch {
    return { ok: false, value: null };
  }
}

export function categoryBannerLink(slug: string) {
  return `/ecommerce/products?category=${encodeURIComponent(slug)}`;
}
