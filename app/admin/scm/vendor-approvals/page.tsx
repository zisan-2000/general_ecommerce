"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { 
  Badge, 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Building2,
  Mail,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

type RequestRow = {
  id: number;
  requestType: "PROFILE_UPDATE" | "DOCUMENT_UPDATE" | "ANNUAL_RENEWAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: unknown;
  note: string | null;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: { id: number; code: string; name: string; email: string | null };
  requestedBy: { id: string; name: string | null; email: string | null };
  reviewedBy: { id: string; name: string | null; email: string | null } | null;
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

function getRequestTypeColor(type: string) {
  switch (type) {
    case "PROFILE_UPDATE":
      return "bg-info/10 text-info border-info/20";
    case "DOCUMENT_UPDATE":
      return "bg-warning/10 text-warning border-warning/20";
    case "ANNUAL_RENEWAL":
      return "bg-primary/10 text-primary border-primary/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-warning/10 text-warning border-warning/20";
    case "APPROVED":
      return "bg-success/10 text-success border-success/20";
    case "REJECTED":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "PENDING":
      return Clock;
    case "APPROVED":
      return CheckCircle;
    case "REJECTED":
      return XCircle;
    default:
      return AlertCircle;
  }
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange, previousLabel, nextLabel }: {
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
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
        aria-label={previousLabel}
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
        aria-label={nextLabel}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function VendorApprovalsPage() {
  const t = useTranslations("AdminVendorApprovals");
  const locale = useLocale();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedPayload, setExpandedPayload] = useState<number | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const response = await fetch(
        `/api/scm/supplier-profile-requests${params.size > 0 ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.load"));
      }
      setRows(Array.isArray(payload) ? (payload as RequestRow[]) : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [search, status]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  // Pagination calculations
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return rows.slice(start, end);
  }, [rows, currentPage]);

  const totalPages = Math.ceil(rows.length / itemsPerPage);

  const review = async (id: number, decision: "APPROVE" | "REJECT") => {
    try {
      setSavingId(id);
      const response = await fetch("/api/scm/supplier-profile-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          decision,
          reviewNote: reviewNotes[id] || "",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.review"));
      }
      toast.success(decision === "APPROVE" ? t("success.approved") : t("success.rejected"));
      await load();
      // Clear review note after successful review
      setReviewNotes((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (error: any) {
      toast.error(error?.message || t("errors.review"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
          {t("header.title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          {t("header.description")}
        </p>
      </div>

      {/* Filters Card */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{t("queue.title")}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading} size="sm">
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
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
          {/* Desktop Filters */}
          <div className="hidden sm:grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t("filters.search")}</Label>
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">{t("common.status")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{t("filters.allStatuses")}</option>
                <option value="PENDING">{t("statuses.PENDING")}</option>
                <option value="APPROVED">{t("statuses.APPROVED")}</option>
                <option value="REJECTED">{t("statuses.REJECTED")}</option>
              </select>
            </div>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <div className="space-y-3 sm:hidden">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("filters.search")}</Label>
                <Input
                  placeholder={t("filters.mobileSearchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("common.status")}</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">{t("filters.allStatuses")}</option>
                  <option value="PENDING">{t("statuses.PENDING")}</option>
                  <option value="APPROVED">{t("statuses.APPROVED")}</option>
                  <option value="REJECTED">{t("statuses.REJECTED")}</option>
                </select>
              </div>
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
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.request")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.supplier")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.type")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.status")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.requestedBy")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.date")}</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => {
                    const StatusIcon = getStatusIcon(row.status);
                    return (
                      <tr key={row.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-medium text-sm text-foreground">#{row.id}</div>
                          {row.note && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {t("common.noteValue", { note: row.note })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-sm font-medium text-foreground">{row.supplier.name}</div>
                          <div className="text-xs text-muted-foreground">{t("common.codeValue", { code: row.supplier.code })}</div>
                         </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={cn("text-xs", getRequestTypeColor(row.requestType))}>
                            {t(`requestTypes.${row.requestType}`)}
                          </Badge>
                         </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={cn("text-xs", getStatusColor(row.status))}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t(`statuses.${row.status}`)}
                          </Badge>
                         </td>
                        <td className="py-3 px-2">
                          <div className="text-sm text-foreground">
                            {row.requestedBy.name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.requestedBy.email || t("common.noEmail")}
                          </div>
                         </td>
                        <td className="py-3 px-2">
                          <div className="text-sm text-foreground">
                            {fmtDate(row.requestedAt, locale)}
                          </div>
                         </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedPayload(expandedPayload === row.id ? null : row.id)}
                            className="h-8 px-3 text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {t("actions.view")}
                          </Button>
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Card View */}
          {!loading && paginatedRows.length > 0 && (
            <div className="space-y-3 lg:hidden">
              {paginatedRows.map((row) => {
                const StatusIcon = getStatusIcon(row.status);
                const isExpanded = expandedPayload === row.id;
                
                return (
                  <Card key={row.id} className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("queue.requestNumber", { id: row.id })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(row.requestedAt, locale)}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("text-xs shrink-0 ml-2", getStatusColor(row.status))}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {t(`statuses.${row.status}`)}
                        </Badge>
                      </div>

                      {/* Supplier Info */}
                      <div className="flex items-start gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{row.supplier.name}</p>
                          <p className="text-xs text-muted-foreground">{t("common.codeValue", { code: row.supplier.code })}</p>
                        </div>
                      </div>

                      {/* Request Type */}
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge variant="outline" className={cn("text-xs", getRequestTypeColor(row.requestType))}>
                          {t(`requestTypes.${row.requestType}`)}
                        </Badge>
                      </div>

                      {/* Requested By */}
                      <div className="flex items-start gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {row.requestedBy.name || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            {row.requestedBy.email || t("common.noEmail")}
                          </p>
                        </div>
                      </div>

                      {/* Note */}
                      {row.note && (
                        <div className="rounded-md bg-muted/30 p-2">
                          <p className="text-xs text-muted-foreground">
                            {t("common.noteValue", { note: row.note })}
                          </p>
                        </div>
                      )}

                      {/* Payload Toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPayload(isExpanded ? null : row.id)}
                        className="w-full justify-between text-xs"
                      >
                        <span>{isExpanded ? t("actions.hidePayload") : t("actions.viewPayload")}</span>
                        <Eye className="h-3 w-3" />
                      </Button>

                      {isExpanded && (
                        <details open className="rounded-md border border-border bg-muted/30 p-3">
                          <summary className="cursor-pointer text-xs font-medium mb-2">
                            {t("queue.payloadSnapshot")}
                          </summary>
                          <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                            {JSON.stringify(row.payload, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Review Section for Pending */}
                      {row.status === "PENDING" ? (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <Textarea
                            placeholder={t("queue.reviewNotePlaceholder")}
                            value={reviewNotes[row.id] || ""}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [row.id]: event.target.value,
                              }))
                            }
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => void review(row.id, "APPROVE")}
                              disabled={savingId === row.id}
                              className="flex-1"
                              size="sm"
                            >
                              {savingId === row.id ? t("actions.processing") : t("actions.approve")}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void review(row.id, "REJECT")}
                              disabled={savingId === row.id}
                              className="flex-1"
                              size="sm"
                            >
                              {t("actions.reject")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-border/50">
                          <div className="flex items-start gap-2 text-xs">
                            <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="text-muted-foreground">
                              {t("queue.reviewedBy", { date: fmtDate(row.reviewedAt, locale), reviewer: row.reviewedBy?.email || "—" })}
                              {row.reviewNote && (
                                <p className="mt-1">{t("common.noteValue", { note: row.reviewNote })}</p>
                              )}
                            </div>
                          </div>
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
              <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || status ? t("emptyFiltered") : t("emptyDefault")}
              </p>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              previousLabel={t("pagination.previous")}
              nextLabel={t("pagination.next")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
