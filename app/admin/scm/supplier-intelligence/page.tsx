"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw, ChevronLeft, ChevronRight, Filter, Building2, Clock, AlertTriangle, CheckCircle, Package, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SupplierIntelligenceRow = {
  supplier: {
    id: number;
    code: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    configuredLeadTimeDays: number | null;
    paymentTermsDays: number | null;
  };
  metrics: {
    trackedPoCount: number;
    completedPoCount: number;
    activePoCount: number;
    openLatePoCount: number;
    partialReceiptPoCount: number;
    onTimeRatePercent: number | null;
    averageFirstReceiptLeadTimeDays: number | null;
    averageFinalReceiptLeadTimeDays: number | null;
    recommendedLeadTimeDays: number | null;
    recommendedBufferDays: number | null;
    averageDelayDays: number | null;
    averageFillRatePercent: number | null;
    partialReceiptRatePercent: number | null;
    performanceBand: "STABLE" | "WATCH" | "AT_RISK" | "INSUFFICIENT_DATA";
    latestReceiptAt: string | null;
  };
  recentOrders: Array<{
    id: number;
    poNumber: string;
    warehouse: { id: number; name: string; code: string };
    status: string;
    orderDate: string;
    anchorDate: string;
    expectedAt: string | null;
    benchmarkDueAt: string | null;
    firstReceiptAt: string | null;
    finalReceiptAt: string | null;
    configuredLeadTimeDays: number | null;
    benchmarkLeadTimeDays: number | null;
    firstReceiptLeadTimeDays: number | null;
    finalReceiptLeadTimeDays: number | null;
    delayDays: number;
    fillRatePercent: number;
    isCompleted: boolean;
    isPartiallyReceived: boolean;
    isOnTime: boolean | null;
    isLateOpen: boolean;
  }>;
};

type SupplierIntelligenceResponse = {
  generatedAt: string;
  windowDays: number;
  overview: {
    supplierCount: number;
    trackedPoCount: number;
    completedPoCount: number;
    openLatePoCount: number;
    averageObservedLeadTimeDays: number | null;
    averageRecommendedLeadTimeDays: number | null;
    averageOnTimeRatePercent: number | null;
    atRiskSupplierCount: number;
    stableSupplierCount: number;
  };
  rows: SupplierIntelligenceRow[];
};

async function readJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale);
}

function formatNumber(value: number | null, suffix = "") {
  if (value === null || Number.isNaN(value)) return "-";
  return `${value}${suffix}`;
}

function getBandVariant(band: SupplierIntelligenceRow["metrics"]["performanceBand"]) {
  switch (band) {
    case "STABLE":
      return "bg-success/10 text-success border-success/20";
    case "WATCH":
      return "bg-warning/10 text-warning border-warning/20";
    case "AT_RISK":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getBandIcon(band: SupplierIntelligenceRow["metrics"]["performanceBand"]) {
  switch (band) {
    case "STABLE":
      return CheckCircle;
    case "WATCH":
      return AlertTriangle;
    case "AT_RISK":
      return TrendingDown;
    default:
      return Package;
  }
}

function getPerformanceColor(value: number | null, isInverse = false) {
  if (value === null) return "text-muted-foreground";
  if (isInverse) {
    if (value <= 5) return "text-success";
    if (value <= 10) return "text-warning";
    return "text-destructive";
  } else {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-destructive";
  }
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange }: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("AdminSupplierIntelligence");
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
        aria-label={t("pagination.previous")}
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
        aria-label={t("pagination.next")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function SupplierIntelligencePage() {
  const t = useTranslations("AdminSupplierIntelligence");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const globalPermissions = Array.isArray(
    (session?.user as any)?.globalPermissions,
  )
    ? ((session?.user as any).globalPermissions as string[])
    : [];
  const canRead = globalPermissions.includes("supplier_performance.read");

  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState("365");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [bandFilter, setBandFilter] = useState("ALL");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dataset, setDataset] = useState<SupplierIntelligenceResponse>({
    generatedAt: "",
    windowDays: 365,
    overview: {
      supplierCount: 0,
      trackedPoCount: 0,
      completedPoCount: 0,
      openLatePoCount: 0,
      averageObservedLeadTimeDays: null,
      averageRecommendedLeadTimeDays: null,
      averageOnTimeRatePercent: null,
      atRiskSupplierCount: 0,
      stableSupplierCount: 0,
    },
    rows: [],
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/scm/supplier-intelligence?windowDays=${encodeURIComponent(windowDays)}`,
        { cache: "no-store" },
      );
      const data = await readJson<SupplierIntelligenceResponse>(
        response,
        t("errors.load"),
      );
      setDataset(data);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
      setDataset((current) => ({ ...current, rows: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
  }, [canRead, windowDays]);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [bandFilter, search]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dataset.rows.filter((row) => {
      if (bandFilter !== "ALL" && row.metrics.performanceBand !== bandFilter) {
        return false;
      }
      if (!query) return true;
      return (
        row.supplier.name.toLowerCase().includes(query) ||
        row.supplier.code.toLowerCase().includes(query) ||
        (row.supplier.email || "").toLowerCase().includes(query)
      );
    });
  }, [bandFilter, dataset.rows, search]);

  // Pagination calculations
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return visibleRows.slice(start, end);
  }, [visibleRows, currentPage]);

  const totalPages = Math.ceil(visibleRows.length / itemsPerPage);

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedSupplierId(null);
      return;
    }
    if (!visibleRows.some((row) => row.supplier.id === selectedSupplierId)) {
      setSelectedSupplierId(visibleRows[0]?.supplier.id ?? null);
    }
  }, [selectedSupplierId, visibleRows]);

  const selectedSupplier =
    visibleRows.find((row) => row.supplier.id === selectedSupplierId) ??
    visibleRows[0] ??
    null;

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("access.denied")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            {t("header.title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {t("header.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={windowDays}
            onChange={(event) => setWindowDays(event.target.value)}
          >
            <option value="90">{t("windows.days90")}</option>
            <option value="180">{t("windows.days180")}</option>
            <option value="365">{t("windows.days365")}</option>
            <option value="730">{t("windows.days730")}</option>
          </select>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {t("actions.refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <Filter className="h-4 w-4" />
            <span className="sr-only">{t("filters.toggle")}</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="shadow-sm">
          <CardHeader className="p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">{t("overview.suppliersTracked")}</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{dataset.overview.supplierCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">{t("overview.trackedPos")}</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{dataset.overview.trackedPoCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">{t("overview.observedLeadTime")}</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">
              {formatNumber(dataset.overview.averageObservedLeadTimeDays, "d")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">{t("overview.averageOnTime")}</CardDescription>
            <CardTitle className={cn("text-xl sm:text-2xl", getPerformanceColor(dataset.overview.averageOnTimeRatePercent))}>
              {formatNumber(dataset.overview.averageOnTimeRatePercent, "%")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm col-span-2 sm:col-span-1">
          <CardHeader className="p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">{t("overview.openLatePos")}</CardDescription>
            <CardTitle className="text-xl sm:text-2xl text-destructive">
              {dataset.overview.openLatePoCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Supplier Scorecard */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{t("scorecard.title")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t("scorecard.description")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden"
            >
              <Filter className="h-4 w-4 mr-2" />
              {t("filters.label")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {/* Desktop Filters */}
          <div className="hidden sm:flex gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className="max-w-md text-sm"
            />
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={bandFilter}
              onChange={(event) => setBandFilter(event.target.value)}
            >
              <option value="ALL">{t("filters.allBands")}</option>
              <option value="STABLE">{t("bands.STABLE")}</option>
              <option value="WATCH">{t("bands.WATCH")}</option>
              <option value="AT_RISK">{t("bands.AT_RISK")}</option>
              <option value="INSUFFICIENT_DATA">{t("bands.INSUFFICIENT_DATA")}</option>
            </select>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <div className="space-y-3 sm:hidden">
              <Input
                placeholder={t("filters.mobileSearchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="text-sm"
              />
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={bandFilter}
                onChange={(event) => setBandFilter(event.target.value)}
              >
                <option value="ALL">{t("filters.allBands")}</option>
                <option value="STABLE">{t("bands.STABLE")}</option>
                <option value="WATCH">{t("bands.WATCH")}</option>
                <option value="AT_RISK">{t("bands.AT_RISK")}</option>
                <option value="INSUFFICIENT_DATA">{t("bands.INSUFFICIENT_DATA")}</option>
              </select>
              <Button variant="outline" onClick={() => setShowFilters(false)} className="w-full">
                {t("filters.close")}
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
          {!loading && paginatedRows.length > 0 && (
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("common.supplier")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("common.configLt")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("common.observedLt")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("common.recommendedLt")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("common.onTime")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("common.openLate")}</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">{t("common.partialRate")}</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("common.band")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row) => {
                    const isSelected = row.supplier.id === selectedSupplier?.supplier.id;
                    const BandIcon = getBandIcon(row.metrics.performanceBand);
                    return (
                      <TableRow
                        key={row.supplier.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/40",
                          isSelected && "bg-primary/5"
                        )}
                        onClick={() => setSelectedSupplierId(row.supplier.id)}
                      >
                        <TableCell className="py-3">
                          <div className="font-medium text-sm text-foreground">{row.supplier.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {row.supplier.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3 text-sm text-foreground">
                          {formatNumber(row.supplier.configuredLeadTimeDays, "d")}
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className={cn("text-sm font-medium", getPerformanceColor(row.metrics.averageFinalReceiptLeadTimeDays, true))}>
                            {formatNumber(row.metrics.averageFinalReceiptLeadTimeDays, "d")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className="text-sm font-medium text-primary">
                            {formatNumber(row.metrics.recommendedLeadTimeDays, "d")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className={cn("text-sm font-medium", getPerformanceColor(row.metrics.onTimeRatePercent))}>
                            {formatNumber(row.metrics.onTimeRatePercent, "%")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className={cn("text-sm font-medium", row.metrics.openLatePoCount > 0 ? "text-destructive" : "text-success")}>
                            {row.metrics.openLatePoCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3 text-sm text-muted-foreground">
                          {formatNumber(row.metrics.partialReceiptRatePercent, "%")}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className={cn("text-xs", getBandVariant(row.metrics.performanceBand))}>
                            <BandIcon className="h-3 w-3 mr-1" />
                            {t(`bands.${row.metrics.performanceBand}`)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Card View */}
          {!loading && paginatedRows.length > 0 && (
            <div className="space-y-3 lg:hidden">
              {paginatedRows.map((row) => {
                const BandIcon = getBandIcon(row.metrics.performanceBand);
                const isSelected = row.supplier.id === selectedSupplier?.supplier.id;
                return (
                  <Card
                    key={row.supplier.id}
                    className={cn(
                      "border-border cursor-pointer transition-all hover:shadow-md",
                      isSelected && "border-primary/50 bg-primary/5"
                    )}
                    onClick={() => setSelectedSupplierId(row.supplier.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{row.supplier.name}</p>
                          <p className="text-xs text-muted-foreground">{t("common.codeValue", { code: row.supplier.code })}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-xs", getBandVariant(row.metrics.performanceBand))}>
                          <BandIcon className="h-3 w-3 mr-1" />
                          {t(`bands.${row.metrics.performanceBand}`)}
                        </Badge>
                      </div>

                      {/* Lead Times */}
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("common.configLt")}</p>
                          <p className="text-sm font-medium text-foreground">
                            {formatNumber(row.supplier.configuredLeadTimeDays, "d")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("common.observedLt")}</p>
                          <p className={cn("text-sm font-medium", getPerformanceColor(row.metrics.averageFinalReceiptLeadTimeDays, true))}>
                            {formatNumber(row.metrics.averageFinalReceiptLeadTimeDays, "d")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("common.recommendedLt")}</p>
                          <p className="text-sm font-medium text-primary">
                            {formatNumber(row.metrics.recommendedLeadTimeDays, "d")}
                          </p>
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("common.onTime")}</p>
                          <p className={cn("text-sm font-medium", getPerformanceColor(row.metrics.onTimeRatePercent))}>
                            {formatNumber(row.metrics.onTimeRatePercent, "%")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("common.openLate")}</p>
                          <p className={cn("text-sm font-medium", row.metrics.openLatePoCount > 0 ? "text-destructive" : "text-success")}>
                            {row.metrics.openLatePoCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("common.partialRate")}</p>
                          <p className="text-sm font-medium text-muted-foreground">
                            {formatNumber(row.metrics.partialReceiptRatePercent, "%")}
                          </p>
                        </div>
                      </div>

                      {/* Contact Info */}
                      {row.supplier.contactName && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <Building2 className="h-3 w-3" />
                          <span>{row.supplier.contactName}</span>
                          {row.supplier.email && <span>• {row.supplier.email}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && paginatedRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("emptyHint")}
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

      {/* Supplier Detail Section */}
      {selectedSupplier && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">{selectedSupplier.supplier.name}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t("detail.summary", { configured: formatNumber(selectedSupplier.supplier.configuredLeadTimeDays, t("common.daysSuffix")), recommended: formatNumber(selectedSupplier.metrics.recommendedLeadTimeDays, t("common.daysSuffix")), receipt: formatDate(selectedSupplier.metrics.latestReceiptAt, locale) })}
                </CardDescription>
              </div>
              <Badge variant="outline" className={cn("text-xs self-start", getBandVariant(selectedSupplier.metrics.performanceBand))}>
                {t(`bands.${selectedSupplier.metrics.performanceBand}`)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            {/* Metrics Cards */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("detail.completedPos")}</div>
                <div className="text-lg sm:text-xl font-semibold text-foreground">
                  {selectedSupplier.metrics.completedPoCount}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("detail.averageFirstReceipt")}</div>
                <div className="text-lg sm:text-xl font-semibold text-foreground">
                  {formatNumber(selectedSupplier.metrics.averageFirstReceiptLeadTimeDays, "d")}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("detail.averageFinalReceipt")}</div>
                <div className={cn("text-lg sm:text-xl font-semibold", getPerformanceColor(selectedSupplier.metrics.averageFinalReceiptLeadTimeDays, true))}>
                  {formatNumber(selectedSupplier.metrics.averageFinalReceiptLeadTimeDays, "d")}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("detail.averageDelay")}</div>
                <div className={cn("text-lg sm:text-xl font-semibold", getPerformanceColor(selectedSupplier.metrics.averageDelayDays, true))}>
                  {formatNumber(selectedSupplier.metrics.averageDelayDays, "d")}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("detail.fillRate")}</div>
                <div className={cn("text-lg sm:text-xl font-semibold", getPerformanceColor(selectedSupplier.metrics.averageFillRatePercent))}>
                  {formatNumber(selectedSupplier.metrics.averageFillRatePercent, "%")}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">{t("detail.suggestedBuffer")}</div>
                <div className="text-lg sm:text-xl font-semibold text-primary">
                  {formatNumber(selectedSupplier.metrics.recommendedBufferDays, "d")}
                </div>
              </div>
            </div>

            {/* Recent Orders Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("orders.title")}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("orders.po")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("orders.warehouse")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("orders.status")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("orders.due")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("orders.leadTime")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("orders.delay")}</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground">{t("detail.fillRate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSupplier.recentOrders.slice(0, 5).map((order) => (
                      <TableRow key={order.id} className="border-border">
                        <TableCell className="py-3">
                          <div className="text-sm font-medium text-foreground">{order.poNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(order.orderDate, locale)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm text-foreground">{order.warehouse.name}</div>
                          <div className="text-xs text-muted-foreground">{order.warehouse.code}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm text-foreground">{t.has(`orderStatuses.${order.status}` as any) ? t(`orderStatuses.${order.status}` as any) : order.status}</div>
                          {order.isLateOpen && (
                            <div className="text-xs text-destructive">{t("orders.openLate")}</div>
                          )}
                          {order.isOnTime === false && (
                            <div className="text-xs text-destructive">{t("orders.delayed")}</div>
                          )}
                          {order.isOnTime === true && (
                            <div className="text-xs text-success">{t("orders.onTime")}</div>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground">
                          {formatDate(order.benchmarkDueAt, locale)}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={cn("text-sm", getPerformanceColor(order.finalReceiptLeadTimeDays, true))}>
                            {formatNumber(order.finalReceiptLeadTimeDays, "d")}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={cn("text-sm", order.delayDays > 0 ? "text-destructive" : "text-success")}>
                            {formatNumber(order.delayDays, "d")}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={cn("text-sm", getPerformanceColor(order.fillRatePercent))}>
                            {formatNumber(order.fillRatePercent, "%")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {selectedSupplier.recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("orders.empty")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
