"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshCw, Save, ChevronLeft, ChevronRight, Filter, Package, Building2, Calendar, User, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type AssetRow = {
  id: number;
  assetTag: string;
  warehouseId: number;
  productVariantId: number;
  status: "ACTIVE" | "RETIRED" | "LOST" | "DISPOSED";
  assignedTo: string | null;
  note: string | null;
  acquiredAt: string;
  warehouse: Warehouse;
  productVariant: {
    id: number;
    sku: string;
    product: {
      id: number;
      name: string;
    };
  };
  materialRequest: {
    id: number;
    requestNumber: string;
  } | null;
  materialReleaseNote: {
    id: number;
    releaseNumber: string;
    challanNumber: string | null;
    waybillNumber: string | null;
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type AssetSummary = {
  total: number;
  active: number;
  retired: number;
  lost: number;
  disposed: number;
};

type AssetDraft = {
  status: AssetRow["status"];
  assignedTo: string;
  note: string;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

function formatDateTime(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-success/10 text-success border-success/20";
    case "RETIRED":
      return "bg-muted/50 text-muted-foreground border-border";
    case "LOST":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "DISPOSED":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-muted/50 text-muted-foreground border-border";
  }
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange }: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  const getVisiblePages = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);
      
      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {getVisiblePages().map((page) => (
        <Button
          key={page}
          variant={currentPage === page ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(page)}
          className="h-8 w-8 p-0"
        >
          {page}
        </Button>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function AssetLifecyclePage() {
  const tScm = useTranslations("ScmAuto");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    ["asset_register.read", "asset_register.manage"].includes(permission),
  );
  const canManage = permissions.includes("asset_register.manage");

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [summary, setSummary] = useState<AssetSummary>({
    total: 0,
    active: 0,
    retired: 0,
    lost: 0,
    disposed: 0,
  });
  const [drafts, setDrafts] = useState<Record<number, AssetDraft>>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (status !== "ALL") query.set("status", status);
      if (warehouseId) query.set("warehouseId", warehouseId);

      const [warehouseData, payload] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }).then((res) =>
          readJson<Warehouse[]>(res, "Failed to load warehouses"),
        ),
        fetch(`/api/scm/assets?${query.toString()}`, {
          cache: "no-store",
        }).then((res) =>
          readJson<{ assets: AssetRow[]; summary: AssetSummary }>(
            res,
            "Failed to load assets",
          ),
        ),
      ]);

      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setAssets(Array.isArray(payload.assets) ? payload.assets : []);
      setSummary(
        payload.summary || {
          total: 0,
          active: 0,
          retired: 0,
          lost: 0,
          disposed: 0,
        },
      );

      setDrafts((current) => {
        const next = { ...current };
        for (const asset of Array.isArray(payload.assets)
          ? payload.assets
          : []) {
          if (!next[asset.id]) {
            next[asset.id] = {
              status: asset.status,
              assignedTo: asset.assignedTo || "",
              note: asset.note || "",
            };
          }
        }
        return next;
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to load assets");
      setAssets([]);
      setSummary({ total: 0, active: 0, retired: 0, lost: 0, disposed: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
  }, [canRead]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, warehouseId]);

  // Pagination calculations
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return assets.slice(start, end);
  }, [assets, currentPage]);

  const totalPages = Math.ceil(assets.length / itemsPerPage);

  const saveAsset = async (asset: AssetRow) => {
    const draft = drafts[asset.id];
    if (!draft) return;

    setSavingId(asset.id);
    try {
      const response = await fetch(`/api/scm/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          assignedTo: draft.assignedTo,
          note: draft.note,
        }),
      });

      await readJson(response, "Failed to update asset");
      toast.success(`Updated ${asset.assetTag}`);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update asset");
    } finally {
      setSavingId(null);
    }
  };

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tScm("k_3dab5f6012e3")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {tScm("k_77b7dd0854cf")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
          {tScm("k_4f2755ecf4e8")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          {tScm("k_d1844d122979")}
        </p>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-muted-foreground">{tScm("k_b25928c69902")}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
              {summary.total}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-muted-foreground">{tScm("k_a733b809d2f1")}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-success">
              {summary.active}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-muted-foreground">{tScm("k_37d1213e53ce")}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-muted-foreground">
              {summary.retired}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-muted-foreground">{tScm("k_75a7bf994e9a")}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-destructive">
              {summary.lost}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-muted-foreground">{tScm("k_1397ce5a41bd")}</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-warning">
              {summary.disposed}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{tScm("k_d356631d4242")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {tScm("k_1844c5dfc167")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden"
            >
              <Filter className="h-4 w-4 mr-2" />
              {tScm("k_96e578211aa2")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {/* Desktop Filters */}
          <div className="hidden sm:grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tScm("k_2505dbdac0a9")}
              className="text-sm"
            />
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="">{tScm("k_4398170593bf")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">{tScm("k_6405179d241b")}</option>
              <option value="ACTIVE">{tScm("k_c72633f673ef")}</option>
              <option value="RETIRED">{tScm("k_bda5ec3f892a")}</option>
              <option value="LOST">{tScm("k_29494e88e9c9")}</option>
              <option value="DISPOSED">{tScm("k_3c1b36d2e8ad")}</option>
            </select>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              {tScm("k_56e3badc4e6c")}
            </Button>
          </div>

          {/* Mobile Filters Drawer */}
          {showFilters && (
            <div className="space-y-3 sm:hidden">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tScm("k_6d7a30a931a3")}
                className="text-sm"
              />
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
              >
                <option value="">{tScm("k_4398170593bf")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="ALL">{tScm("k_6405179d241b")}</option>
                <option value="ACTIVE">{tScm("k_c72633f673ef")}</option>
                <option value="RETIRED">{tScm("k_bda5ec3f892a")}</option>
                <option value="LOST">{tScm("k_29494e88e9c9")}</option>
                <option value="DISPOSED">{tScm("k_3c1b36d2e8ad")}</option>
              </select>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading} className="w-full">
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                {tScm("k_56e3badc4e6c")}
              </Button>
              <Button variant="outline" onClick={() => setShowFilters(false)} className="w-full">
                {tScm("k_6834a4e56490")}
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Desktop Table View */}
          {!loading && paginatedAssets.length > 0 && (
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_4426afd90a77")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_298dff72dae2")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_6da13addb000")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_bae7d5be7082")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_d00c2e68c310")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_2c924e308820")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_c3cd636a585b")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAssets.map((asset) => {
                    const draft = drafts[asset.id] || {
                      status: asset.status,
                      assignedTo: asset.assignedTo || "",
                      note: asset.note || "",
                    };

                    return (
                      <TableRow key={asset.id} className="border-border hover:bg-muted/40">
                        <TableCell className="py-3">
                          <div className="font-medium text-sm text-foreground">{asset.assetTag}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {asset.productVariant.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {asset.productVariant.sku} • {formatDateTime(asset.acquiredAt)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm text-foreground">{asset.warehouse.name}</div>
                          <div className="text-xs text-muted-foreground">{asset.warehouse.code}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-xs text-foreground">
                            {tScm("k_b6b578fd7055")} {asset.materialRequest?.requestNumber || "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tScm("k_a86c7356b090")} {asset.materialReleaseNote?.releaseNumber || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {canManage ? (
                            <select
                              className={cn(
                                "rounded-md border px-2 py-1 text-xs font-medium",
                                getStatusColor(draft.status)
                              )}
                              value={draft.status}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [asset.id]: {
                                    ...draft,
                                    status: event.target.value as AssetRow["status"],
                                  },
                                }))
                              }
                            >
                              <option value="ACTIVE">{tScm("k_c72633f673ef")}</option>
                              <option value="RETIRED">{tScm("k_bda5ec3f892a")}</option>
                              <option value="LOST">{tScm("k_29494e88e9c9")}</option>
                              <option value="DISPOSED">{tScm("k_3c1b36d2e8ad")}</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              getStatusColor(asset.status)
                            )}>
                              {asset.status}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {canManage ? (
                            <Input
                              value={draft.assignedTo}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [asset.id]: {
                                    ...draft,
                                    assignedTo: event.target.value,
                                  },
                                }))
                              }
                              placeholder={tScm("k_26d7853753cf")}
                              className="text-sm"
                            />
                          ) : (
                            <span className="text-sm text-foreground">
                              {asset.assignedTo || "N/A"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {canManage ? (
                            <Input
                              value={draft.note}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [asset.id]: {
                                    ...draft,
                                    note: event.target.value,
                                  },
                                }))
                              }
                              placeholder={tScm("k_90a55f1708fd")}
                              className="text-sm"
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {asset.note || "N/A"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="space-y-2">
                            <Button size="sm" variant="outline" asChild className="w-full">
                              <Link href={`/admin/scm/assets/${asset.id}`}>
                                <FileText className="h-3 w-3 mr-1" />
                                {tScm("k_7c9a7c0610c1")}
                              </Link>
                            </Button>
                            {canManage && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void saveAsset(asset)}
                                disabled={savingId === asset.id}
                                className="w-full"
                              >
                                <Save className="mr-1 h-3 w-3" />
                                {savingId === asset.id ? "Saving..." : "Save"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Card View */}
          {!loading && paginatedAssets.length > 0 && (
            <div className="space-y-3 lg:hidden">
              {paginatedAssets.map((asset) => {
                const draft = drafts[asset.id] || {
                  status: asset.status,
                  assignedTo: asset.assignedTo || "",
                  note: asset.note || "",
                };

                return (
                  <Card key={asset.id} className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      {/* Asset Header */}
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {asset.assetTag}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {asset.productVariant.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {asset.productVariant.sku}
                            </p>
                          </div>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            getStatusColor(asset.status)
                          )}>
                            {asset.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tScm("k_fd67e8f5cbd2")} {formatDateTime(asset.acquiredAt)}
                        </p>
                      </div>

                      {/* Warehouse */}
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">{asset.warehouse.name}</span>
                        <span className="text-xs text-muted-foreground">({asset.warehouse.code})</span>
                      </div>

                      {/* Source Documents */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{tScm("k_b6b578fd7055")}</span>
                          <span className="text-foreground">
                            {asset.materialRequest?.requestNumber || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{tScm("k_a86c7356b090")}</span>
                          <span className="text-foreground">
                            {asset.materialReleaseNote?.releaseNumber || "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Editable Fields */}
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        {canManage ? (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">{tScm("k_bae7d5be7082")}</Label>
                              <select
                                className={cn(
                                  "w-full rounded-md border px-2 py-1.5 text-sm mt-1",
                                  getStatusColor(draft.status)
                                )}
                                value={draft.status}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [asset.id]: {
                                      ...draft,
                                      status: event.target.value as AssetRow["status"],
                                    },
                                  }))
                                }
                              >
                                <option value="ACTIVE">{tScm("k_c72633f673ef")}</option>
                                <option value="RETIRED">{tScm("k_bda5ec3f892a")}</option>
                                <option value="LOST">{tScm("k_29494e88e9c9")}</option>
                                <option value="DISPOSED">{tScm("k_3c1b36d2e8ad")}</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{tScm("k_d00c2e68c310")}</Label>
                              <Input
                                value={draft.assignedTo}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [asset.id]: {
                                      ...draft,
                                      assignedTo: event.target.value,
                                    },
                                  }))
                                }
                                placeholder={tScm("k_26d7853753cf")}
                                className="text-sm mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{tScm("k_2c924e308820")}</Label>
                              <Input
                                value={draft.note}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [asset.id]: {
                                      ...draft,
                                      note: event.target.value,
                                    },
                                  }))
                                }
                                placeholder={tScm("k_90a55f1708fd")}
                                className="text-sm mt-1"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">{tScm("k_d00c2e68c310")}</Label>
                              <p className="text-sm text-foreground mt-1">
                                {asset.assignedTo || "N/A"}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">{tScm("k_2c924e308820")}</Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {asset.note || "N/A"}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <Link href={`/admin/scm/assets/${asset.id}`}>
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {tScm("k_4274b1af463a")}
                          </Link>
                        </Button>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void saveAsset(asset)}
                            disabled={savingId === asset.id}
                            className="flex-1"
                          >
                            <Save className="mr-1 h-3.5 w-3.5" />
                            {savingId === asset.id ? "Saving..." : "Save"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && paginatedAssets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">{tScm("k_065e17b72bdd")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tScm("k_56fb07fd6653")}
              </p>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
