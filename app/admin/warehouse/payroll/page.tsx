"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CalendarRange,
  CircleDollarSign,
  Plus,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type UserOption = {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
};

type WarehouseOption = {
  id: number;
  name: string;
  code: string;
};

type PayrollProfile = {
  id: number;
  userId: string;
  warehouseId?: number | null;
  employeeCode?: string | null;
  paymentType: string;
  baseSalary: string | number;
  bankName?: string | null;
  bankAccountNo?: string | null;
  accountHolder?: string | null;
  mobileBankingNo?: string | null;
  paymentMethod?: string | null;
  joiningDate?: string | null;
  isActive: boolean;
  notes?: string | null;
  user: UserOption;
  warehouse?: WarehouseOption | null;
  _count?: { entries: number };
};

type PayrollPeriod = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
  _count?: { entries: number };
};

type PayrollEntry = {
  id: number;
  payrollPeriodId: number;
  payrollProfileId: number;
  userId: string;
  warehouseId?: number | null;
  basicAmount: string | number;
  overtimeAmount: string | number;
  bonusAmount: string | number;
  deductionAmount: string | number;
  netAmount: string | number;
  paymentStatus: string;
  paidAt?: string | null;
  note?: string | null;
  payrollPeriod: PayrollPeriod;
  payrollProfile: PayrollProfile;
  warehouse?: WarehouseOption | null;
};

type PayrollPayload = {
  summary: {
    activeProfiles: number;
    openPeriods: number;
    paidCount: number;
    pendingCount: number;
    paidAmount: number;
    pendingAmount: number;
  };
  profiles: PayrollProfile[];
  periods: PayrollPeriod[];
  entries: PayrollEntry[];
  users: UserOption[];
  warehouses: WarehouseOption[];
};

type PayrollTab = "profiles" | "periods" | "entries";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

const profileDefaults = {
  userId: "",
  warehouseId: "",
  employeeCode: "",
  paymentType: "MONTHLY",
  baseSalary: "",
  bankName: "",
  bankAccountNo: "",
  accountHolder: "",
  mobileBankingNo: "",
  paymentMethod: "BANK",
  joiningDate: "",
  isActive: true,
  notes: "",
};

const periodDefaults = {
  name: "",
  startDate: "",
  endDate: "",
  status: "OPEN",
  notes: "",
};

const entryDefaults = {
  payrollProfileId: "",
  payrollPeriodId: "",
  warehouseId: "",
  basicAmount: "",
  overtimeAmount: "0",
  bonusAmount: "0",
  deductionAmount: "0",
  netAmount: "",
  paymentStatus: "PENDING",
  paidAt: "",
  note: "",
};

function amount(value: string | number | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateNetAmountValue(entry: typeof entryDefaults) {
  return String(
    amount(entry.basicAmount) +
      amount(entry.overtimeAmount) +
      amount(entry.bonusAmount) -
      amount(entry.deductionAmount),
  );
}

function formatMoney(value: string | number | null | undefined) {
  return money.format(amount(value));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function getBadgeClass(status: string) {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "OPEN":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
    case "PROCESSING":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700";
    case "CLOSED":
      return "border-slate-500/20 bg-slate-500/10 text-slate-700";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  }
}

function PayrollPageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className=" space-y-6">
        <div className="rounded-[28px] border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`payroll-summary-${index}`}
              className="rounded-[24px] border border-border/60 bg-card p-5 shadow-sm"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-9 w-20" />
              <Skeleton className="mt-3 h-4 w-32" />
            </div>
          ))}
        </div>

        <div className="rounded-[28px] border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
            <Skeleton className="h-12 w-80 rounded-2xl" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-60 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>
          <div className="space-y-3 pt-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={`payroll-row-${index}`}
                className="grid gap-3 rounded-2xl border border-border/60 p-4 md:grid-cols-6"
              >
                {Array.from({ length: 6 }).map((__, innerIndex) => (
                  <Skeleton
                    key={`payroll-cell-${index}-${innerIndex}`}
                    className="h-5 w-full"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function AdminPayrollPage() {
  const t = useTranslations("AdminPayroll");

  const [data, setData] = useState<PayrollPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<PayrollTab>("profiles");
  const [submitting, setSubmitting] = useState<
    "profile" | "period" | "entry" | null
  >(null);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(profileDefaults);
  const [periodForm, setPeriodForm] = useState(periodDefaults);
  const [entryForm, setEntryForm] = useState(entryDefaults);
  const [isNetAmountManual, setIsNetAmountManual] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/payroll", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("errors.loadFailed"));
      setData(payload);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : t("errors.loadFailed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProfile = useMemo(
    () =>
      data?.profiles.find(
        (item) => item.id === Number(entryForm.payrollProfileId),
      ) || null,
    [data?.profiles, entryForm.payrollProfileId],
  );

  useEffect(() => {
    if (!selectedProfile) return;
    setEntryForm((current) => ({
      ...current,
      warehouseId:
        current.warehouseId ||
        (selectedProfile.warehouseId
          ? String(selectedProfile.warehouseId)
          : ""),
      basicAmount:
        current.basicAmount || String(selectedProfile.baseSalary ?? ""),
    }));
  }, [selectedProfile]);

  useEffect(() => {
    if (isNetAmountManual) return;

    const calculatedNetAmount = calculateNetAmountValue(entryForm);
    if (entryForm.netAmount === calculatedNetAmount) return;

    setEntryForm((current) => ({
      ...current,
      netAmount: calculateNetAmountValue(current),
    }));
  }, [
    entryForm.basicAmount,
    entryForm.overtimeAmount,
    entryForm.bonusAmount,
    entryForm.deductionAmount,
    entryForm.netAmount,
    isNetAmountManual,
  ]);

  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return data?.profiles ?? [];
    return (data?.profiles ?? []).filter((profile) =>
      [
        profile.user.name,
        profile.user.email,
        profile.employeeCode,
        profile.paymentType,
        profile.paymentMethod,
        profile.warehouse?.name,
        profile.warehouse?.code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data?.profiles, searchTerm]);

  const filteredPeriods = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return data?.periods ?? [];
    return (data?.periods ?? []).filter((period) =>
      [period.name, period.status, period.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data?.periods, searchTerm]);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return data?.entries ?? [];
    return (data?.entries ?? []).filter((entry) =>
      [
        entry.payrollProfile.user.name,
        entry.payrollProfile.user.email,
        entry.payrollPeriod.name,
        entry.paymentStatus,
        entry.warehouse?.name,
        entry.note,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [data?.entries, searchTerm]);

  const resetProfileModal = () => {
    setEditingProfileId(null);
    setProfileForm(profileDefaults);
    setIsProfileModalOpen(false);
  };

  const resetPeriodModal = () => {
    setEditingPeriodId(null);
    setPeriodForm(periodDefaults);
    setIsPeriodModalOpen(false);
  };

  const resetEntryModal = () => {
    setEditingEntryId(null);
    setEntryForm(entryDefaults);
    setIsNetAmountManual(false);
    setIsEntryModalOpen(false);
  };

  const openCreateModal = () => {
    setError(null);
    setSuccess(null);

    if (activeTab === "profiles") {
      setEditingProfileId(null);
      setProfileForm(profileDefaults);
      setIsProfileModalOpen(true);
      return;
    }

    if (activeTab === "periods") {
      setEditingPeriodId(null);
      setPeriodForm(periodDefaults);
      setIsPeriodModalOpen(true);
      return;
    }

    setEditingEntryId(null);
    setEntryForm(entryDefaults);
    setIsNetAmountManual(false);
    setIsEntryModalOpen(true);
  };

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting("profile");
      setError(null);
      setSuccess(null);

      const payload = {
        entity: "profile",
        ...profileForm,
        warehouseId: profileForm.warehouseId || null,
        joiningDate: profileForm.joiningDate || null,
      };
      const url = editingProfileId
        ? `/api/payroll/profile/${editingProfileId}`
        : "/api/payroll";
      const method = editingProfileId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(response?.error || t("errors.profileSaveFailed"));
      }

      const successMessage = editingProfileId
        ? t("success.profileUpdated")
        : t("success.profileCreated");
      toast.success(successMessage);
      setSuccess(successMessage);
      setEditingProfileId(null);
      setProfileForm(profileDefaults);
      setIsProfileModalOpen(false);
      await loadData();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : t("errors.profileSaveFailed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(null);
    }
  };

  const submitPeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting("period");
      setError(null);
      setSuccess(null);

      const payload = {
        entity: "period",
        ...periodForm,
        notes: periodForm.notes || null,
      };
      const url = editingPeriodId
        ? `/api/payroll/period/${editingPeriodId}`
        : "/api/payroll";
      const method = editingPeriodId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(response?.error || t("errors.periodSaveFailed"));
      }

      const successMessage = editingPeriodId
        ? t("success.periodUpdated")
        : t("success.periodCreated");
      toast.success(successMessage);
      setSuccess(successMessage);
      setEditingPeriodId(null);
      setPeriodForm(periodDefaults);
      setIsPeriodModalOpen(false);
      await loadData();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : t("errors.periodSaveFailed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(null);
    }
  };

  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting("entry");
      setError(null);
      setSuccess(null);

      const payload = {
        entity: "entry",
        ...entryForm,
        warehouseId: entryForm.warehouseId || null,
        paidAt: entryForm.paidAt || null,
        note: entryForm.note || null,
      };
      const url = editingEntryId
        ? `/api/payroll/entry/${editingEntryId}`
        : "/api/payroll";
      const method = editingEntryId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(response?.error || t("errors.entrySaveFailed"));
      }

      const successMessage = editingEntryId
        ? t("success.entryUpdated")
        : t("success.entryCreated");
      toast.success(successMessage);
      setSuccess(successMessage);
      setEditingEntryId(null);
      setEntryForm(entryDefaults);
      setIsNetAmountManual(false);
      setIsEntryModalOpen(false);
      await loadData();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : t("errors.entrySaveFailed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(null);
    }
  };

  const summaryCards = [
    {
      label: t("summary.activeProfiles"),
      value: String(data?.summary.activeProfiles || 0),
      hint: t("summary.totalEmployees", { count: data?.profiles.length || 0 }),
      icon: Users,
    },
    {
      label: t("summary.openPeriods"),
      value: String(data?.summary.openPeriods || 0),
      hint: t("summary.totalWindows", { count: data?.periods.length || 0 }),
      icon: CalendarRange,
    },
    {
      label: t("summary.pendingPayroll"),
      value: formatMoney(data?.summary.pendingAmount),
      hint: t("summary.pendingEntries", {
        count: data?.summary.pendingCount || 0,
      }),
      icon: Wallet,
    },
    {
      label: t("summary.paidPayroll"),
      value: formatMoney(data?.summary.paidAmount),
      hint: t("summary.paidEntries", { count: data?.summary.paidCount || 0 }),
      icon: CircleDollarSign,
    },
  ];

  if (loading && !data) {
    return <PayrollPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {t("header.title")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {t("header.description")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => loadData()}
                className="rounded-full px-4"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
                {t("actions.refresh")}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-[24px] border border-border/60 bg-background p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {card.value}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {card.hint}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted p-3 text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-border/60 bg-card shadow-sm">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as PayrollTab)}
            className="w-full"
          >
            <div className="flex flex-col gap-4 border-b border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="justify-start rounded-2xl bg-muted p-1">
                <TabsTrigger
                  value="profiles"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t("tabs.profiles")}
                </TabsTrigger>

                <TabsTrigger
                  value="periods"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t("tabs.periods")}
                </TabsTrigger>

                <TabsTrigger
                  value="entries"
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t("tabs.entries")}
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("searchPlaceholder", {
                      tab: t(`tabs.${activeTab}`),
                    })}
                    className="h-11 w-full min-w-0 rounded-full border border-border bg-background pl-11 pr-4 text-sm outline-none transition focus:border-primary md:w-72"
                  />
                </div>
                <Button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-full px-5"
                >
                  <Plus className="h-4 w-4" />
                  {activeTab === "profiles"
                    ? t("actions.newProfile")
                    : activeTab === "periods"
                      ? t("actions.newPeriod")
                      : t("actions.newEntry")}
                </Button>
              </div>
            </div>

            <TabsContent value="profiles" className="m-0 p-4 md:p-6">
              <div className="space-y-5">
                <SectionHeader
                  title={t("profiles.title")}
                  description={t("profiles.description")}
                />

                <div className="overflow-hidden rounded-[24px] border border-border/60">
                  <div className="hidden grid-cols-[1.6fr_1.3fr_1fr_1fr_1fr_auto] gap-4 border-b border-border/60 bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                    <div>{t("profiles.table.employee")}</div>
                    <div>{t("profiles.table.contact")}</div>
                    <div>{t("profiles.table.warehouse")}</div>
                    <div>{t("profiles.table.payment")}</div>
                    <div>{t("profiles.table.salary")}</div>
                    <div>{t("profiles.table.actions")}</div>
                  </div>

                  {filteredProfiles.length ? (
                    filteredProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="grid gap-4 border-b border-border/60 px-5 py-4 last:border-b-0 lg:grid-cols-[1.6fr_1.3fr_1fr_1fr_1fr_auto] lg:items-center"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {profile.user.name || profile.user.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.employeeCode ||
                              t("profiles.noEmployeeCode")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            {profile.user.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.user.phone || t("profiles.noPhone")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            {profile.warehouse?.name ||
                              t("profiles.noWarehouse")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.warehouse?.code ||
                              t("profiles.unassigned")}
                          </p>
                        </div>
                        <div>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                              getBadgeClass(
                                profile.isActive ? "ACTIVE" : "PENDING",
                              ),
                            )}
                          >
                            {t(`paymentTypes.${profile.paymentType}`)}
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {profile.paymentMethod ||
                              t("profiles.noPaymentMethod")}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {formatMoney(profile.baseSalary)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("profiles.entriesCount", {
                              count: profile._count?.entries || 0,
                            })}
                          </p>
                        </div>
                        <div className="flex justify-start lg:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProfileId(profile.id);
                              setProfileForm({
                                userId: profile.userId,
                                warehouseId: profile.warehouseId
                                  ? String(profile.warehouseId)
                                  : "",
                                employeeCode: profile.employeeCode || "",
                                paymentType: profile.paymentType || "MONTHLY",
                                baseSalary: String(profile.baseSalary || ""),
                                bankName: profile.bankName || "",
                                bankAccountNo: profile.bankAccountNo || "",
                                accountHolder: profile.accountHolder || "",
                                mobileBankingNo: profile.mobileBankingNo || "",
                                paymentMethod: profile.paymentMethod || "",
                                joiningDate:
                                  profile.joiningDate?.slice(0, 10) || "",
                                isActive: profile.isActive,
                                notes: profile.notes || "",
                              });
                              setIsProfileModalOpen(true);
                            }}
                            className="rounded-full"
                          >
                            {t("actions.edit")}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-14 text-center text-sm text-muted-foreground">
                      {t("profiles.empty")}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="periods" className="m-0 p-4 md:p-6">
              <div className="space-y-5">
                <SectionHeader
                  title={t("periods.title")}
                  description={t("periods.description")}
                />

                <div className="overflow-hidden rounded-[24px] border border-border/60">
                  <div className="hidden grid-cols-[1.8fr_1.2fr_1fr_1fr_auto] gap-4 border-b border-border/60 bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                    <div>{t("periods.table.period")}</div>
                    <div>{t("periods.table.timeline")}</div>
                    <div>{t("periods.table.status")}</div>
                    <div>{t("periods.table.entries")}</div>
                    <div>{t("periods.table.actions")}</div>
                  </div>

                  {filteredPeriods.length ? (
                    filteredPeriods.map((period) => (
                      <div
                        key={period.id}
                        className="grid gap-4 border-b border-border/60 px-5 py-4 last:border-b-0 lg:grid-cols-[1.8fr_1.2fr_1fr_1fr_auto] lg:items-center"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {period.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {period.notes || t("periods.noNotes")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            {formatDate(period.startDate)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("periods.toDate", {
                              date: formatDate(period.endDate),
                            })}
                          </p>
                        </div>
                        <div>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                              getBadgeClass(period.status),
                            )}
                          >
                            {t(`periodStatus.${period.status}`)}
                          </span>
                        </div>
                        <div className="text-sm text-foreground">
                          {period._count?.entries || 0}
                        </div>
                        <div className="flex justify-start lg:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPeriodId(period.id);
                              setPeriodForm({
                                name: period.name,
                                startDate: period.startDate.slice(0, 10),
                                endDate: period.endDate.slice(0, 10),
                                status: period.status,
                                notes: period.notes || "",
                              });
                              setIsPeriodModalOpen(true);
                            }}
                            className="rounded-full"
                          >
                            {t("actions.edit")}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-14 text-center text-sm text-muted-foreground">
                      {t("periods.empty")}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="entries" className="m-0 p-4 md:p-6">
              <div className="space-y-5">
                <SectionHeader
                  title={t("entries.title")}
                  description={t("entries.description")}
                />

                <div className="overflow-hidden rounded-[24px] border border-border/60">
                  <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-border/60 bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
                    <div>{t("entries.table.employee")}</div>
                    <div>{t("entries.table.period")}</div>
                    <div>{t("entries.table.warehouse")}</div>
                    <div>{t("entries.table.breakdown")}</div>
                    <div>{t("entries.table.net")}</div>
                    <div>{t("entries.table.status")}</div>
                    <div>{t("entries.table.actions")}</div>
                  </div>

                  {filteredEntries.length ? (
                    filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="grid gap-4 border-b border-border/60 px-5 py-4 last:border-b-0 xl:grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_1fr_auto] xl:items-center"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {entry.payrollProfile.user.name ||
                              entry.payrollProfile.user.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.payrollProfile.user.email}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            {entry.payrollPeriod.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("entries.paidAt", {
                              date: formatDate(entry.paidAt),
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            {entry.warehouse?.name || t("entries.noWarehouse")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {entry.warehouse?.code || t("entries.unassigned")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            {t("entries.basic", {
                              amount: formatMoney(entry.basicAmount),
                            })}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("entries.breakdown", {
                              ot: formatMoney(entry.overtimeAmount),
                              bonus: formatMoney(entry.bonusAmount),
                              deduction: formatMoney(entry.deductionAmount),
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {formatMoney(entry.netAmount)}
                          </p>
                        </div>
                        <div>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                              getBadgeClass(entry.paymentStatus),
                            )}
                          >
                            {t(`paymentStatus.${entry.paymentStatus}`)}
                          </span>
                        </div>
                        <div className="flex justify-start xl:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const nextEntryForm = {
                                payrollProfileId: String(
                                  entry.payrollProfileId,
                                ),
                                payrollPeriodId: String(entry.payrollPeriodId),
                                warehouseId: entry.warehouseId
                                  ? String(entry.warehouseId)
                                  : "",
                                basicAmount: String(entry.basicAmount || ""),
                                overtimeAmount: String(
                                  entry.overtimeAmount || 0,
                                ),
                                bonusAmount: String(entry.bonusAmount || 0),
                                deductionAmount: String(
                                  entry.deductionAmount || 0,
                                ),
                                netAmount: String(entry.netAmount || ""),
                                paymentStatus: entry.paymentStatus,
                                paidAt: entry.paidAt?.slice(0, 10) || "",
                                note: entry.note || "",
                              };
                              setEditingEntryId(entry.id);
                              setIsNetAmountManual(
                                nextEntryForm.netAmount !==
                                  calculateNetAmountValue(nextEntryForm),
                              );
                              setEntryForm(nextEntryForm);
                              setIsEntryModalOpen(true);
                            }}
                            className="rounded-full"
                          >
                            {t("actions.edit")}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-5 py-14 text-center text-sm text-muted-foreground">
                      {t("entries.empty")}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* ============ PROFILE MODAL ============ */}
        <Dialog
          open={isProfileModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetProfileModal();
              return;
            }
            setIsProfileModalOpen(true);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[28px] border border-border/60 p-0">
            <form onSubmit={submitProfile} className="space-y-0">
              <DialogHeader className="border-b border-border/60 px-6 py-5">
                <DialogTitle>
                  {editingProfileId
                    ? t("profileModal.titleEdit")
                    : t("profileModal.titleNew")}
                </DialogTitle>
                <DialogDescription>
                  {t("profileModal.description")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.user")}
                  </label>
                  <select
                    value={profileForm.userId}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, userId: e.target.value }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  >
                    <option value="">{t("profileModal.selectUser")}</option>
                    {data?.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.employeeCode")}
                  </label>
                  <input
                    value={profileForm.employeeCode}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        employeeCode: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.employeeCode")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.warehouse")}
                  </label>
                  <select
                    value={profileForm.warehouseId}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        warehouseId: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  >
                    <option value="">{t("profileModal.noWarehouse")}</option>
                    {data?.warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.paymentType")}
                  </label>
                  <select
                    value={profileForm.paymentType}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        paymentType: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  >
                    <option value="MONTHLY">{t("paymentTypes.MONTHLY")}</option>
                    <option value="WEEKLY">{t("paymentTypes.WEEKLY")}</option>
                    <option value="DAILY">{t("paymentTypes.DAILY")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.baseSalary")}
                  </label>
                  <input
                    value={profileForm.baseSalary}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        baseSalary: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.baseSalary")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.paymentMethod")}
                  </label>
                  <input
                    value={profileForm.paymentMethod}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        paymentMethod: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.paymentMethod")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.joiningDate")}
                  </label>
                  <input
                    type="date"
                    value={profileForm.joiningDate}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        joiningDate: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.bankName")}
                  </label>
                  <input
                    value={profileForm.bankName}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        bankName: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.bankName")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.bankAccountNo")}
                  </label>
                  <input
                    value={profileForm.bankAccountNo}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        bankAccountNo: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.bankAccountNo")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.accountHolder")}
                  </label>
                  <input
                    value={profileForm.accountHolder}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        accountHolder: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.accountHolder")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.mobileBankingNo")}
                  </label>
                  <input
                    value={profileForm.mobileBankingNo}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        mobileBankingNo: e.target.value,
                      }))
                    }
                    placeholder={t("profileModal.placeholders.mobileBankingNo")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("profileModal.fields.notes")}
                  </label>
                  <textarea
                    value={profileForm.notes}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder={t("profileModal.placeholders.notes")}
                    className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-foreground md:col-span-2">
                  <input
                    type="checkbox"
                    checked={profileForm.isActive}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  {t("profileModal.fields.isActive")}
                </label>
              </div>

              <DialogFooter className="border-t border-border/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetProfileModal}
                  className="rounded-full"
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting === "profile"}
                  className="rounded-full"
                >
                  {submitting === "profile"
                    ? t("actions.saving")
                    : editingProfileId
                      ? t("actions.updateProfile")
                      : t("actions.createProfile")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ============ PERIOD MODAL ============ */}
        <Dialog
          open={isPeriodModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetPeriodModal();
              return;
            }
            setIsPeriodModalOpen(true);
          }}
        >
          <DialogContent className="max-w-2xl rounded-[28px] border border-border/60 p-0">
            <form onSubmit={submitPeriod} className="space-y-0">
              <DialogHeader className="border-b border-border/60 px-6 py-5">
                <DialogTitle>
                  {editingPeriodId
                    ? t("periodModal.titleEdit")
                    : t("periodModal.titleNew")}
                </DialogTitle>
                <DialogDescription>
                  {t("periodModal.description")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("periodModal.fields.name")}
                  </label>
                  <input
                    value={periodForm.name}
                    onChange={(e) =>
                      setPeriodForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder={t("periodModal.placeholders.name")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("periodModal.fields.startDate")}
                  </label>
                  <input
                    type="date"
                    value={periodForm.startDate}
                    onChange={(e) =>
                      setPeriodForm((f) => ({
                        ...f,
                        startDate: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("periodModal.fields.endDate")}
                  </label>
                  <input
                    type="date"
                    value={periodForm.endDate}
                    onChange={(e) =>
                      setPeriodForm((f) => ({
                        ...f,
                        endDate: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("periodModal.fields.status")}
                  </label>
                  <select
                    value={periodForm.status}
                    onChange={(e) =>
                      setPeriodForm((f) => ({ ...f, status: e.target.value }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  >
                    <option value="OPEN">{t("periodStatus.OPEN")}</option>
                    <option value="PROCESSING">
                      {t("periodStatus.PROCESSING")}
                    </option>
                    <option value="CLOSED">{t("periodStatus.CLOSED")}</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("periodModal.fields.notes")}
                  </label>
                  <textarea
                    value={periodForm.notes}
                    onChange={(e) =>
                      setPeriodForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder={t("periodModal.placeholders.notes")}
                    className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-border/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetPeriodModal}
                  className="rounded-full"
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting === "period"}
                  className="rounded-full"
                >
                  {submitting === "period"
                    ? t("actions.saving")
                    : editingPeriodId
                      ? t("actions.updatePeriod")
                      : t("actions.createPeriod")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ============ ENTRY MODAL ============ */}
        <Dialog
          open={isEntryModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetEntryModal();
              return;
            }
            setIsEntryModalOpen(true);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[28px] border border-border/60 p-0">
            <form onSubmit={submitEntry} className="space-y-0">
              <DialogHeader className="border-b border-border/60 px-6 py-5">
                <DialogTitle>
                  {editingEntryId
                    ? t("entryModal.titleEdit")
                    : t("entryModal.titleNew")}
                </DialogTitle>
                <DialogDescription>
                  {t("entryModal.description")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.payrollProfile")}
                  </label>
                  <select
                    value={entryForm.payrollProfileId}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        payrollProfileId: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  >
                    <option value="">
                      {t("entryModal.selectPayrollProfile")}
                    </option>
                    {data?.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.user.name || profile.user.email} ·{" "}
                        {formatMoney(profile.baseSalary)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.payrollPeriod")}
                  </label>
                  <select
                    value={entryForm.payrollPeriodId}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        payrollPeriodId: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  >
                    <option value="">
                      {t("entryModal.selectPayrollPeriod")}
                    </option>
                    {data?.periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name} ({t(`periodStatus.${period.status}`)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.warehouse")}
                  </label>
                  <select
                    value={entryForm.warehouseId}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        warehouseId: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  >
                    <option value="">{t("entryModal.noWarehouse")}</option>
                    {data?.warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.paymentStatus")}
                  </label>
                  <select
                    value={entryForm.paymentStatus}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        paymentStatus: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  >
                    <option value="PENDING">
                      {t("paymentStatus.PENDING")}
                    </option>
                    <option value="PAID">{t("paymentStatus.PAID")}</option>
                    <option value="PROCESSING">
                      {t("paymentStatus.PROCESSING")}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.basicAmount")}
                  </label>
                  <input
                    value={entryForm.basicAmount}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        basicAmount: e.target.value,
                      }))
                    }
                    placeholder={t("entryModal.placeholders.basicAmount")}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.overtimeAmount")}
                  </label>
                  <input
                    value={entryForm.overtimeAmount}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        overtimeAmount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.bonusAmount")}
                  </label>
                  <input
                    value={entryForm.bonusAmount}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        bonusAmount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.deductionAmount")}
                  </label>
                  <input
                    value={entryForm.deductionAmount}
                    onChange={(e) =>
                      setEntryForm((f) => ({
                        ...f,
                        deductionAmount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="rounded-[24px] border border-border/60 bg-muted p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t("entryModal.netAmount.title")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("entryModal.netAmount.description")}
                        </p>
                      </div>
                      <div className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                        {t("entryModal.netAmount.autoPreview", {
                          amount: formatMoney(
                            calculateNetAmountValue(entryForm),
                          ),
                        })}
                      </div>
                    </div>

                    <input
                      value={entryForm.netAmount}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setIsNetAmountManual(nextValue.trim() !== "");
                        setEntryForm((f) => ({ ...f, netAmount: nextValue }));
                      }}
                      placeholder={t("entryModal.placeholders.netAmount")}
                      className="mt-4 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.paidAt")}
                  </label>
                  <input
                    type="date"
                    value={entryForm.paidAt}
                    onChange={(e) =>
                      setEntryForm((f) => ({ ...f, paidAt: e.target.value }))
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("entryModal.fields.notes")}
                  </label>
                  <textarea
                    value={entryForm.note}
                    onChange={(e) =>
                      setEntryForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder={t("entryModal.placeholders.notes")}
                    className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="border-t border-border/60 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetEntryModal}
                  className="rounded-full"
                >
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting === "entry"}
                  className="rounded-full"
                >
                  {submitting === "entry"
                    ? t("actions.saving")
                    : editingEntryId
                      ? t("actions.updateEntry")
                      : t("actions.createEntry")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
