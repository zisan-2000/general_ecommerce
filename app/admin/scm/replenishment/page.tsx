"use client";


import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import Pagination from "@/components/admin/scm/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Package, ShoppingCart, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type ProductVariant = {
  id: number;
  sku: string;
  lowStockThreshold: number;
  product: {
    id: number;
    name: string;
  };
};

type Rule = {
  id: number;
  warehouseId: number;
  productVariantId: number;
  strategy: "MIN_MAX" | "REORDER_POINT";
  reorderPoint: number;
  targetStockLevel: number;
  safetyStock: number;
  minOrderQty: number;
  orderMultiple: number;
  leadTimeDays: number | null;
  isActive: boolean;
  note: string | null;
  warehouse: Warehouse;
  productVariant: ProductVariant;
};

type Suggestion = {
  ruleId: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  productVariantId: number;
  productId: number;
  productName: string;
  sku: string;
  strategy: "MIN_MAX" | "REORDER_POINT";
  availableQty: number;
  onHandQty: number;
  reservedQty: number;
  reorderPoint: number;
  targetStockLevel: number;
  safetyStock: number;
  shortageQty: number;
  transferQty: number;
  purchaseQty: number;
  recommendedAction: "NONE" | "PURCHASE" | "TRANSFER" | "HYBRID";
  leadTimeDays: number | null;
  minOrderQty: number;
  orderMultiple: number;
  triggered: boolean;
  sourceWarehouse: {
    id: number;
    name: string;
    code: string;
    transferableQty: number;
  } | null;
};

const defaultForm = {
  ruleId: "",
  warehouseId: "",
  productVariantId: "",
  strategy: "MIN_MAX",
  reorderPoint: "10",
  targetStockLevel: "30",
  safetyStock: "0",
  minOrderQty: "1",
  orderMultiple: "1",
  leadTimeDays: "",
  isActive: true,
  note: "",
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

export default function ReplenishmentPlanningPage() {
  const tScm = useTranslations("ScmAuto");
  const t = useTranslations("AdminReplenishment");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.some((permission) =>
    ["replenishment.read", "replenishment.manage"].includes(permission),
  );
  const canManage = permissions.includes("replenishment.manage");
  const canCreateRequisition =
    permissions.includes("replenishment.manage") &&
    permissions.includes("purchase_requisitions.manage");
  const canCreateTransfer =
    permissions.includes("replenishment.manage") &&
    permissions.includes("warehouse_transfers.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ruleForm, setRuleForm] = useState(defaultForm);
  const [warehouseFilter, setWarehouseFilter] = useState(
    searchParams.get("warehouseId") || "",
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [neededBy, setNeededBy] = useState("");
  const [requisitionNote, setRequisitionNote] = useState("");
  const [selectedRuleIds, setSelectedRuleIds] = useState<number[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [rulesCurrentPage, setRulesCurrentPage] = useState(1);
  const [suggestionsCurrentPage, setSuggestionsCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async (warehouseId?: string) => {
    setLoading(true);
    try {
      const suffix =
        warehouseId && Number(warehouseId) > 0 ? `?warehouseId=${warehouseId}` : "";
      const [warehouseData, variantData, ruleData, suggestionData] = await Promise.all([
        fetch("/api/warehouses", { cache: "no-store" }).then((response) =>
          readJson<Warehouse[]>(response, t("errors.loadWarehouses")),
        ),
        fetch("/api/product-variants", { cache: "no-store" }).then((response) =>
          readJson<ProductVariant[]>(response, t("errors.loadVariants")),
        ),
        fetch(
          `/api/scm/replenishment/rules?includeInactive=1${suffix ? `&warehouseId=${warehouseId}` : ""}`,
          { cache: "no-store" },
        ).then((response) =>
          readJson<Rule[]>(response, t("errors.loadRules")),
        ),
        fetch(`/api/scm/replenishment/suggestions${suffix}`, {
          cache: "no-store",
        }).then((response) =>
          readJson<Suggestion[]>(response, t("errors.loadSuggestions")),
        ),
      ]);

      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setVariants(Array.isArray(variantData) ? variantData : []);
      setRules(Array.isArray(ruleData) ? ruleData : []);
      setSuggestions(Array.isArray(suggestionData) ? suggestionData : []);
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadData"));
      setRules([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData(warehouseFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, warehouseFilter]);

  useEffect(() => {
    setWarehouseFilter(searchParams.get("warehouseId") || "");
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    setRulesCurrentPage(1);
  }, [search, warehouseFilter]);

  useEffect(() => {
    setSuggestionsCurrentPage(1);
  }, [search, warehouseFilter]);

  const selectedVariant = useMemo(
    () =>
      variants.find((variant) => variant.id === Number(ruleForm.productVariantId)) ?? null,
    [ruleForm.productVariantId, variants],
  );

  useEffect(() => {
    if (selectedVariant && !ruleForm.ruleId) {
      setRuleForm((current) => ({
        ...current,
        reorderPoint:
          current.reorderPoint === "10"
            ? String(selectedVariant.lowStockThreshold ?? 10)
            : current.reorderPoint,
      }));
    }
  }, [selectedVariant, ruleForm.ruleId]);

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rules.filter((rule) => {
      if (warehouseFilter && rule.warehouseId !== Number(warehouseFilter)) return false;
      if (!query) return true;
      return (
        rule.productVariant.product.name.toLowerCase().includes(query) ||
        rule.productVariant.sku.toLowerCase().includes(query) ||
        rule.warehouse.name.toLowerCase().includes(query)
      );
    });
  }, [rules, search, warehouseFilter]);

  const visibleRules = useMemo(() => {
    const startIndex = (rulesCurrentPage - 1) * itemsPerPage;
    return filteredRules.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRules, rulesCurrentPage]);

  const totalRulesPages = Math.ceil(filteredRules.length / itemsPerPage);

  const filteredSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return suggestions.filter((suggestion) => {
      if (warehouseFilter && suggestion.warehouseId !== Number(warehouseFilter)) return false;
      if (!query) return true;
      return (
        suggestion.productName.toLowerCase().includes(query) ||
        suggestion.sku.toLowerCase().includes(query) ||
        suggestion.warehouseName.toLowerCase().includes(query)
      );
    });
  }, [search, suggestions, warehouseFilter]);

  const visibleSuggestions = useMemo(() => {
    const startIndex = (suggestionsCurrentPage - 1) * itemsPerPage;
    return filteredSuggestions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSuggestions, suggestionsCurrentPage]);

  const totalSuggestionsPages = Math.ceil(filteredSuggestions.length / itemsPerPage);

  const purchasableSuggestions = visibleSuggestions.filter(
    (suggestion) => suggestion.purchaseQty > 0,
  );
  const transferableSuggestions = visibleSuggestions.filter(
    (suggestion) => suggestion.transferQty > 0,
  );

  const saveRule = async () => {
    if (!ruleForm.warehouseId || !ruleForm.productVariantId) {
      toast.error(t("errors.warehouseVariantRequired"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/scm/replenishment/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: ruleForm.ruleId || null,
          warehouseId: Number(ruleForm.warehouseId),
          productVariantId: Number(ruleForm.productVariantId),
          strategy: ruleForm.strategy,
          reorderPoint: Number(ruleForm.reorderPoint),
          targetStockLevel: Number(ruleForm.targetStockLevel),
          safetyStock: Number(ruleForm.safetyStock),
          minOrderQty: Number(ruleForm.minOrderQty),
          orderMultiple: Number(ruleForm.orderMultiple),
          leadTimeDays: ruleForm.leadTimeDays ? Number(ruleForm.leadTimeDays) : null,
          isActive: ruleForm.isActive,
          note: ruleForm.note,
        }),
      });

      await readJson(response, t("errors.saveRule"));
      toast.success(t("toasts.ruleSaved"));
      setRuleForm(defaultForm);
      await loadData(warehouseFilter);
    } catch (error: any) {
      toast.error(error?.message || t("errors.saveRule"));
    } finally {
      setSaving(false);
    }
  };

  const editRule = (rule: Rule) => {
    setRuleForm({
      ruleId: String(rule.id),
      warehouseId: String(rule.warehouseId),
      productVariantId: String(rule.productVariantId),
      strategy: rule.strategy,
      reorderPoint: String(rule.reorderPoint),
      targetStockLevel: String(rule.targetStockLevel),
      safetyStock: String(rule.safetyStock),
      minOrderQty: String(rule.minOrderQty),
      orderMultiple: String(rule.orderMultiple),
      leadTimeDays: rule.leadTimeDays ? String(rule.leadTimeDays) : "",
      isActive: rule.isActive,
      note: rule.note || "",
    });
  };

  const createRequisition = async () => {
    const selectedSuggestions = purchasableSuggestions.filter((suggestion) =>
      selectedRuleIds.includes(suggestion.ruleId),
    );
    if (selectedSuggestions.length === 0) {
      toast.error(t("errors.selectPurchaseSuggestion"));
      return;
    }

    const distinctWarehouses = [
      ...new Set(selectedSuggestions.map((item) => item.warehouseId)),
    ];
    if (distinctWarehouses.length !== 1) {
      toast.error(t("errors.sameWarehouseRequired"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/scm/replenishment/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: distinctWarehouses[0],
          neededBy: neededBy || null,
          note: requisitionNote,
          items: selectedSuggestions.map((suggestion) => ({
            ruleId: suggestion.ruleId,
            quantityRequested: suggestion.purchaseQty,
          })),
        }),
      });

      const requisition = await readJson<{ requisitionNumber: string }>(
        response,
        t("errors.createRequisition"),
      );
      toast.success(
        t("toasts.requisitionCreated", { number: requisition.requisitionNumber }),
      );
      setSelectedRuleIds([]);
      setNeededBy("");
      setRequisitionNote("");
      router.push(
        `/admin/scm/purchase-requisitions?search=${encodeURIComponent(requisition.requisitionNumber)}`,
      );
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || t("errors.createRequisition"));
    } finally {
      setSaving(false);
    }
  };

  const createTransferDraft = async (suggestion: Suggestion) => {
    if (!suggestion.sourceWarehouse || suggestion.transferQty <= 0) {
      toast.error(t("errors.noTransferableQty"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/scm/replenishment/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_transfer",
          warehouseId: suggestion.warehouseId,
          neededBy: neededBy || null,
          note:
            requisitionNote ||
            t("transferNoteDefault", {
              product: suggestion.productName,
              sku: suggestion.sku,
            }),
          items: [
            {
              ruleId: suggestion.ruleId,
              quantityRequested: suggestion.transferQty,
            },
          ],
        }),
      });

      const transfer = await readJson<{ transferNumber: string }>(
        response,
        t("errors.createTransfer"),
      );
      toast.success(t("toasts.transferCreated", { number: transfer.transferNumber }));
      router.push(
        `/admin/scm/warehouse-transfers?search=${encodeURIComponent(transfer.transferNumber)}`,
      );
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || t("errors.createTransfer"));
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("forbidden.title")}</CardTitle>
            <CardDescription>{t("forbidden.description")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("header.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("header.description")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadData(warehouseFilter)}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("actions.refresh")}
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <ScmStatCard
          label={t("stats.rules.label")}
          value={String(rules.length)}
          hint={t("stats.rules.hint")}
        />
        <ScmStatCard
          label={t("stats.triggered.label")}
          value={String(visibleSuggestions.length)}
          hint={t("stats.triggered.hint")}
        />
        <ScmStatCard
          label={t("stats.purchaseSignals.label")}
          value={String(purchasableSuggestions.length)}
          hint={t("stats.purchaseSignals.hint")}
        />
        <ScmStatCard
          label={t("stats.transferSignals.label")}
          value={String(transferableSuggestions.length)}
          hint={t("stats.transferSignals.hint")}
        />
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {ruleForm.ruleId ? t("ruleForm.editTitle") : t("ruleForm.createTitle")}
            </CardTitle>
            <CardDescription>{t("ruleForm.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>{t("ruleForm.warehouse")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={ruleForm.warehouseId}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      warehouseId: event.target.value,
                    }))
                  }
                >
                  <option value="">{t("ruleForm.selectWarehouse")}</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.variant")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={ruleForm.productVariantId}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      productVariantId: event.target.value,
                    }))
                  }
                >
                  <option value="">{t("ruleForm.selectVariant")}</option>
                  {variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.product.name} ({variant.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.strategy")}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={ruleForm.strategy}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      strategy: event.target.value as "MIN_MAX" | "REORDER_POINT",
                    }))
                  }
                >
                  <option value="MIN_MAX">{tScm("k_efe9633e2a02")}</option>
                  <option value="REORDER_POINT">{tScm("k_4032b04cc9ed")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.leadTimeDays")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.leadTimeDays}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      leadTimeDays: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label>{t("ruleForm.reorderPoint")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.reorderPoint}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      reorderPoint: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.targetStock")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.targetStockLevel}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      targetStockLevel: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.safetyStock")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.safetyStock}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      safetyStock: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.minOrderQty")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={ruleForm.minOrderQty}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      minOrderQty: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ruleForm.orderMultiple")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={ruleForm.orderMultiple}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      orderMultiple: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("ruleForm.note")}</Label>
              <Textarea
                rows={3}
                value={ruleForm.note}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleForm.isActive}
                onChange={(event) =>
                  setRuleForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              {t("ruleForm.ruleActive")}
            </label>

            <div className="flex gap-2">
              <Button onClick={() => void saveRule()} disabled={saving}>
                {saving
                  ? t("ruleForm.saving")
                  : ruleForm.ruleId
                    ? t("ruleForm.updateRule")
                    : t("ruleForm.saveRule")}
              </Button>
              {ruleForm.ruleId ? (
                <Button variant="outline" onClick={() => setRuleForm(defaultForm)}>
                  {t("ruleForm.cancelEdit")}
                </Button>
              ) : null}
            </div>

            {selectedVariant ? (
              <p className="text-xs text-muted-foreground">
                {t("ruleForm.variantDefaultThreshold", {
                  value: selectedVariant.lowStockThreshold,
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("register.title")}</CardTitle>
          <CardDescription>{t("register.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={warehouseFilter}
              onChange={(event) => {
                setWarehouseFilter(event.target.value);
                setSelectedRuleIds([]);
              }}
            >
              <option value="">{t("filters.allWarehouses")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => void loadData(warehouseFilter)}
              disabled={loading}
            >
              {t("actions.refresh")}
            </Button>
          </div>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-1 xl:grid-cols-2">
            {/* Configured Rules Card */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  {t("rulesCard.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          {t("rulesCard.table.warehouse")}
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          {t("rulesCard.table.variant")}
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          {t("rulesCard.table.rule")}
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          {t("rulesCard.table.status")}
                        </TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">
                          {t("rulesCard.table.action")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRules.map((rule) => (
                        <TableRow key={rule.id} className="border-border hover:bg-muted/40">
                          <TableCell className="py-3 text-sm text-foreground">
                            {rule.warehouse.code}
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="font-medium text-sm text-foreground">
                              {rule.productVariant.product.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {rule.productVariant.sku}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="text-sm text-foreground">
                              {t("rulesCard.ruleSummary", {
                                rp: rule.reorderPoint,
                                target: rule.targetStockLevel,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t("rulesCard.ruleDetail", {
                                moq: rule.minOrderQty,
                                multiple: rule.orderMultiple,
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                rule.isActive
                                  ? "bg-success/10 text-success border border-success/20"
                                  : "bg-muted/50 text-muted-foreground border border-border",
                              )}
                            >
                              {rule.isActive
                                ? t("rulesCard.statusActive")
                                : t("rulesCard.statusInactive")}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            {canManage && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => editRule(rule)}
                                className="h-8 px-3 text-xs"
                              >
                                {t("actions.edit")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loading && visibleRules.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Package className="h-8 w-8 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground">
                                {t("rulesCard.empty")}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {!loading && visibleRules.length > 0 && (
                    <Pagination
                      currentPage={rulesCurrentPage}
                      totalPages={totalRulesPages}
                      onPageChange={setRulesCurrentPage}
                    />
                  )}
                </div>

                {/* Mobile Card View */}
                <div className="space-y-3 md:hidden">
                  {visibleRules.map((rule) => (
                    <Card key={rule.id} className="border-border shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {rule.warehouse.code}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  rule.isActive
                                    ? "bg-success/10 text-success"
                                    : "bg-muted/50 text-muted-foreground",
                                )}
                              >
                                {rule.isActive
                                  ? t("rulesCard.statusActive")
                                  : t("rulesCard.statusInactive")}
                              </span>
                            </div>
                          </div>
                          {canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editRule(rule)}
                              className="h-8 px-3 text-xs"
                            >
                              {t("actions.edit")}
                            </Button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {rule.productVariant.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("rulesCard.skuLabel")}: {rule.productVariant.sku}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t("rulesCard.reorderPoint")}
                              </p>
                              <p className="text-sm font-medium text-foreground">
                                {rule.reorderPoint}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t("rulesCard.targetLevel")}
                              </p>
                              <p className="text-sm font-medium text-foreground">
                                {rule.targetStockLevel}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t("rulesCard.minOrderQty")}
                              </p>
                              <p className="text-sm font-medium text-foreground">
                                {rule.minOrderQty}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t("rulesCard.orderMultiple")}
                              </p>
                              <p className="text-sm font-medium text-foreground">
                                {rule.orderMultiple}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {!loading && visibleRules.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("rulesCard.empty")}
                      </p>
                    </div>
                  )}

                  {!loading && visibleRules.length > 0 && (
                    <Pagination
                      currentPage={rulesCurrentPage}
                      totalPages={totalRulesPages}
                      onPageChange={setRulesCurrentPage}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Planning Suggestions Card */}
            <Card className="shadow-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  {t("suggestionsCard.title")}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                  {t("suggestionsCard.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                {canCreateRequisition && (
                  <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-[1fr_2fr_auto] sm:gap-3">
                    <Input
                      type="date"
                      value={neededBy}
                      onChange={(event) => setNeededBy(event.target.value)}
                      className="w-full"
                    />
                    <Input
                      placeholder={t("suggestionsCard.requisitionNotePlaceholder")}
                      value={requisitionNote}
                      onChange={(event) => setRequisitionNote(event.target.value)}
                      className="w-full"
                    />
                    <Button
                      onClick={() => void createRequisition()}
                      disabled={saving || selectedRuleIds.length === 0}
                      className="w-full sm:w-auto"
                    >
                      {t("suggestionsCard.createRequisition")}
                    </Button>
                  </div>
                )}

                {visibleSuggestions.length > 0 ? (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="w-10 text-xs font-medium text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={
                                  visibleSuggestions.length > 0 &&
                                  selectedRuleIds.length ===
                                    visibleSuggestions.filter((s) => s.purchaseQty > 0).length
                                }
                                onChange={(e) => {
                                  const selectableSuggestions = visibleSuggestions.filter(
                                    (s) => s.purchaseQty > 0,
                                  );
                                  if (e.target.checked) {
                                    setSelectedRuleIds(
                                      selectableSuggestions.map((s) => s.ruleId),
                                    );
                                  } else {
                                    setSelectedRuleIds([]);
                                  }
                                }}
                                className="rounded border-border"
                              />
                            </TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground">
                              {t("suggestionsCard.table.item")}
                            </TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground">
                              {t("suggestionsCard.table.signal")}
                            </TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground">
                              {t("suggestionsCard.table.recommendation")}
                            </TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground">
                              {t("suggestionsCard.table.leadTime")}
                            </TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground">
                              {t("suggestionsCard.table.action")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleSuggestions.map((suggestion) => {
                            const selectable = suggestion.purchaseQty > 0;
                            const selected = selectedRuleIds.includes(suggestion.ruleId);
                            return (
                              <TableRow
                                key={suggestion.ruleId}
                                className="border-border hover:bg-muted/40"
                              >
                                <TableCell className="py-3">
                                  <input
                                    type="checkbox"
                                    disabled={!selectable}
                                    checked={selectable && selected}
                                    onChange={(event) =>
                                      setSelectedRuleIds((current) =>
                                        event.target.checked
                                          ? [...current, suggestion.ruleId]
                                          : current.filter(
                                              (value) => value !== suggestion.ruleId,
                                            ),
                                      )
                                    }
                                    className="rounded border-border disabled:opacity-50"
                                  />
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="font-medium text-sm text-foreground">
                                    {suggestion.productName}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {suggestion.sku} | {suggestion.warehouseCode}
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="text-sm text-foreground">
                                    {t("suggestionsCard.availableLine", {
                                      available: suggestion.availableQty,
                                      rp: suggestion.reorderPoint,
                                    })}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {t("suggestionsCard.shortageReservedLine", {
                                      shortage: suggestion.shortageQty,
                                      reserved: suggestion.reservedQty,
                                    })}
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="text-sm font-medium text-primary">
                                    {t(`recommendedActions.${suggestion.recommendedAction}` as any)}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {t("suggestionsCard.transferPurchaseLine", {
                                      transfer: suggestion.transferQty,
                                      purchase: suggestion.purchaseQty,
                                    })}
                                  </div>
                                  {suggestion.sourceWarehouse && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {t("suggestionsCard.sourceLine", {
                                        code: suggestion.sourceWarehouse.code,
                                        qty: suggestion.sourceWarehouse.transferableQty,
                                      })}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 text-sm text-foreground">
                                  {suggestion.leadTimeDays !== null
                                    ? t("suggestionsCard.leadTimeDays", {
                                        days: suggestion.leadTimeDays,
                                      })
                                    : t("labels.na")}
                                </TableCell>
                                <TableCell className="py-3">
                                  {canCreateTransfer &&
                                  suggestion.sourceWarehouse &&
                                  suggestion.transferQty > 0 ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={saving}
                                      onClick={() => void createTransferDraft(suggestion)}
                                      className="h-8 px-3 text-xs whitespace-nowrap"
                                    >
                                      {t("suggestionsCard.createTransfer")}
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {t("labels.na")}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {!loading && visibleSuggestions.length > 0 && (
                        <Pagination
                          currentPage={suggestionsCurrentPage}
                          totalPages={totalSuggestionsPages}
                          onPageChange={setSuggestionsCurrentPage}
                        />
                      )}
                    </div>

                    {/* Mobile Card View */}
                    <div className="space-y-3 md:hidden">
                      {visibleSuggestions.map((suggestion) => {
                        const selectable = suggestion.purchaseQty > 0;
                        const selected = selectedRuleIds.includes(suggestion.ruleId);
                        return (
                          <Card key={suggestion.ruleId} className="border-border shadow-sm">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  disabled={!selectable}
                                  checked={selectable && selected}
                                  onChange={(event) =>
                                    setSelectedRuleIds((current) =>
                                      event.target.checked
                                        ? [...current, suggestion.ruleId]
                                        : current.filter(
                                            (value) => value !== suggestion.ruleId,
                                          ),
                                    )
                                  }
                                  className="mt-0.5 rounded border-border disabled:opacity-50"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    {suggestion.productName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {suggestion.sku} | {suggestion.warehouseCode}
                                  </p>
                                </div>
                              </div>

                              <div className="pl-6 space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      {t("suggestionsCard.available")}:
                                    </span>
                                    <span className="ml-1 text-foreground">
                                      {suggestion.availableQty}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      {t("suggestionsCard.reorderPoint")}:
                                    </span>
                                    <span className="ml-1 text-foreground">
                                      {suggestion.reorderPoint}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      {t("suggestionsCard.shortage")}:
                                    </span>
                                    <span className="ml-1 text-warning">
                                      {suggestion.shortageQty}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      {t("suggestionsCard.reserved")}:
                                    </span>
                                    <span className="ml-1 text-foreground">
                                      {suggestion.reservedQty}
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-border/50">
                                  <p className="text-sm font-medium text-primary">
                                    {t(`recommendedActions.${suggestion.recommendedAction}` as any)}
                                  </p>
                                  <div className="flex gap-3 mt-1 text-xs">
                                    <span>
                                      {t("suggestionsCard.transfer")}:{" "}
                                      <strong>{suggestion.transferQty}</strong>
                                    </span>
                                    <span>
                                      {t("suggestionsCard.purchase")}:{" "}
                                      <strong>{suggestion.purchaseQty}</strong>
                                    </span>
                                  </div>
                                  {suggestion.sourceWarehouse && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {t("suggestionsCard.sourceLine", {
                                        code: suggestion.sourceWarehouse.code,
                                        qty: suggestion.sourceWarehouse.transferableQty,
                                      })}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {t("suggestionsCard.leadTime")}:{" "}
                                    {suggestion.leadTimeDays !== null
                                      ? t("suggestionsCard.leadTimeDays", {
                                          days: suggestion.leadTimeDays,
                                        })
                                      : t("labels.na")}
                                  </p>
                                </div>

                                {canCreateTransfer &&
                                  suggestion.sourceWarehouse &&
                                  suggestion.transferQty > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={saving}
                                      onClick={() => void createTransferDraft(suggestion)}
                                      className="w-full mt-2"
                                    >
                                      {t("suggestionsCard.createTransferDraft")}
                                    </Button>
                                  )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}

                      {!loading && visibleSuggestions.length > 0 && (
                        <Pagination
                          currentPage={suggestionsCurrentPage}
                          totalPages={totalSuggestionsPages}
                          onPageChange={setSuggestionsCurrentPage}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  !loading && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("suggestionsCard.empty")}
                      </p>
                    </div>
                  )
                )}

                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
