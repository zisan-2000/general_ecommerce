-- PostgreSQL normally treats NULL variant IDs as distinct. Bundle lines use
-- NULL variants and must still be unique for each shopper/configuration.
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_user_product_line_null_variant_key"
ON "CartItem"("userId", "productId", "lineKey")
WHERE "variantId" IS NULL;
