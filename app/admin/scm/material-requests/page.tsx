"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Paperclip, Plus, RefreshCw } from "lucide-react";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type MaterialRequestItem = {
  id: number;
  productVariantId: number;
  description: string | null;
  quantityRequested: number;
  quantityReleased: number;
  productVariant: {
    id: number;
    sku: string;
    product: {
      id: number;
      name: string;
      inventoryItemClass: "CONSUMABLE" | "PERMANENT";
      requiresAssetTag: boolean;
    };
  };
};

type MaterialRequest = {
  id: number;
  requestNumber: string;
  warehouseId: number;
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "SUPERVISOR_ENDORSED"
    | "PROJECT_MANAGER_ENDORSED"
    | "ADMIN_APPROVED"
    | "PARTIALLY_RELEASED"
    | "RELEASED"
    | "REJECTED"
    | "CANCELLED";
  title: string | null;
  purpose: string | null;
  budgetCode: string | null;
  boqReference: string | null;
  specification: string | null;
  note: string | null;
  requestedAt: string;
  requiredBy: string | null;
  submittedAt: string | null;
  supervisorEndorsedAt: string | null;
  projectManagerEndorsedAt: string | null;
  adminApprovedAt: string | null;
  createdById: string | null;
  warehouse: Warehouse;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items: MaterialRequestItem[];
  attachments: Array<{
    id: number;
    fileUrl: string;
    fileName: string;
    note: string | null;
    createdAt: string;
  }>;
  approvalEvents: Array<{
    id: number;
    stage: string;
    decision: string;
    note: string | null;
    actedAt: string;
    actedBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  }>;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

function formatDateTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

export default function MaterialRequestsPage() {
  const t = useTranslations("AdminMaterialRequests");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    [
      "material_requests.read",
      "material_requests.manage",
      "material_requests.endorse_supervisor",
      "material_requests.endorse_project_manager",
      "material_requests.approve_admin",
      "material_releases.read",
      "material_releases.manage",
    ].includes(permission),
  );

  const canManage = permissions.includes("material_requests.manage");
  const canSupervisorEndorse = permissions.includes("material_requests.endorse_supervisor");
  const canProjectManagerEndorse = permissions.includes("material_requests.endorse_project_manager");
  const canAdminApprove = permissions.includes("material_requests.approve_admin");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [focusFilter, setFocusFilter] = useState((searchParams.get("focus") || "ALL").toUpperCase());
  const [actionNotes, setActionNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatusFilter(searchParams.get("status") || "ALL");
    setFocusFilter((searchParams.get("focus") || "ALL").toUpperCase());
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const requestData = await fetch("/api/scm/material-requests", {
        cache: "no-store",
      }).then((res) => readJson<MaterialRequest[]>(res, t("errors.load")));

      setRequests(Array.isArray(requestData) ? requestData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.load"));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      if (statusFilter !== "ALL" && request.status !== statusFilter) return false;
      if (focusFilter === "SUPERVISOR-QUEUE" && request.status !== "SUBMITTED") return false;
      if (focusFilter === "PROJECT-QUEUE" && request.status !== "SUPERVISOR_ENDORSED") return false;
      if (focusFilter === "ADMIN-QUEUE" && request.status !== "PROJECT_MANAGER_ENDORSED") return false;

      if (
        focusFilter === "READY-FOR-RELEASE" &&
        !["ADMIN_APPROVED", "PARTIALLY_RELEASED"].includes(request.status)
      ) {
        return false;
      }

      if (
        focusFilter === "MY-ACTIVE" &&
        (request.createdById !== userId ||
          ![
            "SUBMITTED",
            "SUPERVISOR_ENDORSED",
            "PROJECT_MANAGER_ENDORSED",
            "ADMIN_APPROVED",
          ].includes(request.status))
      ) {
        return false;
      }

      if (!query) return true;

      return (
        request.requestNumber.toLowerCase().includes(query) ||
        request.warehouse.name.toLowerCase().includes(query) ||
        (request.title || "").toLowerCase().includes(query) ||
        (request.purpose || "").toLowerCase().includes(query)
      );
    });
  }, [focusFilter, requests, search, statusFilter, userId]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      awaitingSupervisor: requests.filter((request) => request.status === "SUBMITTED").length,
      awaitingProject: requests.filter((request) => request.status === "SUPERVISOR_ENDORSED").length,
      awaitingAdmin: requests.filter((request) => request.status === "PROJECT_MANAGER_ENDORSED").length,
      readyForRelease: requests.filter((request) =>
        ["ADMIN_APPROVED", "PARTIALLY_RELEASED"].includes(request.status),
      ).length,
    }),
    [requests],
  );

  const runAction = async (materialRequestId: number, action: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/scm/material-requests/${materialRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: actionNotes[materialRequestId] || undefined,
        }),
      });

      await readJson(response, t("errors.action", { action }));
      toast.success(
        t("toasts.actionCompleted", { action: t(`actions.${action}` as any) }),
      );

      setActionNotes((current) => ({
        ...current,
        [materialRequestId]: "",
      }));

      await loadData();
    } catch (error: any) {
      toast.error(error?.message || t("errors.action", { action }));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("forbidden.title")}</CardTitle>
            <CardDescription>{t("forbidden.description")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const focusBanner = (() => {
    if (focusFilter === "SUPERVISOR-QUEUE") return t("focus.supervisor");
    if (focusFilter === "PROJECT-QUEUE") return t("focus.project");
    if (focusFilter === "ADMIN-QUEUE") return t("focus.admin");
    if (focusFilter === "READY-FOR-RELEASE") return t("focus.readyForRelease");
    if (focusFilter === "MY-ACTIVE") return t("focus.myActive");
    return t("focus.default");
  })();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("header.description")}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {canManage ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/admin/scm/material-requests/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.newRequest")}
              </Link>
            </Button>
          ) : null}

          <Button
            variant="outline"
            onClick={() => void loadData()}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        <ScmStatCard
          className="col-span-2 md:col-span-1"
          label={t("stats.total.label")}
          value={String(summary.total)}
          hint={t("stats.total.hint")}
        />
        <ScmStatCard
          label={t("stats.supervisorQueue.label")}
          value={String(summary.awaitingSupervisor)}
          hint={t("stats.supervisorQueue.hint")}
        />
        <ScmStatCard
          label={t("stats.projectQueue.label")}
          value={String(summary.awaitingProject)}
          hint={t("stats.projectQueue.hint")}
        />
        <ScmStatCard
          label={t("stats.adminQueue.label")}
          value={String(summary.awaitingAdmin)}
          hint={t("stats.adminQueue.hint")}
        />
        <ScmStatCard
          label={t("stats.releaseReady.label")}
          value={String(summary.readyForRelease)}
          hint={t("stats.releaseReady.hint")}
        />
      </div>

      {focusFilter !== "ALL" || search.trim() ? (
        <Card className="border-amber-200 bg-amber-50/60 shadow-none">
          <CardContent className="flex flex-col gap-2 p-4 text-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">{t("focus.bannerTitle")}</p>
              <p className="text-muted-foreground">{focusBanner}</p>
            </div>

            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setFocusFilter("ALL");
                setStatusFilter("ALL");
                setSearch("");
              }}
            >
              {t("actions.clearFocus")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("register.title")}</CardTitle>
          <CardDescription>{t("register.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]">
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={focusFilter}
              onChange={(event) => setFocusFilter(event.target.value)}
            >
              <option value="ALL">{t("filters.queues.all")}</option>
              <option value="SUPERVISOR-QUEUE">{t("filters.queues.supervisor")}</option>
              <option value="PROJECT-QUEUE">{t("filters.queues.project")}</option>
              <option value="ADMIN-QUEUE">{t("filters.queues.admin")}</option>
              <option value="READY-FOR-RELEASE">{t("filters.queues.readyForRelease")}</option>
              <option value="MY-ACTIVE">{t("filters.queues.myActive")}</option>
            </select>

            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">{t("filters.statuses.all")}</option>
              <option value="DRAFT">{t("statuses.DRAFT")}</option>
              <option value="SUBMITTED">{t("statuses.SUBMITTED")}</option>
              <option value="SUPERVISOR_ENDORSED">{t("statuses.SUPERVISOR_ENDORSED")}</option>
              <option value="PROJECT_MANAGER_ENDORSED">{t("statuses.PROJECT_MANAGER_ENDORSED")}</option>
              <option value="ADMIN_APPROVED">{t("statuses.ADMIN_APPROVED")}</option>
              <option value="PARTIALLY_RELEASED">{t("statuses.PARTIALLY_RELEASED")}</option>
              <option value="RELEASED">{t("statuses.RELEASED")}</option>
              <option value="REJECTED">{t("statuses.REJECTED")}</option>
              <option value="CANCELLED">{t("statuses.CANCELLED")}</option>
            </select>

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {t("filters.visibleCount", { count: visibleRequests.length })}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : visibleRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {visibleRequests.map((request) => {
                const canCancel =
                  ["DRAFT", "SUBMITTED"].includes(request.status) &&
                  (canManage || (request.createdById !== null && request.createdById === userId));

                const canReject =
                  ["SUBMITTED", "SUPERVISOR_ENDORSED", "PROJECT_MANAGER_ENDORSED"].includes(
                    request.status,
                  ) &&
                  (canSupervisorEndorse || canProjectManagerEndorse || canAdminApprove);

                return (
                  <Card key={request.id}>
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-lg">{request.requestNumber}</CardTitle>
                          <CardDescription>
                            {request.warehouse.name} ({request.warehouse.code})
                            {request.title ? ` • ${request.title}` : ""}
                          </CardDescription>
                        </div>

                        <ScmStatusChip status={request.status} />
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          {t("labels.requested")}:{" "}
                          {formatDateTime(request.requestedAt, t("labels.na"))}
                        </div>
                        <div>
                          {t("labels.requiredBy")}:{" "}
                          {formatDateTime(request.requiredBy, t("labels.na"))}
                        </div>
                        <div>
                          {t("labels.submitted")}:{" "}
                          {formatDateTime(request.submittedAt, t("labels.na"))}
                        </div>
                        <div>
                          {t("labels.adminApproved")}:{" "}
                          {formatDateTime(request.adminApprovedAt, t("labels.na"))}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">{t("labels.purpose")}:</span>{" "}
                          {request.purpose || "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("labels.budget")}:</span>{" "}
                          {request.budgetCode || "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("labels.boq")}:</span>{" "}
                          {request.boqReference || "-"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("labels.createdBy")}:</span>{" "}
                          {request.createdBy?.name || request.createdBy?.email || t("labels.na")}
                        </div>
                      </div>

                      {request.specification ? (
                        <p className="text-sm text-muted-foreground">
                          {t("labels.specification")}: {request.specification}
                        </p>
                      ) : null}

                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[720px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("table.item")}</TableHead>
                              <TableHead>{t("table.requested")}</TableHead>
                              <TableHead>{t("table.released")}</TableHead>
                              <TableHead>{t("table.remaining")}</TableHead>
                              <TableHead>{t("table.class")}</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {request.items.map((item) => {
                              const remaining = Math.max(
                                0,
                                item.quantityRequested - item.quantityReleased,
                              );

                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div className="font-medium">
                                      {item.productVariant.product.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {item.productVariant.sku}
                                    </div>
                                  </TableCell>
                                  <TableCell>{item.quantityRequested}</TableCell>
                                  <TableCell>{item.quantityReleased}</TableCell>
                                  <TableCell>{remaining}</TableCell>
                                  <TableCell>
                                    {item.productVariant.product.inventoryItemClass}
                                    {item.productVariant.product.requiresAssetTag
                                      ? ` • ${t("table.tag")}`
                                      : ""}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {request.attachments.length > 0 ? (
                        <div className="rounded-md border p-3">
                          <div className="mb-2 text-sm font-medium">{t("labels.attachments")}</div>
                          <div className="space-y-1 text-sm">
                            {request.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex min-w-0 flex-wrap items-center gap-2"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="max-w-full truncate underline"
                                >
                                  {attachment.fileName}
                                </a>
                                {attachment.note ? (
                                  <span className="text-xs text-muted-foreground">
                                    ({attachment.note})
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label>{t("labels.workflowNote")}</Label>
                        <Input
                          value={actionNotes[request.id] || ""}
                          onChange={(event) =>
                            setActionNotes((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          placeholder={t("labels.workflowNotePlaceholder")}
                        />
                      </div>

                      <div className="grid gap-2 sm:flex sm:flex-wrap">
                        <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                          <Link href={`/admin/scm/material-requests/${request.id}`}>
                            {t("actions.openDetail")}
                          </Link>
                        </Button>

                        {canManage && request.status === "DRAFT" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => void runAction(request.id, "submit")}
                            disabled={saving}
                          >
                            {t("actions.submit")}
                          </Button>
                        ) : null}

                        {canSupervisorEndorse && request.status === "SUBMITTED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => void runAction(request.id, "endorse_supervisor")}
                            disabled={saving}
                          >
                            {t("actions.endorseSupervisor")}
                          </Button>
                        ) : null}

                        {canProjectManagerEndorse && request.status === "SUPERVISOR_ENDORSED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => void runAction(request.id, "endorse_project_manager")}
                            disabled={saving}
                          >
                            {t("actions.endorseProjectManager")}
                          </Button>
                        ) : null}

                        {canAdminApprove && request.status === "PROJECT_MANAGER_ENDORSED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => void runAction(request.id, "approve_admin")}
                            disabled={saving}
                          >
                            {t("actions.approveAdmin")}
                          </Button>
                        ) : null}

                        {canReject ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => void runAction(request.id, "reject")}
                            disabled={saving}
                          >
                            {t("actions.reject")}
                          </Button>
                        ) : null}

                        {canCancel ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full sm:w-auto"
                            onClick={() => void runAction(request.id, "cancel")}
                            disabled={saving}
                          >
                            {t("actions.cancel")}
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}