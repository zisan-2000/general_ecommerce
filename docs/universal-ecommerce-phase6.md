# Universal Ecommerce — Phase 6 Dynamic Category Navigation

## Outcome

Phase 6 removes technology-specific category ordering from runtime code and makes category activation, header/footer placement, homepage featuring and sibling ordering administrator-controlled.

Category configuration fields:

- `isActive`
- `sortOrder`
- `showInHeader`
- `showInFooter`
- `featured`

`sortOrder` is evaluated within each hierarchy level; name and id provide deterministic fallback ordering.

## Runtime rules

1. Inactive categories are excluded from storefront category discovery.
2. A descendant is effectively inactive when any ancestor is inactive.
3. Header visibility requires the category and every ancestor to have `showInHeader = true`.
4. Footer visibility requires the category and every ancestor to have `showInFooter = true`.
5. Homepage category cards prefer active root categories marked `featured`, ordered by `sortOrder`.
6. The admin API rejects self-parenting and descendant cycles.
7. An active category cannot be moved under an inactive parent.
8. Product/catalog core behavior is not rewritten.

## Compatibility

The migration is additive and defaults existing categories to active/header/footer-visible. The idempotent backfill initializes root ordering only when all roots are still at the default sort order, preserving the previous technology-store order for the existing installation without retaining that list in runtime navigation code.

If no root category has been explicitly featured, the backfill marks the same legacy homepage root selection (up to five categories, based on the previous id-descending behavior) as featured.

Deleted categories are marked inactive during backfill.

## Deployment

1. Deploy the additive migration `20260908_add_category_navigation_config`.
2. Run `npm run backfill:category-navigation`.
3. Run `npm run verify:category-navigation-db`.
4. Run `npm run verify:universal-phase6`.
5. Open Admin → Management → Categories and verify Active, Header, Footer, Featured and Sort Order controls.
6. Verify header, footer and homepage categories on desktop and mobile.

The Phase 6 merge gate must pass the cumulative Phase 1–6 regression suite, Prisma validation and TypeScript checking before `main` is updated. The gate also applies deterministic source patches to large existing files before executing verification. CI installs from the existing lockfile with legacy peer-dependency resolution because the repository currently carries a pre-existing `next-auth`/`nodemailer` peer-version mismatch; Phase 6 does not change those dependencies.

## Restore strategy

No legacy column is dropped. To restore the former visible behavior, keep categories active and header/footer-visible, and set the desired root `sortOrder` values through Admin. Do not roll back by dropping Phase 6 columns after application code has started reading them.

## Definition of Done

- Category visibility/order fields exist in Prisma schema and migration.
- Admin can configure activation, header/footer placement, featured state and order.
- Header contains no `DESKTOP_CATEGORY_ORDER` or vertical-specific category list.
- Header/footer hierarchy is database-driven and ancestor-safe.
- Homepage featured categories are configuration-driven.
- Category mutations invalidate catalog, category and homepage caches.
- Backfill and DB verification are available.
- Phase 1–6 release gate passes.
