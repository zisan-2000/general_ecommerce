"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BundleWarehouse, WarehouseBundleStockDetail, WarehouseBundleStockRow } from "@/lib/warehouse-bundle-stock";

type StockList = {
  rows: WarehouseBundleStockRow[];
  warehouses: BundleWarehouse[];
  pagination: { page: number; total: number; pages: number };
};

export default function BundleStockManagement({ refreshKey, onStockChange }: {
  refreshKey: number;
  onStockChange: () => void;
}) {
  const t = useTranslations("AdminWarehouseBundleStock");
  const stock = useTranslations("AdminStockManagement");
  const bundle = useTranslations("AdminBundles.detail");
  const { data: session } = useSession();
  const canConfigure = session?.user?.permissions?.includes("products.manage");
  const detailRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<StockList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [selection, setSelection] = useState<{ bundleId: number; warehouseId: number } | null>(null);
  const [detail, setDetail] = useState<WarehouseBundleStockDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [assemblyQuantity, setAssemblyQuantity] = useState("1");
  const [outQuantity, setOutQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"assembly" | "adjustment" | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ search, page: String(page) });
        if (warehouseId) params.set("warehouseId", warehouseId);
        const response = await fetch(`/api/admin/warehouse/bundle-stock?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (result.code === "STORE_FEATURE_DISABLED") {
          setDisabled(true);
          setData(null);
          return;
        }
        if (!response.ok) throw new Error(result.error || t("loadError"));
        setDisabled(false);
        setData(result);
        if (page > Math.max(1, result.pagination.pages)) setPage(Math.max(1, result.pagination.pages));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(cause instanceof Error ? cause.message : t("loadError"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, warehouseId, page, revision, refreshKey, t]);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    if (!selection) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const load = async () => {
      try {
        const params = new URLSearchParams({ bundleId: String(selection.bundleId), warehouseId: String(selection.warehouseId) });
        const response = await fetch(`/api/admin/warehouse/bundle-stock?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t("loadError"));
        if (!controller.signal.aborted) setDetail(result);
      } catch (cause) {
        if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : t("loadError"));
      }
    };
    void load();
    return () => controller.abort();
  }, [selection, revision, refreshKey, t]);

  async function recordMovement(kind: "assembly" | "adjustment") {
    if (!detail || busy) return;
    const row = detail.row;
    const quantity = Number(kind === "assembly" ? assemblyQuantity : outQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || (kind === "adjustment" && !reason.trim())) {
      toast.error(bundle(kind === "assembly" ? "assembly.invalidQuantity" : "assembly.adjustmentRequired"));
      return;
    }
    setBusy(kind);
    try {
      const response = await fetch(`/api/admin/products/bundles/${row.bundleId}/${kind}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, warehouseId: row.warehouse.id, ...(kind === "adjustment" ? { reason: reason.trim() } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || bundle(kind === "assembly" ? "assembly.failed" : "assembly.adjustmentFailed"));
      toast.success(bundle(kind === "assembly" ? "assembly.success" : "assembly.adjustmentSuccess"));
      if (kind === "adjustment") setReason("");
      setDetail(null);
      setRevision((previous) => previous + 1);
      onStockChange();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t("loadError"));
    } finally { setBusy(null); }
  }

  if (disabled) return <p className="text-sm text-muted-foreground">{t("featureDisabled")}</p>;

  return <div className="space-y-6" data-testid="warehouse-bundle-stock">
    <p className="text-sm text-muted-foreground">{t("description")}</p>
    <p className="text-xs text-muted-foreground">{t("virtualHint")}</p>
    <Card><CardContent className="grid gap-4 p-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="bundle-stock-search">{t("search")}</Label>
        <Input id="bundle-stock-search" value={search} disabled={!!busy} onChange={(event) => {
          setSearch(event.target.value); setPage(1); setSelection(null); setLoading(true);
        }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bundle-stock-warehouse">{stock("warehouseStock.table.warehouse")}</Label>
        <select id="bundle-stock-warehouse" className="w-full rounded-md border bg-background px-3 py-2" value={warehouseId} disabled={!!busy}
          onChange={(event) => { setWarehouseId(event.target.value); setPage(1); setSelection(null); setLoading(true); }}>
          <option value="">{t("allWarehouses")}</option>
          {data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
        </select>
      </div>
    </CardContent></Card>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {loading ? <p role="status">{t("loading")}</p> : data?.rows.length ? <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{stock("filters.productLabel")}</TableHead><TableHead>{stock("warehouseStock.table.warehouse")}</TableHead>
            <TableHead>{t("mode")}</TableHead><TableHead>{bundle("availability.assembledStock")}</TableHead>
            <TableHead>{stock("warehouseStock.table.reserved")}</TableHead><TableHead>{stock("warehouseStock.table.available")}</TableHead>
            <TableHead>{bundle("availability.saleLimit")}</TableHead><TableHead>{bundle("availability.effectiveStock")}</TableHead>
            <TableHead>{stock("warehouseStock.table.action")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>{data.rows.map((row) => <TableRow key={row.key} data-testid={`bundle-stock-${row.key}`}>
            <TableCell><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.sku || "—"} · {bundle(row.active ? "status.active" : "status.inactive")}</p></TableCell>
            <TableCell>{row.warehouse.name}<p className="text-xs text-muted-foreground">{row.warehouse.code}</p></TableCell>
            <TableCell>{t(row.mode)}</TableCell><TableCell>{row.quantity ?? "—"}</TableCell>
            <TableCell>{row.reserved ?? "—"}</TableCell><TableCell>{row.available ?? "—"}</TableCell>
            <TableCell>{row.saleLimit ?? bundle("availability.notSet")}</TableCell><TableCell>{row.orderAvailability}</TableCell>
            <TableCell><Button variant="outline" disabled={!!busy} onClick={() => {
              setDetail(null); setDetailError(""); setSelection({ bundleId: row.bundleId, warehouseId: row.warehouse.id });
              setAssemblyQuantity("1"); setOutQuantity("1"); setReason("");
            }}>{t("manage")}</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("pagination", { page: data.pagination.page, pages: Math.max(1, data.pagination.pages), total: data.pagination.total })}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1 || !!busy} onClick={() => { setPage(page - 1); setLoading(true); }}>{t("previous")}</Button>
          <Button variant="outline" disabled={page >= data.pagination.pages || !!busy} onClick={() => { setPage(page + 1); setLoading(true); }}>{t("next")}</Button>
        </div>
      </div>
    </> : !error ? <p className="text-muted-foreground">{t("empty")}</p> : null}

    {selection ? <Card ref={detailRef}><CardContent className="space-y-5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{detail ? `${detail.row.name} · ${detail.row.warehouse.code}` : t("loading")}</h2>
        <Button variant="outline" disabled={!!busy} onClick={() => setSelection(null)}>{t("close")}</Button>
      </div>
      {detailError ? <p role="alert" className="text-destructive">{detailError}</p> : null}
      {detail ? <>
        <p className="text-sm text-muted-foreground">{bundle(detail.row.mode === "PREASSEMBLED" ? "availability.preassembledDescription" : "availability.description")}</p>
        {detail.row.archived ? <p className="text-sm text-amber-700 dark:text-amber-400">{t("archived")}</p> : null}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            [bundle("availability.assembledStock"), detail.row.quantity ?? "—"],
            [stock("warehouseStock.table.reserved"), detail.row.reserved ?? "—"],
            [stock("warehouseStock.table.available"), detail.row.available ?? "—"],
            [bundle("availability.componentCapacity"), detail.row.componentCapacity ?? "—"],
            [bundle("availability.saleLimit"), detail.row.saleLimit ?? bundle("availability.notSet")],
            [bundle("availability.effectiveStock"), detail.row.orderAvailability],
          ].map(([label, value]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>)}
        </div>
        {detail.row.configurationError ? <p role="alert" className="text-destructive">{detail.row.configurationError}</p> : null}
        {detail.row.canManage ? <div className="grid gap-6 border-t pt-4 md:grid-cols-2">
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void recordMovement("assembly"); }}>
            <Label htmlFor="warehouse-bundle-assemble">{bundle("assembly.quantity")}</Label>
            <Input id="warehouse-bundle-assemble" type="number" min={1} step={1} required value={assemblyQuantity} disabled={!!busy}
              onChange={(event) => setAssemblyQuantity(event.target.value)} />
            <p className="text-xs text-muted-foreground">{bundle("assembly.description")}</p>
            <Button type="submit" disabled={!!busy || !detail.row.componentCapacity}>{bundle(busy === "assembly" ? "assembly.assembling" : "assembly.assemble")}</Button>
          </form>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void recordMovement("adjustment"); }}>
            <Label htmlFor="warehouse-bundle-out">{bundle("assembly.stockOutQuantity")}</Label>
            <Input id="warehouse-bundle-out" type="number" min={1} step={1} required value={outQuantity} disabled={!!busy}
              onChange={(event) => setOutQuantity(event.target.value)} />
            <Label htmlFor="warehouse-bundle-reason">{bundle("assembly.adjustmentReason")}</Label>
            <Input id="warehouse-bundle-reason" required maxLength={250} value={reason} disabled={!!busy} onChange={(event) => setReason(event.target.value)} />
            <p className="text-xs text-muted-foreground">{bundle("assembly.stockOutDescription")}</p>
            <Button type="submit" variant="outline" disabled={!!busy || !detail.row.available}>{bundle(busy === "adjustment" ? "assembly.adjusting" : "assembly.stockOut")}</Button>
          </form>
        </div> : <p className="text-sm text-muted-foreground">{t("readOnly")}</p>}
        {canConfigure && !detail.row.archived ? <Button variant="outline" asChild><Link href={`/admin/operations/products/bundles/${detail.row.bundleId}`}>{t("details")}</Link></Button> : null}
        <div className="space-y-2">
          <h3 className="font-semibold">{t("components")}</h3><p className="text-xs text-muted-foreground">{t("componentsHint")}</p>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>{stock("filters.productLabel")}</TableHead><TableHead>{stock("warehouseStock.variantLabel")}</TableHead>
            <TableHead>{stock("warehouseStock.table.quantity")}</TableHead><TableHead>{stock("warehouseStock.table.available")}</TableHead>
          </TableRow></TableHeader><TableBody>{detail.components.map((component, index) => <TableRow key={`${component.productId}:${index}`}>
            <TableCell>{component.name}</TableCell><TableCell>{component.variant || "—"}</TableCell><TableCell>{component.quantity}</TableCell><TableCell>{component.available ?? "—"}</TableCell>
          </TableRow>)}</TableBody></Table></div>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">{t("reservations")}</h3>
          {detail.reservations.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>{t("order")}</TableHead><TableHead>{stock("warehouseStock.table.quantity")}</TableHead><TableHead>{t("expires")}</TableHead>
          </TableRow></TableHeader><TableBody>{detail.reservations.map((hold) => <TableRow key={hold.id}>
            <TableCell>#{hold.orderId}</TableCell><TableCell>{hold.quantity}</TableCell><TableCell>{hold.expiresAt?.replace("T", " ").slice(0, 19) || "—"}</TableCell>
          </TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">{t("noReservations")}</p>}
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">{stock("logs.title")}</h3><p className="text-xs text-muted-foreground">{t("logsHint")}</p>
          {detail.logs.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow>
            <TableHead>{stock("logs.table.date")}</TableHead><TableHead>{t("movement")}</TableHead><TableHead>{stock("logs.table.change")}</TableHead>
            <TableHead>{t("order")}</TableHead><TableHead>{stock("logs.table.reason")}</TableHead>
          </TableRow></TableHeader><TableBody>{detail.logs.map((log) => <TableRow key={log.id}>
            <TableCell className="whitespace-nowrap">{log.createdAt.replace("T", " ").slice(0, 19)}</TableCell>
            <TableCell>{t(log.kind === "finished" ? "finishedMovement" : "saleLimitMovement")}</TableCell>
            <TableCell className={log.change < 0 ? "text-red-600" : "text-green-600"}>{log.change > 0 ? "+" : ""}{log.change}</TableCell>
            <TableCell>{log.orderId ? `#${log.orderId}` : "—"}</TableCell><TableCell className="min-w-48 break-words">{log.reason}</TableCell>
          </TableRow>)}</TableBody></Table></div> : <p className="text-sm text-muted-foreground">{stock("logs.emptyProduct")}</p>}
        </div>
      </> : null}
    </CardContent></Card> : null}
  </div>;
}
