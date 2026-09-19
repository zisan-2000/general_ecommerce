"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InvestorOption = {
  id: number;
  code: string;
  name: string;
};

type ScheduleRow = {
  id: number;
  investorId: number;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY";
  deliveryFormat: "CSV" | "PDF" | "BOTH";
  statementWindowDays: number;
  status: "ACTIVE" | "PAUSED";
  nextRunAt: string;
  lastRunAt: string | null;
  lastDispatchedAt: string | null;
  lastDispatchNote: string | null;
  investor: {
    id: number;
    code: string;
    name: string;
    status: string;
    hasActivePortalAccess: boolean;
  } | null;
};

function fmtDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

export default function InvestorStatementSchedulesPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    investorId: "",
    frequency: "MONTHLY",
    deliveryFormat: "PDF",
    statementWindowDays: "30",
    nextRunAt: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      const scheduleParams = new URLSearchParams();
      if (statusFilter) {
        scheduleParams.set("status", statusFilter);
      }
      if (dueOnly) {
        scheduleParams.set("dueOnly", "true");
      }

      const [investorRes, scheduleRes] = await Promise.all([
        fetch("/api/admin/investors", { cache: "no-store" }),
        fetch(
          `/api/admin/investor-statement-schedules${scheduleParams.size ? `?${scheduleParams.toString()}` : ""}`,
          { cache: "no-store" },
        ),
      ]);

      const investorPayload = await investorRes.json().catch(() => []);
      const schedulePayload = await scheduleRes.json().catch(() => ({}));

      if (!investorRes.ok) {
        throw new Error(t("errors.loadInvestors"));
      }
      if (!scheduleRes.ok) {
        throw new Error(t("errors.loadSchedules"));
      }

      setInvestors(
        (investorPayload as InvestorOption[]).map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
        })),
      );
      setRows((schedulePayload?.schedules || []) as ScheduleRow[]);
    } catch {
      toast.error(t("errors.loadSchedules"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dueOnly, statusFilter]);

  const dueCount = useMemo(
    () => rows.filter((item) => item.status === "ACTIVE" && new Date(item.nextRunAt) <= new Date()).length,
    [rows],
  );

  const createSchedule = async () => {
    try {
      const response = await fetch("/api/admin/investor-statement-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId: Number(form.investorId),
          frequency: form.frequency,
          deliveryFormat: form.deliveryFormat,
          statementWindowDays: Number(form.statementWindowDays),
          nextRunAt: form.nextRunAt || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(t("errors.createSchedule"));
      }
      toast.success(t("success.scheduleCreated"));
      setForm((current) => ({
        ...current,
        investorId: "",
        nextRunAt: "",
      }));
      await load();
    } catch {
      toast.error(t("errors.createSchedule"));
    }
  };

  const processAction = async (id: number, action: "pause" | "resume" | "run-now") => {
    try {
      setActingId(id);
      const response = await fetch(`/api/admin/investor-statement-schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(t("errors.scheduleAction"));
      }
      toast.success(
        action === "run-now"
          ? t("success.scheduleDispatched")
          : action === "pause"
            ? t("success.schedulePaused")
            : t("success.scheduleResumed"),
      );
      await load();
    } catch {
      toast.error(t("errors.scheduleAction"));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <InvestorWorkflowGuide currentSection="statement-schedules" />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("schedules.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("schedules.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("schedules.active")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{rows.filter((item) => item.status === "ACTIVE").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("schedules.dueNow")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{dueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("schedules.portalReady")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{rows.filter((item) => item.investor?.hasActivePortalAccess).length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("schedules.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="schedule-investor">{t("common.investor")}</Label>
              <select
                id="schedule-investor"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.investorId}
                onChange={(event) => setForm((current) => ({ ...current, investorId: event.target.value }))}
              >
                <option value="">{t("common.selectInvestor")}</option>
                {investors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-frequency">{t("schedules.frequency")}</Label>
              <select
                id="schedule-frequency"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.frequency}
                onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}
              >
                <option value="WEEKLY">{t("enums.frequencies.WEEKLY")}</option>
                <option value="MONTHLY">{t("enums.frequencies.MONTHLY")}</option>
                <option value="QUARTERLY">{t("enums.frequencies.QUARTERLY")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-format">{t("schedules.format")}</Label>
              <select
                id="schedule-format"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.deliveryFormat}
                onChange={(event) => setForm((current) => ({ ...current, deliveryFormat: event.target.value }))}
              >
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
                <option value="BOTH">{t("enums.deliveryFormats.BOTH")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-window">{t("schedules.windowDays")}</Label>
              <Input
                id="schedule-window"
                value={form.statementWindowDays}
                onChange={(event) =>
                  setForm((current) => ({ ...current, statementWindowDays: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[240px,auto]">
            <div className="space-y-2">
              <Label htmlFor="schedule-next-run">{t("schedules.firstRunAt")}</Label>
              <Input
                id="schedule-next-run"
                type="datetime-local"
                value={form.nextRunAt}
                onChange={(event) => setForm((current) => ({ ...current, nextRunAt: event.target.value }))}
              />
            </div>
            <div className="flex items-end justify-end">
              <Button onClick={() => void createSchedule()} disabled={!form.investorId}>
                {t("schedules.create")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("schedules.queue")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="status-filter">{t("common.status")}</Label>
              <select
                id="status-filter"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">{t("common.allStatuses")}</option>
                <option value="ACTIVE">{t("enums.scheduleStatuses.ACTIVE")}</option>
                <option value="PAUSED">{t("enums.scheduleStatuses.PAUSED")}</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant={dueOnly ? "default" : "outline"} onClick={() => setDueOnly((current) => !current)}>
                {dueOnly ? t("schedules.showingDueOnly") : t("schedules.dueOnly")}
              </Button>
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                {t("common.refresh")}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.investor")}</TableHead>
                  <TableHead>{t("schedules.frequency")}</TableHead>
                  <TableHead>{t("schedules.format")}</TableHead>
                  <TableHead>{t("schedules.window")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("schedules.nextRun")}</TableHead>
                  <TableHead>{t("schedules.lastDispatch")}</TableHead>
                  <TableHead>{t("schedules.portal")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const due = item.status === "ACTIVE" && new Date(item.nextRunAt) <= new Date();
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.investor ? (
                          <Link href={`/admin/investors/${item.investor.id}`} className="hover:text-primary">
                            {item.investor.name} ({item.investor.code})
                          </Link>
                        ) : (
                          t("common.unknownInvestor")
                        )}
                      </TableCell>
                      <TableCell>{t(`enums.frequencies.${item.frequency}` as any)}</TableCell>
                      <TableCell>{item.deliveryFormat === "BOTH" ? t("enums.deliveryFormats.BOTH") : item.deliveryFormat}</TableCell>
                      <TableCell>{t("schedules.days", { count: item.statementWindowDays })}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {t(`enums.scheduleStatuses.${item.status}` as any)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>{fmtDate(item.nextRunAt, locale)}</div>
                        {due ? <div className="text-xs text-amber-700">{t("schedules.dueNow")}</div> : null}
                      </TableCell>
                      <TableCell>{fmtDate(item.lastDispatchedAt, locale)}</TableCell>
                      <TableCell>{item.investor?.hasActivePortalAccess ? t("common.ready") : t("common.missing")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.status === "ACTIVE" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void processAction(item.id, "pause")}
                              disabled={actingId === item.id}
                            >
                              {t("common.pause")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void processAction(item.id, "resume")}
                              disabled={actingId === item.id}
                            >
                              {t("common.resume")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => void processAction(item.id, "run-now")}
                            disabled={actingId === item.id || item.status !== "ACTIVE"}
                          >
                            {t("schedules.runNow")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      {t("schedules.empty")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
