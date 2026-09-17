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
          toast.error("Bundle not found");
          router.push("/admin/operations/products/bundles");
          return;
        }
        throw new Error("Failed to fetch bundle");
      }

      const bundleData: Bundle = await response.json();
      setBundle(bundleData);
    } catch (error) {
      console.error("Error fetching bundle:", error);
      toast.error("Failed to load bundle");
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
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
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
          <h2 className="text-2xl font-semibold mb-2">Bundle not found</h2>
          <p className="text-muted-foreground mb-4">
            The bundle you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => router.push("/admin/operations/products/bundles")}>
            Back to Bundles
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
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{bundle.name}</h1>
            <p className="text-muted-foreground">
              Bundle details and configuration
            </p>
          </div>
        </div>

        <Button onClick={() => setEditModalOpen(true)}>
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Bundle
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bundle Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Bundle Overview</CardTitle>
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
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {bundle.description}
                </p>
              </div>

              {/* Short Description */}
              {bundle.shortDesc && (
                <div>
                  <h3 className="font-medium mb-2">Short Description</h3>
                  <p className="text-muted-foreground">{bundle.shortDesc}</p>
                </div>
              )}

              {/* Gallery */}
              {bundle.gallery && bundle.gallery.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Gallery</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {bundle.gallery.map((image, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted rounded-lg overflow-hidden"
                      >
                        <Image
                          src={image}
                          alt={`Gallery image ${index + 1}`}
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
                Selection Groups ({bundle._stats.itemCount})
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
                      <Badge variant="outline">{group.selectionType.replace("_", " ")}</Badge>
                      <Badge variant="outline">{group.pricingMode === "AUTOMATIC" ? "Automatic pricing" : "Manual pricing"}</Badge>
                      <Badge variant={group.required ? "default" : "secondary"}>{group.required ? "Required" : "Optional"}</Badge>
                      <span className="text-xs text-muted-foreground">Choose {group.minSelect}–{group.maxSelect} · Qty {group.defaultQuantity}</span>
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
                            <p className="truncate text-xs text-muted-foreground">{option.variant?.sku || "Default variant"}</p>
                          </div>
                          <div className="text-right text-xs">
                            {option.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                            <p className="mt-1 font-medium">
                              {group.pricingMode === "AUTOMATIC" && group.maxSelect > 1
                                ? "Calculated with group"
                                : displayedAdjustment === 0
                                  ? "Included"
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
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Available</span>
                <Badge variant={bundle.available ? "default" : "secondary"}>
                  {bundle.available ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Featured</span>
                <Badge variant={bundle.featured ? "default" : "outline"}>
                  {bundle.featured ? "Featured" : "Regular"}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Created</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(bundle.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Updated</span>
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
                Pricing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Regular Total:
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
                    Bundle Price:
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
                    Discount Amount:
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
                    Discount Percentage:
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
                  <span className="font-medium">Customer Saves</span>
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
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Category:</span>
                <Badge variant="outline">
                  {bundle.category?.name || "Uncategorized"}
                </Badge>
              </div>

              {bundle.brand && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Brand:</span>
                  <Badge variant="outline">{bundle.brand.name}</Badge>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Currency:</span>
                <Badge variant="outline">{bundle.currency}</Badge>
              </div>

              {bundle.VatClass && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">VAT Class:</span>
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
                  Edit Bundle
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
