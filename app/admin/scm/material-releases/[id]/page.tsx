"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
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
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";

type MaterialRelease = {
  id: number;
  releaseNumber: string;
  status: string;
  challanNumber: string | null;
  waybillNumber: string | null;
  note: string | null;
  releasedAt: string;
  warehouse: { id: number; name: string; code: string };
  releasedBy: { id: string; name: string | null; email: string } | null;
  materialRequest: {
    id: number;
    requestNumber: string;
    status: string;
    createdBy: { id: string; name: string | null; email: string } | null;
  };
  items: Array<{
    id: number;
    quantityReleased: number;
    unitCost: string | null;
    materialRequestItem: {
      id: number;
      quantityRequested: number;
      quantityReleased: number;
    };
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
    assetRegisters: Array<{
      id: number;
      assetTag: string;
      status: string;
    }>;
  }>;
  assetRegisters: Array<{
    id: number;
    assetTag: string;
    status: string;
    productVariantId: number;
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

function formatMoney(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

export default function MaterialReleaseDetailPage() {
  const tScm = useTranslations("ScmAuto");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const materialReleaseId = Number(params?.id);
  const [materialRelease, setMaterialRelease] = useState<MaterialRelease | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMaterialRelease = async () => {
    if (!Number.isInteger(materialReleaseId) || materialReleaseId <= 0) {
      toast.error(tScm("k_5611d6703831"));
      router.replace("/admin/scm/material-releases");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`/api/scm/material-releases/${materialReleaseId}`, {
        cache: "no-store",
      });
      const data = await readJson<MaterialRelease>(response, "Failed to load material release");
      setMaterialRelease(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load material release");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMaterialRelease();
  }, [materialReleaseId]);

  const lifecycleStages = useMemo(() => {
    if (!materialRelease) return [];
    return [
      {
        key: "request",
        label: tScm("k_074f52030ded"),
        value: materialRelease.materialRequest.requestNumber,
        helperText: toStageLabel(materialRelease.materialRequest.status),
        href: `/admin/scm/material-requests/${materialRelease.materialRequest.id}`,
        state: "linked" as const,
      },
      {
        key: "release",
        label: tScm("k_eb3a2805438a"),
        value: materialRelease.releaseNumber,
        helperText: toStageLabel(materialRelease.status),
        href: `/admin/scm/material-releases/${materialRelease.id}`,
        state: "current" as const,
      },
      {
        key: "assets",
        label: tScm("k_1c8091bffc2a"),
        value: materialRelease.assetRegisters.length > 0 ? `${materialRelease.assetRegisters.length} tags` : "No tags",
        helperText: materialRelease.assetRegisters.length > 0 ? "Permanent assets registered" : "Consumable-only issue",
        href: null,
        state: materialRelease.assetRegisters.length > 0 ? ("linked" as const) : ("pending" as const),
      },
    ];
  }, [materialRelease]);

  if (loading) {
    return <div className="space-y-6 p-6"><p className="text-sm text-muted-foreground">{tScm("k_1ba807e40938")}</p></div>;
  }

  if (!materialRelease) {
    return (
      <div className="space-y-6 p-6">
        <Button asChild variant="outline">
          <Link href="/admin/scm/material-releases">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tScm("k_1763e9ae8697")}
          </Link>
        </Button>
        <Card><CardContent className="py-10 text-sm text-muted-foreground">{tScm("k_546d90eb1248")}</CardContent></Card>
      </div>
    );
  }

  const totalQty = materialRelease.items.reduce((sum, item) => sum + item.quantityReleased, 0);
  const totalValue = materialRelease.items.reduce((sum, item) => sum + Number(item.unitCost || 0) * item.quantityReleased, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/scm/material-releases">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tScm("k_b52b36b7269f")}
              </Link>
            </Button>
            <ScmStatusChip status={materialRelease.status} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{materialRelease.releaseNumber}</h1>
            <p className="text-sm text-muted-foreground">{materialRelease.warehouse.name} {tScm("k_ad17d9f4a55e")} {materialRelease.materialRequest.requestNumber}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void loadMaterialRelease()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {tScm("k_56e3badc4e6c")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScmStatCard label={tScm("k_298dff72dae2")} value={materialRelease.warehouse.name} hint={materialRelease.warehouse.code} />
        <ScmStatCard label={tScm("k_9108e105d676")} value={String(totalQty)} hint={`${materialRelease.items.length} release lines`} />
        <ScmStatCard label={tScm("k_1c8091bffc2a")} value={String(materialRelease.assetRegisters.length)} hint={materialRelease.assetRegisters.length > 0 ? "Generated from permanent items" : "No fixed asset tags"} />
        <ScmStatCard label={tScm("k_c6daeb930ba2")} value={formatMoney(totalValue)} hint={`Released ${new Date(materialRelease.releasedAt).toLocaleDateString()}`} />
      </div>

      <ScmDocumentLifecycle stages={lifecycleStages} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="justify-start">
              <TabsTrigger value="overview">{tScm("k_0efc2e6be4c2")}</TabsTrigger>
              <TabsTrigger value="items">{tScm("k_44d25b5d1b6d")}</TabsTrigger>
              <TabsTrigger value="assets">{tScm("k_20e338624cee")}</TabsTrigger>
              <TabsTrigger value="request">{tScm("k_f60b848e3f8c")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader><CardTitle>{tScm("k_ed0df98a9681")}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_e9a9cc2db639")}</div><p className="mt-2 text-sm">{fmtDate(materialRelease.releasedAt)}</p></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_5e40600cd3c0")}</div><p className="mt-2 text-sm">{materialRelease.releasedBy?.name || materialRelease.releasedBy?.email || "-"}</p></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_bbcec6a90780")}</div><p className="mt-2 text-sm">{materialRelease.challanNumber || "-"}</p></div>
                  <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_30fb7e4989bb")}</div><p className="mt-2 text-sm">{materialRelease.waybillNumber || "-"}</p></div>
                  <div className="md:col-span-2"><div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_2c924e308820")}</div><p className="mt-2 text-sm whitespace-pre-wrap">{materialRelease.note || "-"}</p></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items">
              <Card>
                <CardHeader><CardTitle>{tScm("k_c6715416a114")}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                        <TableHead>{tScm("k_35d9bc51591e")}</TableHead>
                        <TableHead>{tScm("k_0105252023c5")}</TableHead>
                        <TableHead>{tScm("k_275a184c0190")}</TableHead>
                        <TableHead>{tScm("k_1c8091bffc2a")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialRelease.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.productVariant.product.name}</div>
                            <div className="text-xs text-muted-foreground">{item.productVariant.sku}</div>
                          </TableCell>
                          <TableCell>{item.quantityReleased}</TableCell>
                          <TableCell>{formatMoney(item.unitCost)}</TableCell>
                          <TableCell>{formatMoney(Number(item.unitCost || 0) * item.quantityReleased)}</TableCell>
                          <TableCell>{item.assetRegisters.length > 0 ? `${item.assetRegisters.length} tags` : "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets">
              <Card>
                <CardHeader><CardTitle>{tScm("k_06844bb80bbe")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {materialRelease.assetRegisters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tScm("k_fa1e8b7eb937")}</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {materialRelease.assetRegisters.map((asset) => (
                        <div key={asset.id} className="rounded-lg border p-3 text-sm">
                          <div className="font-medium">{asset.assetTag}</div>
                          <div className="text-muted-foreground">{toStageLabel(asset.status)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="request">
              <Card>
                <CardHeader><CardTitle>{tScm("k_fbf16c0e410e")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_ecf600582836")}</div>
                    <div className="mt-2 text-sm">
                      <Link href={`/admin/scm/material-requests/${materialRelease.materialRequest.id}`} className="underline-offset-4 hover:underline">
                        {materialRelease.materialRequest.requestNumber}
                      </Link>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{tScm("k_bcdf8d373d33")}</div>
                    <div className="mt-2 text-sm">{materialRelease.materialRequest.createdBy?.name || materialRelease.materialRequest.createdBy?.email || "-"}</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{tScm("k_76c6d44c0c2c")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={`/admin/scm/material-requests/${materialRelease.materialRequest.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {tScm("k_a257d7de5a31")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
