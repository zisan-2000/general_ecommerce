import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public storefront content no longer contains bookstore branding", async () => {
  const files = await Promise.all([
    read("app/ecommerce/about/page.tsx"),
    read("app/ecommerce/contact/ContactPageClient.tsx"),
    read("app/ecommerce/terms/page.tsx"),
    read("app/ecommerce/shipping/page.tsx"),
    read("app/ecommerce/blogs/page.tsx"),
    read("components/ecommarce/footer.tsx"),
    read("app/api/contact/route.ts"),
    read("app/api/auth/forgot-password/route.ts"),
    read("app/api/newsletter/[id]/send/route.ts"),
  ]);
  const content = files.join("\n").toLowerCase();

  for (const forbidden of [
    "kitabghor",
    "hilful",
    "হিলফুল",
    "birdsofeden",
    "/ecommerce/books",
  ]) {
    assert.equal(content.includes(forbidden), false, `Found legacy token: ${forbidden}`);
  }
});

test("primary sitemap keeps book entities behind their storefront feature gates", async () => {
  const sitemap = await read("app/sitemap.ts");

  assert.match(sitemap, /\/ecommerce\/products/);
  assert.match(sitemap, /\/ecommerce\/brands/);
  assert.match(sitemap, /\/ecommerce\/flash-sale/);
  assert.match(sitemap, /registry\.features\.BOOKS\.enabled/);
  assert.match(sitemap, /registry\.features\.AUTHORS\.enabled/);
  assert.match(sitemap, /\/ecommerce\/books/);
  assert.match(sitemap, /\/ecommerce\/authors/);
  assert.match(sitemap, /\/ecommerce\/publishers/);
  assert.match(sitemap, /getStorefrontBooks/);
  assert.match(sitemap, /getBookProductVisibilityWhere/);
  assert.doesNotMatch(sitemap, /book-fair|sitemap-books/);
  assert.doesNotMatch(sitemap, /prisma\.(writer|publisher)/);
});

test("book routes are feature-gated while legacy product URLs preserve SEO", async () => {
  const [index, books, bookDetail, authors, publishers, legacySitemap, config] = await Promise.all([
    read("app/ecommerce/page.tsx"),
    read("app/ecommerce/books/page.tsx"),
    read("app/ecommerce/books/[identifier]/page.tsx"),
    read("app/ecommerce/authors/page.tsx"),
    read("app/ecommerce/publishers/page.tsx"),
    read("app/ecommerce/sitemap-books.xml/route.ts"),
    read("next.config.ts"),
  ]);

  assert.match(index, /permanentRedirect\("\/"\)/);
  assert.match(books, /isFeatureEnabled\("BOOKS"\)/);
  assert.match(bookDetail, /isFeatureEnabled\("BOOKS"\)/);
  assert.match(bookDetail, /getStorefrontBooks/);
  assert.match(bookDetail, /permanentRedirect\(`\/ecommerce\/products\/\$\{product\.id\}`\)/);
  assert.match(authors, /isFeatureEnabled\("AUTHORS"\)/);
  assert.match(publishers, /isFeatureEnabled\("BOOKS"\)/);
  assert.match(legacySitemap, /\/sitemap\.xml/);
  assert.match(legacySitemap, /308/);
  assert.match(config, /source: "\/ecommerce\/books\/:identifier"/);
  assert.match(config, /source: "\/ecommerce\/book-fair"/);
  assert.match(config, /source: "\/ecommerce\/track-order"/);
  assert.match(config, /destination: "\/ecommerce\/user\/orders"/);
});

test("active product links and footer policies use valid tech storefront routes", async () => {
  const [wishlist, footer, productManager, productModal] = await Promise.all([
    read("app/ecommerce/user/wishlist/page.tsx"),
    read("components/ecommarce/footer.tsx"),
    read("components/management/ProductManager.tsx"),
    read("components/management/ProductAddModal.tsx"),
  ]);

  assert.match(wishlist, /`\/ecommerce\/products\/\$\{item\.id\}`/);
  assert.doesNotMatch(wishlist, /\/ecommerce\/books/);
  assert.match(footer, /\/ecommerce\/privacy/);
  assert.match(footer, /\/ecommerce\/terms/);
  assert.doesNotMatch(footer, /birdsofeden|href: "\/privacy"|href: "\/terms"/i);
  assert.doesNotMatch(productManager, /writers=|publishers=/);
  assert.doesNotMatch(productModal, /showBookFields|Select Writer|Select Publisher/);
});

test("contact delivery is rate-limited and environment-configured", async () => {
  const route = await read("app/api/contact/route.ts");

  assert.match(route, /scope: "contact-form"/);
  assert.match(route, /CONTACT_RECIPIENT_EMAILS/);
  assert.match(route, /RESEND_API_KEY/);
  assert.match(route, /escapeHtml/);
  assert.doesNotMatch(route, /islamidawainstitute|birdsofeden|hilful/i);
});
