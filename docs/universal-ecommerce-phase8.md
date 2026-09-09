# Universal Ecommerce — Phase 8: Book Module Decoupling

## Goal

Remove book-specific Writer/Publisher ownership from the generic Product core while preserving every existing relation and keeping the optional BOOKS/AUTHORS modules independently controlled by the Store Feature Registry.

## Architecture

- `BookMetadata` is the authoritative book extension. Transitional Product relation columns remain only for rollback compatibility and are not accepted by generic Product CRUD.
- `BookMetadata` owns `writerId` and `publisherId`.
- `Writer` and `Publisher` use `BookMetadata` as the authoritative relation; direct
  `Product` relations exist only as temporary rollback compatibility and are covered
  by the later-removal runbook.
- Generic product CRUD does not import or write book metadata.
- Book metadata has its own API boundary at `/api/book-metadata/[productId]` and is unavailable unless the `BOOKS` feature is enabled.
- Metadata writes require the existing `products.manage` permission.
- `AUTHORS` remains dependent on `BOOKS`; book, writer and publisher pages/APIs are available only through their central feature gates.

## Data migration safety

The already-committed `20260908190000_decouple_book_metadata` migration may have been applied outside the local environment, so its checksum is intentionally unchanged. The forward-only `20260908200000_restore_book_compatibility` migration additively restores the two rollback columns without moving data. This gives every environment the same safe compatibility state whether the earlier migration was already applied or is applied in the same deployment.

The release sequence is:

1. Deploy both migrations. The final migration is additive and leaves both representations available.
2. Run the bounded, idempotent `backfill:book-metadata` command. It creates missing authoritative metadata from legacy fields and repairs empty restored legacy fields from authoritative metadata. It never overwrites a conflicting authoritative value.
3. Run `verify:book-metadata-db`. Cutover is blocked on missing, conflicting, duplicate, empty or orphaned records.
4. Enable `BOOKS` only after verification. Reads prefer BookMetadata and fall back to legacy fields; writes update both representations in one transaction.
5. Monitor the compatibility window. Remove the legacy columns only in a new migration in a later release after a successful production verification report and tested restore path.

No product, writer, publisher, historical order or audit row is deleted. Writer and publisher removal remains a soft delete, preserving historical relations.

## Deployment

Take a normal database backup/snapshot before schema deployment, then run:

```bash
npx prisma migrate deploy
npm run backfill:book-metadata
npm run verify:book-metadata-db
```

The verifier is read-only. During the compatibility release it requires both legacy columns and `BookMetadata`; it compares both representations and fails on missing, conflicting, empty, orphaned or duplicate metadata.

## Verification

Local/source gate:

```bash
npm run test:universal-phase8
npm run verify:universal-phase8
```

CI provisions PostgreSQL with a pre-Phase-8 legacy fixture, applies both Phase 8 migrations, runs the idempotent backfill and database verifier, then runs Prisma/Next generation, the complete Phase 1–8 regression suite, lint, strict TypeScript and whitespace validation. The repository's older migration history predates the universal-ecommerce work and is not a fresh-install baseline; rebuilding that global baseline belongs to Phase 9 distribution work and must not rewrite already-applied migration checksums.

## Rollback

During the compatibility window, application rollback remains possible because the dual-written Product fields are present. Database rollback is forward-only: do not edit an applied migration. If the original destructive migration was deployed, the compatibility migration restores the columns and the backfill deterministically reconstructs them from BookMetadata.

## Definition of Done

- Generic Product APIs/forms do not accept Writer/Publisher fields; temporary schema fields are explicitly compatibility-only.
- Existing book relations are synchronized by a rerunnable bounded backfill and verified in both directions.
- Book metadata is a one-to-one optional Product extension.
- BOOKS feature gate and product-management authorization protect the module boundary.
- BOOKS/AUTHORS gates control storefront discovery, administration, APIs and navigation; historical records remain readable.
- Book metadata mutations are transactional, dual-written, audited and invalidate affected storefront caches.
- Database integrity verifier exists and is read-only.
- Database-backed CI and the Phase 1–8 cumulative release gate pass before merge.

## Later removal release

The removal migration is deliberately not part of this deployment. Its entry criteria are: production backfill and verifier pass, zero divergence throughout the monitoring window, a current database snapshot, and a tested restore procedure. Shipping removal in this same release would recreate the safety defect this phase repairs.

The exact release procedure is maintained in `docs/universal-ecommerce/phase-8-book-metadata-removal-runbook.md`.

## Cache invalidation list

Book metadata, writer and publisher mutations invalidate the shared storefront catalog/home/product/flash-sale/category tags plus `/ecommerce/books`, author and publisher layouts, and the affected product detail path. Store feature transitions already invalidate navigation, catalog, product detail, SEO and site-setting tags.
