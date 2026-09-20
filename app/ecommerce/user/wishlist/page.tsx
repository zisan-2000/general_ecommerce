"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Home, Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AccountMenu from "../AccountMenu";
import AccountHeader from "../AccountHeader";
import { useCart } from "@/components/ecommarce/CartContext";
import ProductCard from "@/components/ecommarce/ProductCard";
import PriceDropAlertButton from "@/components/ecommarce/PriceDropAlertButton";
import { useLocale, useTranslations } from "next-intl";

type ApiWishlistItem = {
  id: number;
  userId: string;
  productId: number;
  product: {
    id: number;
    name: string;
    slug?: string | null;
    basePrice?: string | number | null;
    originalPrice?: string | number | null;
    image?: string | null;
    discount?: number | null;
    stock?: number | null;
  };
};

type WishlistProduct = {
  id: number;
  name: string;
  slug?: string | null;
  price: number;
  originalPrice: number;
  discount: number;
  image: string;
  stock: number | null;
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export default function WishlistPage() {
  const t = useTranslations("CustomerAccount");
  const locale = useLocale();
  const { addToCart } = useCart();
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/wishlist", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
          toast.error(t("wishlist.errors.login"), { duration: 3500 });
          setItems([]);
          return;
        }

        if (!res.ok) {
          toast.error(t("wishlist.errors.load"), { duration: 3500 });
          setItems([]);
          return;
        }

        const mapped: WishlistProduct[] = Array.isArray(data?.items)
          ? (data.items as ApiWishlistItem[]).map((wishlistItem) => {
              const product = wishlistItem.product;
              const price = toNumber(product?.basePrice);
              const original = toNumber(product?.originalPrice || product?.basePrice);
              const discount =
                typeof product?.discount === "number"
                  ? product.discount
                  : original > 0 && price > 0 && original > price
                    ? Math.round(((original - price) / original) * 100)
                    : 0;

              return {
                id: product.id,
                name: product.name,
                slug: product.slug ?? null,
                price,
                originalPrice: original,
                discount,
                image: product.image || "/placeholder.svg",
                stock:
                  product.stock === null || product.stock === undefined
                    ? null
                    : toNumber(product.stock),
              };
            })
          : [];

        setItems(mapped);
      } catch (err) {
        console.error("Error fetching wishlist:", err);
        toast.error(t("wishlist.errors.load"), { duration: 3500 });
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchWishlist();
  }, []);

  const handleRemoveItem = async (productId: number) => {
    try {
      const res = await fetch(`/api/wishlist?productId=${productId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(t("wishlist.errors.remove"), { duration: 3500 });
        return;
      }

      setItems((prev) => prev.filter((product) => product.id !== productId));
      toast.success(t("wishlist.removed"), { duration: 2500 });
    } catch (err) {
      console.error("Error removing wishlist item:", err);
      toast.error(t("wishlist.errors.remove"), { duration: 3500 });
    }
  };

  const handleAddToCart = (product: WishlistProduct) => {
    addToCart(product.id);
    toast.success(t("wishlist.addedToCart", { name: product.name }), { duration: 2500 });
  };

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-foreground">
            <Home className="h-4 w-4" />
            <span>{t("common.home")}</span>
          </Link>
          <span>/</span>
          <Link href="/ecommerce/user" className="transition-colors hover:text-foreground">
            {t("common.account")}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t("wishlist.title")}</span>
        </div>
      </div>

      <AccountHeader />
      <AccountMenu />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Heart className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-2xl font-medium">{t("wishlist.title")}</h2>
        </div>

        {loading ? (
          <Card className="rounded-2xl border border-border bg-card p-6 text-card-foreground">
            <p className="text-sm text-muted-foreground">{t("wishlist.loading")}</p>
          </Card>
        ) : empty ? (
          <Card className="rounded-2xl border border-border bg-card p-8 text-center text-card-foreground">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
              <Heart className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">{t("wishlist.emptyTitle")}</h3>
            <p className="mb-5 text-sm text-muted-foreground">
              {t("wishlist.emptyDescription")}
            </p>
            <Link href="/">
              <Button className="rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                {t("wishlist.continueShopping")}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="flex h-full flex-col gap-2">
                <ProductCard
                  product={{
                    id: item.id,
                    name: item.name,
                    href: `/ecommerce/products/${item.id}`,
                    image: item.image,
                    price: item.price,
                    originalPrice: item.originalPrice,
                    discountPct: item.discount,
                    stock: item.stock,
                  }}
                  wishlistMode="remove"
                  onWishlistClick={() => handleRemoveItem(item.id)}
                  onAddToCart={() => handleAddToCart(item)}
                  showMeta={false}
                  formatPrice={(value) =>
                    new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: "BDT",
                    }).format(value)
                  }
                  className="rounded-2xl"
                />
                <PriceDropAlertButton
                  productId={item.id}
                  productHref={`/ecommerce/products/${item.id}`}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
