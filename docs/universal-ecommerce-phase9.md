# Universal Ecommerce — Phase 9: Universal Seeds + Acceptance

## Goal

Make the repository safe to initialize for any single-store ecommerce vertical without silently forcing the technology demo, deleting existing catalog state, or creating known demo credentials.

## Seed profiles

### Safe default — universal

`npx prisma db seed` runs `prisma/seed-universal.ts`.

It only ensures:

- neutral `GENERAL` site settings when no site settings row exists;
- five neutral root categories;
- missing Store Feature Registry rows using the existing defaults.

The universal seed is idempotent and non-destructive. It does not create admin/customer accounts, does not overwrite existing site settings, does not archive unrelated products/categories/brands, and does not enable BOOKS/AUTHORS beyond the configured registry defaults.

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

The database verifier checks neutral site identity, required active/navigation-ready categories, complete Store Feature Registry coverage, and absence of the known demo credential accounts.

## CI acceptance environment

The Phase 9 workflow provisions an isolated PostgreSQL service, pushes the current Prisma schema into that disposable database, runs the universal seed twice, verifies database invariants after the second run, and then executes the cumulative Phase 1–9 release suite.

The clean CI database is intentionally disposable. `prisma db push --force-reset` is used only there and must not be copied into production deployment procedures.

## Production initialization

For a new production database:

1. Apply the repository's approved migration/baseline process.
2. Run `npx prisma db seed` only if neutral baseline settings/categories are desired.
3. Run `npx tsx scripts/verify-universal-seed.ts`.
4. Configure store identity, category navigation, features, products and optional modules through the admin surfaces.

For an existing production database, the universal seed preserves an existing site-settings row and upserts only the neutral baseline category slugs. Review the five reserved slugs before running it if those slugs already have business-specific meanings.

## Rollback

The universal seed creates or updates only deterministic baseline records. Rollback of source code is a normal git revert. Database rollback should normally be performed by editing/removing the seeded baseline records through admin tooling rather than restoring a whole database snapshot.

Demo seed rollback is different: because the legacy demo can archive unrelated storefront state, take a database snapshot before any explicitly authorized demo-seed run and restore that snapshot if rollback is required.

## Definition of Done

- Default Prisma seed is universal and non-destructive.
- No known demo credentials are created by the default seed.
- Existing store identity is preserved.
- Store feature defaults are inserted without overwriting administrator choices.
- Neutral categories are deterministic and idempotent.
- Technology/full demo behavior is explicit and guarded.
- Live PostgreSQL acceptance runs the universal seed twice.
- Database invariants are verified after the second seed.
- Phase 1–9 cumulative tests, Prisma validation/generation, Next route type generation, lint, strict TypeScript and whitespace checks pass before merge.
