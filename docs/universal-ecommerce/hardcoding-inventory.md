# Universal Ecommerce Hardcoding Inventory

This inventory distinguishes configurable storefront assumptions from intentional vertical modules. Phase 1 records them; later phases replace or gate them.

| Area | Current coupling | Target treatment | Owner phase |
| --- | --- | --- | --- |
| Feature visibility | PC Builder and Compare routes/actions are directly available | Central `StoreFeature` resolver; server/API/UI gating | 2–3 |
| Header navigation | `DESKTOP_CATEGORY_ORDER`, PC Builder and Compare quick actions in `components/ecommarce/header.tsx` | Database-driven category order/visibility plus feature-aware extras | 3 and 6 |
| Search | Tech synonym groups and tech category aliases in `lib/search/core.ts` | Base search plus enabled-preset/category synonyms | 3–4 |
| Category model | Only hierarchy/deletion controls; no explicit menu placement or activation | Add `isActive`, `sortOrder`, `showInHeader`, `showInFooter`, `featured` | 6 |
| Attribute model | Free-text `ProductAttribute.value`; no category allow-list/type/unit | `CategoryAttribute`, attribute type/unit and typed values | 4–5 |
| Site defaults | `Tech Ecommerce` in `lib/site-defaults.ts` | Configurable identity with neutral fallback | 7 |
| Global SEO | Computer/laptop/technology defaults in `lib/seo.ts` | Site settings and active catalog drive metadata | 7 |
| Storefront copy | Technology language in About, Contact, FAQ, Terms, Shipping, Brands, Products, Blog, Flash Sale and Footer | Settings/content-managed neutral defaults or preset copy | 7 |
| Storefront seed | Tech categories/products/site identity and `enforceTechOnlyStorefront` in `prisma/seed-data/storefront` | Separate base seed, tech preset and optional demo dataset | 9 |
| Book coupling | `Writer`, `Publisher`, `Product.writerId`, `Product.publisherId` | Additive `BookMetadata`, backfill, dual read/write, cutover, later cleanup | 8 |
| Legacy book URLs | Books redirect to products; authors/publishers redirect to brands | Preserve redirects while disabled; enable feature-specific pages only through resolver | 3 and 8 |
| PC Builder internals | PC taxonomy, compatibility and checkout are technology-specific by design | Preserve module; gate entry points and operations, do not genericize internals | 2–3 |

## Feature-gating surface checklist

For each optional feature, later phases must cover all applicable surfaces:

- storefront navigation and discovery
- direct page routes
- public APIs
- admin navigation and management pages
- create/update/activate actions
- cart and purchase actions
- sitemap and SEO output
- search indexing/facets
- background jobs and seed commands
- cache invalidation

The required feature keys are:

- `PC_BUILDER`
- `BOOKS`
- `AUTHORS`
- `COMPARE`
- `DIGITAL_PRODUCTS`
- `SERVICE_PRODUCTS`
- `BUNDLES`

Feature-off behavior blocks new discovery, creation, management and purchase actions. It must not erase or make historical transactional/audit data unreadable.

