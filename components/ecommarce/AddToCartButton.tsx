"use client";

import { useState } from "react";
import { useCart } from "@/components/ecommarce/CartContext";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function AddToCartButton({
  productId,
  variantId,
  quantity = 1,
  className = "",
  children,
  disabled = false,
  disabledText,
}: {
  productId: string | number;
  variantId?: string | number | null;
  quantity?: number;
  className?: string;
  children?: React.ReactNode;

  // ✅ NEW
  disabled?: boolean;
  disabledText?: string;
}) {
  const t = useTranslations("StorefrontCommerce.addToCart");
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(false);

  const isDisabled = disabled || loading || !productId;

  const handleAdd = async () => {
    if (isDisabled) return;

    try {
      setLoading(true);

      // ✅ Your existing CartContext function (localStorage cart)
      const added = await addToCart(productId, quantity, variantId);
      if (!added) throw new Error("Product could not be added to cart");
    } catch (e) {
      console.error(e);
      alert(t("failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={isDisabled}
      className={cn(
        "btn-primary h-11 px-6 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {loading
        ? t("adding")
        : isDisabled && disabled
          ? disabledText ?? t("outOfStock")
          : children ?? t("label")}
    </button>
  );
}
