"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { X } from "lucide-react";
import Image from "next/image";

const BANNER_TYPES = [
  "HERO",
  "BANNER1",
  "BANNER2",
  "PROMOTION",
  "POPUP",
] as const;

type BannerType = (typeof BANNER_TYPES)[number];

const BANNER_TYPE_TRANSLATION_KEYS: Record<
  BannerType,
  `bannerTypes.${BannerType}`
> = {
  HERO: "bannerTypes.HERO",
  BANNER1: "bannerTypes.BANNER1",
  BANNER2: "bannerTypes.BANNER2",
  PROMOTION: "bannerTypes.PROMOTION",
  POPUP: "bannerTypes.POPUP",
};

const isBannerType = (value: string): value is BannerType =>
  BANNER_TYPES.includes(value as BannerType);

interface Banner {
  id: number;
  title: string;
  image: string;
  type: BannerType;
  position: number;
  isActive: boolean;
}

interface Props {
  banners: Banner[];
  onCreate: (data: any) => Promise<void>;
  onUpdate: (id: number, data: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function BannerManager({
  banners,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const t = useTranslations("AdminBannerManager");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);

  const [form, setForm] = useState<{
    title: string;
    image: string;
    type: BannerType;
    position: number;
    isActive: boolean;
  }>({
    title: "",
    image: "",
    type: "HERO",
    position: 0,
    isActive: true,
  });

  const resetForm = () => {
    setForm({
      title: "",
      image: "",
      type: "HERO",
      position: 0,
      isActive: true,
    });
  };

  const openAdd = () => {
    resetForm();
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setForm(banner);
    setOpen(true);
  };

  const uploadFile = async (file: File, folder: string) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/upload/${folder}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url)
      throw new Error(data?.message || t("errors.uploadFailed"));
    return data.url as string;
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file, "banners");
      setForm({ ...form, image: url });
    } catch (err: any) {
      toast.error(err?.message || t("errors.imageUploadFailed"));
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.image) {
      toast.error(t("errors.titleImageRequired"));
      return;
    }

    try {
      if (editing) {
        await onUpdate(editing.id, form);
        toast.success(t("success.updated"));
      } else {
        await onCreate(form);
        toast.success(t("success.created"));
      }
      setOpen(false);
      resetForm();
    } catch {
      toast.error(t("errors.operationFailed"));
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <Button onClick={openAdd}>{t("actions.addBanner")}</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="bg-card border border-border rounded-xl p-4 space-y-3"
          >
            <Image
              src={banner.image}
              alt={banner.title || t("bannerAlt")}
              width={640}
              height={320}
              className="h-40 w-full object-cover rounded-md"
            />

            <h3 className="font-semibold text-foreground">{banner.title}</h3>

            <p className="text-sm text-muted-foreground">
              {t("labels.type")}: {t(BANNER_TYPE_TRANSLATION_KEYS[banner.type])}
            </p>

            <p className="text-sm text-muted-foreground">
              {t("labels.position")}: {banner.position}
            </p>

            <p
              className={`text-sm ${
                banner.isActive ? "text-green-600" : "text-red-500"
              }`}
            >
              {banner.isActive ? t("labels.active") : t("labels.inactive")}
            </p>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEdit(banner)}
              >
                {t("actions.edit")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(banner.id)}
              >
                {t("actions.delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-gray-400/40 flex items-center justify-center">
          <div className="bg-card p-6 rounded-xl w-[400px] space-y-4">
            <h2 className="text-lg font-semibold">
              {editing ? t("modal.titleEdit") : t("modal.titleNew")}
            </h2>

            <div>
              <Label>{t("fields.title")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("fields.image")}</Label>
              {form.image ? (
                <div className="relative w-32">
                  <Image
                    src={form.image}
                    alt={t("previewAlt")}
                    width={120}
                    height={120}
                    className="rounded border border-border object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => setForm({ ...form, image: "" })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Input
                    key={form.image ? "has-image" : "no-image"}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-foreground">{t("fields.type")}</Label>
              <select
                className="border border-border bg-background text-foreground p-2 rounded w-full"
                value={form.type}
                onChange={(e) => {
                  if (isBannerType(e.target.value)) {
                    setForm({ ...form, type: e.target.value });
                  }
                }}
              >
                <option value="HERO">{t("bannerTypes.HERO")}</option>
                <option value="BANNER1">{t("bannerTypes.BANNER1")}</option>
                <option value="BANNER2">{t("bannerTypes.BANNER2")}</option>
                <option value="PROMOTION">{t("bannerTypes.PROMOTION")}</option>
                <option value="POPUP">{t("bannerTypes.POPUP")}</option>
              </select>
            </div>

            <div>
              <Label>{t("fields.position")}</Label>
              <Input
                type="number"
                value={form.position}
                onChange={(e) =>
                  setForm({
                    ...form,
                    position: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <Label>{t("fields.active")}</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(val) => setForm({ ...form, isActive: val })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("actions.cancel")}
              </Button>
              <Button onClick={handleSubmit}>
                {editing ? t("actions.update") : t("actions.create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
