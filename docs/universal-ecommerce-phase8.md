# Universal Ecommerce — Phase 8: Book Module Decoupling

## Goal

Remove book-specific Writer/Publisher ownership from the generic Product core while preserving every existing relation and keeping the optional BOOKS/AUTHORS modules independently controlled by the Store Feature Registry.

## Architecture

- `Product` owns only universal commerce concerns and now has a single optional `bookMetadata` extension relation.
- `BookMetadata` owns `writerId` and `publisherId`.
- `Writer` and `Publisher` relate to `BookMetadata`, never directly to generic `Product`.
- Generic product CRUD does not import or write book metadata.
- Book metadata has its own API boundary at `/api/book-metadata/[productId]` and is unavailable unless the `BOOKS` feature is enabled.
- Metadata writes require the existing `products.manage` permission.
- `AUTHORS` remains dependent on `BOOKS`; legacy writer/publisher endpoints remain dormant rather than silently reviving old bookstore behavior.

## Data migration safety

Migration `20260908190000_decouple_book_metadata` performs the transition in one PostgreSQL transaction:

1. Create `BookMetadata` and indexes.
2. Copy every Product row that has a legacy writer or publisher relation.
3. Add referential constraints.
4. Remove legacy Product foreign keys/indexes.
5. Drop `Product.writerId` and `Product.publisherId` only after the copy.

No product, writer, or publisher row is deleted. Product deletion cascades to its metadata; deleting a writer or publisher only nulls the relevant metadata relation.

## Deployment

Take a normal database backup/snapshot before schema deployment, then run:

```bash
npx prisma migrate deploy
npm run verify:book-metadata-db
```

The verifier is read-only. It fails if legacy Product columns remain, if `BookMetadata` is missing, or if orphaned/duplicate metadata relations exist.

## Verification

Local/source gate:

```bash
npm run test:universal-phase8
npm run verify:universal-phase8
```

CI additionally runs Prisma validation/generation, Next route type generation, the complete Phase 1–8 regression suite, lint, strict TypeScript and whitespace validation.

## Rollback

Before deployment, rollback is simply reverting the code/migration commit. After the migration has dropped legacy Product columns, restore from the pre-deployment database snapshot before reverting application code; do not recreate the legacy columns manually and guess relation data.

## Definition of Done

- Generic Product has no Writer/Publisher foreign keys or indexes.
- Existing book relation data is copied before legacy columns are removed.
- Book metadata is a one-to-one optional Product extension.
- BOOKS feature gate and product-management authorization protect the module boundary.
- Legacy bookstore APIs stay dormant.
- Database integrity verifier exists and is read-only.
- Phase 1–8 cumulative release gate passes before merge.
