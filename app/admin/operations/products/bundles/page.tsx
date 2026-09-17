"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  Package,
  Tag,
  TrendingDown,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
  bundleItems: Array<{
    id: number;
    productId: number;
    quantity: number;
    sortOrder: number;
    product: {
      id: number;
      name: string;
      basePrice: number;
      image?: string;
      available: boolean;
    };
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

interface BundlesResponse {
  bundles: Bundle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function BundlesPage() {
  const router = useRouter();
  const t = useTranslations("AdminBundles.list");
  const locale = useLocale();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<BundlesResponse["pagination"]>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingBundle, setDeletingBundle] = useState<Bundle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchBundles = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search,
        status: statusFilter,
      });

      const response = await fetch(`/api/admin/operations/products/bundles?${params}`);
      if (!response.ok) throw new Error(t("errors.fetch"));

      const data: BundlesResponse = await response.json();
      setBundles(data.bundles);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching bundles:", error);
      toast.error(t("errors.load"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBundles();
  }, [page, search, statusFilter]);

  const handleDelete = async () => {
    if (!deletingBundle) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/operations/products/bundles/${deletingBundle.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) throw new Error(t("errors.delete"));

      toast.success(t("success.deleted"));
      setDeleteModalOpen(false);
      setDeletingBundle(null);
      fetchBundles();
    } catch (error) {
      console.error("Error deleting bundle:", error);
      toast.error(t("errors.delete"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBundles();
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const filteredBundles = useMemo(() => {
    return bundles; // Filtering is done server-side
  }, [bundles]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("header.title")}</h1>
          <p className="text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            {t("actions.refresh")}
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("actions.create")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t("filters.searchPlaceholder")}
                  aria-label={t("filters.searchLabel")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                {t("filters.all", { count: pagination.total })}
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("active");
                  setPage(1);
                }}
              >
                {t("status.active")}
              </Button>
              <Button
                variant={statusFilter === "inactive" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter("inactive");
                  setPage(1);
                }}
              >
                {t("status.inactive")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bundles Grid */}
      {filteredBundles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("empty.title")}</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== "all"
                ? t("empty.filtered")
                : t("empty.initial")}
            </p>
            {!search && statusFilter === "all" && (
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("actions.create")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredBundles.map((bundle) => (
            <Card
              key={bundle.id}
              className="overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-primary/50"
              onClick={() =>
                router.push(`/admin/operations/products/bundles/${bundle.id}`)
              }
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-start gap-6">
                  {/* Bundle Image */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {bundle.image ? (
                        <Image
                          src={bundle.image}
                          alt={bundle.name}
                          width={80}
                          height={80}
                          className="object-cover"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Bundle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">
                            {bundle.name}
                          </h3>
                          <Badge
                            variant={bundle.available ? "default" : "secondary"}
                          >
                            {bundle.available ? t("status.active") : t("status.inactive")}
                          </Badge>
                          {bundle.featured && (
                            <Badge variant="outline">{t("status.featured")}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {bundle.shortDesc || bundle.description}
                        </p>
                      </div>
                    </div>

                    {/* Bundle Items */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Package className="h-4 w-4" />
                        <span>{t("card.items", { count: bundle._stats.itemCount })}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {bundle.bundleItems.slice(0, 3).map((item) => (
                          <Badge
                            key={item.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {item.product.name} × {item.quantity}
                          </Badge>
                        ))}
                        {bundle.bundleItems.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            {t("card.more", { count: bundle.bundleItems.length - 3 })}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency(
                            bundle._stats.regularTotal,
                            bundle.currency,
                          )}
                        </span>
                        <TrendingDown className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-lg">
                          {formatCurrency(
                            bundle._stats.discountedPrice,
                            bundle.currency,
                          )}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-green-700 bg-green-50"
                      >
                        {t("card.save", { amount: bundle._stats.savings })}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(`/admin/operations/products/bundles/${bundle.id}`)
                    }
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {t("actions.view")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(`/admin/operations/products/bundles/${bundle.id}`)
                    }
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    {t("actions.edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeletingBundle(bundle);
                      setDeleteModalOpen(true);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("actions.delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            {t("pagination.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("pagination.page", { page, pages: pagination.pages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === pagination.pages}
          >
            {t("pagination.next")}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.description", { name: deletingBundle?.name ?? "" })}
              {deletingBundle && (
                <span className="block mt-2 text-sm">
                  {t("delete.productCount", { count: deletingBundle._stats.itemCount })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BundleFormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        mode="create"
        onSuccess={async () => {
          setPage(1);
          await fetchBundles();
        }}
      />
    </div>
  );
}
