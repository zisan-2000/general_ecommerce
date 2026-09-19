"use client";

import { useTranslations } from "next-intl";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
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

type Zone = {
  id: number;
  warehouseId: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type Aisle = {
  id: number;
  warehouseId: number;
  zoneId: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type Bin = {
  id: number;
  warehouseId: number;
  zoneId: number;
  aisleId: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type BinLevel = {
  id: number;
  quantity: number;
  reserved: number;
  warehouse: Warehouse;
  bin: {
    id: number;
    code: string;
    name: string;
    zone: { id: number; code: string; name: string };
    aisle: { id: number; code: string; name: string };
  };
  variant: { id: number; sku: string; product: { id: number; name: string } };
};

async function readJson<T>(res: Response, errorMessage: string) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || errorMessage);
  }
  return (await res.json()) as T;
}

export default function WarehouseLocationsPage() {
  const tScm = useTranslations("ScmAuto");
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];

  const canRead = permissions.includes("warehouse_locations.read") || permissions.includes("warehouse_locations.manage");
  const canManage = permissions.includes("warehouse_locations.manage");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [binLevels, setBinLevels] = useState<BinLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [zoneForm, setZoneForm] = useState({ code: "", name: "", description: "" });
  const [aisleForm, setAisleForm] = useState({ zoneId: "", code: "", name: "", description: "" });
  const [binForm, setBinForm] = useState({ zoneId: "", aisleId: "", code: "", name: "", description: "" });

  const selectedWarehouseId = Number(warehouseId);

  const loadWarehouses = async () => {
    const res = await fetch("/api/warehouses", { cache: "no-store" });
    const data = await readJson<Warehouse[]>(res, "Failed to load warehouses");
    setWarehouses(data);
    if (!warehouseId && data.length > 0) {
      setWarehouseId(String(data[0].id));
    }
  };

  const loadLocations = async (targetWarehouseId: number) => {
    if (!targetWarehouseId) return;
    const res = await fetch(`/api/scm/warehouse-locations?warehouseId=${targetWarehouseId}`, {
      cache: "no-store",
    });
    const data = await readJson<{ zones: Zone[]; aisles: Aisle[]; bins: Bin[] }>(
      res,
      "Failed to load warehouse locations",
    );
    setZones(data.zones);
    setAisles(data.aisles);
    setBins(data.bins);
  };

  const loadBinLevels = async (targetWarehouseId: number, query = "") => {
    if (!targetWarehouseId) return;
    const qs = new URLSearchParams({ warehouseId: String(targetWarehouseId) });
    if (query.trim()) qs.set("search", query.trim());
    const res = await fetch(`/api/scm/stock-bin-levels?${qs.toString()}`, {
      cache: "no-store",
    });
    const data = await readJson<BinLevel[]>(res, "Failed to load bin stock");
    setBinLevels(data);
  };

  const refreshAll = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      await loadLocations(selectedWarehouseId);
      await loadBinLevels(selectedWarehouseId, search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWarehouses();
  }, []);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    void refreshAll();
  }, [selectedWarehouseId]);

  const createLocation = async (type: "zone" | "aisle" | "bin") => {
    if (!selectedWarehouseId) {
      toast.error(tScm("k_cd495704cc3c"));
      return;
    }
    const payload =
      type === "zone"
        ? {
            type,
            warehouseId: selectedWarehouseId,
            code: zoneForm.code,
            name: zoneForm.name,
            description: zoneForm.description,
          }
        : type === "aisle"
          ? {
              type,
              warehouseId: selectedWarehouseId,
              zoneId: Number(aisleForm.zoneId),
              code: aisleForm.code,
              name: aisleForm.name,
              description: aisleForm.description,
            }
          : {
              type,
              warehouseId: selectedWarehouseId,
              zoneId: Number(binForm.zoneId),
              aisleId: Number(binForm.aisleId),
              code: binForm.code,
              name: binForm.name,
              description: binForm.description,
            };

    const res = await fetch("/api/scm/warehouse-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await readJson(res, "Failed to create location");
    toast.success(tScm("k_ac1c9c296f07"));
    if (type === "zone") setZoneForm({ code: "", name: "", description: "" });
    if (type === "aisle") setAisleForm({ zoneId: "", code: "", name: "", description: "" });
    if (type === "bin")
      setBinForm({ zoneId: "", aisleId: "", code: "", name: "", description: "" });
    await refreshAll();
  };

  const toggleActive = async (type: "zone" | "aisle" | "bin", id: number, isActive: boolean) => {
    const res = await fetch("/api/scm/warehouse-locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, isActive }),
    });
    await readJson(res, "Failed to update location");
    toast.success(tScm("k_4a38f4ef542f"));
    await refreshAll();
  };

  const filteredBinLevels = useMemo(() => {
    if (!search.trim()) return binLevels;
    const term = search.trim().toLowerCase();
    return binLevels.filter((level) => {
      const label = `${level.bin.code} ${level.bin.name} ${level.variant.sku} ${level.variant.product.name}`
        .toLowerCase();
      return label.includes(term);
    });
  }, [binLevels, search]);

  if (!canRead) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {tScm("k_8017aa14a1fd")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tScm("k_1d0c73d85f54")}</h1>
          <p className="text-sm text-muted-foreground">
            {tScm("k_4d786d7f81ef")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {tScm("k_56e3badc4e6c")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_35cd1adc62e7")}</CardTitle>
          <CardDescription>{tScm("k_57e3dc836eaa")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label>{tScm("k_298dff72dae2")}</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">{tScm("k_cfab2ae6ca21")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
            {selectedWarehouseId
              ? "Locations are scoped per warehouse. Use the forms below to create zones, aisles, and bins."
              : "Choose a warehouse to begin configuring locations."}
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_f4b9b43f39db")}</CardTitle>
              <CardDescription>{tScm("k_d2c3b6ac66e3")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={tScm("k_a817f745e86d")}
                value={zoneForm.code}
                onChange={(e) => setZoneForm((cur) => ({ ...cur, code: e.target.value }))}
              />
              <Input
                placeholder={tScm("k_597e227239ad")}
                value={zoneForm.name}
                onChange={(e) => setZoneForm((cur) => ({ ...cur, name: e.target.value }))}
              />
              <Input
                placeholder={tScm("k_388de6fa3aa3")}
                value={zoneForm.description}
                onChange={(e) => setZoneForm((cur) => ({ ...cur, description: e.target.value }))}
              />
              <Button onClick={() => void createLocation("zone")} disabled={!selectedWarehouseId}>
                <Plus className="h-4 w-4" />
                {tScm("k_a06cebbd763a")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_47502e932851")}</CardTitle>
              <CardDescription>{tScm("k_2e3ba75f7cfb")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={aisleForm.zoneId}
                onChange={(e) => setAisleForm((cur) => ({ ...cur, zoneId: e.target.value }))}
              >
                <option value="">{tScm("k_38328d84288b")}</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.code} · {zone.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder={tScm("k_77f625222ed3")}
                value={aisleForm.code}
                onChange={(e) => setAisleForm((cur) => ({ ...cur, code: e.target.value }))}
              />
              <Input
                placeholder={tScm("k_f997dc14c13a")}
                value={aisleForm.name}
                onChange={(e) => setAisleForm((cur) => ({ ...cur, name: e.target.value }))}
              />
              <Input
                placeholder={tScm("k_388de6fa3aa3")}
                value={aisleForm.description}
                onChange={(e) => setAisleForm((cur) => ({ ...cur, description: e.target.value }))}
              />
              <Button onClick={() => void createLocation("aisle")} disabled={!selectedWarehouseId}>
                <Plus className="h-4 w-4" />
                {tScm("k_1e5d5ce9f5f1")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tScm("k_7af6ead5938b")}</CardTitle>
              <CardDescription>{tScm("k_f72be0dbf273")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={binForm.zoneId}
                onChange={(e) =>
                  setBinForm((cur) => ({
                    ...cur,
                    zoneId: e.target.value,
                    aisleId: "",
                  }))
                }
              >
                <option value="">{tScm("k_38328d84288b")}</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.code} · {zone.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={binForm.aisleId}
                onChange={(e) => setBinForm((cur) => ({ ...cur, aisleId: e.target.value }))}
              >
                <option value="">{tScm("k_fc5aead5ed20")}</option>
                {aisles
                  .filter((aisle) => String(aisle.zoneId) === binForm.zoneId)
                  .map((aisle) => (
                    <option key={aisle.id} value={aisle.id}>
                      {aisle.code} · {aisle.name}
                    </option>
                  ))}
              </select>
              <Input
                placeholder={tScm("k_0cc26f9f15b1")}
                value={binForm.code}
                onChange={(e) => setBinForm((cur) => ({ ...cur, code: e.target.value }))}
              />
              <Input
                placeholder={tScm("k_c22b93d3524e")}
                value={binForm.name}
                onChange={(e) => setBinForm((cur) => ({ ...cur, name: e.target.value }))}
              />
              <Input
                placeholder={tScm("k_388de6fa3aa3")}
                value={binForm.description}
                onChange={(e) => setBinForm((cur) => ({ ...cur, description: e.target.value }))}
              />
              <Button onClick={() => void createLocation("bin")} disabled={!selectedWarehouseId}>
                <Plus className="h-4 w-4" />
                {tScm("k_ada2a93103de")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_182e2eb72d8d")}</CardTitle>
            <CardDescription>{tScm("k_43b3e4814601")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tScm("k_adac69379a62")}</TableHead>
                  <TableHead>{tScm("k_709a23220f2c")}</TableHead>
                  <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {tScm("k_73b723177c08")}
                    </TableCell>
                  </TableRow>
                ) : (
                  zones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell>{zone.code}</TableCell>
                      <TableCell>{zone.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage}
                          onClick={() => void toggleActive("zone", zone.id, !zone.isActive)}
                        >
                          {zone.isActive ? "Active" : "Inactive"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_8e17756c679d")}</CardTitle>
            <CardDescription>{tScm("k_a47bac4c5a73")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tScm("k_03efccb49f3f")}</TableHead>
                  <TableHead>{tScm("k_adac69379a62")}</TableHead>
                  <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aisles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {tScm("k_baeb9fbfc94e")}
                    </TableCell>
                  </TableRow>
                ) : (
                  aisles.map((aisle) => {
                    const zone = zones.find((item) => item.id === aisle.zoneId);
                    return (
                      <TableRow key={aisle.id}>
                        <TableCell>{zone ? zone.code : "-"}</TableCell>
                        <TableCell>{aisle.code}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canManage}
                            onClick={() => void toggleActive("aisle", aisle.id, !aisle.isActive)}
                          >
                            {aisle.isActive ? "Active" : "Inactive"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_3f1d8e6968d0")}</CardTitle>
            <CardDescription>{tScm("k_c5b0b7fd8e7c")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tScm("k_ee6f23c25ad0")}</TableHead>
                  <TableHead>{tScm("k_adac69379a62")}</TableHead>
                  <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {tScm("k_4597fbb50fcd")}
                    </TableCell>
                  </TableRow>
                ) : (
                  bins.map((bin) => {
                    const aisle = aisles.find((item) => item.id === bin.aisleId);
                    return (
                      <TableRow key={bin.id}>
                        <TableCell>{aisle ? aisle.code : "-"}</TableCell>
                        <TableCell>{bin.code}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canManage}
                            onClick={() => void toggleActive("bin", bin.id, !bin.isActive)}
                          >
                            {bin.isActive ? "Active" : "Inactive"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_e575f446311c")}</CardTitle>
          <CardDescription>{tScm("k_53ae4625c7f8")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>{tScm("k_bce06414177f")}</Label>
              <Input
                placeholder={tScm("k_3e745c5ffb0d")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void loadBinLevels(selectedWarehouseId, search)}>
              {tScm("k_bce06414177f")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tScm("k_4c5ec7b06df2")}</TableHead>
                <TableHead>{tScm("k_cc91b1ea2c16")}</TableHead>
                <TableHead className="text-right">{tScm("k_1e5ff9e500c2")}</TableHead>
                <TableHead className="text-right">{tScm("k_67a6ff10f1b9")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBinLevels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {tScm("k_41c85e95e11b")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBinLevels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell>
                      <div className="font-medium">{level.bin.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {level.bin.zone.code} / {level.bin.aisle.code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{level.variant.product.name}</div>
                      <div className="text-xs text-muted-foreground">{level.variant.sku}</div>
                    </TableCell>
                    <TableCell className="text-right">{level.quantity}</TableCell>
                    <TableCell className="text-right">{level.reserved}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
