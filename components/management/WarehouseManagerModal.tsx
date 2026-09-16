"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Warehouse {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WarehouseManagerModal({ open, onClose }: Props) {
  const t = useTranslations("AdminWarehouseManager");

  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState({ name: "", code: "", isDefault: false });

  const sorted = useMemo(() => {
    return [...warehouses].sort((a, b) =>
      a.isDefault === b.isDefault ? b.id - a.id : a.isDefault ? -1 : 1,
    );
  }, [warehouses]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/warehouses", { cache: "no-store" });
      const data = await res.json();
      setWarehouses(data || []);
    } catch (err) {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createWarehouse = async () => {
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name || !code) {
      toast.error(t("errors.nameCodeRequired"));
      return;
    }

    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("errors.createFailed"));

      toast.success(t("success.created"));
      setForm({ name: "", code: "", isDefault: false });
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.createFailed"));
    }
  };

  const deleteWarehouse = async (id: number) => {
    if (!confirm(t("confirm.deleteWarehouse"))) return;

    try {
      const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.deleteFailed"));

      toast.success(t("success.deleted"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.deleteFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t("title")}
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="border rounded-lg p-4">
            <p className="font-semibold mb-3">{t("addTitle")}</p>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label>{t("fields.name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={loading}
                />
              </div>
              <div>
                <Label>{t("fields.code")}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={loading}
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) =>
                      setForm({ ...form, isDefault: e.target.checked })
                    }
                    disabled={loading}
                  />
                  {t("fields.default")}
                </label>
                <Button onClick={createWarehouse} disabled={loading}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("actions.add")}
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("empty.noWarehouses")}
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {sorted.map((w) => (
                <div key={w.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {w.name}{" "}
                        {w.isDefault && (
                          <span className="text-xs ml-2 px-2 py-0.5 rounded-full border">
                            {t("defaultBadge")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("codeLabel", { code: w.code })}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => deleteWarehouse(w.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
