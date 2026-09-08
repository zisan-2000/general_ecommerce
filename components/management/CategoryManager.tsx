"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Plus,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Eye,
  EyeOff,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
  parentId: number | null;
  image?: string | null;
  productCount?: number;
  childrenCount?: number;
  isActive: boolean;
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  featured: boolean;
}

type CategoryForm = {
  name: string;
  parentId: number | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  featured: boolean;
};

const emptyForm = (): CategoryForm => ({
  name: "",
  parentId: null,
  image: null,
  isActive: true,
  sortOrder: 0,
  showInHeader: true,
  showInFooter: true,
  featured: false,
});

function sortCategories<T extends Pick<Category, "id" | "name" | "sortOrder">>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
      a.id - b.id,
  );
}

export default function CategoryManager({
  categories,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: Category[];
  loading: boolean;
  onCreate: (payload: Omit<CategoryForm, "image"> & { image?: string | null }) => Promise<void>;
  onUpdate: (id: number, payload: Partial<CategoryForm>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createParent, setCreateParent] = useState<Category | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const treeData = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const source = query
      ? categories.filter((category) => category.name.toLowerCase().includes(query))
      : categories;
    const map = new Map<number, Category & { children: Category[] }>();
    source.forEach((item) => map.set(item.id, { ...item, children: [] }));
    const roots: Array<Category & { children: Category[] }> = [];

    source.forEach((item) => {
      const node = map.get(item.id)!;
      const parent = item.parentId ? map.get(item.parentId) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });

    const sortTree = (nodes: Array<Category & { children: Category[] }>) => {
      nodes.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
          a.id - b.id,
      );
      nodes.forEach((node) => sortTree(node.children as Array<Category & { children: Category[] }>));
    };
    sortTree(roots);
    return roots;
  }, [categories, searchTerm]);

  const parentOptions = useMemo(() => sortCategories(categories), [categories]);

  const closeModal = () => {
    if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    setModalOpen(false);
    setEditing(null);
    setCreateParent(null);
    setSubmitting(false);
    setImageFile(null);
    setImagePreviewUrl(null);
    setFileInputKey((key) => key + 1);
    setForm(emptyForm());
  };

  const openAddModal = (parent: Category | null = null) => {
    setEditing(null);
    setCreateParent(parent);
    setImageFile(null);
    setImagePreviewUrl(null);
    setFileInputKey((key) => key + 1);
    setForm({ ...emptyForm(), parentId: parent?.id ?? null });
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditing(category);
    setCreateParent(null);
    setImageFile(null);
    setImagePreviewUrl(category.image ?? null);
    setFileInputKey((key) => key + 1);
    setForm({
      name: category.name,
      parentId: category.parentId,
      image: category.image ?? null,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      showInHeader: category.showInHeader,
      showInFooter: category.showInFooter,
      featured: category.featured,
    });
    setModalOpen(true);
  };

  const uploadCategoryImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.fileUrl) {
      throw new Error(data?.error || "Image upload failed");
    }
    return data.fileUrl as string;
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter category name");
      return;
    }
    if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0) {
      toast.error("Sort order must be a non-negative integer");
      return;
    }

    try {
      setSubmitting(true);
      const image = imageFile ? await uploadCategoryImage(imageFile) : form.image;
      const payload = { ...form, name: form.name.trim(), image };

      if (editing) {
        await onUpdate(editing.id, payload);
        toast.success("Category updated");
      } else {
        await onCreate(payload);
        toast.success("Category created");
      }
      closeModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLocal = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    try {
      await onDelete(id);
      toast.success("Category deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const renderNode = (node: Category & { children: Category[] }, level = 0) => {
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.id} className="min-w-0">
        <div
          className={cn(
            "group rounded-lg border border-transparent px-2 py-3 transition hover:border-border hover:bg-muted/40 sm:px-3",
            !node.isActive && "opacity-60",
          )}
          style={{ marginLeft: `${Math.min(level * 14, 42)}px` }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [node.id]: !prev[node.id] }))}
                  className="shrink-0 rounded p-1 hover:bg-muted"
                  aria-label={expanded[node.id] ? "Collapse category" : "Expand category"}
                >
                  {expanded[node.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <div className="w-6 shrink-0" />
              )}

              {node.image ? (
                <img src={node.image} alt="" className="h-9 w-9 shrink-0 rounded border bg-muted object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted text-xs font-semibold text-muted-foreground">
                  {(node.name?.[0] || "?").toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-semibold">{node.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Order {node.sortOrder}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", node.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive")}>{node.isActive ? "Active" : "Inactive"}</span>
                  {node.showInHeader ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Header</span> : null}
                  {node.showInFooter ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Footer</span> : null}
                  {node.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"><Star className="h-3 w-3" />Featured</span> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{node.productCount || 0} products</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
              <Button size="sm" variant="outline" onClick={() => openAddModal(node)}><Plus size={14} /><span className="ml-1 sm:hidden">Add</span></Button>
              <Button size="sm" variant="outline" onClick={() => openEditModal(node)}><Edit3 size={14} /><span className="ml-1 sm:hidden">Edit</span></Button>
              <Button size="sm" variant="outline" onClick={() => void handleDeleteLocal(node.id)} className="text-destructive"><Trash2 size={14} /><span className="ml-1 sm:hidden">Del</span></Button>
            </div>
          </div>
        </div>

        {hasChildren && expanded[node.id] ? (
          <div className="mt-1 space-y-1">
            {(node.children as Array<Category & { children: Category[] }>).map((child) => renderNode(child, level + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const ToggleField = ({
    label,
    description,
    value,
    onChange,
    icon,
  }: {
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
    icon?: React.ReactNode;
  }) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-primary"
      />
    </label>
  );

  return (
    <div className="w-full p-3 sm:p-5 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Category Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control hierarchy, visibility, navigation order and homepage category placement without code changes.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => openAddModal(null)}><Plus size={16} className="mr-2" />Add Root Category</Button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input className="h-11 pl-10" placeholder="Search categories..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
      </div>

      <div className="overflow-x-hidden rounded-lg border bg-card p-2 sm:p-4">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : treeData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No categories found</p>
        ) : (
          <div className="space-y-1">{treeData.map((node) => renderNode(node))}</div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={closeModal}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card p-4 shadow-lg sm:max-w-2xl sm:rounded-xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold sm:text-xl">{editing ? "Edit Category" : createParent ? `Add Subcategory: ${createParent.name}` : "New Root Category"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Navigation changes take effect after save and cache invalidation.</p>
              </div>
              <Button size="icon" variant="ghost" onClick={closeModal} aria-label="Close modal"><X size={18} /></Button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input className="mt-1 h-11" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>

                <div>
                  <Label>Sort Order</Label>
                  <Input type="number" min={0} step={1} className="mt-1 h-11" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Math.max(0, Number(event.target.value) || 0) }))} />
                  <p className="mt-1 text-xs text-muted-foreground">Lower values appear first within the same level.</p>
                </div>

                <div>
                  <Label>Parent</Label>
                  <select className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={form.parentId ?? ""} disabled={!editing && Boolean(createParent)} onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.target.value ? Number(event.target.value) : null }))}>
                    <option value="">Root</option>
                    {parentOptions.filter((category) => category.id !== editing?.id).map((category) => <option key={category.id} value={category.id} disabled={!category.isActive && form.isActive}>{category.name}{!category.isActive ? " (inactive)" : ""}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <Label>Image</Label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {imagePreviewUrl ? <img src={imagePreviewUrl} alt="Category preview" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted-foreground">No image</span>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input key={fileInputKey} type="file" accept="image/*" className="h-auto" onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (!file) return;
                      if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
                      setImageFile(file);
                      setImagePreviewUrl(URL.createObjectURL(file));
                    }} />
                    {(imagePreviewUrl || form.image) ? <Button type="button" size="sm" variant="outline" onClick={() => {
                      if (imagePreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
                      setImageFile(null);
                      setImagePreviewUrl(null);
                      setFileInputKey((key) => key + 1);
                      setForm((prev) => ({ ...prev, image: null }));
                    }}>Remove image</Button> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField label="Active" description="Inactive categories and their descendants are excluded from storefront discovery." value={form.isActive} onChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))} icon={form.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} />
                <ToggleField label="Show in Header" description="Allow this category in the header tree when every ancestor is also header-visible." value={form.showInHeader} onChange={(value) => setForm((prev) => ({ ...prev, showInHeader: value }))} />
                <ToggleField label="Show in Footer" description="Allow this category in footer navigation when every ancestor is also footer-visible." value={form.showInFooter} onChange={(value) => setForm((prev) => ({ ...prev, showInFooter: value }))} />
                <ToggleField label="Featured" description="Make this category eligible for the homepage featured-category section." value={form.featured} onChange={(value) => setForm((prev) => ({ ...prev, featured: value }))} icon={<Star className="h-4 w-4" />} />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="w-full" onClick={closeModal} disabled={submitting}>Cancel</Button>
                <Button type="button" onClick={() => void handleSubmit()} className="w-full" disabled={submitting}>{submitting ? "Saving..." : editing ? "Update" : "Create"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
