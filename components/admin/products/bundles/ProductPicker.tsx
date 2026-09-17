"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Product {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  basePrice: number;
  originalPrice?: number;
  currency: string;
  image?: string;
  available: boolean;
  type: string;
  category?: {
    id: number;
    name: string;
  };
  brand?: {
    id: number;
    name: string;
  };
  defaultPrice: number;
  stock: number;
  variants: Array<{
    id: number;
    sku: string;
    price: number;
    currency: string;
    stock: number;
    isDefault: boolean;
    options: any;
  }>;
}

interface BundleItem {
  product: Product;
  variant?: Product["variants"][0];
  quantity: number;
}

interface Category {
  id: number;
  name: string;
}

interface ProductPickerProps {
  selectedItems: BundleItem[];
  onItemsChange: (items: BundleItem[]) => void;
  excludeBundleId?: number;
  categoryIds?: string[];
  categories?: Category[];
  warehouseId?: string;
}

export default function ProductPicker({
  selectedItems,
  onItemsChange,
  excludeBundleId,
  categoryIds,
  categories,
  warehouseId,
}: ProductPickerProps) {
  const t = useTranslations("AdminBundles.picker");
  const locale = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showProducts, setShowProducts] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<{ [key: number]: number }>({});

  const selectedProductIds = useMemo(
    () => new Set(selectedItems.map((item) => item.product?.id).filter(Boolean)),
    [selectedItems]
  );

  const getSafeSelectedItems = () => {
    const safeItems = (selectedItems || []).filter((item) => item?.product?.id);
    if (safeItems.length !== (selectedItems || []).length) {
      console.warn("ProductPicker: Dropping invalid selectedItems entries", {
        original: (selectedItems || []).length,
        safe: safeItems.length,
      });
    }
    return safeItems;
  };

  const fetchProductsByCategory = async (categoryId: string) => {
    if (!categoryId) {
      setProducts([]);
      setShowProducts(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        categoryIds: categoryId,
        limit: "50",
      });

      if (excludeBundleId) {
        params.append("excludeBundleId", excludeBundleId.toString());
      }

      const response = await fetch(
        `/api/admin/operations/products/bundles/search-products?${params}`
      );
      if (!response.ok) throw new Error(t("errors.fetch"));

      const data = await response.json();
      let fetchedProducts = data.products || [];

      if (warehouseId && fetchedProducts.length > 0) {
        const productIds = fetchedProducts.map((p: Product) => p.id).join(",");
        const stockResponse = await fetch(
          `/api/admin/operations/products/warehouse-stock?productIds=${productIds}&warehouseId=${warehouseId}`
        );

        if (stockResponse.ok) {
          const stockData = await stockResponse.json();
          const stockMap = new Map();

          stockData.products?.forEach((productWithStock: any) => {
            stockMap.set(productWithStock.id, {
              stock: productWithStock.stock,
              variants: productWithStock.variants,
            });
          });

          fetchedProducts = fetchedProducts.map((product: Product) => {
            const stockInfo = stockMap.get(product.id);
            if (stockInfo) {
              return {
                ...product,
                stock: stockInfo.stock,
                variants: product.variants.map((variant: any) => {
                  const variantStock = stockInfo.variants.find(
                    (v: any) => v.id === variant.id
                  );
                  return variantStock
                    ? { ...variant, stock: variantStock.stock.available }
                    : variant;
                }),
              };
            }
            return product;
          });
        }
      }

      setProducts(fetchedProducts);
      setShowProducts(true);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error(t("errors.fetch"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (categoryIds && categoryIds.length > 0) {
      setSelectedCategory(categoryIds[0]);
      fetchProductsByCategory(categoryIds[0]);
    } else {
      setProducts([]);
      setShowProducts(false);
      setSelectedCategory("");
    }
  }, [categoryIds]);

  useEffect(() => {
    if (selectedCategory && showProducts) {
      fetchProductsByCategory(selectedCategory);
    }
  }, [warehouseId]);

  const addItem = (product: Product) => {
    if (!product || !product.id || !product.name) {
      toast.error(t("errors.invalidProduct"));
      return;
    }

    if (product.stock <= 0) {
      toast.error(t("errors.productOutOfStock"));
      return;
    }

    const selectedVariantId = selectedVariants[product.id];
    const selectedVariant =
      product.variants.find((v) => v.id === selectedVariantId) ||
      product.variants.find((v) => v.isDefault) ||
      product.variants[0];

    const variantStock = selectedVariant?.stock || 0;
    if (selectedVariant && variantStock <= 0) {
      toast.error(t("errors.variantOutOfStock"));
      return;
    }

    const cleanProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      basePrice: product.basePrice,
      originalPrice: product.originalPrice,
      currency: product.currency,
      image: product.image,
      available: product.available,
      type: product.type,
      category: product.category,
      brand: product.brand,
      defaultPrice: product.defaultPrice,
      stock: product.stock,
      variants: product.variants || [],
    };

    const cleanVariant = selectedVariant
      ? {
          id: selectedVariant.id,
          sku: selectedVariant.sku,
          price: selectedVariant.price,
          currency: selectedVariant.currency,
          stock: selectedVariant.stock,
          isDefault: selectedVariant.isDefault,
          options: selectedVariant.options,
        }
      : undefined;

    const newItem: BundleItem = {
      product: cleanProduct,
      variant: cleanVariant,
      quantity: 1,
    };

    const safeSelectedItems = getSafeSelectedItems();

    const existingItemIndex = safeSelectedItems.findIndex(
      (item) =>
        item.product?.id === product.id &&
        (item.variant?.id || 0) === (cleanVariant?.id || 0)
    );

    let newItems: BundleItem[];
    if (existingItemIndex >= 0) {
      newItems = [...safeSelectedItems];
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        quantity: newItems[existingItemIndex].quantity + 1,
      };
    } else {
      newItems = [...safeSelectedItems, newItem];
    }

    onItemsChange(newItems);
  };

  const removeItem = (productId: number, variantId?: number) => {
    const safeSelectedItems = getSafeSelectedItems();

    const updatedItems = safeSelectedItems.filter(
      (item) =>
        !(
          item.product.id === productId &&
          (item.variant?.id || 0) === (variantId || 0)
        )
    );

    onItemsChange(updatedItems);
  };

  const updateQuantity = (productId: number, quantity: number, variantId?: number) => {
    if (quantity < 1) return;

    const safeSelectedItems = getSafeSelectedItems();

    const updatedItems = safeSelectedItems.map((item) => {
      if (
        item.product?.id === productId &&
        (item.variant?.id || 0) === (variantId || 0)
      ) {
        const itemStock = Number(item.variant?.stock ?? item.product?.stock ?? 0);
        return { ...item, quantity: Math.min(quantity, Math.max(itemStock, 1)) };
      }
      return item;
    });

    onItemsChange(updatedItems);
  };

  const formatCurrency = (amount: number, currency = "BDT") => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency === "BDT" ? "BDT" : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(amount)
      .replace("BDT", "৳");
  };

  return (
    <div className="space-y-4">
      {categoryIds && categoryIds.length > 0 && (
        <div>
          <label className="text-sm font-medium mb-2 block">
            {t("categoryLabel")}
          </label>
          <Select
            value={selectedCategory}
            onValueChange={(value) => {
              setSelectedCategory(value);
              fetchProductsByCategory(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {categoryIds.map((categoryId) => {
                const category = categories?.find(
                  (c) => c.id.toString() === categoryId
                );
                return (
                  <SelectItem key={categoryId} value={categoryId}>
                    {category?.name || t("categoryNumber", { id: categoryId })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {(!categoryIds || categoryIds.length === 0) && (
        <Card className="p-4 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2" />
          <p>{t("chooseCategoryHint")}</p>
        </Card>
      )}

      {showProducts && products.length > 0 && (
        <Card className="border-2">
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{product.name}</h4>

                        <Badge
                          variant={product.stock > 0 ? "outline" : "destructive"}
                          className="text-xs"
                        >
                          {t("totalStock", { count: product.stock })}
                        </Badge>

                        {warehouseId && (
                          <Badge variant="secondary" className="text-xs">
                            {t("warehouseStock")}
                          </Badge>
                        )}

                        {product.stock <= 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {t("outOfStock")}
                          </Badge>
                        )}
                      </div>

                      {product.variants && product.variants.length > 1 && (
                        <div className="mb-2">
                          <Select
                            value={
                              selectedVariants[product.id]?.toString() ||
                              product.variants.find((v) => v.isDefault)?.id?.toString() ||
                              product.variants[0]?.id?.toString()
                            }
                            onValueChange={(value) => {
                              setSelectedVariants((prev) => ({
                                ...prev,
                                [product.id]: parseInt(value, 10),
                              }));
                            }}
                          >
                            <SelectTrigger className="w-full h-8">
                              <SelectValue placeholder={t("variantPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {product.variants.map((variant) => (
                                <SelectItem
                                  key={variant.id}
                                  value={variant.id.toString()}
                                  disabled={(variant.stock || 0) <= 0}
                                >
                                  {variant.sku} -{" "}
                                  {formatCurrency(variant.price, product.currency)} (
                                  {warehouseId
                                    ? t("inWarehouse", { count: variant.stock || 0 })
                                    : t("inStock", { count: variant.stock })}
                                  )
                                  {(variant.stock || 0) <= 0 && ` - ${t("outOfStock")}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {formatCurrency(product.defaultPrice, product.currency)}
                        </span>
                        {product.category && (
                          <>
                            <span>•</span>
                            <span>{product.category.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => addItem(product)}
                      className="flex-shrink-0"
                      disabled={product.stock <= 0}
                    >
                      {product.stock > 0 ? t("add") : t("outOfStock")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showProducts && products.length === 0 && !loading && (
        <Card className="p-4 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2" />
          <p>{t("emptyCategory")}</p>
        </Card>
      )}

      {selectedItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("selectedProducts", { count: selectedItems.length })}
            </h3>

            <div className="space-y-3">
              {selectedItems.map((item, index) => {
                const itemStock = item.variant ? item.variant.stock : item.product.stock;
                const isOutOfStock = itemStock <= 0;
                const maxBundlesForItem =
                  item.quantity > 0 ? Math.floor(itemStock / item.quantity) : 0;

                return (
                  <div
                    key={`${item.product.id}-${item.variant?.id || "default"}-${index}`}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isOutOfStock
                        ? "bg-destructive/10 border border-destructive/20"
                        : "bg-muted/30"
                    }`}
                  >
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.product.image ? (
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{item.product.name}</h4>

                      {item.variant && (
                        <div className="text-sm text-muted-foreground">
                          {t("variant", { sku: item.variant.sku })}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {formatCurrency(
                            item.variant?.price || item.product.defaultPrice,
                            item.product.currency
                          )}
                        </span>

                        {item.product.category && (
                          <>
                            <span>•</span>
                            <span>{item.product.category.name}</span>
                          </>
                        )}

                        {isOutOfStock && (
                          <>
                            <span>•</span>
                            <span className="text-destructive font-medium">
                              {t("outOfStock")}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{t("totalStock", { count: itemStock })}</span>
                        <span>{t("quantityPerBundle", { count: item.quantity })}</span>
                        <span>{t("maxBundles", { count: maxBundlesForItem })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-28">
                          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                            {t("quantityLabel")}
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max={Math.max(itemStock, 1)}
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.product.id,
                                Number(e.target.value || 1),
                                item.variant?.id
                              )
                            }
                            className="h-8"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity - 1,
                              item.variant?.id
                            )
                          }
                          disabled={item.quantity <= 1}
                          aria-label={t("decreaseQuantity", { product: item.product.name })}
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>

                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity + 1,
                              item.variant?.id
                            )
                          }
                          className="h-8 w-8 p-0"
                          aria-label={t("increaseQuantity", { product: item.product.name })}
                        >
                          +
                        </Button>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removeItem(item.product.id, item.variant?.id)
                        }
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        aria-label={t("removeProduct", { product: item.product.name })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedItems.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">{t("emptySelection.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("emptySelection.description")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
