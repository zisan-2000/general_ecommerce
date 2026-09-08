# Phase 3 — Runtime module gating

Phase 3 connects the Phase 2 feature registry to every high-risk runtime surface.

## Enforcement contract

When an optional module is disabled:

- dedicated storefront and admin pages are unavailable;
- navigation and related UI actions are hidden;
- public catalog, search, recommendations, flash sales, wishlist and sitemap discovery omit its products;
- new product/module creation and management mutations are rejected;
- add-to-cart, cart quantity increase and order creation are rejected server-side;
- historical order and audit reads remain available;
- existing database references are not deleted.

All product-type decisions map through the central registry:

- `DIGITAL` → `DIGITAL_PRODUCTS`
- `SERVICE` → `SERVICE_PRODUCTS`
- `BUNDLE` → `BUNDLES`
- `PHYSICAL` remains a core commerce capability and is not feature-gated.

Dedicated module routes use `gateStoreFeature`. Generic product flows use
`gateProductType`, while storefront queries use
`getDisabledStorefrontProductTypes`. No consumer queries `StoreFeature`
directly.

## Compatibility behavior

The Phase 2 missing-table fallback remains active during additive deployment,
so current tech-store defaults are preserved until the migration/backfill is
applied. Feature changes invalidate all affected storefront caches.

Legacy book/author/publisher redirects remain intact for URL and SEO
compatibility. Their dedicated module activation is deferred to the approved
Book Metadata phase; Phase 3 does not rewrite or delete legacy data.

## Verification

Run:

```bash
npm run test:universal-phase3
npm run verify:universal-phase3
```

The focused suite verifies module route gates, product-type discovery filters,
transactional mutation gates, UI visibility, and the historical-order read
exception.
