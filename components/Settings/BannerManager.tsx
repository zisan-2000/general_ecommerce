"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ExternalLink, ImagePlus, Link2, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { categoryBannerLink, parseBannerLink } from "@/lib/banner-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const BANNER_TYPES = ["HERO", "BANNER1", "BANNER2", "PROMOTION", "POPUP"] as const;
type BannerType = (typeof BANNER_TYPES)[number];
type DestinationType = "catalog" | "category" | "custom";

const BANNER_TYPE_TRANSLATION_KEYS: Record<BannerType, `bannerTypes.${BannerType}`> = {
  HERO: "bannerTypes.HERO",
  BANNER1: "bannerTypes.BANNER1",
  BANNER2: "bannerTypes.BANNER2",
  PROMOTION: "bannerTypes.PROMOTION",
  POPUP: "bannerTypes.POPUP",
};

const isBannerType = (value: string): value is BannerType =>
  BANNER_TYPES.includes(value as BannerType);

export interface Banner {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image: string;
  mobileImage?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  type: BannerType;
  position: number;
  isActive: boolean;
}

type Category = {
  id: number;
  name: string;
  slug: string;
  parentName?: string | null;
};

type BannerForm = {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  buttonText: string;
  type: BannerType;
  position: number;
  isActive: boolean;
  destinationType: DestinationType;
  categorySlug: string;
  customLink: string;
};

export type BannerMutationInput = Omit<
  BannerForm,
  "destinationType" | "categorySlug" | "customLink"
> & { buttonLink: string };

interface Props {
  banners: Banner[];
  onCreate: (data: BannerMutationInput) => Promise<void>;
  onUpdate: (id: number, data: BannerMutationInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const EMPTY_FORM: BannerForm = {
  title: "",
  subtitle: "",
  description: "",
  image: "",
  buttonText: "",
  type: "HERO",
  position: 0,
  isActive: true,
  destinationType: "catalog",
  categorySlug: "",
  customLink: "",
};

function destinationFromLink(link: string | null | undefined) {
  if (!link || link === "/ecommerce/products") {
    return { destinationType: "catalog" as const, categorySlug: "", customLink: "" };
  }
  try {
    const url = new URL(link, "https://storefront.invalid");
    const category = url.pathname === "/ecommerce/products"
      ? url.searchParams.get("category")
      : null;
    if (category) {
      return {
        destinationType: "category" as const,
        categorySlug: category,
        customLink: "",
      };
    }
  } catch {
    // Keep legacy malformed values editable as custom text.
  }
  return { destinationType: "custom" as const, categorySlug: "", customLink: link };
}

export default function BannerManager({ banners, onCreate, onUpdate, onDelete }: Props) {
  const t = useTranslations("AdminBannerManager");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/categories?view=storefront", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const payload = await response.json();
        if (!cancelled) setCategories(Array.isArray(payload) ? payload : []);
      } catch {
        if (!cancelled) toast.error(t("errors.categoriesLoadFailed"));
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.name])),
    [categories],
  );

  const resetForm = () => setForm(EMPTY_FORM);
  const closeModal = () => {
    if (saving || uploading) return;
    setOpen(false);
    setEditing(null);
    resetForm();
  };

  const openAdd = () => {
    resetForm();
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      description: banner.description ?? "",
      image: banner.image,
      buttonText: banner.buttonText ?? "",
      type: banner.type,
      position: banner.position,
      isActive: banner.isActive,
      ...destinationFromLink(banner.buttonLink),
    });
    setOpen(true);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload/banners", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.url) {
      throw new Error(payload?.message || t("errors.uploadFailed"));
    }
    return payload.url as string;
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadFile(file);
      setForm((current) => ({ ...current, image }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.imageUploadFailed"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const resolveDestination = () => {
    if (form.destinationType === "catalog") return "/ecommerce/products";
    if (form.destinationType === "category") {
      return form.categorySlug ? categoryBannerLink(form.categorySlug) : null;
    }
    const parsed = parseBannerLink(form.customLink);
    return parsed.ok ? parsed.value : null;
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.image) {
      toast.error(t("errors.titleImageRequired"));
      return;
    }
    const buttonLink = resolveDestination();
    if (!buttonLink) {
      toast.error(
        form.destinationType === "category"
          ? t("errors.categoryRequired")
          : t("errors.invalidDestination"),
      );
      return;
    }

    const payload: BannerMutationInput = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      image: form.image,
      buttonText: form.buttonText.trim(),
      type: form.type,
      position: form.position,
      isActive: form.isActive,
      buttonLink,
    };

    setSaving(true);
    try {
      if (editing) await onUpdate(editing.id, payload);
      else await onCreate(payload);
      setOpen(false);
      setEditing(null);
      resetForm();
    } catch {
      // The settings page owns the request-specific error toast.
    } finally {
      setSaving(false);
    }
  };

  const destinationLabel = (banner: Banner) => {
    const destination = destinationFromLink(banner.buttonLink);
    if (destination.destinationType === "catalog") return t("destinations.catalog");
    if (destination.destinationType === "category") {
      return categoryNames.get(destination.categorySlug) ?? destination.categorySlug;
    }
    return destination.customLink;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <ImagePlus className="h-4 w-4" />
          {t("actions.addBanner")}
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {banners.map((banner) => (
          <article key={banner.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="relative aspect-[2/1] bg-muted">
              <Image src={banner.image} alt={banner.title || t("bannerAlt")} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
              <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${banner.isActive ? "bg-emerald-500 text-white" : "bg-slate-700 text-white"}`}>
                {banner.isActive ? t("labels.active") : t("labels.inactive")}
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <h3 className="line-clamp-1 font-semibold text-foreground">{banner.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(BANNER_TYPE_TRANSLATION_KEYS[banner.type])} · {t("labels.position")} {banner.position}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" title={banner.buttonLink ?? undefined}>{destinationLabel(banner)}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(banner)}>{t("actions.edit")}</Button>
                <Button size="sm" variant="destructive" onClick={() => onDelete(banner.id)}>{t("actions.delete")}</Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
              <div>
                <h2 className="text-lg font-semibold">{editing ? t("modal.titleEdit") : t("modal.titleNew")}</h2>
                <p className="text-xs text-muted-foreground">{t("modal.description")}</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={closeModal} disabled={saving || uploading} aria-label={t("actions.cancel")}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("fields.image")}</Label>
                {form.image ? (
                  <div className="relative aspect-[3/1] overflow-hidden rounded-xl border border-border bg-muted">
                    <Image src={form.image} alt={t("previewAlt")} fill className="object-cover" sizes="640px" />
                    <Button type="button" size="icon" variant="destructive" className="absolute right-3 top-3 h-8 w-8 rounded-full" onClick={() => setForm((current) => ({ ...current, image: "" }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-5 text-center hover:border-primary/60 hover:bg-primary/5">
                    {uploading ? <Loader2 className="mb-2 h-7 w-7 animate-spin text-primary" /> : <ImagePlus className="mb-2 h-7 w-7 text-muted-foreground" />}
                    <span className="text-sm font-medium">{uploading ? t("fields.uploading") : t("fields.chooseImage")}</span>
                    <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="sr-only" />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner-title">{t("fields.title")}</Label>
                <Input id="banner-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-subtitle">{t("fields.subtitle")}</Label>
                <Input id="banner-subtitle" value={form.subtitle} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="banner-description">{t("fields.description")}</Label>
                <textarea id="banner-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.type")}</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(event) => isBannerType(event.target.value) && setForm((current) => ({ ...current, type: event.target.value as BannerType }))}>
                  {BANNER_TYPES.map((type) => <option key={type} value={type}>{t(BANNER_TYPE_TRANSLATION_KEYS[type])}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-position">{t("fields.position")}</Label>
                <Input id="banner-position" type="number" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: Number(event.target.value) }))} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>{t("fields.destinationType")}</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.destinationType} onChange={(event) => setForm((current) => ({ ...current, destinationType: event.target.value as DestinationType }))}>
                  <option value="catalog">{t("destinations.catalog")}</option>
                  <option value="category">{t("destinations.category")}</option>
                  <option value="custom">{t("destinations.custom")}</option>
                </select>
              </div>

              {form.destinationType === "category" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("fields.category")}</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.categorySlug} disabled={categoriesLoading} onChange={(event) => setForm((current) => ({ ...current, categorySlug: event.target.value }))}>
                    <option value="">{categoriesLoading ? t("fields.loadingCategories") : t("fields.chooseCategory")}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.slug}>{category.parentName ? `${category.parentName} / ` : ""}{category.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.destinationType === "custom" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="banner-link">{t("fields.customRoute")}</Label>
                  <Input id="banner-link" value={form.customLink} onChange={(event) => setForm((current) => ({ ...current, customLink: event.target.value }))} placeholder="/ecommerce/products?brand=example" />
                  <p className="text-xs text-muted-foreground">{t("fields.customRouteHint")}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="banner-button-text">{t("fields.buttonText")}</Label>
                <Input id="banner-button-text" value={form.buttonText} onChange={(event) => setForm((current) => ({ ...current, buttonText: event.target.value }))} placeholder={t("fields.buttonTextPlaceholder")} />
              </div>
              <div className="flex items-end">
                <div className="flex h-10 w-full items-center justify-between rounded-lg border border-border px-3">
                  <Label>{t("fields.active")}</Label>
                  <Switch checked={form.isActive} onCheckedChange={(isActive) => setForm((current) => ({ ...current, isActive }))} />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-card/95 px-5 py-4 backdrop-blur">
              {resolveDestination() && <a href={resolveDestination() ?? undefined} target="_blank" rel="noreferrer" className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />{t("actions.previewDestination")}</a>}
              <Button variant="outline" onClick={closeModal} disabled={saving || uploading}>{t("actions.cancel")}</Button>
              <Button onClick={handleSubmit} disabled={saving || uploading} className="min-w-28">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? t("actions.update") : t("actions.create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
