"use client";

import { useTranslations } from "next-intl";


import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Warehouse = { id: number; name: string; code: string };

type DailyRow = {
  warehouse: Warehouse;
  variant: { id: number; sku: string; product: { id: number; name: string } };
  quantity: number;
  reserved: number;
  available: number;
  status: string;
};

type AgingRow = {
  warehouse: Warehouse;
  variant: { id: number; sku: string; product: { id: number; name: string } };
  quantity: number;
  reserved: number;
  available: number;
  lastMovement: string | null;
  ageDays: number | null;
};

type MonthlyRow = {
  warehouse: Warehouse | null;
  daysTracked: number;
  avgQuantity: number;
  avgReserved: number;
  avgAvailable: number;
  endQuantity: number;
  endReserved: number;
  endAvailable: number;
  endDate: string | null;
};

async function readJson<T>(res: Response, errorMessage: string) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || errorMessage);
  }
  return (await res.json()) as T;
}

function fmtDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function StockReportsPage() {
  const tScm = useTranslations("ScmAuto");
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canRead = permissions.includes("stock_reports.read") || permissions.includes("inventory.manage");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState(searchParams.get("warehouseId") || "");
  const [tab, setTab] = useState(searchParams.get("tab") || "daily");
  const [dailyDate, setDailyDate] = useState(() => fmtDate(new Date()));
  const [monthlyFrom, setMonthlyFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return fmtDate(d);
  });
  const [monthlyTo, setMonthlyTo] = useState(() => fmtDate(new Date()));
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [agingRows, setAgingRows] = useState<AgingRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedWarehouseId = Number(warehouseId);

  const loadWarehouses = async () => {
    const res = await fetch("/api/warehouses", { cache: "no-store" });
    const data = await readJson<Warehouse[]>(res, "Failed to load warehouses");
    setWarehouses(data);
    if (!warehouseId && data.length > 0) {
      setWarehouseId(String(data[0].id));
    }
  };

  const loadDaily = async () => {
    const qs = new URLSearchParams({ type: "daily", date: dailyDate });
    if (warehouseId) qs.set("warehouseId", warehouseId);
    const res = await fetch(`/api/scm/stock-reports?${qs.toString()}`, { cache: "no-store" });
    const data = await readJson<{ rows: DailyRow[] }>(res, "Failed to load daily report");
    setDailyRows(data.rows || []);
  };

  const loadAging = async () => {
    const qs = new URLSearchParams({ type: "aging" });
    if (warehouseId) qs.set("warehouseId", warehouseId);
    const res = await fetch(`/api/scm/stock-reports?${qs.toString()}`, { cache: "no-store" });
    const data = await readJson<{ rows: AgingRow[] }>(res, "Failed to load aging report");
    setAgingRows(data.rows || []);
  };

  const loadMonthly = async () => {
    const qs = new URLSearchParams({ type: "monthly", from: monthlyFrom, to: monthlyTo });
    if (warehouseId) qs.set("warehouseId", warehouseId);
    const res = await fetch(`/api/scm/stock-reports?${qs.toString()}`, { cache: "no-store" });
    const data = await readJson<{ rows: MonthlyRow[] }>(res, "Failed to load monthly summary");
    setMonthlyRows(data.rows || []);
  };

  const refresh = async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      if (tab === "daily") await loadDaily();
      if (tab === "aging") await loadAging();
      if (tab === "monthly") await loadMonthly();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWarehouses();
  }, []);

  useEffect(() => {
    setWarehouseId(searchParams.get("warehouseId") || "");
    setTab(searchParams.get("tab") || "daily");
  }, [searchParams]);

  useEffect(() => {
    if (!canRead) return;
    void refresh();
  }, [tab, warehouseId, dailyDate, monthlyFrom, monthlyTo, canRead]);

  const dailySummary = useMemo(() => {
    return dailyRows.reduce(
      (acc, row) => {
        acc.quantity += row.quantity;
        acc.reserved += row.reserved;
        acc.available += row.available;
        return acc;
      },
      { quantity: 0, reserved: 0, available: 0 },
    );
  }, [dailyRows]);

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {tScm("k_8ccee4eaf02d")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tScm("k_f0534f0d3623")}</h1>
          <p className="text-sm text-muted-foreground">
            {tScm("k_12a6d97a1603")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {tScm("k_56e3badc4e6c")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_96e578211aa2")}</CardTitle>
          <CardDescription>{tScm("k_824cdb210353")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>{tScm("k_298dff72dae2")}</Label>
            <select
              className="rounded-md border bg-background px-3 py-2"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">{tScm("k_4398170593bf")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>
          {tab === "daily" ? (
            <div className="space-y-2">
              <Label>{tScm("k_eb9a4bc1c0c1")}</Label>
              <Input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
            </div>
          ) : null}
          {tab === "monthly" ? (
            <>
              <div className="space-y-2">
                <Label>{tScm("k_3f66052a107e")}</Label>
                <Input type="date" value={monthlyFrom} onChange={(e) => setMonthlyFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{tScm("k_ae79ea1e9c63")}</Label>
                <Input type="date" value={monthlyTo} onChange={(e) => setMonthlyTo(e.target.value)} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="daily">{tScm("k_dab503b4ac86")}</TabsTrigger>
          <TabsTrigger value="aging">{tScm("k_e40fd2635c24")}</TabsTrigger>
          <TabsTrigger value="monthly">{tScm("k_e96ac2bf45fc")}</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">{tScm("k_42fa648388d1")}</div>
                <div className="text-xl font-semibold">{dailySummary.quantity}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">{tScm("k_67a6ff10f1b9")}</div>
                <div className="text-xl font-semibold">{dailySummary.reserved}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">{tScm("k_7c62a1424469")}</div>
                <div className="text-xl font-semibold">{dailySummary.available}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_b3655c1695d6")}</CardTitle>
              <CardDescription>{tScm("k_f73dfb9f4c35")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tScm("k_298dff72dae2")}</TableHead>
                    <TableHead>{tScm("k_cc91b1ea2c16")}</TableHead>
                    <TableHead className="text-right">{tScm("k_1e5ff9e500c2")}</TableHead>
                    <TableHead className="text-right">{tScm("k_67a6ff10f1b9")}</TableHead>
                    <TableHead className="text-right">{tScm("k_7c62a1424469")}</TableHead>
                    <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {tScm("k_40b2883bce1e")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyRows.map((row) => (
                      <TableRow key={`${row.warehouse.id}-${row.variant.id}`}>
                        <TableCell>
                          <div className="font-medium">{row.warehouse.name}</div>
                          <div className="text-xs text-muted-foreground">{row.warehouse.code}</div>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/scm/stock-cards?warehouseId=${row.warehouse.id}&variantId=${row.variant.id}&search=${encodeURIComponent(row.variant.sku)}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {row.variant.product.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{row.variant.sku}</div>
                        </TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{row.reserved}</TableCell>
                        <TableCell className="text-right">{row.available}</TableCell>
                        <TableCell className="text-xs uppercase">{row.status.replaceAll("_", " ")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_e40fd2635c24")}</CardTitle>
              <CardDescription>{tScm("k_83dd906c975b")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tScm("k_298dff72dae2")}</TableHead>
                    <TableHead>{tScm("k_cc91b1ea2c16")}</TableHead>
                    <TableHead className="text-right">{tScm("k_1e5ff9e500c2")}</TableHead>
                    <TableHead className="text-right">{tScm("k_7c62a1424469")}</TableHead>
                    <TableHead className="text-right">{tScm("k_8705b9ef375d")}</TableHead>
                    <TableHead>{tScm("k_3461e78baba4")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {tScm("k_0066e91968d9")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    agingRows.map((row) => (
                      <TableRow key={`${row.warehouse.id}-${row.variant.id}`}>
                        <TableCell>
                          <div className="font-medium">{row.warehouse.name}</div>
                          <div className="text-xs text-muted-foreground">{row.warehouse.code}</div>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/scm/stock-cards?warehouseId=${row.warehouse.id}&variantId=${row.variant.id}&search=${encodeURIComponent(row.variant.sku)}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {row.variant.product.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{row.variant.sku}</div>
                        </TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{row.available}</TableCell>
                        <TableCell className="text-right">{row.ageDays ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.lastMovement ? new Date(row.lastMovement).toLocaleString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_69eb3361a9d0")}</CardTitle>
              <CardDescription>{tScm("k_f7c7633cb34d")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tScm("k_298dff72dae2")}</TableHead>
                    <TableHead className="text-right">{tScm("k_ebb3f5381b0b")}</TableHead>
                    <TableHead className="text-right">{tScm("k_d07b02aa58c2")}</TableHead>
                    <TableHead className="text-right">{tScm("k_1ed746e51daf")}</TableHead>
                    <TableHead className="text-right">{tScm("k_1bc0c3721d84")}</TableHead>
                    <TableHead>{tScm("k_2badb6bf625f")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {tScm("k_5cd0a1348209")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyRows.map((row, index) => (
                      <TableRow key={`${row.warehouse?.id ?? "all"}-${index}`}>
                        <TableCell>
                          {row.warehouse ? (
                            <>
                              <Link
                                href={`/admin/scm/stock-cards?warehouseId=${row.warehouse.id}`}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {row.warehouse.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{row.warehouse.code}</div>
                            </>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell className="text-right">{row.daysTracked}</TableCell>
                        <TableCell className="text-right">{row.avgQuantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.avgAvailable.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.endQuantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.endDate ? new Date(row.endDate).toLocaleDateString() : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
