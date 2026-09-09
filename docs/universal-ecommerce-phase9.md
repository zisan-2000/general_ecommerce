# Universal Ecommerce — Phase 9: Universal Seeds + Acceptance

## Goal

Make the repository safe to initialize for any single-store ecommerce vertical without silently forcing the technology demo, deleting existing catalog state, or creating known demo credentials.

## Seed profiles

### Safe default — universal

`npx prisma db seed` runs `prisma/seed-universal.ts`.

It only ensures:

- neutral `GENERAL` site settings when no site settings row exists;
- missing required runtime settings on an existing legacy row (`storeName`/`siteTitle`, currency, currency position, timezone, locale and store type), without overwriting non-empty configured values;
- five neutral root categories when their slugs do not already exist;
- missing Store Feature Registry rows using the existing defaults.

The universal seed is idempotent and non-destructive. It does not create admin/customer accounts, does not replace non-empty administrator-configured site settings or existing category configuration, does not archive unrelated products/categories/brands, and does not enable BOOKS/AUTHORS beyond the configured registry defaults. Existing supported store types such as `TECH`, `FASHION`, `GROCERY` and `BOOK` are preserved; only missing/blank legacy values are repaired.

## Explicit vertical presets

Four configuration-only presets are available. They configure informational store
type, feature flags, navigation categories and typed category-attribute mappings;
they do not create products, users or known credentials.

```powershell
$env:STORE_PRESET="tech" # tech | fashion | grocery | book
$env:ALLOW_STORE_PRESET_APPLY="true"
npm run seed:preset
npm run verify:store-preset
```

Preset application is intentionally explicit because it replaces configuration
owned by the four presets. Historical products and orders are never deleted.

### Explicit demo seed

The previous rich technology/operations demo remains available for isolated demonstrations:

```bash
ALLOW_DEMO_CREDENTIALS=true \
ALLOW_DESTRUCTIVE_DEMO_SEED=true \
SEED_PROFILE=full-demo \
node scripts/run-demo-seed.mjs
```

`technology-demo` and `full-demo` are intentionally blocked unless both safety acknowledgements are present because the legacy demo contains known credentials and can archive non-tech storefront records.

Never run the demo seed against a real production database.

## Acceptance verification

Source contract:

```bash
npx tsx --test tests/universal-ecommerce-phase9.test.mjs
```

Database contract after the universal seed:

```bash
npx tsx scripts/verify-universal-seed.ts
```

Full cumulative release gate:

```bash
npm run verify:universal-phase9
```

On Windows, stop any local Next.js development server before running the full gate.
`prisma generate` replaces the native query-engine binary, which a running server
may keep locked.

The database verifier checks usable/supported site runtime settings, required active/navigation-ready categories, complete Store Feature Registry coverage, and absence of active known demo credentials. Historical demo user rows may remain only when their password is removed and the account is banned.

For an existing legacy database, disable known credentials after taking a backup:

```powershell
$env:ALLOW_DEMO_CREDENTIAL_DISABLE="true"
npm run disable:known-demo-credentials
npx tsx scripts/verify-universal-seed.ts
```

## CI acceptance environment

The Phase 9 workflow provisions an isolated PostgreSQL service, applies the active
squashed migration through `prisma migrate deploy`, runs the universal seed twice,
proves legacy-null repair, applies and verifies all four vertical presets, tests
known-demo-credential neutralization, then executes the cumulative Phase 1–9 suite.

The legacy incremental migration SQL remains in `prisma/migrations` for audit.
`prisma/migrations-release` is the active installation history.

## Production initialization

For a new production database:

1. Run `npx prisma migrate deploy`.
2. Run `npx prisma db seed` only if neutral baseline settings/categories are desired.
3. Run `npx tsx scripts/verify-universal-seed.ts`.
4. Configure store identity, category navigation, features, products and optional modules through the admin surfaces.

For an existing database created before the Phase 9 squashed history, first take a
backup and run the one-time reconciliation below. It validates core tables before
marking the baseline as applied; it does not execute baseline DDL.

```powershell
$env:ALLOW_PHASE9_BASELINE_RESOLVE="true"
npm run resolve:phase9-baseline
npx prisma migrate status
```

The universal seed then preserves non-empty administrator settings and existing
category configuration while repairing only missing runtime settings.

## Rollback

The universal seed creates or updates only deterministic baseline records. Rollback of source code is a normal git revert. Database rollback should normally be performed by editing/removing the seeded baseline records through admin tooling rather than restoring a whole database snapshot.

Demo seed rollback is different: because the legacy demo can archive unrelated storefront state, take a database snapshot before any explicitly authorized demo-seed run and restore that snapshot if rollback is required.

## Definition of Done

- Default Prisma seed is universal and non-destructive.
- No known demo credentials are created by the default seed.
- Existing non-empty store identity and localization settings are preserved.
- Missing legacy runtime settings are repaired with safe defaults.
- Store feature defaults are inserted without overwriting administrator choices.
- Neutral categories are deterministic and idempotent.
- Existing category configuration is not overwritten by the safe default seed.
- Tech, fashion, grocery and book presets are separate, guarded operations.
- Technology/full demo behavior is explicit and guarded.
- Known demo users are banned and have credential hashes removed without deleting history.
- A clean database installs through `prisma migrate deploy`, including external PC Builder tables.
- Live PostgreSQL acceptance runs the universal seed twice and verifies simulated legacy-null repair.
- Database invariants are verified after each acceptance scenario.
- Phase 1–9 cumulative tests, Prisma validation/generation, Next route type generation, lint, strict TypeScript and whitespace checks pass before merge.
