"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, RefreshCw, ChevronLeft, ChevronRight, Filter, Eye, CheckCircle, XCircle, Users, Package, Building2, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Warehouse = { id: number; name: string; code: string };
type Variant = { id: number; sku: string; product?: { id: number; name: string } };
type UserRow = { id: string; name: string | null; email: string | null };
type Bin = { id: number; code: string; name: string };

type VerificationLine = {
  id: number;
  systemQty: number;
  countedQty: number;
  variance: number;
  note: string | null;
  productVariant: { id: number; sku: string; product: { id: number; name: string } };
  bin?: { id: number; code: string; name: string } | null;
};

type Verification = {
  id: number;
  status: "DRAFT" | "SUBMITTED" | "COMMITTEE_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  periodStart: string;
  periodEnd: string;
  note: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  warehouse: Warehouse;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  approvedBy?: { id: string; name: string | null; email: string | null } | null;
  committeeMembers: Array<{ id: number; user: UserRow }>;
  lines: VerificationLine[];
  approvalEvents: Array<{
    id: number;
    stage: string;
    decision: string;
    note: string | null;
    actedAt: string;
    actedBy?: { id: string; name: string | null; email: string | null } | null;
  }>;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "bg-muted/50 text-muted-foreground border-border";
    case "SUBMITTED":
      return "bg-warning/10 text-warning border-warning/20";
    case "COMMITTEE_REVIEW":
      return "bg-info/10 text-info border-info/20";
    case "APPROVED":
      return "bg-success/10 text-success border-success/20";
    case "REJECTED":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "CLOSED":
      return "bg-muted/30 text-muted-foreground border-border";
    default:
      return "bg-muted/50 text-muted-foreground border-border";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "DRAFT":
      return Package;
    case "SUBMITTED":
      return Clock;
    case "COMMITTEE_REVIEW":
      return Users;
    case "APPROVED":
      return CheckCircle;
    case "REJECTED":
      return XCircle;
    case "CLOSED":
      return CheckCircle;
    default:
      return Package;
  }
};

async function readJson<T>(res: Response, errorMessage: string) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || errorMessage);
  }
  return (await res.json()) as T;
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

export default function PhysicalVerificationsPage() {
  const tScm = useTranslations("ScmAuto");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.includes("physical_verifications.read") || permissions.includes("physical_verifications.manage") || permissions.includes("physical_verifications.approve");
  const canManage = permissions.includes("physical_verifications.manage");
  const canApprove = permissions.includes("physical_verifications.approve");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [form, setForm] = useState({
    warehouseId: "",
    frequency: "MONTHLY",
    periodStart: "",
    periodEnd: "",
    note: "",
    committeeUserIds: [] as string[],
  });
  const [lines, setLines] = useState(
    [] as Array<{
      productVariantId: string;
      binId: string;
      systemQty: string;
      countedQty: string;
      note: string;
    }>,
  );

  const selectedWarehouseId = Number(form.warehouseId || warehouseId);

  // Pagination calculations
  const paginatedVerifications = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return verifications.slice(start, end);
  }, [verifications, currentPage]);

  const totalPages = Math.ceil(verifications.length / itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [warehouseId, statusFilter]);

  const loadBootstrap = async () => {
    setLoading(true);
    try {
      const [warehouseRes, variantRes] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }),
        fetch("/api/product-variants", { cache: "no-store" }),
      ]);
      const [warehouseData, variantData] = await Promise.all([
        readJson<Warehouse[]>(warehouseRes, "Failed to load warehouses"),
        readJson<Variant[]>(variantRes, "Failed to load variants"),
      ]);
      setWarehouses(warehouseData);
      setVariants(variantData);
      if (!warehouseId && warehouseData.length > 0) {
        setWarehouseId(String(warehouseData[0].id));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load setup data");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users?limit=50", { cache: "no-store" });
      const data = await readJson<{ users: UserRow[] }>(res, "Failed to load users");
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    }
  };

  const loadBins = async (targetWarehouseId: number) => {
    if (!targetWarehouseId) return;
    const res = await fetch(`/api/scm/warehouse-locations?warehouseId=${targetWarehouseId}`, {
      cache: "no-store",
    });
    const data = await readJson<{ bins: Bin[] }>(res, "Failed to load bins");
    setBins(data.bins || []);
  };

  const loadVerifications = async () => {
    const qs = new URLSearchParams();
    if (warehouseId) qs.set("warehouseId", warehouseId);
    if (statusFilter) qs.set("status", statusFilter);
    const res = await fetch(`/api/scm/physical-verifications?${qs.toString()}`, {
      cache: "no-store",
    });
    const data = await readJson<Verification[]>(res, "Failed to load verifications");
    setVerifications(data);
  };

  useEffect(() => {
    void loadBootstrap();
    if (canRead) {
      void loadVerifications();
    }
    if (canManage || canApprove) {
      void loadUsers();
    }
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    void loadBins(selectedWarehouseId);
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (!canRead) return;
    void loadVerifications();
  }, [warehouseId, statusFilter, canRead]);

  const addLine = () => {
    setLines((current) => [
      ...current,
      { productVariantId: "", binId: "", systemQty: "", countedQty: "", note: "" },
    ]);
  };

  const updateLine = (index: number, key: string, value: string) => {
    setLines((current) =>
      current.map((line, idx) => (idx === index ? { ...line, [key]: value } : line)),
    );
  };

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, idx) => idx !== index));
  };

  const toggleCommitteeMember = (userId: string) => {
    setForm((current) => {
      const exists = current.committeeUserIds.includes(userId);
      return {
        ...current,
        committeeUserIds: exists
          ? current.committeeUserIds.filter((id) => id !== userId)
          : [...current.committeeUserIds, userId],
      };
    });
  };

  const createVerification = async () => {
    if (!form.warehouseId || !form.periodStart || !form.periodEnd) {
      toast.error(tScm("k_2048c7b83c3d"));
      return;
    }
    if (lines.length === 0) {
      toast.error(tScm("k_09c4abc803db"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/scm/physical-verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: Number(form.warehouseId),
          frequency: form.frequency,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          note: form.note,
          committeeUserIds: form.committeeUserIds,
          lines: lines.map((line) => ({
            productVariantId: Number(line.productVariantId),
            binId: line.binId ? Number(line.binId) : null,
            systemQty: Number(line.systemQty || 0),
            countedQty: Number(line.countedQty || 0),
            note: line.note,
          })),
        }),
      });
      await readJson(res, "Failed to create verification");
      toast.success(tScm("k_06bacd1b9805"));
      setForm({
        warehouseId: "",
        frequency: "MONTHLY",
        periodStart: "",
        periodEnd: "",
        note: "",
        committeeUserIds: [],
      });
      setLines([]);
      await loadVerifications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create verification");
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (id: number, action: string) => {
    try {
      const res = await fetch(`/api/scm/physical-verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJson(res, "Failed to update verification");
      toast.success(tScm("k_08e5e6725515"));
      await loadVerifications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update verification");
    }
  };

  const visibleUsers = useMemo(() => users.slice(0, 12), [users]);

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {tScm("k_2813baf32b4d")}
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
            {tScm("k_4142a28f5370")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {tScm("k_f72fa73d4458")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadVerifications()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          {tScm("k_56e3badc4e6c")}
        </Button>
      </div>

      {/* Create Verification Form */}
      {canManage && (
        <Card className="shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{tScm("k_51bcc01c1dfc")}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {tScm("k_d562c7b5fb83")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            {/* Basic Info Grid */}
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_298dff72dae2")}</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.warehouseId}
                  onChange={(e) => setForm((cur) => ({ ...cur, warehouseId: e.target.value }))}
                >
                  <option value="">{tScm("k_cfab2ae6ca21")}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_89836a870e44")}</Label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.frequency}
                  onChange={(e) => setForm((cur) => ({ ...cur, frequency: e.target.value }))}
                >
                  <option value="MONTHLY">{tScm("k_d31edb7b8a94")}</option>
                  <option value="QUARTERLY">{tScm("k_8a34f7088055")}</option>
                  <option value="ANNUAL">{tScm("k_0930f3f8992c")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_026ce8e3362b")}</Label>
                <Input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm((cur) => ({ ...cur, periodStart: e.target.value }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_420b295ed55d")}</Label>
                <Input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm((cur) => ({ ...cur, periodEnd: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Committee & Note */}
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_e08febf4aded")}</Label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 max-h-24 overflow-y-auto p-2 border border-border rounded-md">
                  {visibleUsers.length === 0 ? (
                    <div className="text-xs text-muted-foreground">{tScm("k_d09009497910")}</div>
                  ) : (
                    visibleUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          "rounded-full border px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs transition-colors",
                          form.committeeUserIds.includes(user.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                        onClick={() => toggleCommitteeMember(user.id)}
                      >
                        {user.name || user.email || user.id.slice(0, 6)}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm">{tScm("k_2c924e308820")}</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm((cur) => ({ ...cur, note: e.target.value }))}
                  placeholder={tScm("k_d61f37e3ae63")}
                  className="text-sm min-h-[80px]"
                />
              </div>
            </div>

            {/* Counted Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs sm:text-sm">{tScm("k_037b9aea8a9b")}</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  {tScm("k_a147e4e01e58")}
                </Button>
              </div>
              
              {lines.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  {tScm("k_091fd89791fb")}
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {lines.map((line, index) => (
                    <div
                      key={`line-${index}`}
                      className="space-y-2 p-3 border border-border rounded-md bg-muted/10"
                    >
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                        <select
                          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                          value={line.productVariantId}
                          onChange={(e) => updateLine(index, "productVariantId", e.target.value)}
                        >
                          <option value="">{tScm("k_cc91b1ea2c16")}</option>
                          {variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.product?.name || "Variant"} ({variant.sku})
                            </option>
                          ))}
                        </select>
                        <select
                          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                          value={line.binId}
                          onChange={(e) => updateLine(index, "binId", e.target.value)}
                        >
                          <option value="">{tScm("k_636bb3801d91")}</option>
                          {bins.map((bin) => (
                            <option key={bin.id} value={bin.id}>
                              {bin.code} · {bin.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder={tScm("k_8e17c8b581cf")}
                          value={line.systemQty}
                          onChange={(e) => updateLine(index, "systemQty", e.target.value)}
                          className="text-sm"
                        />
                        <Input
                          placeholder={tScm("k_76c6b404651a")}
                          value={line.countedQty}
                          onChange={(e) => updateLine(index, "countedQty", e.target.value)}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder={tScm("k_2c924e308820")}
                            value={line.note}
                            onChange={(e) => updateLine(index, "note", e.target.value)}
                            className="text-sm flex-1"
                          />
                          <Button variant="ghost" size="sm" onClick={() => removeLine(index)} className="px-2">
                            {tScm("k_e963907dac5c")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={() => void createVerification()} disabled={creating} className="w-full sm:w-auto">
              {creating ? "Creating..." : "Create Verification"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Verification Register */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">{tScm("k_9959e12cd7c4")}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {tScm("k_8b2ecbb962f9")}
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
          <div className="hidden sm:flex flex-wrap gap-3">
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">{tScm("k_4398170593bf")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{tScm("k_6405179d241b")}</option>
              <option value="DRAFT">{tScm("k_23d33e22acfc")}</option>
              <option value="SUBMITTED">{tScm("k_2e00359b9802")}</option>
              <option value="COMMITTEE_REVIEW">{tScm("k_55d497ca1f48")}</option>
              <option value="APPROVED">{tScm("k_41b81eb8db1b")}</option>
              <option value="REJECTED">{tScm("k_27eeb7a291bf")}</option>
              <option value="CLOSED">{tScm("k_88d86b7721d5")}</option>
            </select>
          </div>

          {/* Mobile Filters Drawer */}
          {showFilters && (
            <div className="space-y-3 sm:hidden">
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
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
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{tScm("k_6405179d241b")}</option>
                <option value="DRAFT">{tScm("k_23d33e22acfc")}</option>
                <option value="SUBMITTED">{tScm("k_2e00359b9802")}</option>
                <option value="COMMITTEE_REVIEW">{tScm("k_55d497ca1f48")}</option>
                <option value="APPROVED">{tScm("k_41b81eb8db1b")}</option>
                <option value="REJECTED">{tScm("k_27eeb7a291bf")}</option>
                <option value="CLOSED">{tScm("k_88d86b7721d5")}</option>
              </select>
              <Button variant="outline" onClick={() => setShowFilters(false)} className="w-full">
                {tScm("k_6834a4e56490")}
              </Button>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_298dff72dae2")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_170a28a9db6d")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_bae7d5be7082")}</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">{tScm("k_c6fd3870c86e")}</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">{tScm("k_c3cd636a585b")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVerifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">{tScm("k_67378bb1f456")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVerifications.map((verification) => {
                    const StatusIcon = getStatusIcon(verification.status);
                    return (
                      <TableRow key={verification.id} className="border-border hover:bg-muted/40">
                        <TableCell className="py-3">
                          <div className="font-medium text-sm text-foreground">{verification.warehouse.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{verification.warehouse.code}</div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm text-foreground">
                            {new Date(verification.periodStart).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            → {new Date(verification.periodEnd).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            getStatusColor(verification.status)
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {verification.status.replaceAll("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3 font-medium text-foreground">
                          {verification.lines.length}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" asChild className="h-8 px-2 text-xs">
                              <Link href={`/admin/scm/physical-verifications/${verification.id}`}>
                                <Eye className="h-3 w-3 mr-1" />
                                {tScm("k_69bd4ef9fbd0")}
                              </Link>
                            </Button>
                            {canManage && verification.status === "DRAFT" && (
                              <Button size="sm" onClick={() => void runAction(verification.id, "submit")} className="h-8 px-2 text-xs">
                                {tScm("k_2dacf6595984")}
                              </Button>
                            )}
                            {canApprove && verification.status === "SUBMITTED" && (
                              <Button size="sm" variant="outline" onClick={() => void runAction(verification.id, "committee_review")} className="h-8 px-2 text-xs">
                                {tScm("k_e29a79fe0c34")}
                              </Button>
                            )}
                            {canApprove && verification.status === "COMMITTEE_REVIEW" && (
                              <>
                                <Button size="sm" onClick={() => void runAction(verification.id, "committee_approve")} className="h-8 px-2 text-xs">
                                  {tScm("k_7b2c7f146aba")}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => void runAction(verification.id, "committee_reject")} className="h-8 px-2 text-xs">
                                  {tScm("k_2b03b59293b6")}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 lg:hidden">
            {paginatedVerifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{tScm("k_67378bb1f456")}</p>
              </div>
            ) : (
              paginatedVerifications.map((verification) => {
                const StatusIcon = getStatusIcon(verification.status);
                return (
                  <Card key={verification.id} className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-sm font-semibold text-foreground">
                              {verification.warehouse.name}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              ({verification.warehouse.code})
                            </span>
                          </div>
                        </div>
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          getStatusColor(verification.status)
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          {verification.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      {/* Period */}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">
                          {new Date(verification.periodStart).toLocaleDateString()} →{" "}
                          {new Date(verification.periodEnd).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Lines Count */}
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">
                          {verification.lines.length} {tScm("k_264f39cab871")}{verification.lines.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <Link href={`/admin/scm/physical-verifications/${verification.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {tScm("k_907b3bee2778")}
                          </Link>
                        </Button>
                        {canManage && verification.status === "DRAFT" && (
                          <Button size="sm" onClick={() => void runAction(verification.id, "submit")} className="flex-1">
                            {tScm("k_2dacf6595984")}
                          </Button>
                        )}
                        {canApprove && verification.status === "SUBMITTED" && (
                          <Button size="sm" variant="outline" onClick={() => void runAction(verification.id, "committee_review")} className="flex-1">
                            {tScm("k_10227c577f3d")}
                          </Button>
                        )}
                        {canApprove && verification.status === "COMMITTEE_REVIEW" && (
                          <div className="flex gap-2 w-full">
                            <Button size="sm" onClick={() => void runAction(verification.id, "committee_approve")} className="flex-1">
                              {tScm("k_7b2c7f146aba")}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void runAction(verification.id, "committee_reject")} className="flex-1">
                              {tScm("k_2b03b59293b6")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
