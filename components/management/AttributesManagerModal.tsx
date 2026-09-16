"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ATTRIBUTE_TYPES,
  type CatalogAttributeType,
} from "@/lib/attribute-schema";

interface AttributeValue {
  id: number;
  value: string;
}

interface Attribute {
  id: number;
  name: string;
  type: CatalogAttributeType;
  unit: string | null;
  values: AttributeValue[];
  categoryAttributes: Array<{
    isRequired: boolean;
    isFilterable: boolean;
    isVariant: boolean;
    sortOrder: number;
    category: { id: number; name: string; slug: string };
  }>;
}

type DefinitionDraft = Pick<Attribute, "name" | "type"> & { unit: string };
type MappingDraft = {
  enabled: boolean;
  isRequired: boolean;
  isFilterable: boolean;
  isVariant: boolean;
  sortOrder: number;
};

interface CategoryOption {
  id: number;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AttributesManagerModal({ open, onClose }: Props) {
  const t = useTranslations("AdminAttributesManager");

  const [loading, setLoading] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newAttributeType, setNewAttributeType] =
    useState<CatalogAttributeType>("SELECT");
  const [newAttributeUnit, setNewAttributeUnit] = useState("");
  const [valueDraft, setValueDraft] = useState<Record<number, string>>({});
  const [definitionDraft, setDefinitionDraft] = useState<
    Record<number, DefinitionDraft>
  >({});
  const [mappingCategoryId, setMappingCategoryId] = useState("");
  const [mappingDraft, setMappingDraft] = useState<
    Record<number, MappingDraft>
  >({});
  const [savingMappings, setSavingMappings] = useState(false);

  const sortedAttributes = useMemo(() => {
    return [...attributes].sort((a, b) => b.id - a.id);
  }, [attributes]);

  const load = async () => {
    try {
      setLoading(true);
      const [attributeResponse, categoryResponse] = await Promise.all([
        fetch("/api/attributes", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
      ]);
      const [data, categoryData] = await Promise.all([
        attributeResponse.json(),
        categoryResponse.json(),
      ]);
      if (!attributeResponse.ok || !categoryResponse.ok) {
        throw new Error(
          data?.error || categoryData?.error || t("errors.loadSettings"),
        );
      }
      const nextAttributes = Array.isArray(data) ? data : [];
      setAttributes(nextAttributes);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setDefinitionDraft(
        Object.fromEntries(
          nextAttributes.map((attribute: Attribute) => [
            attribute.id,
            {
              name: attribute.name,
              type: attribute.type,
              unit: attribute.unit ?? "",
            },
          ]),
        ),
      );
    } catch (err) {
      toast.error(t("errors.loadAttributes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!mappingCategoryId) {
      setMappingDraft({});
      return;
    }
    const categoryId = Number(mappingCategoryId);
    setMappingDraft(
      Object.fromEntries(
        attributes.map((attribute) => {
          const mapping = attribute.categoryAttributes?.find(
            (item) => item.category.id === categoryId,
          );
          return [
            attribute.id,
            {
              enabled: Boolean(mapping),
              isRequired: mapping?.isRequired ?? false,
              isFilterable: mapping?.isFilterable ?? true,
              isVariant: mapping?.isVariant ?? false,
              sortOrder: mapping?.sortOrder ?? 0,
            },
          ];
        }),
      ),
    );
  }, [attributes, mappingCategoryId]);

  const createAttribute = async () => {
    const name = newAttributeName.trim();
    if (!name) {
      toast.error(t("errors.attributeNameRequired"));
      return;
    }

    try {
      const res = await fetch("/api/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: newAttributeType,
          unit: newAttributeUnit,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("errors.createFailed"));

      toast.success(t("attributes.created"));
      setNewAttributeName("");
      setNewAttributeType("SELECT");
      setNewAttributeUnit("");
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.createFailed"));
    }
  };

  const saveDefinition = async (attributeId: number) => {
    const draft = definitionDraft[attributeId];
    if (!draft?.name.trim()) {
      toast.error(t("errors.attributeNameRequired"));
      return;
    }
    try {
      const res = await fetch(`/api/attributes/${attributeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("errors.updateFailed"));
      toast.success(t("attributes.definitionUpdated"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.updateFailed"));
    }
  };

  const updateMapping = (attributeId: number, patch: Partial<MappingDraft>) => {
    setMappingDraft((previous) => ({
      ...previous,
      [attributeId]: {
        ...(previous[attributeId] ?? {
          enabled: false,
          isRequired: false,
          isFilterable: true,
          isVariant: false,
          sortOrder: 0,
        }),
        ...patch,
      },
    }));
  };

  const saveCategoryMappings = async () => {
    if (!mappingCategoryId) return;
    try {
      setSavingMappings(true);
      const mappings = attributes.flatMap((attribute) => {
        const draft = mappingDraft[attribute.id];
        return draft?.enabled
          ? [
              {
                attributeId: attribute.id,
                isRequired: draft.isRequired,
                isFilterable: draft.isFilterable,
                isVariant: draft.isVariant,
                sortOrder: draft.sortOrder,
              },
            ]
          : [];
      });
      const res = await fetch(
        `/api/categories/${mappingCategoryId}/attributes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attributes: mappings }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const firstInvalidProduct = Array.isArray(data?.products)
          ? data.products[0]
          : null;
        throw new Error(
          firstInvalidProduct
            ? t("errors.mappingWithProduct", {
                error: data.error,
                name: firstInvalidProduct.name,
                productError: firstInvalidProduct.error,
              })
            : data?.error || t("errors.mappingFailed"),
        );
      }
      toast.success(t("mapping.saved"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.mappingFailed"));
    } finally {
      setSavingMappings(false);
    }
  };

  const addValue = async (attributeId: number) => {
    const value = (valueDraft[attributeId] || "").trim();
    if (!value) {
      toast.error(t("errors.valueRequired"));
      return;
    }

    try {
      const res = await fetch(`/api/attributes/${attributeId}/values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("errors.createFailed"));

      toast.success(t("values.added"));
      setValueDraft((prev) => ({ ...prev, [attributeId]: "" }));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.createFailed"));
    }
  };

  const deleteValue = async (valueId: number) => {
    if (!confirm(t("confirm.deleteValue"))) return;

    try {
      const res = await fetch(`/api/attribute-values/${valueId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.deleteFailed"));

      toast.success(t("values.deleted"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.deleteFailed"));
    }
  };

  const deleteAttribute = async (attributeId: number) => {
    if (!confirm(t("confirm.deleteAttribute"))) return;

    try {
      const res = await fetch(`/api/attributes/${attributeId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("errors.deleteFailed"));

      toast.success(t("attributes.deleted"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("errors.deleteFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t("title")}
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_160px_120px_auto] md:items-end">
            <div className="space-y-1">
              <Label htmlFor="new-attribute-name">{t("create.name")}</Label>
              <Input
                id="new-attribute-name"
                placeholder={t("create.namePlaceholder")}
                value={newAttributeName}
                onChange={(e) => setNewAttributeName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-attribute-type">{t("create.type")}</Label>
              <select
                id="new-attribute-type"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={newAttributeType}
                onChange={(event) =>
                  setNewAttributeType(
                    event.target.value as CatalogAttributeType,
                  )
                }
                disabled={loading}
              >
                {ATTRIBUTE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-attribute-unit">{t("create.unit")}</Label>
              <Input
                id="new-attribute-unit"
                placeholder={t("create.unitPlaceholder")}
                value={newAttributeUnit}
                onChange={(event) => setNewAttributeUnit(event.target.value)}
                disabled={loading}
              />
            </div>
            <Button onClick={createAttribute} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" />
              {t("actions.add")}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="w-full max-w-sm space-y-1">
                <Label htmlFor="mapping-category">
                  {t("mapping.categoryLabel")}
                </Label>
                <select
                  id="mapping-category"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={mappingCategoryId}
                  onChange={(event) => setMappingCategoryId(event.target.value)}
                >
                  <option value="">{t("mapping.selectCategory")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={saveCategoryMappings}
                disabled={!mappingCategoryId || savingMappings}
              >
                <Save className="mr-1 h-4 w-4" />
                {savingMappings
                  ? t("actions.saving")
                  : t("mapping.saveMapping")}
              </Button>
            </div>

            {mappingCategoryId && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2">{t("mapping.table.attribute")}</th>
                      <th>{t("mapping.table.use")}</th>
                      <th>{t("mapping.table.required")}</th>
                      <th>{t("mapping.table.filter")}</th>
                      <th>{t("mapping.table.variant")}</th>
                      <th className="w-24">{t("mapping.table.order")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAttributes.map((attribute) => {
                      const draft = mappingDraft[attribute.id];
                      const enabled = draft?.enabled ?? false;
                      return (
                        <tr
                          key={attribute.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 font-medium">{attribute.name}</td>
                          {(
                            [
                              "enabled",
                              "isRequired",
                              "isFilterable",
                              "isVariant",
                            ] as const
                          ).map((field) => (
                            <td key={field}>
                              <input
                                type="checkbox"
                                aria-label={`${attribute.name} ${field}`}
                                checked={
                                  draft?.[field] ?? field === "isFilterable"
                                }
                                disabled={field !== "enabled" && !enabled}
                                onChange={(event) =>
                                  updateMapping(attribute.id, {
                                    [field]: event.target.checked,
                                  })
                                }
                              />
                            </td>
                          ))}
                          <td>
                            <Input
                              type="number"
                              min={0}
                              max={10000}
                              aria-label={`${attribute.name} sort order`}
                              value={draft?.sortOrder ?? 0}
                              disabled={!enabled}
                              onChange={(event) =>
                                updateMapping(attribute.id, {
                                  sortOrder: Number(event.target.value),
                                })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : sortedAttributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("empty.attributes")}
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {sortedAttributes.map((attr) => (
                <div key={attr.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{attr.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("attributeMeta", {
                          type: attr.type,
                          count: attr.categoryAttributes?.length || 0,
                        })}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => deleteAttribute(attr.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label={t("definition.nameAria", { name: attr.name })}
                      value={definitionDraft[attr.id]?.name ?? attr.name}
                      onChange={(event) =>
                        setDefinitionDraft((previous) => ({
                          ...previous,
                          [attr.id]: {
                            ...(previous[attr.id] ?? {
                              type: attr.type,
                              unit: attr.unit ?? "",
                            }),
                            name: event.target.value,
                          },
                        }))
                      }
                    />
                    <select
                      aria-label={t("definition.typeAria", { name: attr.name })}
                      className="h-10 rounded-md border bg-background px-2 text-sm"
                      value={definitionDraft[attr.id]?.type ?? attr.type}
                      onChange={(event) =>
                        setDefinitionDraft((previous) => ({
                          ...previous,
                          [attr.id]: {
                            ...(previous[attr.id] ?? {
                              name: attr.name,
                              unit: attr.unit ?? "",
                            }),
                            type: event.target.value as CatalogAttributeType,
                          },
                        }))
                      }
                    >
                      {ATTRIBUTE_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <Input
                      aria-label={t("definition.unitAria", { name: attr.name })}
                      placeholder={t("definition.unitPlaceholder")}
                      value={definitionDraft[attr.id]?.unit ?? attr.unit ?? ""}
                      onChange={(event) =>
                        setDefinitionDraft((previous) => ({
                          ...previous,
                          [attr.id]: {
                            ...(previous[attr.id] ?? {
                              name: attr.name,
                              type: attr.type,
                            }),
                            unit: event.target.value,
                          },
                        }))
                      }
                    />
                    <Button
                      variant="outline"
                      onClick={() => saveDefinition(attr.id)}
                    >
                      <Save className="mr-1 h-4 w-4" /> {t("actions.save")}
                    </Button>
                  </div>

                  {["SELECT", "MULTI_SELECT", "COLOR"].includes(attr.type) && (
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("values.addPlaceholder")}
                        value={valueDraft[attr.id] || ""}
                        onChange={(e) =>
                          setValueDraft((prev) => ({
                            ...prev,
                            [attr.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="outline"
                        onClick={() => addValue(attr.id)}
                      >
                        {t("actions.add")}
                      </Button>
                    </div>
                  )}

                  {attr.values?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className="text-xs px-2 py-1 rounded-full border hover:bg-muted"
                          title={t("values.clickToDelete")}
                          onClick={() => deleteValue(v.id)}
                        >
                          {v.value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("values.empty")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
