"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ImageIcon,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AdminBrand,
  BrandPagination,
} from "@/app/admin/management/brands/page";

type BrandPayload = { name: string; logo: string | null };

interface BrandManagerProps {
  brands: AdminBrand[];
  pagination: BrandPagination;
  search: string;
  loading: boolean;
  error: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onCreate: (payload: BrandPayload) => Promise<void>;
  onUpdate: (id: number, payload: BrandPayload) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) =>
    start + index,
  );
}

export default function BrandManager({
  brands,
  pagination,
  search,
  loading,
  error,
  onSearchChange,
  onPageChange,
  onRetry,
  onCreate,
  onUpdate,
  onDelete,
}: BrandManagerProps) {
  const t = useTranslations("AdminBrandManager");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [deleting, setDeleting] = useState<AdminBrand | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [form, setForm] = useState<BrandPayload>({ name: "", logo: null });

  const productCount = useMemo(
    () => brands.reduce((total, brand) => total + brand.productCount, 0),
    [brands],
  );
  const visiblePages = useMemo(
    () => pageNumbers(pagination.page, pagination.pages),
    [pagination.page, pagination.pages],
  );

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const resetModal = () => {
    if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    setEditing(null);
    setImageFile(null);
    setImagePreviewUrl(null);
    setFileInputKey((value) => value + 1);
    setForm({ name: "", logo: null });
  };

  const openAdd = () => {
    resetModal();
    setModalOpen(true);
  };

  const openEdit = (brand: AdminBrand) => {
    resetModal();
    setEditing(brand);
    setImagePreviewUrl(brand.logo);
    setForm({ name: brand.name, logo: brand.logo });
    setModalOpen(true);
  };

  const uploadBrandImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload/brands", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    const fileUrl =
      typeof data?.url === "string"
        ? data.url
        : typeof data?.fileUrl === "string"
          ? data.fileUrl
          : null;
    if (!response.ok || !data?.success || !fileUrl) {
      throw new Error(
        data?.error || data?.message || t("errors.imageUploadFailed"),
      );
    }
    return fileUrl;
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error(t("errors.nameRequired"));
      return;
    }
    try {
      setSubmitting(true);
      const logo = imageFile ? await uploadBrandImage(imageFile) : form.logo;
      if (editing) {
        await onUpdate(editing.id, { name, logo });
        toast.success(t("success.updated"));
      } else {
        await onCreate({ name, logo });
        toast.success(t("success.created"));
      }
      setModalOpen(false);
      resetModal();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error ? submitError.message : t("errors.saveFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setDeletingBusy(true);
      await onDelete(deleting.id);
      toast.success(t("success.deleted"));
      setDeleting(null);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : t("errors.deleteFailed"),
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/20 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t("header.title")}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {t("header.subtitle")}
                </p>
              </div>
            </div>
            <Button onClick={openAdd} size="lg" className="shrink-0 shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("actions.addBrand")}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Building2, value: pagination.total, label: t("stats.totalBrands") },
            { icon: Package, value: productCount, label: t("stats.productsOnPage") },
            {
              icon: Boxes,
              value: `${pagination.page}/${pagination.pages}`,
              label: t("stats.currentPage"),
            },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={t("search.placeholder")}
                  className="h-11 pl-10 pr-10"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
                    aria-label={t("search.clear")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("search.results", { count: pagination.total })}
              </p>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={onRetry}>{t("actions.retry")}</Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="space-y-4 p-5">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : brands.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {search ? t("empty.searchDescription") : t("empty.description")}
              </p>
              {!search ? (
                <Button onClick={openAdd} className="mt-5">
                  <Plus className="mr-2 h-4 w-4" />{t("actions.addBrand")}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {brands.map((brand) => (
              <Card
                key={brand.id}
                className="group overflow-hidden border-border/70 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 p-4">
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt={t("card.logoAlt", { name: brand.name })}
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-7 w-7" />
                        <span className="text-xs">{t("card.noLogo")}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 min-w-0">
                    <h2 className="truncate font-semibold" title={brand.name}>
                      {brand.name}
                    </h2>
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={brand.slug}>
                      /{brand.slug}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="font-medium">
                      <Package className="mr-1 h-3 w-3" />
                      {t("card.products", { count: brand.productCount })}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(brand)}
                        aria-label={t("actions.edit")}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleting(brand)}
                        aria-label={t("actions.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!error && pagination.pages > 1 ? (
          <nav className="flex flex-col items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row" aria-label={t("pagination.label")}>
            <p className="text-sm text-muted-foreground">
              {t("pagination.summary", {
                page: pagination.page,
                pages: pagination.pages,
                total: pagination.total,
              })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={loading || pagination.page <= 1}
                onClick={() => onPageChange(pagination.page - 1)}
                aria-label={t("pagination.previous")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {visiblePages.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={pageNumber === pagination.page ? "default" : "outline"}
                  size="icon"
                  disabled={loading}
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                disabled={loading || pagination.page >= pagination.pages}
                onClick={() => onPageChange(pagination.page + 1)}
                aria-label={t("pagination.next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (submitting) return;
          setModalOpen(open);
          if (!open) resetModal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("modal.titleEdit") : t("modal.titleNew")}</DialogTitle>
            <DialogDescription>{t("modal.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name">{t("form.name")}</Label>
              <Input
                id="brand-name"
                value={form.name}
                maxLength={200}
                autoFocus
                onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                placeholder={t("form.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-logo">{t("form.logo")}</Label>
              <div className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background p-2">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} className="h-full w-full object-contain" alt={t("form.logoPreviewAlt")} />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    id="brand-logo"
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
                      setImageFile(file);
                      setImagePreviewUrl(URL.createObjectURL(file));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t("form.logoHint")}</p>
                </div>
              </div>
              {(imagePreviewUrl || form.logo) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
                    setImageFile(null);
                    setImagePreviewUrl(null);
                    setFileInputKey((value) => value + 1);
                    setForm((value) => ({ ...value, logo: null }));
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />{t("form.removeImage")}
                </Button>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setModalOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={submit}>
              {submitting ? t("actions.saving") : editing ? t("actions.update") : t("actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deletingBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", { name: deleting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingBusy}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBusy ? t("actions.deleting") : t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
