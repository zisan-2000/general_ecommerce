"use client";

import { useTranslations } from "next-intl";


import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MaterialRelease = {
  id: number;
  releaseNumber: string;
  challanNumber: string | null;
  waybillNumber: string | null;
  status: string;
  releasedAt: string;
  note: string | null;
  warehouse: {
    id: number;
    name: string;
    code: string;
  };
  materialRequest: {
    id: number;
    requestNumber: string;
    createdBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
  releasedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items: Array<{
    id: number;
    quantityReleased: number;
    unitCost: string | null;
    productVariant: {
      id: number;
      sku: string;
      product: {
        id: number;
        name: string;
      };
    };
    assetRegisters: Array<{
      id: number;
      assetTag: string;
      status: string;
    }>;
  }>;
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

function formatMoney(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2);
}

export default function MaterialReleasePrintPage() {
  const tScm = useTranslations("ScmAuto");
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const printType = (searchParams.get("type") || "challan").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [release, setRelease] = useState<MaterialRelease | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/scm/material-releases/${params.id}`, {
          cache: "no-store",
        });
        const data = await readJson<MaterialRelease>(response, "Failed to load release note");
        setRelease(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load release note");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      void loadData();
    }
  }, [params.id]);

  const totals = useMemo(() => {
    if (!release) return { qty: 0, value: 0 };
    const qty = release.items.reduce((sum, item) => sum + item.quantityReleased, 0);
    const value = release.items.reduce(
      (sum, item) => sum + Number(item.unitCost || 0) * item.quantityReleased,
      0,
    );
    return { qty, value };
  }, [release]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{tScm("k_9aba059ebb56")}</div>;
  }

  if (error || !release) {
    return <div className="p-6 text-sm text-destructive">{error || "Release not found"}</div>;
  }

  const title = printType === "waybill" ? "Material Waybill" : "Material Challan";
  const docNo = printType === "waybill" ? release.waybillNumber : release.challanNumber;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold">{title}</h1>
        <Button onClick={() => window.print()}>{tScm("k_5b221e9c2a45")}</Button>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <div><strong>{tScm("k_9e515d40898a")}</strong> {docNo || "AUTO"}</div>
              <div><strong>{tScm("k_3f22fcd2ae0f")}</strong> {release.releaseNumber}</div>
              <div><strong>{tScm("k_2c1cdd6bce0e")}</strong> {release.materialRequest.requestNumber}</div>
              <div><strong>{tScm("k_11dc9e195292")}</strong> {release.status}</div>
            </div>
            <div>
              <div><strong>{tScm("k_edce1fb96bf3")}</strong> {release.warehouse.name} ({release.warehouse.code})</div>
              <div><strong>{tScm("k_702f46bcd39f")}</strong> {formatDateTime(release.releasedAt)}</div>
              <div><strong>{tScm("k_730a5474aa58")}</strong> {release.releasedBy?.name || release.releasedBy?.email || "N/A"}</div>
              <div><strong>{tScm("k_c0f1db2d87f9")}</strong> {release.materialRequest.createdBy?.name || release.materialRequest.createdBy?.email || "N/A"}</div>
            </div>
          </div>

          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr>
                <th className="border px-2 py-1 text-left">{tScm("k_ecdda59aea5e")}</th>
                <th className="border px-2 py-1 text-left">{tScm("k_d59192b9c8f2")}</th>
                <th className="border px-2 py-1 text-right">{tScm("k_1e5ff9e500c2")}</th>
                <th className="border px-2 py-1 text-right">{tScm("k_0105252023c5")}</th>
                <th className="border px-2 py-1 text-right">{tScm("k_2d1a09efa038")}</th>
              </tr>
            </thead>
            <tbody>
              {release.items.map((item) => (
                <tr key={item.id}>
                  <td className="border px-2 py-1">{item.productVariant.product.name}</td>
                  <td className="border px-2 py-1">{item.productVariant.sku}</td>
                  <td className="border px-2 py-1 text-right">{item.quantityReleased}</td>
                  <td className="border px-2 py-1 text-right">{formatMoney(item.unitCost)}</td>
                  <td className="border px-2 py-1 text-right">
                    {formatMoney(Number(item.unitCost || 0) * item.quantityReleased)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="border px-2 py-1" colSpan={2}><strong>{tScm("k_b25928c69902")}</strong></td>
                <td className="border px-2 py-1 text-right"><strong>{totals.qty}</strong></td>
                <td className="border px-2 py-1" />
                <td className="border px-2 py-1 text-right"><strong>{formatMoney(totals.value)}</strong></td>
              </tr>
            </tfoot>
          </table>

          {release.items.some((item) => item.assetRegisters.length > 0) ? (
            <div>
              <div className="mb-1 font-semibold">{tScm("k_1c8091bffc2a")}</div>
              <div className="space-y-1 text-xs">
                {release.items
                  .filter((item) => item.assetRegisters.length > 0)
                  .map((item) => (
                    <div key={item.id}>
                      {item.productVariant.sku}: {item.assetRegisters.map((asset) => asset.assetTag).join(", ")}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {release.note ? (
            <div>
              <div className="font-semibold">{tScm("k_2c924e308820")}</div>
              <div>{release.note}</div>
            </div>
          ) : null}

          <div className="grid gap-6 pt-10 md:grid-cols-3">
            <div className="border-t pt-2 text-center">{tScm("k_447abf81cf80")}</div>
            <div className="border-t pt-2 text-center">{tScm("k_80f2a2955c12")}</div>
            <div className="border-t pt-2 text-center">{tScm("k_2b62a43b5586")}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
