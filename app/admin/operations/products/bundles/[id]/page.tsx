"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Edit3,
  Package,
  DollarSign,
  TrendingDown,
  Calendar,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import BundleFormModal from "@/components/admin/products/bundles/BundleFormModal";

interface Bundle {
  id: number;
  name: string;
  slug: string;
  description: string;
  shortDesc?: string;
  basePrice: number;
  originalPrice?: number;
  currency: string;
  image?: string;
  gallery?: string[];
  available: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: number;
    name: string;
  };
  brand?: {
    id: number;
    name: string;
  };
  VatClass?: {
    id: number;
    name: string;
    code: string;
  };
  bundleItems: Array<{
    id: number;
    productId: number;
    quantity: number;
    sortOrder: number;
    product: {
      id: number;
      name: string;
      slug: string;
      basePrice: number;
      image?: string;
      available: boolean;
      variants: Array<{
        id: number;
        sku: string;
        price: number;
        currency: string;
        stock: number;
        isDefault: boolean;
        options: any;
      }>;
    };
  }>;
  bundleGroups: Array<{
    id: number;
    name: string;
    selectionType: string;
    pricingMode: "AUTOMATIC" | "MANUAL";
    required: boolean;
    minSelect: number;
    maxSelect: number;
    defaultQuantity: number;
    allowQuantityChange: boolean;
    options: Array<{
      id: number;
      isDefault: boolean;
      priceAdjustment: number;
      product: { id: number; name: string; image?: string; available: boolean; basePrice: number };
      variant?: { id: number; sku: string; price: number } | null;
    }>;
  }>;
  _stats: {
    itemCount: number;
    regularTotal: number;
    discountedPrice: number;
    discountAmount: number;
    discountPercentage: number;
    savings: string;
  };
}

export default function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations("AdminBundles.detail");
  const locale = useLocale();
  const { id } = use(params);
  const bundleId = parseInt(id);

  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const fetchBundle = async () => {
    try {
      const response = await fetch(`/api/admin/operations/products/bundles/${bundleId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error(t("errors.notFound"));
          router.push("/admin/operations/products/bundles");
          return;
        }
        throw new Error(t("errors.fetch"));
      }

      const bundleData: Bundle = await response.json();
      setBundle(bundleData);
    } catch (error) {
      console.error("Error fetching bundle:", error);
      toast.error(t("errors.load"));
      router.push("/admin/operations/products/bundles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bundleId && !isNaN(bundleId)) {
      void fetchBundle();
    }
  }, [bundleId, router]);

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">{t("notFound.title")}</h2>
          <p className="text-muted-foreground mb-4">
            {t("notFound.description")}
          </p>
          <Button onClick={() => router.push("/admin/operations/products/bundles")}>
            {t("actions.backToBundles")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("actions.back")}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{bundle.name}</h1>
            <p className="text-muted-foreground">
              {t("header.description")}
            </p>
          </div>
        </div>

        <Button onClick={() => setEditModalOpen(true)}>
          <Edit3 className="h-4 w-4 mr-2" />
          {t("actions.edit")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bundle Overview */}
          <Card>
            <CardHeader>
              <CardTitle>{t("overview.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bundle Image */}
              {bundle.image && (
                <div className="w-full h-64 bg-muted rounded-lg overflow-hidden">
                  <Image
                    src={bundle.image}
                    alt={bundle.name}
                    width={600}
                    height={256}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <h3 className="font-medium mb-2">{t("overview.description")}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {bundle.description}
                </p>
              </div>

              {/* Short Description */}
              {bundle.shortDesc && (
                <div>
                  <h3 className="font-medium mb-2">{t("overview.shortDescription")}</h3>
                  <p className="text-muted-foreground">{bundle.shortDesc}</p>
                </div>
              )}

              {/* Gallery */}
              {bundle.gallery && bundle.gallery.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">{t("overview.gallery")}</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {bundle.gallery.map((image, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted rounded-lg overflow-hidden"
                      >
                        <Image
                          src={image}
                          alt={t("overview.galleryImage", { number: index + 1 })}
                          width={100}
                          height={100}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurable selection groups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t("groups.title", { count: bundle._stats.itemCount })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bundle.bundleGroups.map((group, index) => {
                  const defaultUnitPrice = group.options
                    .filter((option) => option.isDefault)
                    .reduce(
                      (total, option) => total + Number(option.variant?.price ?? option.product.basePrice),
                      0,
                    );
                  const hasDefault = group.options.some((option) => option.isDefault);
                  return (
                  <div key={group.id} className="rounded-lg bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                      <h4 className="font-semibold">{group.name}</h4>
                      <Badge variant="outline">{t(`selectionTypes.${group.selectionType}`)}</Badge>
                      <Badge variant="outline">{group.pricingMode === "AUTOMATIC" ? t("groups.automaticPricing") : t("groups.manualPricing")}</Badge>
                      <Badge variant={group.required ? "default" : "secondary"}>{group.required ? t("groups.required") : t("groups.optional")}</Badge>
                      <span className="text-xs text-muted-foreground">{t("groups.selectionSummary", { min: group.minSelect, max: group.maxSelect, quantity: group.defaultQuantity })}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {group.options.map((option) => {
                        const unitPrice = Number(option.variant?.price ?? option.product.basePrice);
                        const automaticDifference = !hasDefault
                          ? unitPrice
                          : unitPrice - defaultUnitPrice;
                        const displayedAdjustment = group.pricingMode === "AUTOMATIC"
                          ? automaticDifference
                          : Number(option.priceAdjustment);
                        return (
                        <div key={option.id} className="flex items-center gap-3 rounded border bg-background p-2">
                          <div className="relative h-10 w-10 overflow-hidden rounded bg-muted">
                            {option.product.image ? <Image src={option.product.image} alt="" fill sizes="40px" className="object-contain" /> : <Package className="m-2 h-6 w-6 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{option.product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{option.variant?.sku || t("groups.defaultVariant")}</p>
                          </div>
                          <div className="text-right text-xs">
                            {option.isDefault ? <Badge variant="secondary">{t("groups.default")}</Badge> : null}
                            <p className="mt-1 font-medium">
                              {group.pricingMode === "AUTOMATIC" && group.maxSelect > 1
                                ? t("groups.calculatedWithGroup")
                                : displayedAdjustment === 0
                                  ? t("groups.included")
                                  : `${displayedAdjustment > 0 ? "+" : "−"}${formatCurrency(Math.abs(displayedAdjustment), bundle.currency)}`}
                            </p>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t("status.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("status.available")}</span>
                <Badge variant={bundle.available ? "default" : "secondary"}>
                  {bundle.available ? t("status.active") : t("status.inactive")}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("status.featured")}</span>
                <Badge variant={bundle.featured ? "default" : "outline"}>
                  {bundle.featured ? t("status.featured") : t("status.regular")}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("status.created")}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(bundle.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("status.updated")}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(bundle.updatedAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t("pricing.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("pricing.regularTotal")}
                  </span>
                  <span className="font-medium line-through">
                    {formatCurrency(
                      bundle._stats.regularTotal,
                      bundle.currency,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("pricing.bundlePrice")}
                  </span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(
                      bundle._stats.discountedPrice,
                      bundle.currency,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("pricing.discountAmount")}
                  </span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(
                      bundle._stats.discountAmount,
                      bundle.currency,
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("pricing.discountPercentage")}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-green-700 bg-green-50"
                  >
                    {bundle._stats.discountPercentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-medium">{t("pricing.customerSaves")}</span>
                </div>
                <div className="text-2xl font-bold text-green-700 mt-1">
                  {bundle._stats.savings}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t("classification.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("classification.category")}</span>
                <Badge variant="outline">
                  {bundle.category?.name || t("classification.uncategorized")}
                </Badge>
              </div>

              {bundle.brand && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("classification.brand")}</span>
                  <Badge variant="outline">{bundle.brand.name}</Badge>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("classification.currency")}</span>
                <Badge variant="outline">{bundle.currency}</Badge>
              </div>

              {bundle.VatClass && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("classification.vatClass")}</span>
                  <Badge variant="outline">
                    {bundle.VatClass.name} ({bundle.VatClass.code})
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => setEditModalOpen(true)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {t("actions.edit")}
                </Button>

                {/* <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`ecommerce/products/${bundle.id}`)}
                  target=""
                >
                  <Package className="h-4 w-4 mr-2" />
                  View on Store
                </Button> */}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <BundleFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        bundleId={bundle.id}
        onSuccess={async () => {
          await fetchBundle();
        }}
      />
    </div>
  );
}
