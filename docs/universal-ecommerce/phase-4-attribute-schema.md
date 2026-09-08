# Phase 4 — Typed category attributes

Phase 4 adds the data foundation for category-specific product specifications without removing the legacy `ProductAttribute.value` field.

## Delivered

- `AttributeType`: `TEXT`, `NUMBER`, `SELECT`, `MULTI_SELECT`, `BOOLEAN`, and `COLOR`.
- Optional units on attribute definitions.
- `CategoryAttribute` mappings with required, filterable, variant, and sort-order metadata.
- Typed product value columns: text, decimal, boolean, and predefined-value reference.
- Compatibility writes: every current product mutation still writes `value` and also writes the matching typed column when the legacy value is resolvable.
- Admin attribute definition editing plus a protected category-mapping API.
- Idempotent typed-value backfill and a read-only verification command.

## Rollout order

1. Back up the database and apply `20260908_add_typed_category_attributes` in the normal deployment pipeline.
2. Configure each attribute's type and optional unit in Product Management.
3. Run `npm run backfill:product-attributes`.
4. Run `npm run verify:product-attributes-db` and resolve every listed legacy value.
5. Save category mappings through `PUT /api/categories/:id/attributes`; Phase 5 treats this as the strict-policy cutover for that category.

The migration has no data update or destructive statement. The backfill skips rows whose typed value already matches the legacy value and repairs stale typed fields, so it can safely be rerun after a definition change.

## Compatibility boundary

Phase 4 intentionally does not reject a legacy value that cannot yet be converted. This keeps current product create/edit flows operational while administrators classify existing attributes. Phase 5 will add category-aware forms, required-field enforcement, strict type validation, and typed storefront filtering after the verifier is clean.
