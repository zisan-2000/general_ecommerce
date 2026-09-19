"use client";

import { useTranslations } from "next-intl";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MatchResponse = {
  invoice: {
    id: number;
    invoiceNumber: string;
    matchStatus: string;
    total: number | string;
    supplier: { id: number; name: string; code: string };
    purchaseOrder: { id: number; poNumber: string; warehouse: { name: string; code: string } } | null;
  };
  match: {
    status: string;
    summary: {
      matchedLineCount: number;
      varianceCount: number;
      invoiceSubtotal: string;
      expectedSubtotal: string | null;
      issues: string[];
      lines: Array<{
        id: number;
        sku: string;
        productName: string;
        quantityInvoiced: number;
        quantityReceived: number;
        quantityOrdered: number;
        invoiceUnitCost: string;
        purchaseOrderUnitCost: string | null;
        invoiceLineTotal: string;
        expectedLineTotal: string | null;
        isMatched: boolean;
        issues: string[];
      }>;
    };
  };
};

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || fallbackMessage);
  }
  return data as T;
}

export default function ThreeWayMatchPage() {
  const tScm = useTranslations("ScmAuto");
  const { data: session } = useSession();
  const globalPermissions = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[])
    : [];
  const canRead = globalPermissions.some((permission) =>
    ["three_way_match.read", "supplier_invoices.read", "supplier_invoices.manage"].includes(permission),
  );

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [matches, setMatches] = useState<MatchResponse[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/scm/three-way-match", { cache: "no-store" });
      const data = await readJson<MatchResponse[]>(response, "Failed to load three-way match data");
      setMatches(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load three-way match data");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
  }, [canRead]);

  const visibleMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return matches.filter((entry) => {
      if (statusFilter !== "ALL" && entry.match.status !== statusFilter) {
        return false;
      }
      if (!query) return true;
      return (
        entry.invoice.invoiceNumber.toLowerCase().includes(query) ||
        entry.invoice.supplier.name.toLowerCase().includes(query) ||
        (entry.invoice.purchaseOrder?.poNumber || "").toLowerCase().includes(query)
      );
    });
  }, [matches, search, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tScm("k_ca63a1d38873")}</h1>
          <p className="text-sm text-muted-foreground">
            {tScm("k_8fad5a565731")}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tScm("k_f84a973d8ff4")}
            className="w-full md:w-80"
          />
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {tScm("k_56e3badc4e6c")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{tScm("k_462e3af2a5ca")}</CardTitle>
            <CardDescription>{tScm("k_293db44faf75")}</CardDescription>
          </div>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm md:w-56"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">{tScm("k_6405179d241b")}</option>
            <option value="MATCHED">{tScm("k_1bf3ec5bf8dd")}</option>
            <option value="VARIANCE">{tScm("k_eb39bbf6ccbb")}</option>
            <option value="PENDING">{tScm("k_96f608c16cef")}</option>
          </select>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{tScm("k_c3d5d0d774f0")}</p>
          ) : visibleMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tScm("k_4f25351babce")}</p>
          ) : (
            visibleMatches.map((entry) => (
              <Card key={entry.invoice.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {entry.invoice.invoiceNumber} • {entry.invoice.supplier.name}
                  </CardTitle>
                  <CardDescription>
                    {entry.invoice.purchaseOrder?.poNumber || "No PO"} {tScm("k_b25d2dfab1bd")} {entry.match.status} {tScm("k_e2f689e9dec6")}{" "}
                    {entry.match.summary.varianceCount}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-muted-foreground">{tScm("k_a3d399c1d66a")}</div>
                      <div className="text-lg font-semibold">{entry.match.summary.invoiceSubtotal}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-muted-foreground">{tScm("k_9b21b39480d2")}</div>
                      <div className="text-lg font-semibold">{entry.match.summary.expectedSubtotal || "-"}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-muted-foreground">{tScm("k_e6d8435bd526")}</div>
                      <div className="text-lg font-semibold">{entry.match.summary.matchedLineCount}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-muted-foreground">{tScm("k_459030b6a872")}</div>
                      <div className="text-lg font-semibold">{entry.match.status}</div>
                    </div>
                  </div>

                  {entry.match.summary.issues.length > 0 ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      <div className="font-medium">{tScm("k_cf0a5fd97ed5")}</div>
                      <ul className="mt-2 list-disc pl-5">
                        {entry.match.summary.issues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tScm("k_ecdda59aea5e")}</TableHead>
                        <TableHead>{tScm("k_a34cd60f96a5")}</TableHead>
                        <TableHead>{tScm("k_fec046f9cfe8")}</TableHead>
                        <TableHead>{tScm("k_dcc47fe51216")}</TableHead>
                        <TableHead>{tScm("k_57806a1930ad")}</TableHead>
                        <TableHead>{tScm("k_2aed97257d8d")}</TableHead>
                        <TableHead>{tScm("k_bae7d5be7082")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entry.match.summary.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="font-medium">{line.productName}</div>
                            <div className="text-xs text-muted-foreground">{line.sku}</div>
                            {line.issues.length > 0 ? (
                              <div className="mt-1 text-xs text-destructive">
                                {line.issues.join(" ")}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{line.quantityOrdered}</TableCell>
                          <TableCell>{line.quantityReceived}</TableCell>
                          <TableCell>{line.quantityInvoiced}</TableCell>
                          <TableCell>{line.purchaseOrderUnitCost || "-"}</TableCell>
                          <TableCell>{line.invoiceUnitCost}</TableCell>
                          <TableCell>{line.isMatched ? "Matched" : "Variance"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
