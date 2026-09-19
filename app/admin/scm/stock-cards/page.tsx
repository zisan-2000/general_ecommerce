"use client";

import { useTranslations } from "next-intl";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshCw, Package, Warehouse, Calendar, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Pagination from "@/components/admin/scm/Pagination";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type StockCardSummary = {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  variantId: number;
  sku: string;
  productName: string;
  inventoryItemClass: "CONSUMABLE" | "PERMANENT";
  requiresAssetTag: boolean;
  quantity: number;
  reserved: number;
  available: number;
  lastMovementAt: string | null;
};

type StockCardMovement = {
  id: number;
  createdAt: string;
  change: number;
  reason: string;
};

type StockCardDetail = {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  variantId: number;
  sku: string;
  productName: string;
  inventoryItemClass: "CONSUMABLE" | "PERMANENT";
  requiresAssetTag: boolean;
  quantity: number;
  reserved: number;
  available: number;
  openingBalance: number;
  movementDelta: number;
  closingBalance: number;
  movements: StockCardMovement[];
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

function getStockStatusColor(available: number, quantity: number) {
  const ratio = quantity > 0 ? available / quantity : 0;
  if (ratio === 0) return "text-destructive";
  if (ratio < 0.3) return "text-warning";
  return "text-success";
}

export default function StockCardsPage() {
  const tScm = useTranslations("ScmAuto");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    [
      "inventory.manage",
      "material_releases.read",
      "material_releases.manage",
      "material_requests.approve_admin",
    ].includes(permission),
  );

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouseId") || "");
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [summaries, setSummaries] = useState<StockCardSummary[]>([]);
  const [selected, setSelected] = useState<{ warehouseId: number; variantId: number } | null>(null);
  const [detail, setDetail] = useState<StockCardDetail | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [warehouseData, stockData] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }).then((res) =>
          readJson<Warehouse[]>(res, "Failed to load warehouses"),
        ),
        fetch(
          `/api/scm/stock-cards?search=${encodeURIComponent(search)}${
            warehouseId ? `&warehouseId=${encodeURIComponent(warehouseId)}` : ""
          }`,
          { cache: "no-store" },
        ).then((res) =>
          readJson<{ summaries: StockCardSummary[]; detail: StockCardDetail | null }>(
            res,
            "Failed to load stock cards",
          ),
        ),
      ]);

      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      const nextSummaries = Array.isArray(stockData.summaries) ? stockData.summaries : [];
      setSummaries(nextSummaries);

      if (selected) {
        const stillExists = nextSummaries.some(
          (item) => item.warehouseId === selected.warehouseId && item.variantId === selected.variantId,
        );
        if (!stillExists) {
          setSelected(null);
          setDetail(null);
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load stock cards");
      setSummaries([]);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (target: { warehouseId: number; variantId: number }) => {
    setDetailLoading(true);
    try {
      const response = await fetch(
        `/api/scm/stock-cards?warehouseId=${target.warehouseId}&variantId=${target.variantId}${
          from ? `&from=${encodeURIComponent(from)}` : ""
        }${to ? `&to=${encodeURIComponent(to)}` : ""}`,
        { cache: "no-store" },
      );

      const payload = await readJson<{ summaries: StockCardSummary[]; detail: StockCardDetail | null }>(
        response,
        "Failed to load stock card detail",
      );
      setDetail(payload.detail || null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load stock card detail");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadSummary();
    }
  }, [canRead]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setWarehouseId(searchParams.get("warehouseId") || "");
    setFrom(searchParams.get("from") || "");
    setTo(searchParams.get("to") || "");
  }, [searchParams]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, warehouseId]);

  useEffect(() => {
    if (!canRead) return;
    const variantId = Number(searchParams.get("variantId") || 0);
    const queryWarehouseId = Number(searchParams.get("warehouseId") || 0);
    if (!variantId || !queryWarehouseId) return;
    const target = { warehouseId: queryWarehouseId, variantId };
    setSelected(target);
    void loadDetail(target);
  }, [canRead, searchParams]);

  const selectedLabel = useMemo(() => {
    if (!detail) return "";
    return `${detail.productName} (${detail.sku}) @ ${detail.warehouseName}`;
  }, [detail]);

  // Pagination logic for summaries
  const paginatedSummaries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return summaries.slice(startIndex, endIndex);
  }, [summaries, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(summaries.length / itemsPerPage);
  }, [summaries]);

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tScm("k_3dab5f6012e3")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {tScm("k_1c5583477172")}
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
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{tScm("k_9db89ea0e549")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          {tScm("k_7ece26376d9f")}
        </p>
      </div>

      {/* Stock Position Card */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{tScm("k_8445b87ab2c6")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {tScm("k_4db1c137ad7e")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          {/* Filters */}
          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[1.5fr_1fr_auto] sm:gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tScm("k_17ff267ad3e4")}
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
            <Button variant="outline" onClick={() => void loadSummary()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              {tScm("k_56e3badc4e6c")}
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Desktop Table View */}
          {!loading && summaries.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_ecdda59aea5e")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_298dff72dae2")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_41ff354b2b33")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_41733d8e5596")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_67a6ff10f1b9")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_7c62a1424469")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_3461e78baba4")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSummaries.map((item) => {
                    const active =
                      selected?.warehouseId === item.warehouseId &&
                      selected?.variantId === item.variantId;
                    return (
                      <TableRow
                        key={`${item.warehouseId}-${item.variantId}`}
                        className={cn(
                          "border-border cursor-pointer transition-colors hover:bg-muted/40",
                          active && "bg-primary/5 hover:bg-primary/10"
                        )}
                        onClick={() => {
                          const target = { warehouseId: item.warehouseId, variantId: item.variantId };
                          setSelected(target);
                          void loadDetail(target);
                        }}
                      >
                        <TableCell className="py-3">
                          <div className="font-medium text-sm text-foreground">{item.productName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.sku}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm text-foreground">{item.warehouseName}</div>
                          <div className="text-xs text-muted-foreground">{item.warehouseCode}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground">
                            {item.inventoryItemClass}
                          </span>
                          {item.requiresAssetTag && (
                            <span className="inline-flex items-center ml-1 rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                              {tScm("k_41ea8208e1f9")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-3 font-medium text-foreground">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right py-3 text-muted-foreground">
                          {item.reserved}
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className={cn("font-medium", getStockStatusColor(item.available, item.quantity))}>
                            {item.available}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          {formatDateTime(item.lastMovementAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Card View */}
          {!loading && paginatedSummaries.length > 0 && (
            <div className="space-y-3 md:hidden">
              {paginatedSummaries.map((item) => {
                const active =
                  selected?.warehouseId === item.warehouseId &&
                  selected?.variantId === item.variantId;
                return (
                  <Card
                    key={`${item.warehouseId}-${item.variantId}`}
                    className={cn(
                      "border-border cursor-pointer transition-all hover:shadow-md",
                      active && "border-primary/50 bg-primary/5"
                    )}
                    onClick={() => {
                      const target = { warehouseId: item.warehouseId, variantId: item.variantId };
                      setSelected(target);
                      void loadDetail(target);
                    }}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{item.productName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.sku}</p>
                        </div>
                        <div className="flex gap-1">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground">
                            {item.inventoryItemClass}
                          </span>
                          {item.requiresAssetTag && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                              {tScm("k_41ea8208e1f9")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Warehouse */}
                      <div className="flex items-center gap-2 text-sm">
                        <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">{item.warehouseName}</span>
                        <span className="text-xs text-muted-foreground">({item.warehouseCode})</span>
                      </div>

                      {/* Stock Numbers */}
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/50">
                        <div>
                          <p className="text-xs text-muted-foreground">{tScm("k_41733d8e5596")}</p>
                          <p className="text-lg font-semibold text-foreground">{item.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{tScm("k_67a6ff10f1b9")}</p>
                          <p className="text-lg font-semibold text-muted-foreground">{item.reserved}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{tScm("k_7c62a1424469")}</p>
                          <p className={cn("text-lg font-semibold", getStockStatusColor(item.available, item.quantity))}>
                            {item.available}
                          </p>
                        </div>
                      </div>

                      {/* Last Movement */}
                      {item.lastMovementAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{tScm("k_9b08e4dbe735")} {formatDateTime(item.lastMovementAt)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && paginatedSummaries.length === 0 && summaries.length > 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">{tScm("k_33b2990e4948")}</p>
            </div>
          )}

          {/* Pagination */}
          {!loading && summaries.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Stock Card Detail Section */}
      {selected && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tScm("k_dd00376ce90f")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm break-words">
              {selectedLabel || "Selected item"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            {/* Date Range Filters */}
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_6b7587a9cdd9")}</Label>
                <Input 
                  type="datetime-local" 
                  value={from} 
                  onChange={(event) => setFrom(event.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_642cced347da")}</Label>
                <Input 
                  type="datetime-local" 
                  value={to} 
                  onChange={(event) => setTo(event.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => selected && void loadDetail(selected)}
                  disabled={detailLoading}
                  className="w-full sm:w-auto"
                >
                  {detailLoading ? "Loading..." : "Apply Range"}
                </Button>
              </div>
            </div>

            {/* Detail Loading State */}
            {detailLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {/* Detail Content */}
            {!detailLoading && detail && (
              <>
                {/* Summary Cards - Responsive Grid */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  <Card className="border-border/50 bg-muted/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="text-xs text-muted-foreground">{tScm("k_56e44065a564")}</div>
                      <div className="text-lg sm:text-xl font-semibold text-foreground">
                        {detail.openingBalance}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-muted/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="text-xs text-muted-foreground">{tScm("k_dc812752b758")}</div>
                      <div className={cn(
                        "text-lg sm:text-xl font-semibold flex items-center gap-1",
                        detail.movementDelta >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {detail.movementDelta >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {detail.movementDelta}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-muted/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="text-xs text-muted-foreground">{tScm("k_76a032e9c77c")}</div>
                      <div className="text-lg sm:text-xl font-semibold text-foreground">
                        {detail.closingBalance}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-muted/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="text-xs text-muted-foreground">{tScm("k_41733d8e5596")}</div>
                      <div className="text-lg sm:text-xl font-semibold text-foreground">
                        {detail.quantity}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50 bg-muted/20">
                    <CardContent className="p-3 sm:p-4">
                      <div className="text-xs text-muted-foreground">{tScm("k_7c62a1424469")}</div>
                      <div className={cn("text-lg sm:text-xl font-semibold", getStockStatusColor(detail.available, detail.quantity))}>
                        {detail.available}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Movements Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_6c82e6dd8680")}</TableHead>
                        <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_64fbd995d3b6")}</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_f219cc0614ae")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.movements.map((movement) => (
                        <TableRow key={movement.id} className="border-border">
                          <TableCell className="py-3 text-xs sm:text-sm text-muted-foreground">
                            {formatDateTime(movement.createdAt)}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <span className={cn(
                              "font-medium",
                              movement.change >= 0 ? "text-success" : "text-destructive"
                            )}>
                              {movement.change >= 0 ? `+${movement.change}` : movement.change}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-foreground">
                            {movement.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                      {detail.movements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Info className="h-8 w-8 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground">
                                {tScm("k_414122f5b44e")}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* No Detail State */}
            {!detailLoading && !detail && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {tScm("k_fcc7b604ddb5")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
