"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScmSectionHeader } from "@/components/admin/scm/ScmSectionHeader";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";

type Warehouse = {
  id: number;
  name: string;
  code: string;
};

type MaterialRequest = {
  id: number;
  requestNumber: string;
  warehouseId: number;
  status: string;
  purpose: string | null;
  requiredBy: string | null;
  warehouse: Warehouse;
  items: Array<{
    id: number;
    quantityRequested: number;
    quantityReleased: number;
    productVariantId: number;
    productVariant: {
      id: number;
      sku: string;
      product: {
        id: number;
        name: string;
      };
    };
  }>;
};

type MaterialRelease = {
  id: number;
  releaseNumber: string;
};

type ReleaseDraftItem = {
  materialRequestItemId: number;
  productName: string;
  sku: string;
  quantityRequested: number;
  quantityReleased: number;
  remainingQty: number;
  quantityToRelease: string;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload as T;
}

function formatDateTime(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

export default function NewMaterialReleasePage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManage = permissions.includes("material_releases.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [materialRequestId, setMaterialRequestId] = useState("");
  const [note, setNote] = useState("");
  const [challanNumber, setChallanNumber] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [releaseItems, setReleaseItems] = useState<ReleaseDraftItem[]>([]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const requestData = await fetch("/api/scm/material-requests", { cache: "no-store" }).then((res) =>
        readJson<MaterialRequest[]>(res, "Failed to load material requests"),
      );
      setMaterialRequests(Array.isArray(requestData) ? requestData : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load releasable requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      void loadRequests();
    }
  }, [canManage]);

  const releasableRequests = useMemo(
    () =>
      materialRequests.filter((request) =>
        ["ADMIN_APPROVED", "PARTIALLY_RELEASED"].includes(request.status),
      ),
    [materialRequests],
  );

  const selectedMaterialRequest = useMemo(
    () => releasableRequests.find((request) => request.id === Number(materialRequestId)) ?? null,
    [materialRequestId, releasableRequests],
  );

  useEffect(() => {
    if (!selectedMaterialRequest) {
      setReleaseItems([]);
      return;
    }

    setReleaseItems(
      selectedMaterialRequest.items.map((item) => {
        const remainingQty = Math.max(0, item.quantityRequested - item.quantityReleased);
        return {
          materialRequestItemId: item.id,
          productName: item.productVariant.product.name,
          sku: item.productVariant.sku,
          quantityRequested: item.quantityRequested,
          quantityReleased: item.quantityReleased,
          remainingQty,
          quantityToRelease: remainingQty > 0 ? String(remainingQty) : "",
        };
      }),
    );
  }, [selectedMaterialRequest]);

  const summary = useMemo(
    () => ({
      releasable: releasableRequests.length,
      openLines:
        selectedMaterialRequest?.items.reduce(
          (sum, item) => sum + Math.max(item.quantityRequested - item.quantityReleased, 0),
          0,
        ) ?? 0,
      partialRequests: releasableRequests.filter((request) => request.status === "PARTIALLY_RELEASED")
        .length,
    }),
    [releasableRequests, selectedMaterialRequest],
  );

  const updateReleaseItem = (index: number, value: string) => {
    setReleaseItems((current) =>
      current.map((item, idx) => (idx === index ? { ...item, quantityToRelease: value } : item)),
    );
  };

  const createRelease = async () => {
    if (!selectedMaterialRequest) {
      toast.error(tScm("k_01cf2a054564"));
      return;
    }

    const payloadItems = releaseItems
      .map((item) => ({
        materialRequestItemId: item.materialRequestItemId,
        quantityReleased: Number(item.quantityToRelease),
      }))
      .filter((item) => Number.isInteger(item.quantityReleased) && item.quantityReleased > 0);

    if (payloadItems.length === 0) {
      toast.error(tScm("k_d0aa9c28a413"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/scm/material-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialRequestId: selectedMaterialRequest.id,
          note,
          challanNumber: challanNumber || null,
          waybillNumber: waybillNumber || null,
          items: payloadItems,
        }),
      });
      const created = await readJson<MaterialRelease>(response, "Failed to issue material release");
      toast.success(tScm("k_e65998f5d8d3"));
      router.push(`/admin/scm/material-releases?search=${encodeURIComponent(created.releaseNumber)}`);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to issue material release");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_3dab5f6012e3")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tScm("k_6c7859f4f707")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <ScmSectionHeader
        title={tScm("k_4664e0332c53")}
        description={tScm("k_8bf5a91063ec")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/scm/material-releases">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tScm("k_1763e9ae8697")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void loadRequests()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {tScm("k_56e3badc4e6c")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ScmStatCard label={tScm("k_60c59538868f")} value={String(summary.releasable)} hint={tScm("k_64028e895e0c")} />
        <ScmStatCard label={tScm("k_0d3d1f76e9cc")} value={String(summary.partialRequests)} hint={tScm("k_6e95ce02290e")} icon={ClipboardCheck} />
        <ScmStatCard label={tScm("k_0cee1b3dad5f")} value={String(summary.openLines)} hint={tScm("k_f787fbcbaba4")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_0ccc973c8c4d")}</CardTitle>
          <CardDescription>
            {tScm("k_2340df1dfce5")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{tScm("k_074f52030ded")}</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={materialRequestId}
              onChange={(event) => setMaterialRequestId(event.target.value)}
            >
              <option value="">{tScm("k_0df479644b08")}</option>
              {releasableRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.requestNumber} - {request.warehouse.name} ({request.status})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_9210f1639e82")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{tScm("k_68f86fd1267b")}</Label>
            <Input
              value={challanNumber}
              onChange={(event) => setChallanNumber(event.target.value)}
              placeholder={tScm("k_5e564164709b")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tScm("k_dc60c7ace45e")}</Label>
            <Input
              value={waybillNumber}
              onChange={(event) => setWaybillNumber(event.target.value)}
              placeholder={tScm("k_5e564164709b")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tScm("k_d1c29194ea1d")}</Label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_4a2a33416e3b")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedMaterialRequest ? (
            <p className="text-sm text-muted-foreground">
              {tScm("k_a3b0fca59407")}
            </p>
          ) : (
            <>
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                {tScm("k_ec0e7ce9ae95")} {selectedMaterialRequest.requestNumber} {tScm("k_03132f2317a5")} {selectedMaterialRequest.warehouse.name} {tScm("k_634e7b7de11e")} {formatDateTime(selectedMaterialRequest.requiredBy)}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                    <TableHead>{tScm("k_c26bf60fed37")}</TableHead>
                    <TableHead>{tScm("k_35d9bc51591e")}</TableHead>
                    <TableHead>{tScm("k_cc632b5e2fd2")}</TableHead>
                    <TableHead>{tScm("k_d862ce4666fb")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releaseItems.map((item, index) => (
                    <TableRow key={item.materialRequestItemId}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      <TableCell>{item.quantityRequested}</TableCell>
                      <TableCell>{item.quantityReleased}</TableCell>
                      <TableCell>{item.remainingQty}</TableCell>
                      <TableCell className="w-40">
                        <Input
                          type="number"
                          min={0}
                          max={item.remainingQty}
                          value={item.quantityToRelease}
                          onChange={(event) => updateReleaseItem(index, event.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_80fb33f8fb91")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {tScm("k_7c5e8ebac6e8")}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/scm/material-releases")}>
              {tScm("k_77dfd2135f4d")}
            </Button>
            <Button onClick={() => void createRelease()} disabled={saving || !selectedMaterialRequest}>
              {saving ? "Issuing..." : "Issue Release"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
