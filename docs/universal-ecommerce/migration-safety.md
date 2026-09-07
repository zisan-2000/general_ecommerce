# Universal Ecommerce Migration Safety Contract

Every universal-ecommerce schema or behavior migration must follow this sequence:

```text
Additive migration
  → Backfill script
  → Verification script
  → Compatibility read/write
  → Controlled cutover
  → Old-column removal in a later release
```

## Mandatory rules

### 1. Additive migration

- Add nullable columns, new tables, indexes and relations first.
- Do not rename/drop a live field in the same release that introduces its replacement.
- New constraints become strict only after existing data passes verification.

### 2. Backfill

- Backfill scripts must be idempotent and safe to rerun.
- Process large datasets in bounded batches.
- Record processed, skipped and failed counts.
- Do not overwrite a valid new-format value on retry.

### 3. Verification

- Compare old and new representations by count and stable identifier.
- Report missing, conflicting and invalid records.
- A cutover is blocked while verification has unresolved failures.

### 4. Compatibility window

- Reads prefer the new representation and fall back to the old one while backfill is incomplete.
- Writes update both representations when rollback compatibility requires it.
- Historical orders, invoices, product snapshots and audit events must remain readable even when a feature is disabled.

### 5. Cutover

- Use an explicit release decision or feature/configuration switch.
- Invalidate affected feature, navigation, catalog and SEO caches.
- Monitor errors and data divergence before declaring the migration complete.

### 6. Removal

- Remove old columns and compatibility code only in a later release.
- Require a successful production verification report and a tested restore path.
- Database rollback means forward-fixing with additive migrations whenever destructive rollback would lose data.

## Required migration artifacts

Each schema-changing phase must contain:

- Prisma migration
- idempotent backfill command
- read-only verification command
- compatibility strategy
- cache invalidation list
- cutover and restore runbook
- tests proving old data remains readable

## Planned applications

- Phase 2: `StoreFeature`, dependency-aware resolver and cache invalidation
- Phase 4: typed attribute values and `CategoryAttribute`
- Phase 6: category visibility/order/activation fields
- Phase 8: `BookMetadata` extraction from `Product.writerId/publisherId`
- Phase 9: base seeds, vertical presets and demo seeds separated

