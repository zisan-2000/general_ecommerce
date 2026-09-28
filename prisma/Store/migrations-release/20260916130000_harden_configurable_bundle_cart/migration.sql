-- PostgreSQL treats NULL values as distinct in ordinary unique constraints.
-- Bundle parents intentionally have no variant, so protect identical configured
-- lines with a partial unique index and keep concurrent cart writes idempotent.
CREATE UNIQUE INDEX "CartItem_user_product_line_null_variant_key"
ON "CartItem"("userId", "productId", "lineKey")
WHERE "variantId" IS NULL;
