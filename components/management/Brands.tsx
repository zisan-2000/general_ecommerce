"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit3, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import SpotlightCard from "../SpotlightCard";

export default function BrandManager({
  brands,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}: any) {
  const t = useTranslations("AdminBrandManager");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [form, setForm] = useState({
    name: "",
    logo: null as string | null,
  });

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  /* =========================
     MODAL CONTROL
  ========================= */

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSubmitting(false);
    setImageFile(null);
    setImagePreviewUrl(null);
    setFileInputKey((k) => k + 1);
    setForm({ name: "", logo: null });
  };

  const openAdd = () => {
    setEditing(null);
    setImageFile(null);
    setImagePreviewUrl(null);
    setFileInputKey((k) => k + 1);
    setForm({ name: "", logo: null });
    setModalOpen(true);
  };

  const openEdit = (brand: any) => {
    setEditing(brand);
    setImageFile(null);
    setImagePreviewUrl(brand.logo ?? null);
    setFileInputKey((k) => k + 1);
    setForm({ name: brand.name, logo: brand.logo ?? null });
    setModalOpen(true);
  };

  /* =========================
     IMAGE UPLOAD
  ========================= */

  const uploadBrandImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload/brands", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    const fileUrl =
      typeof data?.url === "string"
        ? data.url
        : typeof data?.fileUrl === "string"
          ? data.fileUrl
          : null;

    if (!res.ok || !data?.success || !fileUrl) {
      throw new Error(
        data?.error || data?.message || t("errors.imageUploadFailed"),
      );
    }

    return fileUrl;
  };

  /* =========================
     SUBMIT
  ========================= */

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error(t("errors.nameRequired"));
      return;
    }

    try {
      setSubmitting(true);

      let logoUrl = form.logo ?? null;

      if (imageFile) {
        logoUrl = await uploadBrandImage(imageFile);
      }

      const payload = {
        name: form.name,
        logo: logoUrl,
      };

      if (editing) {
        await onUpdate(editing.id, payload);
        toast.success(t("success.updated"));
      } else {
        await onCreate(payload);
        toast.success(t("success.created"));
      }

      closeModal();
    } catch (err: any) {
      toast.error(err?.message || t("errors.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="p-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("header.title")}</h1>
        <Button onClick={openAdd}>
          <Plus size={16} className="mr-2" />
          {t("actions.addBrand")}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="border rounded-lg p-4 bg-card">
              <div className="h-20 bg-muted animate-pulse rounded overflow-hidden" />
              <div className="h-4 bg-muted animate-pulse rounded mt-3" />
              <div className="flex gap-2 mt-3">
                <div className="h-8 bg-muted animate-pulse rounded flex-1" />
                <div className="h-8 bg-muted animate-pulse rounded w-8" />
              </div>
            </div>
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">{t("empty.title")}</h3>
          <p className="text-muted-foreground mb-6">{t("empty.description")}</p>
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" />
            {t("actions.addBrand")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          {brands.map((b: any) => (
            <SpotlightCard key={b.id}>
              <div className="h-20 flex items-center justify-center bg-muted rounded overflow-hidden">
                {b.logo ? (
                  <img
                    src={b.logo}
                    className="h-full object-contain"
                    alt={t("card.logoAlt", { name: b.name })}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("card.noLogo")}
                  </span>
                )}
              </div>

              <h3 className="mt-3 font-medium">{b.name}</h3>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="btn-primary"
                  onClick={() => openEdit(b)}
                >
                  <Edit3 size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(b.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-card p-6 rounded-lg w-[400px] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editing ? t("modal.titleEdit") : t("modal.titleNew")}
              </h2>
              <Button size="icon" variant="ghost" onClick={closeModal}>
                <X size={18} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label>{t("form.name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <Label>{t("form.logo")}</Label>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 border rounded overflow-hidden bg-muted flex items-center justify-center">
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        className="h-full w-full object-cover"
                        alt={t("form.logoPreviewAlt")}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {t("form.noImage")}
                      </span>
                    )}
                  </div>

                  <Input
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (imagePreviewUrl?.startsWith("blob:")) {
                        URL.revokeObjectURL(imagePreviewUrl);
                      }

                      setImageFile(file);
                      setImagePreviewUrl(URL.createObjectURL(file));
                    }}
                  />
                </div>

                {(imagePreviewUrl || form.logo) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      if (imagePreviewUrl?.startsWith("blob:")) {
                        URL.revokeObjectURL(imagePreviewUrl);
                      }
                      setImageFile(null);
                      setImagePreviewUrl(null);
                      setFileInputKey((k) => k + 1);
                      setForm({ ...form, logo: null });
                    }}
                  >
                    {t("form.removeImage")}
                  </Button>
                )}
              </div>

              <Button onClick={submit} disabled={submitting} className="w-full">
                {submitting
                  ? t("actions.saving")
                  : editing
                    ? t("actions.update")
                    : t("actions.create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
