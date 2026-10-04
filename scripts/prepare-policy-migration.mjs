// Capture the existing translated policy copy once into the release migration.
// Running this generator does not connect to or mutate the database.
import fs from "node:fs";
import path from "node:path";
const locales = ["en", "bn", "zh", "ar", "ne", "id"];
const quote = value => "'" + String(value).replace(/'/g, "''") + "'";
const rows = [];
function add(kind, locale, title, content, category = "", linkUrl = null) {
  rows.push({ id: `policy_seed_${locale}_${kind}_${rows.length}`, kind, locale, title, content, category, linkUrl, order: rows.filter(r => r.kind === kind && r.locale === locale).length });
}
function flatten(value) {
  return Object.entries(value).filter(([key]) => !["metadata", "eyebrow", "cta", "effectiveDate"].includes(key)).flatMap(([, item]) => typeof item === "string" ? [item.replaceAll("{site}", "this store")] : flatten(item)).join("\n\n");
}
for (const locale of locales) {
  const messages = JSON.parse(fs.readFileSync(path.join("messages", `${locale}.json`), "utf8"));
  const support = messages.StorefrontSupport;
  for (const kind of ["shipping", "returns", "privacy", "terms"]) {
    const copy = support[kind];
    const intro = [copy.subtitle, copy.intro, copy.agreement].filter(Boolean).join("\n\n").replaceAll("{site}", "this store");
    if (intro) add(kind, locale, copy.title, intro);
    for (const [key, value] of Object.entries(copy)) {
      if (["metadata", "cta"].includes(key) || !value || typeof value !== "object") continue;
      if (key === "sections") {
        for (const section of Object.values(value)) add(kind, locale, section.title, flatten(Object.fromEntries(Object.entries(section).filter(([k]) => k !== "title"))));
      } else add(kind, locale, value.title || copy.title, flatten(Object.fromEntries(Object.entries(value).filter(([k]) => k !== "title"))));
    }
  }
  for (const category of Object.values(support.faq.categories)) {
    for (const [key, question] of Object.entries(category)) if (/^q\d+$/.test(key)) add("faq", locale, question, category[`a${key.slice(1)}`], category.title);
  }
  const labels = messages.StorefrontShell.footer.links;
  for (const [route, key] of [["shipping", "shippingPolicy"], ["returns", "returnPolicy"], ["privacy", "privacyPolicy"], ["faq", "faq"], ["terms", "terms"]]) add("sitemap", locale, labels[key] || support[route].title, "", "", `/ecommerce/${route}`);
}
const directory = "prisma/migrations-release/20261004090000_store_policy_content";
fs.mkdirSync(directory, { recursive: true });
const sql = `CREATE TABLE "StorePolicyContent" (
  "id" TEXT NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
  "title" VARCHAR(250) NOT NULL,
  "content" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL DEFAULT '',
  "linkUrl" VARCHAR(500),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "effectiveDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorePolicyContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorePolicyContent_kind_check" CHECK ("kind" IN ('shipping', 'returns', 'privacy', 'faq', 'terms', 'sitemap')),
  CONSTRAINT "StorePolicyContent_sortOrder_check" CHECK ("sortOrder" >= 0)
);
CREATE INDEX "StorePolicyContent_kind_locale_isPublished_sortOrder_idx"
  ON "StorePolicyContent"("kind", "locale", "isPublished", "sortOrder");

-- Preserve existing translated storefront content as editable published records.
INSERT INTO "StorePolicyContent" ("id", "kind", "locale", "title", "content", "category", "linkUrl", "sortOrder", "isPublished") VALUES
${rows.map(r => `(${[r.id, r.kind, r.locale, r.title, r.content, r.category].map(quote).join(", ")}, ${r.linkUrl ? quote(r.linkUrl) : "NULL"}, ${r.order}, true)`).join(",\n")};
`;
fs.writeFileSync(path.join(directory, "migration.sql"), sql);
console.log(`Prepared migration with ${rows.length} translated policy, FAQ and sitemap entries.`);
