"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScmDocumentLifecycle } from "@/components/admin/scm/ScmDocumentLifecycle";
import { ScmNextStepPanel } from "@/components/admin/scm/ScmNextStepPanel";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type Verification = {
  id: number;
  status: "DRAFT" | "SUBMITTED" | "COMMITTEE_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  periodStart: string;
  periodEnd: string;
  note: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt?: string | null;
  warehouse: { id: number; name: string; code: string };
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  approvedBy?: { id: string; name: string | null; email: string | null } | null;
  committeeMembers: Array<{ id: number; user: { id: string; name: string | null; email: string | null } }>;
  lines: Array<{
    id: number;
    systemQty: number;
    countedQty: number;
    variance: number;
    note: string | null;
    productVariant: { id: number; sku: string; product: { id: number; name: string } };
    bin?: { id: number; code: string; name: string } | null;
  }>;
  approvalEvents: Array<{
    id: number;
    stage: string;
    decision: string;
    note: string | null;
    actedAt: string;
    actedBy?: { id: string; name: string | null; email: string | null } | null;
  }>;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || fallback);
  return payload as T;
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function toStageLabel(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function PhysicalVerificationDetailPage() {
  const tScm = useTranslations("ScmAuto");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const verificationId = Number(params?.id);
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("physical_verifications.manage");
  const canApprove = permissions.includes("physical_verifications.approve");

  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadVerification = async () => {
    if (!Number.isInteger(verificationId) || verificationId <= 0) {
      toast.error(tScm("k_5561cd089bdb"));
      router.replace("/admin/scm/physical-verifications");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/scm/physical-verifications/${verificationId}`, { cache: "no-store" });
      const data = await readJson<Verification>(response, "Failed to load verification");
      setVerification(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load verification");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadVerification(); }, [verificationId]);

  const actionButtons = useMemo(() => {
    if (!verification) return [] as Array<{ action: string; label: string }>;
    const buttons: Array<{ action: string; label: string }> = [];
    if (canManage && verification.status === "DRAFT") buttons.push({ action: "submit", label: tScm("k_2dacf6595984") });
    if (canApprove && verification.status === "SUBMITTED") buttons.push({ action: "committee_review", label: tScm("k_2fc4ec57da8f") });
    if (canApprove && verification.status === "COMMITTEE_REVIEW") {
      buttons.push({ action: "committee_approve", label: tScm("k_9b255cf13eb4") });
      buttons.push({ action: "committee_reject", label: tScm("k_f87e852d3816") });
    }
    if (canApprove && ["SUBMITTED", "COMMITTEE_REVIEW"].includes(verification.status)) {
      buttons.push({ action: "admin_approve", label: tScm("k_558e5096411f") });
      buttons.push({ action: "admin_reject", label: tScm("k_6a2c4155c365") });
    }
    if (canApprove && verification.status === "APPROVED") buttons.push({ action: "close", label: tScm("k_bbfa773e5a63") });
    return buttons;
  }, [verification, canManage, canApprove]);

  const lifecycleStages = useMemo(() => {
    if (!verification) return [];
    return [
      { key: "draft", label: tScm("k_23d33e22acfc"), value: verification.frequency, helperText: `Period ${new Date(verification.periodStart).toLocaleDateString()} to ${new Date(verification.periodEnd).toLocaleDateString()}`, href: `/admin/scm/physical-verifications/${verification.id}`, state: "linked" as const },
      { key: "committee", label: tScm("k_f43dba5677df"), value: verification.submittedAt ? "Submitted" : "Pending", helperText: verification.submittedAt ? formatDate(verification.submittedAt) : "Awaiting submission", href: null, state: verification.submittedAt ? ("linked" as const) : ("pending" as const) },
      { key: "approval", label: tScm("k_8cc047ac17d3"), value: verification.approvedAt ? "Approved" : verification.status === "REJECTED" ? "Rejected" : "Pending", helperText: verification.approvedAt ? formatDate(verification.approvedAt) : verification.status === "REJECTED" ? "Rejected in workflow" : "Awaiting approval", href: null, state: verification.approvedAt ? ("linked" as const) : verification.status === "REJECTED" ? ("blocked" as const) : ("pending" as const) },
      { key: "closure", label: tScm("k_84e77ec95c5a"), value: verification.status === "CLOSED" ? "Closed" : "Open", helperText: verification.status === "CLOSED" ? "Verification closed" : "Outstanding verification cycle", href: null, state: verification.status === "CLOSED" ? ("current" as const) : ("pending" as const) },
    ];
  }, [verification]);

  const runAction = async (action: string) => {
    if (!verification) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/scm/physical-verifications/${verification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJson(response, "Failed to update verification");
      toast.success(`Verification ${toStageLabel(action)} completed`);
      await loadVerification();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update verification");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6 p-6"><p className="text-sm text-muted-foreground">{tScm("k_23956b7135c6")}</p></div>;
  if (!verification) return <div className="space-y-6 p-6"><Button asChild variant="outline"><Link href="/admin/scm/physical-verifications"><ArrowLeft className="mr-2 h-4 w-4" />{tScm("k_1763e9ae8697")}</Link></Button><Card><CardContent className="py-10 text-sm text-muted-foreground">{tScm("k_1d80283da697")}</CardContent></Card></div>;

  const varianceCount = verification.lines.filter((line) => line.variance !== 0).length;
  const totalVariance = verification.lines.reduce((sum, line) => sum + line.variance, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><Button asChild variant="outline" size="sm"><Link href="/admin/scm/physical-verifications"><ArrowLeft className="mr-2 h-4 w-4" />{tScm("k_b52b36b7269f")}</Link></Button><ScmStatusChip status={verification.status} /></div>
          <div><h1 className="text-2xl font-bold">{tScm("k_803a61fadfb2")}{verification.id}</h1><p className="text-sm text-muted-foreground">{verification.warehouse.name} • {toStageLabel(verification.frequency)}</p></div>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadVerification()} disabled={loading || saving}><RefreshCw className="mr-2 h-4 w-4" />{tScm("k_56e3badc4e6c")}</Button>{actionButtons.map((button) => <Button key={button.action} variant={button.action.includes("reject") ? "outline" : "default"} onClick={() => void runAction(button.action)} disabled={saving}>{button.label}</Button>)}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_298dff72dae2")} value={verification.warehouse.name} hint={verification.warehouse.code} />
        <ScmStatCard label={tScm("k_037b9aea8a9b")} value={String(verification.lines.length)} hint={`${varianceCount} with variance`} />
        <ScmStatCard label={tScm("k_0b850bfcc939")} value={String(totalVariance)} hint={tScm("k_5c953f55e621")} />
        <ScmStatCard label={tScm("k_170a28a9db6d")} value={new Date(verification.periodStart).toLocaleDateString()} hint={`to ${new Date(verification.periodEnd).toLocaleDateString()}`} />
      </div>

      <ScmDocumentLifecycle stages={lifecycleStages} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="overview">{tScm("k_0efc2e6be4c2")}</TabsTrigger><TabsTrigger value="lines">{tScm("k_c6fd3870c86e")}</TabsTrigger><TabsTrigger value="workflow">{tScm("k_d7a484140f5f")}</TabsTrigger></TabsList>
            <TabsContent value="overview"><Card><CardHeader><CardTitle>{tScm("k_492f54810544")}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_89836a870e44")}</div><p className="mt-2 text-sm">{toStageLabel(verification.frequency)}</p></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_43de2bcd6337")}</div><p className="mt-2 text-sm">{verification.createdBy?.name || verification.createdBy?.email || "-"}</p></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_e08febf4aded")}</div><p className="mt-2 text-sm">{verification.committeeMembers.map((member) => member.user.name || member.user.email || member.user.id).join(", ") || "-"}</p></div><div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_2c924e308820")}</div><p className="mt-2 text-sm whitespace-pre-wrap">{verification.note || "-"}</p></div></CardContent></Card></TabsContent>
            <TabsContent value="lines"><Card><CardHeader><CardTitle>{tScm("k_037b9aea8a9b")}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>{tScm("k_ecdda59aea5e")}</TableHead><TableHead>{tScm("k_4c5ec7b06df2")}</TableHead><TableHead>{tScm("k_bc0792d8dc81")}</TableHead><TableHead>{tScm("k_319a2b6e851d")}</TableHead><TableHead>{tScm("k_eb39bbf6ccbb")}</TableHead></TableRow></TableHeader><TableBody>{verification.lines.map((line) => <TableRow key={line.id}><TableCell><div className="font-medium">{line.productVariant.product.name}</div><div className="text-xs text-muted-foreground">{line.productVariant.sku}</div></TableCell><TableCell>{line.bin ? `${line.bin.code} · ${line.bin.name}` : "N/A"}</TableCell><TableCell>{line.systemQty}</TableCell><TableCell>{line.countedQty}</TableCell><TableCell>{line.variance}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></TabsContent>
            <TabsContent value="workflow"><Card><CardHeader><CardTitle>{tScm("k_33f6a9385a4b")}</CardTitle></CardHeader><CardContent className="space-y-3">{verification.approvalEvents.map((event) => <div key={event.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium">{toStageLabel(event.stage)} • {toStageLabel(event.decision)}</div><div className="text-xs text-muted-foreground">{formatDate(event.actedAt)}</div></div><div className="mt-2 text-sm text-muted-foreground">{event.actedBy?.name || event.actedBy?.email || "System"}</div>{event.note ? <p className="mt-2 text-sm">{event.note}</p> : null}</div>)}</CardContent></Card></TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          <ScmNextStepPanel
            title={verification.status}
            subtitle={tScm("k_6fd6bd809099")}
            actions={actionButtons.map((button) => ({
              key: button.action,
              label: button.label,
              onClick: () => void runAction(button.action),
              disabled: saving,
              variant: button.action.includes("reject") ? "outline" : "default",
            }))}
            emptyMessage={tScm("k_ad90a4161999")}
          />
        </div>
      </div>
    </div>
  );
}
