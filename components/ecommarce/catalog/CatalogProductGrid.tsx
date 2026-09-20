"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ProductCard from "@/components/ecommarce/ProductCard";
import { useCart } from "@/components/ecommarce/CartContext";
import { useWishlist } from "@/components/ecommarce/WishlistContext";
import { useSession } from "@/lib/auth-client";
import { useProductCompare } from "@/hooks/use-product-compare";
import { useStorefrontFeatures } from "@/providers/storefront-features-provider";
import type { StorefrontCatalogProduct } from "@/lib/storefront-catalog";
import { sendSearchEvent } from "@/lib/search/client-analytics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale, useTranslations } from "next-intl";

export default function CatalogProductGrid({
  products,
  searchQuery = "",
  resultCount,
}: {
  products: StorefrontCatalogProduct[];
  searchQuery?: string;
  resultCount?: number;
}) {
  const t = useTranslations("StorefrontCatalog.grid");
  const locale = useLocale();
  const { COMPARE: compareEnabled } = useStorefrontFeatures();
  const { status } = useSession();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const {
    count: compareCount,
    href: compareHref,
    isCompared,
    toggle: toggleComparedProduct,
  } = useProductCompare();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const formatBDT = useCallback(
    (value: number) => `৳${Math.round(value).toLocaleString(locale)}`,
    [locale],
  );

  const toggleWishlist = useCallback(
    async (product: StorefrontCatalogProduct) => {
      if (status !== "authenticated") {
        setLoginModalOpen(true);
        return;
      }

      try {
        const wishlisted = isInWishlist(product.id);
        const response = await fetch(
          wishlisted ? `/api/wishlist?productId=${product.id}` : "/api/wishlist",
          wishlisted
            ? { method: "DELETE" }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id }),
              },
        );
        if (!response.ok) throw new Error(t("errors.wishlist"));

        if (wishlisted) {
          removeFromWishlist(product.id);
          toast.success(t("success.wishlistRemoved"));
        } else {
          addToWishlist(product.id);
          toast.success(t("success.wishlistAdded"));
        }
      } catch (error) {
        console.error(error);
        toast.error(t("errors.wishlist"));
      }
    },
    [addToWishlist, isInWishlist, removeFromWishlist, status, t],
  );

  const addProductToCart = useCallback(
    async (product: StorefrontCatalogProduct) => {
      if (product.stock <= 0) {
        toast.error(t("errors.outOfStock"));
        return;
      }
      if (await addToCart(product.id)) toast.success(t("success.addedToCart", { name: product.name }));
      else toast.error(t("errors.addToCart"));
      if (searchQuery) {
        sendSearchEvent({
          event: "ADD_TO_CART",
          query: searchQuery,
          resultCount,
          productId: product.id,
        });
      }
    },
    [addToCart, resultCount, searchQuery, t],
  );

  const toggleCompare = useCallback(
    (productId: number) => {
      const result = toggleComparedProduct(productId);
      if (result.limitReached) toast.error(t("errors.compareLimit"));
      else toast.success(result.added ? t("success.comparisonAdded") : t("success.comparisonRemoved"));
    },
    [t, toggleComparedProduct],
  );

  return (
    <>
      {compareEnabled && compareCount > 0 ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
          <span>{t("compareSelected", { count: compareCount })}</span>
          <Link href={compareHref} className="font-bold text-primary hover:underline">{t("compareNow")}</Link>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="h-full"
            onClickCapture={(event) => {
              if (!searchQuery) return;
              const target = event.target as HTMLElement;
              if (!target.closest("a[href*='/ecommerce/products/']")) return;
              sendSearchEvent({
                event: "RESULT_CLICKED",
                query: searchQuery,
                resultCount,
                productId: product.id,
                position: index + 1,
              });
            }}
          >
          <ProductCard
            product={{
              id: product.id,
              name: product.name,
              href: `/ecommerce/products/${product.id}`,
              image: product.image,
              shortDesc: product.shortDesc ?? undefined,
              specifications: product.specifications,
              price: product.price,
              originalPrice: product.originalPrice,
              stock: product.stock,
              ratingAvg: product.ratingAvg,
              ratingCount: product.ratingCount,
              discountPct: product.discountPct,
              type: product.type,
              variants: product.variants,
              available: product.available,
              totalSold: product.soldCount,
              bundleStockLimit: product.bundleStockLimit ?? undefined,
              bundleItems: product.bundleItems,
              bundleItemCount: product.bundleItems.length,
            }}
            wishlisted={isInWishlist(product.id)}
            onWishlistClick={() => toggleWishlist(product)}
            onCompareClick={
              compareEnabled ? () => toggleCompare(product.id) : undefined
            }
            compared={compareEnabled && isCompared(product.id)}
            onAddToCart={() => addProductToCart(product)}
            formatPrice={formatBDT}
            imagePriority={index < 2}
          />
          </div>
        ))}
      </div>

      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("login.title")}</DialogTitle>
            <DialogDescription>
              {t("login.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setLoginModalOpen(false)}
              className="h-10 rounded-lg border px-4 text-sm font-medium hover:bg-muted"
            >
              {t("login.cancel")}
            </button>
            <Link
              href="/signin?callbackUrl=/ecommerce/products"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {t("login.signIn")}
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
