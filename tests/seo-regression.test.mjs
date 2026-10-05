import assert from "node:assert/strict";
import test from "node:test";
import { resolveSeoSiteUrl } from "../lib/seo-url.ts";
import { catalogCanonicalUrl, isIndexableCatalogView } from "../lib/catalog-seo.ts";
import { sanitizeStorefrontHtml } from "../lib/storefront-html.ts";

const base = {
  q: "", category: "", brands: [], type: "", minPrice: null, maxPrice: null,
  inStock: false, featured: false, sort: "newest", page: 1, perPage: 24,
  attributes: {}, variants: {}, specifications: {},
};

test("development fallback and normalized production origin", () => {
  assert.equal(resolveSeoSiteUrl({ NODE_ENV: "development" }), "http://localhost:3000");
  assert.equal(resolveSeoSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://shop.example.com///" }), "https://shop.example.com");
  assert.equal(resolveSeoSiteUrl({ NEXT_PUBLIC_BASE_URL: "https://primary.example.com", NEXT_PUBLIC_SITE_URL: "https://secondary.example.com" }), "https://primary.example.com");
});

test("production fails closed for missing, malformed, local or non-HTTPS origins", () => {
  for (const url of [undefined, "not a URL", "http://shop.example.com", "https://localhost", "https://localhost.", "https://127.0.0.1", "https://[::1]", "https://192.168.1.2", "https://shop.example.com/path", "https://user:password@shop.example.com", "https://shop.example.com?x=1"]) {
    assert.throws(() => resolveSeoSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: url }));
  }
});

test("server rich text preserves content and useful links without executable markup", () => {
  const html = sanitizeStorefrontHtml('<p>Product details</p><a href="/ecommerce/products?category=laptops">Laptops</a><script>alert(1)</script><img src="/images/product.jpg" alt="Laptop" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>');
  assert.match(html, /Product details/);
  assert.match(html, /href="\/ecommerce\/products\?category=laptops"/);
  assert.match(html, /alt="Laptop"/);
  assert.doesNotMatch(html, /<script|onerror|javascript:/);
  assert.equal(sanitizeStorefrontHtml('Plain text\nsecond line'), 'Plain text<br />second line');
});

test("clean category, brand and pagination remain distinct canonical landing pages", () => {
  for (const filters of [base, { ...base, category: "laptops" }, { ...base, brands: ["acme"] }, { ...base, category: "laptops", page: 2 }]) {
    assert.equal(isIndexableCatalogView(filters), true);
  }
  assert.equal(catalogCanonicalUrl({ ...base, category: "laptops", page: 2 }), "/ecommerce/products?category=laptops&page=2");
  assert.equal(catalogCanonicalUrl({ ...base, brands: ["acme"] }), "/ecommerce/products?brand=acme");
});

test("search, sort and arbitrary facets stay noindex and shed facets from canonical", () => {
  for (const override of [{ q: "laptop" }, { sort: "popular" }, { minPrice: 100 }, { inStock: true }, { featured: true }, { brands: ["acme", "other"] }, { category: "laptops", brands: ["acme"] }, { attributes: { "1": ["red"] } }, { variants: { Size: ["L"] } }, { specifications: { memory: ["16GB"] } }, { perPage: 12 }]) {
    assert.equal(isIndexableCatalogView({ ...base, ...override }), false);
  }
  assert.equal(catalogCanonicalUrl({ ...base, category: "laptops", brands: ["acme"], minPrice: 100, attributes: { "1": ["red"] } }), "/ecommerce/products?category=laptops");
});
