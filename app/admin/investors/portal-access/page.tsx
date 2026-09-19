"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorWorkflowGuide } from "@/components/investors/InvestorWorkflowGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type InvestorOption = {
  id: number;
  code: string;
  name: string;
  status: string;
  kycStatus: string;
};

type UserOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  investorPortalAccess: {
    id: string;
    investorId: number;
    status: string;
  } | null;
};

type AccessRecord = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  note: string | null;
  createdAt: string;
  updatedAt: string;
  investor: InvestorOption;
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
  investors: InvestorOption[];
  users: UserOption[];
};

function fmtDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale);
}

export default function InvestorPortalAccessPage() {
  const t = useTranslations("AdminInvestors.pages");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "REVOKED">("ACTIVE");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      const response = await fetch(
        `/api/admin/investor-portal-access${params.size > 0 ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.loadPortalAccess"));
      }
      const data = payload as AccessPayload;
      setRecords(Array.isArray(data.records) ? data.records : []);
      setInvestors(Array.isArray(data.investors) ? data.investors : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      toast.error(t("errors.loadPortalAccess"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [query]);

  const availableUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!editingId) return !user.investorPortalAccess;
        if (!user.investorPortalAccess) return true;
        if (user.id === selectedUserId) return true;
        return user.investorPortalAccess.id === editingId;
      }),
    [editingId, selectedUserId, users],
  );

  const resetForm = () => {
    setEditingId(null);
    setSelectedUserId("");
    setSelectedInvestorId("");
    setStatus("ACTIVE");
    setNote("");
  };

  const startEdit = (record: AccessRecord) => {
    setEditingId(record.id);
    setSelectedUserId(record.user.id);
    setSelectedInvestorId(String(record.investor.id));
    setStatus(record.status);
    setNote(record.note ?? "");
  };

  const saveRecord = async () => {
    if (!selectedUserId || !selectedInvestorId) {
      toast.error(t("errors.portalAccessRequired"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/admin/investor-portal-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          userId: selectedUserId,
          investorId: Number(selectedInvestorId),
          status,
          note,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(t("errors.savePortalAccess"));
      }
      toast.success(editingId ? t("success.accessUpdated") : t("success.accessCreated"));
      resetForm();
      await loadData();
    } catch {
      toast.error(t("errors.savePortalAccess"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <InvestorWorkflowGuide currentSection="portal-access" />

      <div>
        <h1 className="text-2xl font-bold">{t("portalAccess.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("portalAccess.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? t("portalAccess.editTitle") : t("portalAccess.createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("common.user")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="">{t("common.selectUser")}</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || t("common.unnamed")} ({user.email || t("common.noEmail")})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{t("common.investor")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedInvestorId}
                onChange={(event) => setSelectedInvestorId(event.target.value)}
              >
                <option value="">{t("common.selectInvestor")}</option>
                {investors.map((investor) => (
                  <option key={investor.id} value={investor.id}>
                    {investor.name} ({investor.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("common.status")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "ACTIVE" | "SUSPENDED" | "REVOKED")
                }
              >
                <option value="ACTIVE">{t("enums.accessStatuses.ACTIVE")}</option>
                <option value="SUSPENDED">{t("enums.accessStatuses.SUSPENDED")}</option>
                <option value="REVOKED">{t("enums.accessStatuses.REVOKED")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("common.note")}</Label>
            <Textarea
              placeholder={t("portalAccess.notePlaceholder")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveRecord()} disabled={saving}>
              {saving ? t("common.saving") : editingId ? t("portalAccess.update") : t("portalAccess.create")}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                {t("common.cancelEdit")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("portalAccess.registry")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder={t("portalAccess.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-md"
            />
            <Button variant="outline" onClick={() => void loadData()}>
              {t("common.refresh")}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portalAccess.empty")}</p>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div key={record.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {record.user.name || t("common.unnamedUser")} ({record.user.email || t("common.noEmail")})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("portalAccess.investorValue", { investor: `${record.investor.name} (${record.investor.code})` })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={record.status === "ACTIVE" ? "default" : "outline"}>
                        {t(`enums.accessStatuses.${record.status}` as any)}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => startEdit(record)}>
                        {t("common.edit")}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("portalAccess.auditLine", { updated: fmtDate(record.updatedAt, locale), creator: record.createdBy?.email || "—" })}
                  </p>
                  {record.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t("common.noteValue", { note: record.note })}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
