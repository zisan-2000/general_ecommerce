# Universal Ecommerce — Phase 1 Baseline

## Outcome

Phase 1 freezes the currently working commerce core before universal-store changes begin. It adds regression coverage and migration rules; it does not change production storefront behavior, database data, or route availability.

The following modules are the protected core and must be evolved, not rewritten:

- Product and Product Variant CRUD
- Category hierarchy and catalog filtering
- Cart, Buy Now, checkout and order creation
- Inventory deduction, reservation and restoration
- Flash sale and compare
- PC Builder
- Physical, digital, service and bundle products
- Existing book data and legacy book/author URLs

## Executable baseline

Run the fast Phase 1 contract suite while developing:

```bash
npm run test:universal-baseline
```

Run the complete Phase 1 release gate before merging a universal-ecommerce phase:

```bash
npm run verify:universal-phase1
```

The release gate runs the new baseline, the established product/storefront suites, order-idempotency coverage, Prisma validation, ESLint and TypeScript checking. `validate:schema` supplies a non-secret placeholder PostgreSQL URL because Prisma requires the variable while parsing the schema; `prisma validate` does not connect to or mutate that database.

## Coverage matrix

| Required flow | Current implementation evidence | Regression evidence |
| --- | --- | --- |
| Product CRUD | `/api/products` and `/api/products/[id]` | Universal baseline + Phase 0/1/2 suites |
| Variant CRUD | `/api/product-variants` and item route | Universal baseline |
| Category hierarchy | Self-referencing `Category.parent/children` | Universal baseline + Phase 1 |
| Search/filter | Storefront catalog parser and search core | Universal baseline + search + Phase 1 |
| Cart | Cart collection/item APIs and `CartContext` | Universal baseline + Phase 2 |
| Buy Now / checkout | Purchase panel → checkout → order API | Universal baseline |
| Order creation | Transactional order POST | Universal baseline + idempotency |
| Inventory deduction | Reservation/deduction plus lifecycle restoration | Universal baseline + order-inventory |
| Flash sale | Shared pricing resolver and admin API | Universal baseline + flash-sale |
| Compare | Compare state helpers and compare API | Universal baseline + Phase 2 |
| PC Builder | Catalog, validation, saved build and checkout modules | Universal baseline + PC Builder suite |
| Books | Writer/Publisher data plus permanent legacy redirects | Universal baseline + storefront cleanup |
| Digital product | Non-physical purchase/stock rule | Universal baseline + Phase 2 |
| Service product | Non-physical purchase/stock rule | Universal baseline |
| Bundle | Bundle relation and calculated/limited stock | Universal baseline + Phase 1/2 |

## Current-state truth

- The storefront is currently a technology-store preset.
- PC Builder is currently active and publicly discoverable.
- Compare is currently active.
- Book, author and publisher data structures still exist, but the public book/author/publisher indexes are intentionally dormant and use permanent redirects.
- `Product.writerId` and `Product.publisherId` are still coupled to the base product model. This is technical debt scheduled for the book-metadata phase, not something to remove in Phase 1.
- Several storefront copy, navigation, SEO and search defaults remain technology-specific. They are catalogued in `hardcoding-inventory.md` and will be replaced through configuration in later phases.

## Architecture invariants for Phases 2–9

1. Feature decisions must come from one server-side resolver; clients consume its result and do not independently decide feature state.
2. Disabling a feature blocks new creation, purchase, discovery and management actions for that feature. Historical orders, invoices and audit records remain readable.
3. Feature dependencies must be validated centrally. A dependent feature cannot become active when its prerequisite is off.
4. Feature and catalog configuration mutations must invalidate every affected cache/tag.
5. Category attributes become the source of allowed fields. Values must support typed storage (`valueText`, `valueNumber`, `valueBoolean`, `attributeValueId`) through an additive migration.
6. Category activation is explicit (`isActive`) and separate from deletion.
7. `storeType` is informational and may select initial presets; it must never become a runtime behavior switch.
8. Book metadata migration uses additive columns/tables, backfill, compatibility reads/writes, verification and cutover before legacy fields are removed.
9. Base seed data, vertical presets and optional demo data remain separate operations.

## Phase 1 exit criteria

- All 15 required flows above are represented in the executable baseline.
- The full Phase 1 release command passes.
- Known technology and book coupling is inventoried with an owner phase.
- The additive migration protocol is documented and mandatory.
- No production behavior or persisted data is changed by Phase 1.

After these criteria pass, Phase 2 can introduce `StoreFeature` and the central feature resolver without rewriting the protected core.

