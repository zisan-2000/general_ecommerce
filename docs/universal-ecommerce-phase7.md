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

## Cache invalidation

Updating or resetting Site Settings invalidates the `site-settings` tag. Global metadata, manifest consumers, storefront home data and catalog navigation all use that tag directly or through their existing tagged caches.

## Deployment

1. Deploy migration `20260908_phase7_store_identity_seo`.
2. Run `npm run backfill:store-identity`.
3. Run `npm run verify:store-identity-db`.
4. Run `npm run verify:universal-phase7`.
5. Configure the final identity and SEO values in `/admin/settings/general`.

## Restore strategy

No legacy column is removed. If a rollback is required, older code continues reading `siteTitle`, `logo`, `footerDescription` and the existing contact/social fields. The new columns can remain safely unused until the Phase 7 code is restored.

## Definition of Done

- Admin can configure identity, SEO and localization without a code change.
- Global metadata, Open Graph, Twitter, icons, manifest and JSON-LD use resolved settings.
- General storefront pages contain neutral copy; vertical module copy remains inside its gated module.
- `storeType` does not control runtime behavior.
- Backfill and read-only database verification are available.
- Phase 1–7 release gate passes.
