# Universal Ecommerce — Phase 2 Feature Registry

## Outcome

Phase 2 introduces the central feature registry without changing storefront route visibility yet. Phase 3 will consume this resolver across navigation, pages, APIs, admin actions, search and sitemaps.

Runtime code must use:

```ts
await isFeatureEnabled("PC_BUILDER");
```

It must not query `StoreFeature` directly to decide module behavior.

## Feature keys and compatibility defaults

| Feature | Default | Dependency / requirement |
| --- | --- | --- |
| `PC_BUILDER` | ON | Physical products, cart, inventory |
| `BOOKS` | OFF | — |
| `AUTHORS` | OFF | `BOOKS` |
| `COMPARE` | ON | — |
| `DIGITAL_PRODUCTS` | ON | — |
| `SERVICE_PRODUCTS` | ON | — |
| `BUNDLES` | ON | Physical products |

The defaults deliberately preserve the current technology storefront during migration. A database row overrides its default, but dependencies determine the effective state.

For example, `AUTHORS` configured ON while `BOOKS` is OFF resolves to:

```text
configuredEnabled = true
enabled = false
blockedBy = [BOOKS]
```

## Admin API

`GET /api/admin/store-features` returns the complete resolved registry. It requires `settings.manage` and is always private/no-store.

`PATCH /api/admin/store-features` accepts:

```json
{
  "key": "BOOKS",
  "enabled": true
}
```

Updates are serialized with a PostgreSQL transaction-scoped advisory lock. Enabling a feature with unmet requirements, or disabling a feature with an active dependent, returns HTTP `409`. Successful changes are activity-logged and immediately invalidate feature, storefront, product, category, flash-sale and site-settings caches.

## Deployment sequence

1. Deploy and apply `20260907_add_store_feature_registry`.
2. Run `npm run backfill:store-features` with the target environment's `DATABASE_URL`.
3. Run `npm run verify:store-features-db`.
4. Deploy Phase 2 application code if it was not deployed together with the additive migration.
5. Run `npm run verify:universal-phase2`.
6. Confirm the admin GET reports `storage: "database"`.

The backfill only inserts missing keys (`createMany` with `skipDuplicates`) and never overwrites an administrator's existing choice.

## Compatibility and restore

- Before the new table exists, read-only feature resolution falls back to the compatibility defaults. It catches only Prisma's missing-table error; unrelated database failures are not hidden.
- Mutations fail with HTTP `503` until storage exists.
- To restore behavior, update feature rows to the defaults and rerun the verifier. Do not drop the table during the compatibility window.
- No old field or table is removed in this phase.
- Historical order/audit readability is not gated by the registry. Phase 3 must preserve that invariant while enforcing feature-off behavior for new discovery, creation, management and purchase operations.

## Verification

Fast Phase 2 tests:

```bash
npm run test:universal-phase2
```

Full code-level release gate:

```bash
npm run verify:universal-phase2
```

Live database verification:

```bash
npm run verify:store-features-db
```

## Definition of Done

- All approved feature keys exist in schema, migration and registry.
- Current behavior is preserved by explicit compatibility defaults.
- Dependency and core-requirement failures resolve fail-closed.
- Invalid dependency transitions cannot be committed through the admin API.
- Runtime reads and writes are centralized.
- Feature changes invalidate every known affected cache.
- Migration, idempotent backfill, read-only verifier and restore instructions exist.
- Phase 1 and Phase 2 release gates pass.
