# Phase 5 — Category attribute integration

Phase 5 connects the typed attribute schema to product management and storefront filtering.

## Product management

- Selecting a category renders its mapped attributes in configured sort order.
- Inputs follow the attribute type: text, decimal number, managed choice/color, multi-select, or boolean.
- Required, filterable, variant, and unit metadata are visible to administrators.
- Variant option selection is restricted to attributes marked `isVariant` when the category has a policy.
- The relations editor uses the same category allow-list and typed controls.

## Server enforcement

Product create and update validate the complete effective attribute set against trusted database mappings. A configured category rejects:

- missing required attributes;
- attributes not assigned to the category;
- invalid numbers and booleans;
- unmanaged SELECT/COLOR values;
- unsupported MULTI_SELECT values;
- variant options not marked `isVariant`.

Direct attribute mutations validate the category and type too. Required attributes cannot be removed through the relations endpoint.

For rollout safety, categories with zero mappings retain the legacy compatibility behavior. Strict enforcement starts independently for each category as soon as its first mapping is saved.

## Storefront filters

Facets now include only category mappings marked `isFilterable`. Filtering reads the typed columns (`valueNumber`, `valueBoolean`, `attributeValueId`, or `valueText`) instead of comparing every value as a legacy string. Attributes that are both filterable and variant-enabled also aggregate their validated variant-option values. Numeric facet values sort numerically, boolean values render as Yes/No, configured units appear in filter headings, and counts are de-duplicated per product.

Apply the Phase 4 migration, configure attribute types, run the typed backfill, and ensure `npm run verify:product-attributes-db` is clean before saving mappings for production categories. Mapping changes are rejected if they would invalidate an active product or expose an active product with stale typed storage.
