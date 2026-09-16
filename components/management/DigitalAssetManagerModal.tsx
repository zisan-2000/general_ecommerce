"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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

interface DigitalAsset {
  id: number;
  title: string;
  fileUrl: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DigitalAssetManagerModal({ open, onClose }: Props) {
  const t = useTranslations("AdminDigitalAssets");

  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<DigitalAsset[]>([]);
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const sorted = useMemo(
    () => [...assets].sort((a, b) => b.id - a.id),
    [assets],
  );

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/digital-assets", { cache: "no-store" });
      const data = await res.json();
      setAssets(data || []);
    } catch {
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

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload/digital-assets", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      throw new Error(data?.message || t("errors.uploadFailed"));
    }
    return data.url as string;
  };

  const handleFilePick = async (file: File) => {
    try {
      setUploading(true);
      const url = await uploadFile(file);
      setFileUrl(url);
      if (!title.trim()) {
        setTitle(file.name);
      }
      toast.success(t("upload.uploaded"));
    } catch (err: any) {
      toast.error(err?.message || t("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const createAsset = async () => {
    const trimmedTitle = title.trim();
    const trimmedUrl = fileUrl.trim();
    if (!trimmedTitle || !trimmedUrl) {
      toast.error(t("errors.titleAndUrlRequired"));
      return;
    }

    try {
      const res = await fetch("/api/digital-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle, fileUrl: trimmedUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.createFailed"));

      toast.success(t("create.created"));
      setTitle("");
      setFileUrl("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.createFailed"));
    }
  };

  const deleteAsset = async (id: number) => {
    if (!confirm(t("confirm.deleteAsset"))) return;
    try {
      const res = await fetch(`/api/digital-assets/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.deleteFailed"));

      toast.success(t("common.deleted"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.deleteFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t("title")}
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="border rounded-lg p-4 space-y-3">
            <p className="font-semibold">{t("create.title")}</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>{t("create.assetTitle")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading || uploading}
                />
              </div>
              <div>
                <Label>{t("create.fileUrl")}</Label>
                <Input
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  disabled={loading || uploading}
                  placeholder={t("create.fileUrlPlaceholder")}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFilePick(f);
                }}
                disabled={loading || uploading}
              />
              <Button onClick={createAsset} disabled={loading || uploading}>
                <Plus className="h-4 w-4 mr-1" />
                {t("actions.create")}
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty.assets")}</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {sorted.map((a) => (
                <div key={a.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground break-all">
                        {a.fileUrl}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => deleteAsset(a.id)}
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
