"use client";

import { useTranslations } from "next-intl";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ClipboardCheck, PackageCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScmSectionHeader } from "@/components/admin/scm/ScmSectionHeader";
import { ScmStatCard } from "@/components/admin/scm/ScmStatCard";

type PurchaseOrder = {
  id: number;
  poNumber: string;
  status: string;
  warehouse: { id: number; name: string; code: string };
  supplier: { id: number; name: string; code: string };
  items: Array<{
    id: number;
    quantityOrdered: number;
    quantityReceived: number;
    productVariant: {
      id: number;
      sku: string;
      product: { id: number; name: string };
    };
  }>;
};

type GoodsReceipt = {
  id: number;
  receiptNumber: string;
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

export default function NewGoodsReceiptPage() {
  const tScm = useTranslations("ScmAuto");
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = Array.isArray((session?.user as any)?.permissions)
    ? ((session?.user as any).permissions as string[])
    : [];
  const canManagePosting = permissions.includes("goods_receipts.manage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [quantityDraft, setQuantityDraft] = useState<Record<number, string>>({});

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/scm/purchase-orders", { cache: "no-store" });
      const data = await readJson<PurchaseOrder[]>(response, "Failed to load purchase orders");
      setPurchaseOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManagePosting) {
      void loadPurchaseOrders();
    }
  }, [canManagePosting]);

  const eligiblePurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter((purchaseOrder) =>
        ["APPROVED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status),
      ),
    [purchaseOrders],
  );

  const selectedPurchaseOrder = useMemo(() => {
    const purchaseOrderId = Number(selectedPurchaseOrderId);
    if (!Number.isInteger(purchaseOrderId) || purchaseOrderId <= 0) return null;
    return eligiblePurchaseOrders.find((purchaseOrder) => purchaseOrder.id === purchaseOrderId) || null;
  }, [eligiblePurchaseOrders, selectedPurchaseOrderId]);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      setQuantityDraft({});
      return;
    }
    setQuantityDraft(
      Object.fromEntries(
        selectedPurchaseOrder.items.map((item) => [
          item.id,
          String(Math.max(item.quantityOrdered - item.quantityReceived, 0)),
        ]),
      ),
    );
  }, [selectedPurchaseOrder]);

  const summary = useMemo(
    () => ({
      readyToReceive: eligiblePurchaseOrders.length,
      partiallyReceived: eligiblePurchaseOrders.filter((row) => row.status === "PARTIALLY_RECEIVED")
        .length,
      linesOpen:
        selectedPurchaseOrder?.items.reduce(
          (sum, item) => sum + Math.max(item.quantityOrdered - item.quantityReceived, 0),
          0,
        ) ?? 0,
    }),
    [eligiblePurchaseOrders, selectedPurchaseOrder],
  );

  const postReceipt = async () => {
    if (!selectedPurchaseOrder) {
      toast.error(tScm("k_adb43fa72368"));
      return;
    }

    const payloadItems = selectedPurchaseOrder.items
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantityReceived: Number(quantityDraft[item.id] || 0),
      }))
      .filter((item) => Number.isInteger(item.quantityReceived) && item.quantityReceived > 0);

    if (payloadItems.length === 0) {
      toast.error(tScm("k_aed8b875ba09"));
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/scm/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: selectedPurchaseOrder.id,
          note: receiptNote,
          items: payloadItems,
        }),
      });
      const created = await readJson<GoodsReceipt>(response, "Failed to post goods receipt");
      toast.success(tScm("k_55ded0a954d4"));
      router.push(`/admin/scm/goods-receipts/${created.id}`);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to post goods receipt");
    } finally {
      setSaving(false);
    }
  };

  if (!canManagePosting) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{tScm("k_3dab5f6012e3")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tScm("k_89be79b95b43")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <ScmSectionHeader
        title={tScm("k_c70a7bee590d")}
        description={tScm("k_f474fb5ec1cc")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/scm/goods-receipts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tScm("k_1763e9ae8697")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void loadPurchaseOrders()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {tScm("k_56e3badc4e6c")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ScmStatCard label={tScm("k_19658080540b")} value={String(summary.readyToReceive)} hint={tScm("k_57c8f945195f")} icon={PackageCheck} />
        <ScmStatCard label={tScm("k_6ae6c2d973e7")} value={String(summary.partiallyReceived)} hint={tScm("k_413538ff1a98")} icon={ClipboardCheck} />
        <ScmStatCard label={tScm("k_0cee1b3dad5f")} value={String(summary.linesOpen)} hint={tScm("k_d5d7f2256856")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_32efc23f1f7b")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{tScm("k_3c45b957fdc8")}</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={selectedPurchaseOrderId}
              onChange={(event) => setSelectedPurchaseOrderId(event.target.value)}
            >
              <option value="">{tScm("k_973848060da3")}</option>
              {eligiblePurchaseOrders.map((purchaseOrder) => (
                <option key={purchaseOrder.id} value={purchaseOrder.id}>
                  {purchaseOrder.poNumber} • {purchaseOrder.supplier.name} • {purchaseOrder.warehouse.code}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-muted-foreground">
            {tScm("k_f6e2911e17f7")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_e786b8d41f53")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{tScm("k_3c9a728cd2da")}</p>
          ) : !selectedPurchaseOrder ? (
            <p className="text-sm text-muted-foreground">
              {tScm("k_7a71979cb898")}
            </p>
          ) : (
            <>
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                {selectedPurchaseOrder.supplier.name} • {selectedPurchaseOrder.warehouse.name} • {selectedPurchaseOrder.status}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                      <TableHead>{tScm("k_c9dd3b77c90c")}</TableHead>
                      <TableHead>{tScm("k_27548c4fc95d")}</TableHead>
                      <TableHead>{tScm("k_cc632b5e2fd2")}</TableHead>
                      <TableHead>{tScm("k_d60a7fe92a15")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPurchaseOrder.items.map((item) => {
                      const remaining = Math.max(item.quantityOrdered - item.quantityReceived, 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.productVariant.product.name}</div>
                            <div className="text-xs text-muted-foreground">{item.productVariant.sku}</div>
                          </TableCell>
                          <TableCell>{item.quantityOrdered}</TableCell>
                          <TableCell>{item.quantityReceived}</TableCell>
                          <TableCell>{remaining}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={remaining}
                              value={quantityDraft[item.id] ?? "0"}
                              onChange={(event) =>
                                setQuantityDraft((prev) => ({ ...prev, [item.id]: event.target.value }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tScm("k_bade8c81daf3")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{tScm("k_505862ef4ca7")}</Label>
            <Textarea
              rows={4}
              value={receiptNote}
              onChange={(event) => setReceiptNote(event.target.value)}
              placeholder={tScm("k_a48f9714c2d7")}
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            {tScm("k_fa7f1fe91d7b")}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/scm/goods-receipts")}>
              {tScm("k_77dfd2135f4d")}
            </Button>
            <Button onClick={() => void postReceipt()} disabled={saving || !selectedPurchaseOrder}>
              {saving ? "Posting..." : "Post Goods Receipt"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
