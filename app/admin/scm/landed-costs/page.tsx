"use client";

import { useTranslations } from "next-intl";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type PurchaseOrderOption = {
  id: number;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedAt: string | null;
  currency: string;
  supplier: {
    id: number;
    name: string;
    code: string;
  };
  warehouse: {
    id: number;
    name: string;
    code: string;
  };
};

type SelectedPurchaseOrder = {
  id: number;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedAt: string | null;
  currency: string;
  supplier: {
    id: number;
    name: string;
    code: string;
  };
  warehouse: {
    id: number;
    name: string;
    code: string;
  };
  locked: boolean;
  lockReason: string | null;
  totals: {
    baseSubtotal: string;
    landedTotal: string;
    effectiveSubtotal: string;
  };
  landedCosts: Array<{
    id: number;
    component: string;
    amount: string;
    currency: string;
    note: string | null;
    incurredAt: string;
    createdAt: string;
    createdBy: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  }>;
  allocationLines: Array<{
    purchaseOrderItemId: number;
    variantId: number | null;
    sku: string;
    productName: string;
    quantityOrdered: number;
    baseUnitCost: string;
    landedPerUnit: string;
    effectiveUnitCost: string;
    baseLineTotal: string;
    landedAllocationTotal: string;
    effectiveLineTotal: string;
  }>;
};

type WorkspaceResponse = {
  purchaseOrders: PurchaseOrderOption[];
  selectedPurchaseOrder: SelectedPurchaseOrder | null;
};

const COMPONENT_OPTIONS = [
  "FREIGHT",
  "CUSTOMS",
  "HANDLING",
  "INSURANCE",
  "CLEARING",
  "OTHER",
] as const;

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2);
}

function formatComponent(component: string) {
  return component
    .split("_")
    .map((token) => token.charAt(0) + token.slice(1).toLowerCase())
    .join(" ");
}

export default function LandedCostsPage() {
  const tScm = useTranslations("ScmAuto");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("landed_costs.manage");

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<number | null>(
    null,
  );
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
    useState<SelectedPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [component, setComponent] = useState<(typeof COMPONENT_OPTIONS)[number]>(
    "FREIGHT",
  );
  const [amount, setAmount] = useState("");
  const [incurredAt, setIncurredAt] = useState("");
  const [note, setNote] = useState("");

  const loadWorkspace = async (purchaseOrderId?: number | null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (purchaseOrderId && purchaseOrderId > 0) {
        params.set("purchaseOrderId", String(purchaseOrderId));
      }
      const response = await fetch(
        `/api/scm/landed-costs${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const data = await readJson<WorkspaceResponse>(
        response,
        "Failed to load landed cost workspace",
      );
      setPurchaseOrders(Array.isArray(data.purchaseOrders) ? data.purchaseOrders : []);
      setSelectedPurchaseOrder(data.selectedPurchaseOrder || null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load landed costs");
      setSelectedPurchaseOrder(null);
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace(selectedPurchaseOrderId);
  }, [selectedPurchaseOrderId]);

  useEffect(() => {
    if (selectedPurchaseOrderId !== null) return;
    if (purchaseOrders.length === 0) return;
    setSelectedPurchaseOrderId(purchaseOrders[0].id);
  }, [purchaseOrders, selectedPurchaseOrderId]);

  const canEditCurrent = useMemo(() => {
    if (!canManage) return false;
    if (!selectedPurchaseOrder) return false;
    return !selectedPurchaseOrder.locked;
  }, [canManage, selectedPurchaseOrder]);

  const clearForm = () => {
    setComponent("FREIGHT");
    setAmount("");
    setIncurredAt("");
    setNote("");
  };

  const createLandedCost = async () => {
    if (!selectedPurchaseOrderId) {
      toast.error(tScm("k_066571655f0f"));
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error(tScm("k_11d766c549fb"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/scm/landed-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: selectedPurchaseOrderId,
          component,
          amount: Number(amount),
          incurredAt: incurredAt || null,
          note,
        }),
      });
      await readJson(response, "Failed to create landed cost");
      toast.success(tScm("k_a5d21ba536b4"));
      clearForm();
      await loadWorkspace(selectedPurchaseOrderId);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create landed cost");
    } finally {
      setSaving(false);
    }
  };

  const deleteLandedCost = async (landedCostId: number) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/scm/landed-costs/${landedCostId}`, {
        method: "DELETE",
      });
      await readJson(response, "Failed to delete landed cost");
      toast.success(tScm("k_2aa1d8f4f84c"));
      await loadWorkspace(selectedPurchaseOrderId);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete landed cost");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tScm("k_e61f23a1f3b7")}</h1>
          <p className="text-sm text-muted-foreground">
            {tScm("k_346425877b4f")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadWorkspace(selectedPurchaseOrderId)}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {tScm("k_56e3badc4e6c")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_e9116a67c5dd")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{tScm("k_3c45b957fdc8")}</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={selectedPurchaseOrderId ?? ""}
                onChange={(event) =>
                  setSelectedPurchaseOrderId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">{tScm("k_7f6382a08038")}</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} - {po.supplier.name} - {po.warehouse.code} ({po.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedPurchaseOrder ? (
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading workspace..."
                : "Select a purchase order to manage landed costs."}
            </p>
          ) : (
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <div className="font-medium">
                {selectedPurchaseOrder.poNumber} - {selectedPurchaseOrder.supplier.name} -{" "}
                {selectedPurchaseOrder.warehouse.name}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  {tScm("k_73e770a21e40")}{" "}
                  <span className="font-medium">
                    {formatMoney(selectedPurchaseOrder.totals.baseSubtotal)}{" "}
                    {selectedPurchaseOrder.currency}
                  </span>
                </div>
                <div>
                  {tScm("k_629b9d7e8dfd")}{" "}
                  <span className="font-medium">
                    {formatMoney(selectedPurchaseOrder.totals.landedTotal)}{" "}
                    {selectedPurchaseOrder.currency}
                  </span>
                </div>
                <div>
                  {tScm("k_e952644d83b5")}{" "}
                  <span className="font-medium">
                    {formatMoney(selectedPurchaseOrder.totals.effectiveSubtotal)}{" "}
                    {selectedPurchaseOrder.currency}
                  </span>
                </div>
              </div>
              {selectedPurchaseOrder.lockReason ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-300">
                  {selectedPurchaseOrder.lockReason}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPurchaseOrder ? (
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_d3edfe945595")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>{tScm("k_c92c529e0731")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={component}
                  onChange={(event) =>
                    setComponent(event.target.value as (typeof COMPONENT_OPTIONS)[number])
                  }
                  disabled={!canEditCurrent || saving}
                >
                  {COMPONENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatComponent(option)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{tScm("k_52b139c9d30c")}{selectedPurchaseOrder.currency})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={!canEditCurrent || saving}
                />
              </div>
              <div>
                <Label>{tScm("k_e5b8ba6ba688")}</Label>
                <Input
                  type="datetime-local"
                  value={incurredAt}
                  onChange={(event) => setIncurredAt(event.target.value)}
                  disabled={!canEditCurrent || saving}
                />
              </div>
              <div>
                <Label>{tScm("k_2c924e308820")}</Label>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={1}
                  disabled={!canEditCurrent || saving}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void createLandedCost()}
                disabled={!canEditCurrent || saving}
              >
                {tScm("k_186ea6166538")}
              </Button>
              <Button
                variant="outline"
                onClick={clearForm}
                disabled={!canEditCurrent || saving}
              >
                {tScm("k_719ea396ad92")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selectedPurchaseOrder ? (
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_be223e0b2e52")}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPurchaseOrder.landedCosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tScm("k_b7cace9129dd")}</p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {selectedPurchaseOrder.landedCosts.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="break-words font-medium">
                            {formatComponent(row.component)}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {formatMoney(row.amount)} {row.currency}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => void deleteLandedCost(row.id)}
                          disabled={!canEditCurrent || saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_92eff367b4b1")}
                          </div>
                          <div className="mt-1 break-words font-medium">
                            {new Date(row.incurredAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_43de2bcd6337")}
                          </div>
                          <div className="mt-1 break-words font-medium">
                            {row.createdBy?.name || row.createdBy?.email || "N/A"}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm sm:col-span-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_2c924e308820")}
                          </div>
                          <div className="mt-1 break-words font-medium">
                            {row.note || "N/A"}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={() => void deleteLandedCost(row.id)}
                        disabled={!canEditCurrent || saving}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {tScm("k_e963907dac5c")}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_c92c529e0731")}</TableHead>
                        <TableHead>{tScm("k_43dc8532f7e5")}</TableHead>
                        <TableHead>{tScm("k_92eff367b4b1")}</TableHead>
                        <TableHead>{tScm("k_2c924e308820")}</TableHead>
                        <TableHead>{tScm("k_43de2bcd6337")}</TableHead>
                        <TableHead className="text-right">{tScm("k_97c89a4d6630")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchaseOrder.landedCosts.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatComponent(row.component)}</TableCell>
                          <TableCell>
                            {formatMoney(row.amount)} {row.currency}
                          </TableCell>
                          <TableCell>
                            {new Date(row.incurredAt).toLocaleString()}
                          </TableCell>
                          <TableCell>{row.note || "N/A"}</TableCell>
                          <TableCell>
                            {row.createdBy?.name || row.createdBy?.email || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void deleteLandedCost(row.id)}
                              disabled={!canEditCurrent || saving}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tScm("k_e963907dac5c")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedPurchaseOrder ? (
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_f37b845ff970")}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPurchaseOrder.allocationLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tScm("k_4a301ceefc28")}</p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {selectedPurchaseOrder.allocationLines.map((line) => (
                    <div key={line.purchaseOrderItemId} className="rounded-lg border p-4">
                      <div className="min-w-0">
                        <div className="break-words font-medium">{line.productName}</div>
                        <div className="text-xs text-muted-foreground">{line.sku}</div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_1e5ff9e500c2")}
                          </div>
                          <div className="mt-1 font-medium">{line.quantityOrdered}</div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_f1e3347bd968")}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatMoney(line.baseUnitCost)}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_fc3178c44274")}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatMoney(line.landedPerUnit)}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_ee50338ff976")}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatMoney(line.effectiveUnitCost)}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_25925b541d6f")}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatMoney(line.baseLineTotal)}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_677213c0aa75")}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatMoney(line.landedAllocationTotal)}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/30 p-3 text-sm sm:col-span-2">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {tScm("k_6b917eca0aef")}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatMoney(line.effectiveLineTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                        <TableHead>{tScm("k_1e5ff9e500c2")}</TableHead>
                        <TableHead>{tScm("k_f1e3347bd968")}</TableHead>
                        <TableHead>{tScm("k_fc3178c44274")}</TableHead>
                        <TableHead>{tScm("k_ee50338ff976")}</TableHead>
                        <TableHead>{tScm("k_25925b541d6f")}</TableHead>
                        <TableHead>{tScm("k_677213c0aa75")}</TableHead>
                        <TableHead>{tScm("k_6b917eca0aef")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchaseOrder.allocationLines.map((line) => (
                        <TableRow key={line.purchaseOrderItemId}>
                          <TableCell className="min-w-[220px]">
                            <div className="font-medium">{line.productName}</div>
                            <div className="text-xs text-muted-foreground">{line.sku}</div>
                          </TableCell>
                          <TableCell>{line.quantityOrdered}</TableCell>
                          <TableCell>{formatMoney(line.baseUnitCost)}</TableCell>
                          <TableCell>{formatMoney(line.landedPerUnit)}</TableCell>
                          <TableCell>{formatMoney(line.effectiveUnitCost)}</TableCell>
                          <TableCell>{formatMoney(line.baseLineTotal)}</TableCell>
                          <TableCell>{formatMoney(line.landedAllocationTotal)}</TableCell>
                          <TableCell>{formatMoney(line.effectiveLineTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
