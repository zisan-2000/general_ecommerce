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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScmDocumentLifecycle } from "@/components/admin/scm/ScmDocumentLifecycle";
import { ScmNextStepPanel } from "@/components/admin/scm/ScmNextStepPanel";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type WarehouseTransfer = {
  id: number;
  transferNumber: string;
  status: string;
  requestedAt: string;
  requiredBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  note: string | null;
  sourceWarehouse: { id: number; name: string; code: string };
  destinationWarehouse: { id: number; name: string; code: string };
  createdBy?: { id: string; name: string | null; email: string } | null;
  approvedBy?: { id: string; name: string | null; email: string } | null;
  dispatchedBy?: { id: string; name: string | null; email: string } | null;
  receivedBy?: { id: string; name: string | null; email: string } | null;
  items: Array<{
    id: number;
    quantityRequested: number;
    quantityDispatched: number;
    quantityReceived: number;
    description: string | null;
    productVariant: {
      id: number;
      sku: string;
      stock?: number;
      product: { id: number; name: string };
      stockLevels?: Array<{
        warehouseId: number;
        quantity: number;
        reserved: number;
      }>;
    };
  }>;
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

function fmtDate(value?: string | null) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
}

function toStageLabel(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function WarehouseTransferDetailPage() {
  const tScm = useTranslations("ScmAuto");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const warehouseTransferId = Number(params?.id);
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("warehouse_transfers.manage");
  const canApprove = permissions.includes("warehouse_transfers.approve");

  const [transfer, setTransfer] = useState<WarehouseTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTransfer = async () => {
    if (!Number.isInteger(warehouseTransferId) || warehouseTransferId <= 0) {
      toast.error(tScm("k_3ab01ddaf1ef"));
      router.replace("/admin/scm/warehouse-transfers");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/scm/warehouse-transfers/${warehouseTransferId}`, {
        cache: "no-store",
      });
      const data = await readJson<WarehouseTransfer>(response, "Failed to load warehouse transfer");
      setTransfer(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load warehouse transfer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransfer();
  }, [warehouseTransferId]);

  const actionButtons = useMemo(() => {
    if (!transfer) return [] as Array<{ action: string; label: string }>;
    const buttons: Array<{ action: string; label: string }> = [];
    if (canManage && transfer.status === "DRAFT") {
      buttons.push({ action: "submit", label: tScm("k_2dacf6595984") });
    }
    if (canApprove && transfer.status === "SUBMITTED") {
      buttons.push({ action: "approve", label: tScm("k_7b2c7f146aba") });
    }
    if (canManage && ["APPROVED", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(transfer.status)) {
      buttons.push({ action: "dispatch", label: tScm("k_840e1b364a32") });
    }
    if (canManage && ["DISPATCHED", "PARTIALLY_DISPATCHED", "PARTIALLY_RECEIVED"].includes(transfer.status)) {
      buttons.push({ action: "receive", label: tScm("k_965fb2ddf63d") });
    }
    if ((canManage || canApprove) && ["DRAFT", "SUBMITTED", "APPROVED"].includes(transfer.status)) {
      buttons.push({ action: "cancel", label: tScm("k_77dfd2135f4d") });
    }
    return buttons;
  }, [transfer, canManage, canApprove]);

  const lifecycleStages = useMemo(() => {
    if (!transfer) return [];
    return [
      {
        key: "requested",
        label: tScm("k_c26bf60fed37"),
        value: fmtDate(transfer.requestedAt),
        helperText: tScm("k_3e3346550053"),
        href: `/admin/scm/warehouse-transfers/${transfer.id}`,
        state: "linked" as const,
      },
      {
        key: "approved",
        label: tScm("k_41b81eb8db1b"),
        value: transfer.approvedAt ? fmtDate(transfer.approvedAt) : "Pending",
        helperText: transfer.approvedAt ? "Approval complete" : "Awaiting approval",
        href: null,
        state: transfer.approvedAt ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "dispatch",
        label: tScm("k_840e1b364a32"),
        value: transfer.dispatchedAt ? fmtDate(transfer.dispatchedAt) : "Pending",
        helperText: transfer.dispatchedAt ? "Stock moved out" : "Awaiting source dispatch",
        href: null,
        state: transfer.dispatchedAt ? ("linked" as const) : ("pending" as const),
      },
      {
        key: "receipt",
        label: tScm("k_f6ce3b6fcfca"),
        value: transfer.receivedAt ? fmtDate(transfer.receivedAt) : "Pending",
        helperText: transfer.receivedAt ? "Destination received" : "Awaiting receipt confirmation",
        href: null,
        state: transfer.receivedAt ? ("linked" as const) : ("pending" as const),
      },
    ];
  }, [transfer]);

  const runAction = async (action: string) => {
    if (!transfer) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/scm/warehouse-transfers/${transfer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await readJson(response, `Failed to ${action} warehouse transfer`);
      toast.success(`Warehouse transfer ${toStageLabel(action)} completed`);
      await loadTransfer();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${action} warehouse transfer`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-6 p-6"><p className="text-sm text-muted-foreground">{tScm("k_3663f66663df")}</p></div>;
  }

  if (!transfer) {
    return (
      <div className="space-y-6 p-6">
        <Button asChild variant="outline">
          <Link href="/admin/scm/warehouse-transfers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tScm("k_1763e9ae8697")}
          </Link>
        </Button>
        <Card><CardContent className="py-10 text-sm text-muted-foreground">{tScm("k_74fb560bf8cf")}</CardContent></Card>
      </div>
    );
  }

  const requested = transfer.items.reduce((sum, item) => sum + item.quantityRequested, 0);
  const dispatched = transfer.items.reduce((sum, item) => sum + item.quantityDispatched, 0);
  const received = transfer.items.reduce((sum, item) => sum + item.quantityReceived, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/scm/warehouse-transfers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tScm("k_b52b36b7269f")}
              </Link>
            </Button>
            <ScmStatusChip status={transfer.status} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{transfer.transferNumber}</h1>
            <p className="text-sm text-muted-foreground">{transfer.sourceWarehouse.name} {tScm("k_4374aaee247f")} {transfer.destinationWarehouse.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadTransfer()} disabled={loading || saving}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {tScm("k_56e3badc4e6c")}
          </Button>
          {actionButtons.map((button) => (
            <Button key={button.action} variant={button.action === "cancel" ? "outline" : "default"} onClick={() => void runAction(button.action)} disabled={saving}>
              {button.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_c26bf60fed37")} value={String(requested)} hint={`${transfer.items.length} lines`} />
        <ScmStatCard label={tScm("k_ff07201ae2e7")} value={String(dispatched)} hint={`Remaining ${Math.max(0, requested - dispatched)}`} />
        <ScmStatCard label={tScm("k_27548c4fc95d")} value={String(received)} hint={`In transit ${Math.max(0, dispatched - received)}`} />
        <ScmStatCard label={tScm("k_0d9626e5ac5f")} value={transfer.requiredBy ? new Date(transfer.requiredBy).toLocaleDateString() : "-"} hint={`Raised ${new Date(transfer.requestedAt).toLocaleDateString()}`} />
      </div>

      <ScmDocumentLifecycle stages={lifecycleStages} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">{tScm("k_0efc2e6be4c2")}</TabsTrigger>
              <TabsTrigger value="items">{tScm("k_44d25b5d1b6d")}</TabsTrigger>
              <TabsTrigger value="timeline">{tScm("k_018514a3d58a")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader><CardTitle>{tScm("k_84fc431f66c4")}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_8b4bc74e600f")}</div><p className="mt-2 text-sm">{transfer.sourceWarehouse.name} ({transfer.sourceWarehouse.code})</p></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_b04156809d3f")}</div><p className="mt-2 text-sm">{transfer.destinationWarehouse.name} ({transfer.destinationWarehouse.code})</p></div>
                  <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_2c924e308820")}</div><p className="mt-2 text-sm whitespace-pre-wrap">{transfer.note || "-"}</p></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items">
              <Card>
                <CardHeader><CardTitle>{tScm("k_4dfc24a609dc")}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                        <TableHead>{tScm("k_c26bf60fed37")}</TableHead>
                        <TableHead>{tScm("k_ff07201ae2e7")}</TableHead>
                        <TableHead>{tScm("k_27548c4fc95d")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfer.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.productVariant.product.name}</div>
                            <div className="text-xs text-muted-foreground">{item.productVariant.sku}</div>
                            {item.description ? <div className="text-xs text-muted-foreground">{item.description}</div> : null}
                          </TableCell>
                          <TableCell>{item.quantityRequested}</TableCell>
                          <TableCell>{item.quantityDispatched}</TableCell>
                          <TableCell>{item.quantityReceived}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader><CardTitle>{tScm("k_a997f30b5e69")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: tScm("k_c26bf60fed37"), value: fmtDate(transfer.requestedAt) },
                    { label: tScm("k_2e00359b9802"), value: fmtDate(transfer.submittedAt) },
                    { label: tScm("k_41b81eb8db1b"), value: fmtDate(transfer.approvedAt) },
                    { label: tScm("k_ff07201ae2e7"), value: fmtDate(transfer.dispatchedAt) },
                    { label: tScm("k_27548c4fc95d"), value: fmtDate(transfer.receivedAt) },
                  ].map((step) => (
                    <div key={step.label} className="rounded-lg border p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{step.label}</div>
                      <div className="mt-2 text-sm font-medium">{step.value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{tScm("k_b37554f695b1")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_43de2bcd6337")}</div><div className="mt-1">{transfer.createdBy?.name || transfer.createdBy?.email || "-"}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_2b62a43b5586")}</div><div className="mt-1">{transfer.approvedBy?.name || transfer.approvedBy?.email || "-"}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_434385ecbffd")}</div><div className="mt-1">{transfer.dispatchedBy?.name || transfer.dispatchedBy?.email || "-"}</div></div>
              <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_f84f73c618d9")}</div><div className="mt-1">{transfer.receivedBy?.name || transfer.receivedBy?.email || "-"}</div></div>
            </CardContent>
          </Card>

          <ScmNextStepPanel
            title={transfer.status}
            subtitle={tScm("k_0844d6e7205d")}
            actions={actionButtons.map((button) => ({
              key: button.action,
              label: button.label,
              onClick: () => void runAction(button.action),
              disabled: saving,
              variant: button.action === "cancel" ? "outline" : "default",
            }))}
            emptyMessage={tScm("k_ad90a4161999")}
          />
        </div>
      </div>
    </div>
  );
}
