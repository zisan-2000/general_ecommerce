//app/admin/settings/gallery/page.tsx
"use client";

import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Copy,
  FolderOpen,
  Grid3X3,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLocale, useTranslations } from "next-intl";

type GalleryImage = {
  name: string;
  folder: string;
  path: string;
  url: string;
  size: number;
  updatedAt: string;
  extension: string;
};

type GalleryResponse = {
  images: GalleryImage[];
  folders: string[];
  page?: number;
  pageSize?: number;
  total?: number;
};

type ImageUsageRef = {
  entity: "sitesettings" | "banner" | "brand" | "product" | "variant";
  id: string | number;
  field: string;
};

const uploadTargets = [
  { key: "general", value: "root" },
  { key: "site", value: "site" },
  { key: "banners", value: "banners" },
  { key: "products", value: "products" },
  { key: "productGallery", value: "products/gallery" },
  { key: "variantGallery", value: "products/variants/gallery" },
  { key: "profiles", value: "userProfilePic" },
] as const;

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toUploadEndpoint(target: string) {
  return target === "root" ? "/api/upload" : `/api/upload/${target}`;
}

export default function GalleryManagementPage() {
  const t = useTranslations("AdminGalleryManagement");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState("all");
  const [uploadTarget, setUploadTarget] = useState("root");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [replacingPath, setReplacingPath] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetRef = useRef<GalleryImage | null>(null);
  const [usageByPath, setUsageByPath] = useState<
    Record<string, ImageUsageRef[]>
  >({});
  const [usageLoading, setUsageLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GalleryImage | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadGallery = useCallback(async (opts?: { refresh?: boolean; nextPage?: number }) => {
    try {
      const nextPage = typeof opts?.nextPage === "number" ? opts.nextPage : page;
      const isInitial = images.length === 0;
      if (isInitial) setLoading(true);
      else setPageLoading(true);

      const folderQuery =
        folder === "all" ? "" : `folder=${encodeURIComponent(folder)}`;
      const query = [
        folderQuery,
        `page=${nextPage}`,
        `pageSize=${pageSize}`,
        opts?.refresh ? "refresh=1" : "",
      ]
        .filter(Boolean)
        .join("&");

      const res = await fetch(`/api/admin/gallery${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const data = (await res
        .json()
        .catch(() => ({}))) as Partial<GalleryResponse> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(t("errors.loadFailed"));
      }

      setImages(Array.isArray(data.images) ? data.images : []);
      setFolders(Array.isArray(data.folders) ? data.folders : []);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setPageSize(typeof data.pageSize === "number" ? data.pageSize : pageSize);
      setTotal(typeof data.total === "number" ? data.total : 0);

      // After images are loaded, compute "Used" markers in the background.
      const loadedImages = Array.isArray(data.images)
        ? (data.images as GalleryImage[])
        : [];
      const paths = loadedImages.map((img) => img.path).filter(Boolean);
      if (paths.length > 0) {
        setUsageLoading(true);
        try {
          const usageRes = await fetch("/api/admin/gallery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths }),
          });
          const usageData = (await usageRes.json().catch(() => ({}))) as {
            usageByPath?: Record<string, ImageUsageRef[]>;
            error?: string;
          };

          if (usageRes.ok && usageData?.usageByPath) {
            setUsageByPath(usageData.usageByPath);
          } else {
            setUsageByPath({});
          }
        } finally {
          setUsageLoading(false);
        }
      } else {
        setUsageByPath({});
      }
    } catch (error: any) {
      toast.error(error?.message || t("errors.loadFailed"));
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [folder, images.length, page, pageSize, t]);

  useEffect(() => {
    setPage(1);
    setSelectedPaths(new Set());
    loadGallery({ nextPage: 1 });
  }, [folder, pageSize]);

  const filteredImages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return images;

    return images.filter((image) =>
      [image.name, image.folder, image.path, image.extension]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [images, search]);

  const totalSize = useMemo(
    () => images.reduce((total, image) => total + image.size, 0),
    [images],
  );

  const visiblePaths = useMemo(
    () => filteredImages.map((img) => img.path).filter(Boolean),
    [filteredImages],
  );

  const selectedCount = selectedPaths.size;
  const pageAllSelected =
    visiblePaths.length > 0 && visiblePaths.every((p) => selectedPaths.has(p));
  const pageSomeSelected = visiblePaths.some((p) => selectedPaths.has(p));

  const toggleSelectPath = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleSelectPage = useCallback(() => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) {
        for (const p of visiblePaths) next.delete(p);
      } else {
        for (const p of visiblePaths) next.add(p);
      }
      return next;
    });
  }, [pageAllSelected, visiblePaths]);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";

    if (!selectedFiles.length) return;

    try {
      setUploading(true);
      const endpoint = toUploadEndpoint(uploadTarget);

      for (const file of selectedFiles) {
        if (!file.type.startsWith("image/")) {
          toast.error(t("errors.notImage", { name: file.name }));
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || (!data?.success && !data?.url && !data?.fileUrl)) {
          throw new Error(t("errors.uploadFailed"));
        }
      }

      toast.success(t("success.uploaded"));
      await loadGallery({ refresh: true });
    } catch (error: any) {
      toast.error(error?.message || t("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("success.urlCopied"));
    } catch {
      toast.error(t("errors.copyFailed"));
    }
  };

  const deleteImage = (image: GalleryImage) => {
    if (usageByPath[image.path]?.length) {
      toast.error(t("errors.inUse"));
      return;
    }
    setDeleteTarget(image);
  };

  const openReplacePicker = (image: GalleryImage) => {
    replaceTargetRef.current = image;
    replaceInputRef.current?.click();
  };

  const handleReplace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;

    if (!file || !target) return;

    try {
      setReplacingPath(target.path);

      const formData = new FormData();
      formData.append("path", target.path);
      formData.append("file", file);

      const res = await fetch("/api/admin/gallery", {
        method: "PUT",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        image?: GalleryImage;
        previousPath?: string;
      };

      if (!res.ok || !data?.image) {
        throw new Error(t("errors.replaceFailed"));
      }

      const previousPath = data.previousPath || target.path;

      setImages((prev) =>
        prev.map((img) => (img.path === previousPath ? data.image! : img)),
      );
      setUsageByPath((prev) => {
        if (previousPath === data.image!.path || !prev[previousPath]) {
          return prev;
        }

        const next = { ...prev };
        next[data.image!.path] = prev[previousPath];
        delete next[previousPath];
        return next;
      });
      setSelectedPaths((prev) => {
        if (!prev.has(previousPath)) return prev;
        const next = new Set(prev);
        next.delete(previousPath);
        next.add(data.image!.path);
        return next;
      });

      toast.success(t("success.replaced"));
    } catch (error: any) {
      toast.error(error?.message || t("errors.replaceFailed"));
    } finally {
      setReplacingPath(null);
    }
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setDeletingPath(deleteTarget.path);
      const res = await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deleteTarget.path }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        refs?: ImageUsageRef[];
      };

      if (!res.ok) {
        if (
          res.status === 409 &&
          Array.isArray(data?.refs) &&
          data.refs.length > 0
        ) {
          setUsageByPath((prev) => ({
            ...prev,
            [deleteTarget.path]: data.refs!,
          }));
          const hint = data.refs
            .slice(0, 4)
            .map((r) => `${r.entity}:${r.field}#${r.id}`)
            .join(", ");
          throw new Error(
            `${t("errors.inUse")}${hint ? ` (${hint}${data.refs.length > 4 ? "..." : ""})` : ""}`,
          );
        }

        throw new Error(t("errors.deleteFailed"));
      }

      setImages((prev) => prev.filter((img) => img.path !== deleteTarget.path));
      setUsageByPath((prev) => {
        if (!prev[deleteTarget.path]) return prev;
        const next = { ...prev };
        delete next[deleteTarget.path];
        return next;
      });
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.path);
        return next;
      });
      setDeleteTarget(null);
      toast.success(t("success.deleted"));
    } catch (error: any) {
      toast.error(error?.message || t("errors.deleteFailed"));
    } finally {
      setDeletingPath(null);
    }
  }, [deleteTarget, t]);

  const closeDialog = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const paths = Array.from(selectedPaths);
    if (paths.length === 0) return;

    const confirmed = window.confirm(
      t("confirm.bulkDelete", { count: paths.length }),
    );
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      const res = await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        deleted?: string[];
        blocked?: Record<string, ImageUsageRef[]>;
        notFound?: string[];
        failed?: Record<string, string>;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(t("errors.bulkDeleteFailed"));
      }

      const deleted = Array.isArray(data.deleted) ? data.deleted : [];
      const blockedCount = data.blocked ? Object.keys(data.blocked).length : 0;
      const failedCount = data.failed ? Object.keys(data.failed).length : 0;

      if (deleted.length > 0) {
        setImages((prev) => prev.filter((img) => !deleted.includes(img.path)));
        setSelectedPaths((prev) => {
          const next = new Set(prev);
          for (const p of deleted) next.delete(p);
          return next;
        });
        toast.success(t("success.bulkDeleted", { count: deleted.length }));
      } else {
        toast.message(t("success.noneDeleted"));
      }

      if (blockedCount > 0) {
        toast.error(t("errors.usedSkipped", { count: blockedCount }));
      }
      if (failedCount > 0) {
        toast.error(t("errors.deleteCountFailed", { count: failedCount }));
      }

      await loadGallery({ refresh: true });
    } catch (error: any) {
      toast.error(error?.message || t("errors.bulkDeleteFailed"));
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedPaths, loadGallery, t]);

  const goToPage = useCallback(
    (next: number) => {
      const target = Math.min(Math.max(1, next), totalPages);
      setPage(target);
      setSelectedPaths(new Set());
      loadGallery({ nextPage: target });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [loadGallery, totalPages],
  );

  const paginationItems = useMemo(() => {
    const lastPage = totalPages;
    const current = page;
    if (lastPage <= 1) return [] as Array<number | "...">;

    const siblings = 3; // how many pages on each side of current
    const boundary = 2; // always show first 2 and last 2

    const start = Math.max(boundary + 1, current - siblings);
    const end = Math.min(lastPage - boundary, current + siblings);

    const items: Array<number | "..."> = [];

    // first boundary pages
    for (let p = 1; p <= Math.min(boundary, lastPage); p += 1) items.push(p);

    // left ellipsis
    if (start > boundary + 1) items.push("...");

    // middle pages
    for (let p = start; p <= end; p += 1) items.push(p);

    // right ellipsis
    if (end < lastPage - boundary) items.push("...");

    // last boundary pages
    for (let p = Math.max(lastPage - boundary + 1, boundary + 1); p <= lastPage; p += 1) {
      items.push(p);
    }

    return items;
  }, [page, totalPages]);

  
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("header.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("header.description")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={uploadTarget} onValueChange={setUploadTarget}>
            <SelectTrigger className="w-full sm:w-[230px]">
              <SelectValue placeholder={t("upload.targetPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {uploadTargets.map((target) => (
                <SelectItem key={target.value} value={target.value}>
                  {t(`upload.targets.${target.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t("actions.uploadImages")}
            <Input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </Label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalImages")}</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.visible", { count: filteredImages.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.storageUsed")}</CardTitle>
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.currentScope")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.folders")}</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{folders.length}</div>
            <p className="text-xs text-muted-foreground">
              {t("stats.detectedFolders")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={toggleSelectPage}
          disabled={loading || pageLoading || filteredImages.length === 0}
          className="w-full md:w-auto"
          title={pageAllSelected ? t("actions.unselectCurrentPage") : t("actions.selectCurrentPage")}
        >
          {pageAllSelected ? (
            <CheckSquare className="mr-2 h-4 w-4" />
          ) : (
            <Square className="mr-2 h-4 w-4" />
          )}
          {pageAllSelected ? t("actions.unselectPage") : t("actions.selectPage")}
        </Button>

        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger className="w-full md:w-[280px]">
            <SelectValue placeholder={t("filters.folder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allImages")}</SelectItem>
            <SelectItem value="upload">{t("filters.uploadFolder")}</SelectItem>
            {folders.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value))}
        >
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder={t("filters.pageSize")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">{t("filters.perPage", { count: 30 })}</SelectItem>
            <SelectItem value="60">{t("filters.perPage", { count: 60 })}</SelectItem>
            <SelectItem value="90">{t("filters.perPage", { count: 90 })}</SelectItem>
            <SelectItem value="120">{t("filters.perPage", { count: 120 })}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadGallery({ refresh: true })}
          disabled={loading || pageLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading || pageLoading ? "animate-spin" : ""
            }`}
          />
          {t("actions.refresh")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {pageSomeSelected || pageAllSelected ? (
              <>
                {t("selection.selected", { count: selectedCount })}
              </>
            ) : (
              <>
                {t("selection.showing", { visible: filteredImages.length, total })}
              </>
            )}
          </span>

          {selectedCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              {t("actions.clear")}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border bg-card">
          <div className="w-full max-w-5xl p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 20 }).map((_, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-lg border bg-card shadow-sm"
                >
                  <div className="aspect-square bg-muted animate-pulse" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                    <div className="h-9 w-full rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border bg-card text-center">
          <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("empty.description")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleReplace}
          />
          {filteredImages.map((image) => (
            <GalleryImageCard
              key={image.path}
              image={image}
              refs={usageByPath[image.path] ?? null}
              usageLoading={usageLoading}
              deletingPath={deletingPath}
              replacingPath={replacingPath}
              onCopy={copyUrl}
              onReplace={openReplacePicker}
              onDelete={deleteImage}
              selected={selectedPaths.has(image.path)}
              onToggleSelected={() => toggleSelectPath(image.path)}
            />
          ))}
          {pageLoading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={`page-skel-${idx}`}
                className="overflow-hidden rounded-lg border bg-card shadow-sm"
              >
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-9 w-full rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))
          ) : null}
        </div>
      )}

      {!loading && totalPages > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 rounded-lg border bg-card p-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            {t("pagination.pageOf", { page, totalPages })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={pageLoading || page <= 1}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {t("pagination.previous")}
            </Button>

            {paginationItems.map((item, idx) =>
              item === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-sm text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(item)}
                  disabled={pageLoading}
                  className="min-w-9"
                >
                  {item}
                </Button>
              ),
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={pageLoading || page >= totalPages}
            >
              {t("pagination.next")}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-0 p-0 shadow-2xl">
          <div className="p-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-7 w-7 text-red-600" />
            </div>

            <DialogHeader>
              <DialogTitle className="text-center text-xl font-bold text-gray-900">
                {t("deleteDialog.title")}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 rounded-xl border bg-muted/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("deleteDialog.description")}
              </p>

              <p className="mt-1 truncate text-base font-semibold text-gray-900">
                {deleteTarget?.name}
              </p>

              <p className="mt-3 text-sm font-medium text-red-600">
                {t("deleteDialog.warning")}
              </p>
            </div>

            <DialogFooter className="mt-6 flex gap-3 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingPath === deleteTarget?.path}
              >
                {t("actions.cancel")}
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="w-full rounded-xl"
                onClick={confirmDelete}
                disabled={deletingPath === deleteTarget?.path}
              >
                {deletingPath === deleteTarget?.path ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.deleting")}
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("actions.deleteImage")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCount > 0 ? (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-5xl">
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              {t("selection.selected", { count: selectedCount })}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={clearSelection}
                disabled={bulkDeleting}
              >
                {t("actions.clear")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.deleting")}
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("actions.deleteSelected")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const GalleryImageCard = React.memo(function GalleryImageCard({
  image,
  refs,
  usageLoading,
  deletingPath,
  replacingPath,
  onCopy,
  onReplace,
  onDelete,
  selected,
  onToggleSelected,
}: {
  image: GalleryImage;
  refs: ImageUsageRef[] | null;
  usageLoading: boolean;
  deletingPath: string | null;
  replacingPath: string | null;
  onCopy: (url: string) => void;
  onReplace: (image: GalleryImage) => void;
  onDelete: (image: GalleryImage) => void;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const t = useTranslations("AdminGalleryManagement");
  const locale = useLocale();
  const isUsed = Array.isArray(refs) && refs.length > 0;

  const usedHint = refs
    ? refs
        .slice(0, 2)
        .map((r) => `${r.entity}:${r.field}#${r.id}`)
        .join(", ")
    : "";

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card shadow-sm ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex aspect-square items-center justify-center bg-muted/40">
        <img
          src={`${image.url}?v=${encodeURIComponent(image.updatedAt)}`}
          alt={image.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>

      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded border bg-background hover:bg-muted"
              onClick={onToggleSelected}
              title={selected ? t("actions.unselect") : t("actions.select")}
            >
              {selected ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <p className="truncate text-sm font-semibold" title={image.name}>
              {image.name}
            </p>

            <Badge variant="secondary" className="shrink-0">
              {image.extension}
            </Badge>

            {isUsed ? (
              <Badge variant="destructive" className="shrink-0">
                {t("card.used")}
              </Badge>
            ) : null}
          </div>

          <p className="mt-1 truncate text-xs text-muted-foreground">
            {image.folder || t("card.publicRoot")}
          </p>

          {isUsed ? (
            <p
              className="mt-1 truncate text-[11px] text-destructive"
              title={refs
                .map((r) => `${r.entity}:${r.field}#${r.id}`)
                .join(", ")}
            >
              {t("card.usedReferences", { references: usedHint })}
              {refs.length > 2 ? "..." : ""}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>{formatBytes(image.size)}</span>
          <span className="text-right">{formatDate(image.updatedAt, locale)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onCopy(image.url)}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t("actions.copy")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onReplace(image)}
            title={t("actions.replaceHint")}
          >
            {replacingPath === image.path ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={
              usageLoading ||
              deletingPath === image.path ||
              replacingPath === image.path
            }
            onClick={() => onDelete(image)}
            title={t("actions.deleteImage")}
          >
            {deletingPath === image.path ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
