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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";
import { 
  Plus, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Building2,
  Mail,
  User,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type SupplierOption = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

type UserOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  supplierPortalAccess: {
    id: string;
    supplierId: number;
    status: string;
  } | null;
};

type AccessRecord = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  twoFactorRequired: boolean;
  twoFactorMethod: string | null;
  twoFactorLastVerifiedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: SupplierOption;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  };
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type AccessPayload = {
  records: AccessRecord[];
  suppliers: SupplierOption[];
  users: UserOption[];
};

function fmtDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-success/10 text-success border-success/20";
    case "SUSPENDED":
      return "bg-warning/10 text-warning border-warning/20";
    case "REVOKED":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "ACTIVE":
      return CheckCircle;
    case "SUSPENDED":
      return AlertCircle;
    case "REVOKED":
      return XCircle;
    default:
      return Shield;
  }
}

// Pagination Component
function Pagination({ currentPage, totalPages, onPageChange }: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("AdminSupplierPortalAccess");
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

// Modal Component for Create/Edit
function AccessModal({ 
  open, 
  onOpenChange, 
  editingId,
  selectedUserId,
  selectedSupplierId,
  status,
  twoFactorRequired,
  twoFactorMethod,
  note,
  suppliers,
  users,
  availableUsers,
  onUserIdChange,
  onSupplierIdChange,
  onStatusChange,
  onTwoFactorChange,
  onNoteChange,
  onSave,
  saving,
  onReset
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  selectedUserId: string;
  selectedSupplierId: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  twoFactorRequired: boolean;
  twoFactorMethod: string;
  note: string;
  suppliers: SupplierOption[];
  users: UserOption[];
  availableUsers: UserOption[];
  onUserIdChange: (value: string) => void;
  onSupplierIdChange: (value: string) => void;
  onStatusChange: (value: "ACTIVE" | "SUSPENDED" | "REVOKED") => void;
  onTwoFactorChange: (required: boolean, method: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("AdminSupplierPortalAccess");
  const handleClose = () => {
    onReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {editingId ? t("modal.editTitle") : t("modal.createTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {editingId 
              ? t("modal.editDescription")
              : t("modal.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("fields.userRequired")}</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedUserId}
              onChange={(event) => onUserIdChange(event.target.value)}
            >
              <option value="">{t("fields.selectUser")}</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || t("common.unnamed")} ({user.email || t("common.noEmail")}) - {user.role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("fields.supplierRequired")}</Label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedSupplierId}
              onChange={(event) => onSupplierIdChange(event.target.value)}
            >
              <option value="">{t("fields.selectSupplier")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.code}) {!supplier.isActive && `- ${t("statuses.INACTIVE")}`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("common.status")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={status}
                onChange={(event) =>
                  onStatusChange(event.target.value as "ACTIVE" | "SUSPENDED" | "REVOKED")
                }
              >
                <option value="ACTIVE">{t("statusOptions.ACTIVE")}</option>
                <option value="SUSPENDED">{t("statusOptions.SUSPENDED")}</option>
                <option value="REVOKED">{t("statusOptions.REVOKED")}</option>
              </select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("fields.twoFactorPolicy")}</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={twoFactorRequired ? twoFactorMethod : "DISABLED"}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "DISABLED") {
                    onTwoFactorChange(false, "EMAIL_OTP");
                    return;
                  }
                  onTwoFactorChange(true, value);
                }}
              >
                <option value="DISABLED">{t("twoFactor.DISABLED")}</option>
                <option value="EMAIL_OTP">{t("twoFactor.EMAIL_OTP")}</option>
                <option value="TOTP">{t("twoFactor.TOTP")}</option>
                <option value="AUTH_APP">{t("twoFactor.AUTH_APP")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("fields.noteOptional")}</Label>
            <Textarea
              placeholder={t("fields.notePlaceholder")}
              value={note}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onNoteChange(event.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? t("actions.saving") : editingId ? t("actions.update") : t("actions.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierPortalAccessPage() {
  const t = useTranslations("AdminSupplierPortalAccess");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "REVOKED">("ACTIVE");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState("EMAIL_OTP");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      const response = await fetch(
        `/api/admin/supplier-portal-access${params.size > 0 ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.load"));
      }
      const data = payload as AccessPayload;
      setRecords(Array.isArray(data.records) ? data.records : []);
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [query]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  const availableUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!editingId) return true;
        if (user.id === selectedUserId) return true;
        return !user.supplierPortalAccess;
      }),
    [editingId, selectedUserId, users],
  );

  // Pagination calculations
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return records.slice(start, end);
  }, [records, currentPage]);

  const totalPages = Math.ceil(records.length / itemsPerPage);

  const resetForm = () => {
    setEditingId(null);
    setSelectedUserId("");
    setSelectedSupplierId("");
    setStatus("ACTIVE");
    setTwoFactorRequired(false);
    setTwoFactorMethod("EMAIL_OTP");
    setNote("");
  };

  const startEdit = (record: AccessRecord) => {
    setEditingId(record.id);
    setSelectedUserId(record.user.id);
    setSelectedSupplierId(String(record.supplier.id));
    setStatus(record.status);
    setTwoFactorRequired(Boolean(record.twoFactorRequired));
    setTwoFactorMethod(record.twoFactorMethod || "EMAIL_OTP");
    setNote(record.note ?? "");
    setModalOpen(true);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const saveRecord = async () => {
    if (!selectedUserId || !selectedSupplierId) {
      toast.error(t("errors.required"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/admin/supplier-portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          userId: selectedUserId,
          supplierId: Number(selectedSupplierId),
          status,
          twoFactorRequired,
          twoFactorMethod: twoFactorRequired ? twoFactorMethod : null,
          note,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || t("errors.save"));
      }
      toast.success(editingId ? t("success.updated") : t("success.created"));
      resetForm();
      setModalOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.save"));
    } finally {
      setSaving(false);
    }
  };

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
          <Button onClick={openCreateModal} className="flex-1 sm:flex-initial">
            <Plus className="h-4 w-4 mr-2" />
            {t("actions.add")}
          </Button>
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

      {/* Search Section */}
      <div className="hidden sm:block">
        <Input
          placeholder={t("filters.searchPlaceholder")}
          value={query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          className="max-w-md text-sm"
        />
      </div>

      {/* Mobile Search */}
      {showFilters && (
        <div className="sm:hidden">
          <Input
            placeholder={t("filters.mobileSearchPlaceholder")}
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            className="text-sm"
          />
        </div>
      )}

      {/* Access Registry Card */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("registry.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Desktop Table View */}
          {!loading && paginatedRecords.length > 0 && (
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.user")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.supplier")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.status")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.twoFactor")}</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.lastUpdated")}</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record) => {
                    const StatusIcon = getStatusIcon(record.status);
                    return (
                      <tr key={record.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-medium text-sm text-foreground">
                            {record.user.name || t("common.unnamedUser")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {record.user.email || t("common.noEmail")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("common.roleValue", { role: record.user.role })}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-sm text-foreground">{record.supplier.name}</div>
                          <div className="text-xs text-muted-foreground">{t("common.codeValue", { code: record.supplier.code })}</div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className={cn("text-xs", getStatusColor(record.status))}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t(`statuses.${record.status}`)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="text-xs">
                            {record.twoFactorRequired 
                              ? t("twoFactor.requiredValue", { method: record.twoFactorMethod || "EMAIL_OTP" })
                              : t("twoFactor.optional")}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-xs text-muted-foreground">
                            {fmtDate(record.updatedAt, locale)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t("common.byValue", { creator: record.createdBy?.email || t("common.system") })}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(record)}
                            className="h-8 px-3 text-xs"
                          >
                            {t("actions.edit")}
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
          {!loading && paginatedRecords.length > 0 && (
            <div className="space-y-3 lg:hidden">
              {paginatedRecords.map((record) => {
                const StatusIcon = getStatusIcon(record.status);
                return (
                  <Card key={record.id} className="border-border shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      {/* User Info */}
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {record.user.name || t("common.unnamedUser")}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">
                              {record.user.email || t("common.noEmail")}
                            </p>
                          </div>
                          <Badge variant="outline" className={cn("text-xs shrink-0 ml-2", getStatusColor(record.status))}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t(`statuses.${record.status}`)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("common.roleValue", { role: record.user.role })}
                        </p>
                      </div>

                      {/* Supplier Info */}
                      <div className="flex items-start gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">{record.supplier.name}</p>
                          <p className="text-xs text-muted-foreground">{t("common.codeValue", { code: record.supplier.code })}</p>
                        </div>
                      </div>

                      {/* 2FA Status */}
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {record.twoFactorRequired 
                            ? t("twoFactor.mobileRequiredValue", { method: record.twoFactorMethod || "EMAIL_OTP" })
                            : t("twoFactor.mobileOptional")}
                        </span>
                      </div>

                      {/* Note */}
                      {record.note && (
                        <div className="rounded-md bg-muted/30 p-2">
                          <p className="text-xs text-muted-foreground">
                            {t("common.noteValue", { note: record.note })}
                          </p>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <Clock className="h-3 w-3" />
                        <span>{t("common.updatedValue", { date: fmtDate(record.updatedAt, locale) })}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("common.createdByValue", { creator: record.createdBy?.email || t("common.system") })}
                      </div>

                      {/* Actions */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(record)}
                        className="w-full mt-2"
                      >
                        {t("actions.editAccess")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && paginatedRecords.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/50 mb-2" />
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

      {/* Create/Edit Modal */}
      <AccessModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
        selectedUserId={selectedUserId}
        selectedSupplierId={selectedSupplierId}
        status={status}
        twoFactorRequired={twoFactorRequired}
        twoFactorMethod={twoFactorMethod}
        note={note}
        suppliers={suppliers}
        users={users}
        availableUsers={availableUsers}
        onUserIdChange={setSelectedUserId}
        onSupplierIdChange={setSelectedSupplierId}
        onStatusChange={setStatus}
        onTwoFactorChange={(required, method) => {
          setTwoFactorRequired(required);
          setTwoFactorMethod(method);
        }}
        onNoteChange={setNote}
        onSave={saveRecord}
        saving={saving}
        onReset={resetForm}
      />
    </div>
  );
}
