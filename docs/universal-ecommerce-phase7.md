# Universal Ecommerce Phase 7 — Store Identity and SEO

## Scope

Phase 7 removes technology-specific global branding, metadata and general storefront copy. Store identity is now controlled from the existing Site Settings administration surface without changing source code.

Configurable fields:

- store name and tagline
- logo, favicon and default social-share image
- default SEO title, description and keywords
- currency and currency position
- IANA timezone and BCP 47 locale
- informational store type (`GENERAL`, `TECH`, `FASHION`, `GROCERY`, `BOOK`)
- existing contact, footer and social settings

`storeType` is descriptive only. Runtime capabilities remain controlled by `StoreFeature`, category navigation and attribute configuration; application code must not branch on `storeType`.

## Compatibility

The migration is additive. `siteTitle` remains in place while `storeName` is introduced. Reads prefer `storeName` and fall back to `siteTitle`; administration writes both fields during the compatibility window. The backfill populates only missing new values and is safe to rerun.

When explicit SEO keywords are empty, metadata derives neutral commerce keywords from the store name and currently active root categories. No technology category list remains in global SEO defaults.

## Runtime localization

The root layout resolves Site Settings once and provides `currency`, `currencyPosition` and `locale` to the client storefront through `StorefrontSettingsProvider`. Shared product cards therefore render prices using the configured currency instead of a hardcoded Taka/BDT symbol. `BEFORE` and `AFTER` placement are both supported and number formatting follows the configured locale.

Organization structured data no longer hardcodes Bangladesh. When the configured locale contains a region (for example `en-BD`, `en-US` or `fr-FR`), the JSON-LD `addressCountry` is derived from that BCP 47 region.

## Cache invalidation

Updating or resetting Site Settings invalidates the `site-settings` tag. Global metadata, manifest consumers, storefront home data and catalog navigation all use that tag directly or through their existing tagged caches.

## Verification and CI

`.github/workflows/universal-ecommerce-phase7.yml` is the cumulative Phase 1–7 release gate. It uses `npm ci --legacy-peer-deps --ignore-scripts` because the repository currently contains a pre-existing `next-auth` / `nodemailer` peer-dependency mismatch. The gate runs Prisma validation/generation, universal baseline tests, product/inventory regression tests, Phase 2–7 tests, the Phase 7 completion contract, lint, and a no-new-errors TypeScript check.

The TypeScript check does not silently ignore arbitrary errors. It explicitly allowlists only the known pre-existing Business Network route/page diagnostics and fails on any new or unrecognized diagnostic, including any Phase 7 file.

## Deployment

1. Deploy migration `20260908_phase7_store_identity_seo`.
2. Run `npm run backfill:store-identity`.
3. Run `npm run verify:store-identity-db`.
4. Ensure the `Universal Ecommerce Phase 7` GitHub Actions release gate is green.
5. Configure the final identity, currency, locale and SEO values in `/admin/settings/general`.

## Restore strategy

No legacy column is removed. If a rollback is required, older code continues reading `siteTitle`, `logo`, `footerDescription` and the existing contact/social fields. The new columns can remain safely unused until the Phase 7 code is restored.

## Definition of Done

- Admin can configure identity, SEO and localization without a code change.
- Global metadata, Open Graph, Twitter, icons, manifest and JSON-LD use resolved settings.
- Shared storefront product pricing uses configured currency, placement and locale.
- JSON-LD country is derived from configured locale rather than a hardcoded country.
- General storefront pages contain neutral copy; vertical module copy remains inside its gated module.
- `storeType` does not control runtime behavior.
- Backfill and read-only database verification are available.
- Phase 1–7 cumulative release gate passes.
