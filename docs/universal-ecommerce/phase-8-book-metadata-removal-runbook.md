# Phase 8 BookMetadata legacy-column removal runbook

This runbook is for a later production release. Do not add the removal migration to the compatibility deployment.

## Entry criteria

1. `npm run backfill:book-metadata` and `npm run verify:book-metadata-db` pass in every environment.
2. The verifier reports zero missing, conflicting, orphaned, duplicate and empty records throughout the agreed monitoring window.
3. `BOOKS` has been exercised with create, edit, delete, catalog, author, publisher, cart and historical-order reads.
4. A current custom-format database backup exists and a restore has been tested outside production.
5. The release owner records the verification output and approves the cutover.

## Release A — stop compatibility writes

- Change all book reads to require `BookMetadata` rather than falling back to Product fields.
- Stop dual-writing `Product.writerId` and `Product.publisherId`.
- Keep the columns intact for one more monitored release.
- Run the verifier in comparison mode and confirm no application path changes the legacy values.

## Release B — remove legacy schema

Create a new Prisma migration that:

1. drops `Product_writerId_fkey` and `Product_publisherId_fkey`;
2. drops `Product_writerId_deleted_available_idx` and `Product_publisherId_deleted_available_idx`;
3. drops `Product.writerId` and `Product.publisherId`;
4. removes the matching Prisma fields, relations and compatibility code.

Deploy only after Release A's observation window succeeds. Run Prisma validation/generation, the Phase 1–8 release gate and the post-removal database verifier.

## Restore and rollback

- Application rollback during Release A is direct because both representations still exist.
- After Release B, never edit or roll back an applied destructive migration.
- Forward-fix by additively restoring nullable legacy columns and constraints, then reconstruct them from authoritative `BookMetadata` with the idempotent backfill.
- If authoritative metadata itself is damaged, restore the verified pre-release database snapshot before serving writes.
