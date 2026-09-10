"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Clipboard, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createSpecificationCopyFormat,
  getSpecificationPreset,
  mergeSpecificationGroups,
  parseSpecificationText,
  SPECIFICATION_TEMPLATE_LABELS,
  type SpecificationApplyMode,
  type SpecificationGroupInput,
  type SpecificationParseResult,
  type SpecificationTemplateKey,
} from "@/lib/product-specifications";

interface Props {
  enabled: boolean;
  groups: SpecificationGroupInput[];
  onEnabledChange: (enabled: boolean) => void;
  onChange: (groups: SpecificationGroupInput[]) => void;
}

const move = <T,>(items: T[], from: number, to: number) => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export default function ProductSpecificationBuilder({
  enabled,
  groups,
  onEnabledChange,
  onChange,
}: Props) {
  const [template, setTemplate] = useState<SpecificationTemplateKey>("blank");
  const [pendingTemplate, setPendingTemplate] = useState<SpecificationTemplateKey | null>(null);
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [parseResult, setParseResult] = useState<SpecificationParseResult | null>(null);
  const [applyMode, setApplyMode] = useState<SpecificationApplyMode>("fill-empty");

  const hasStructure = groups.some((group) => group.name.trim() || group.items.length > 0);
  const hasValues = groups.some((group) => group.items.some((item) => item.value.trim()));

  const updateGroup = (index: number, patch: Partial<SpecificationGroupInput>) => {
    onChange(groups.map((group, groupIndex) => (groupIndex === index ? { ...group, ...patch } : group)));
  };

  const loadTemplate = () => {
    if (template === "blank") return;
    if (hasStructure) {
      setPendingTemplate(template);
      return;
    }
    onChange(getSpecificationPreset(template));
    toast.success(`${SPECIFICATION_TEMPLATE_LABELS[template]} template loaded`);
  };

  const applyTemplate = (mode: "merge" | "replace") => {
    if (!pendingTemplate) return;
    const preset = getSpecificationPreset(pendingTemplate);
    onChange(mode === "replace" ? preset : mergeSpecificationGroups(groups, preset, "fill-empty"));
    toast.success(`${SPECIFICATION_TEMPLATE_LABELS[pendingTemplate]} template ${mode === "merge" ? "merged" : "loaded"}`);
    setPendingTemplate(null);
  };

  const startPreview = () => {
    const result = parseSpecificationText(importText);
    if (result.itemCount === 0) {
      toast.error("We could not detect valid specification data. Use a group name followed by Specification: Value.");
      return;
    }
    setParseResult(result);
  };

  const closeAutoFill = () => {
    setAutoFillOpen(false);
    setParseResult(null);
    setImportText("");
    setApplyMode("fill-empty");
  };

  const applyImport = () => {
    if (!parseResult) return;
    onChange(mergeSpecificationGroups(groups, parseResult.groups, applyMode));
    onEnabledChange(true);
    toast.success(`${parseResult.itemCount} specifications applied`);
    closeAutoFill();
  };

  const copyFormat = async (format: "laptop" | "desktop") => {
    try {
      await navigator.clipboard.writeText(createSpecificationCopyFormat(format));
      toast.success(`${SPECIFICATION_TEMPLATE_LABELS[format]} format copied`);
    } catch {
      toast.error("Could not copy the format. Please allow clipboard access and try again.");
    }
  };

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Step 3: Dynamic Product Specifications</h3>
          <p className="text-sm text-muted-foreground">
            Use a preset, paste formatted specifications, or build a custom structure.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          Enable Specifications
        </label>
      </div>

      {enabled ? (
        <>
          <div className="grid gap-3 rounded-lg bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="specification-template">Specification Template</Label>
              <select
                id="specification-template"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={template}
                onChange={(event) => setTemplate(event.target.value as SpecificationTemplateKey)}
              >
                {Object.entries(SPECIFICATION_TEMPLATE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <Button type="button" variant="outline" onClick={loadTemplate} disabled={template === "blank"}>
              Load Template
            </Button>
            <Button type="button" onClick={() => setAutoFillOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" /> Auto Fill Specifications
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Select and load a template, import formatted text, or add your first group.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group, groupIndex) => (
                <div key={`${groupIndex}-${group.name}`} className="space-y-3 rounded-lg border p-3">
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Group ${groupIndex + 1} name`}
                      className="font-semibold"
                      value={group.name}
                      onChange={(event) => updateGroup(groupIndex, { name: event.target.value })}
                      placeholder="Group name"
                    />
                    <Button type="button" size="icon" variant="outline" disabled={groupIndex === 0} onClick={() => onChange(move(groups, groupIndex, groupIndex - 1))} aria-label="Move group up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="outline" disabled={groupIndex === groups.length - 1} onClick={() => onChange(move(groups, groupIndex, groupIndex + 1))} aria-label="Move group down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="outline" onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))} aria-label="Remove group">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {group.items.map((item, itemIndex) => (
                    <div key={`${itemIndex}-${item.label}`} className="grid gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto_auto_auto]">
                      <Input
                        aria-label={`Specification ${itemIndex + 1} label`}
                        value={item.label}
                        onChange={(event) => updateGroup(groupIndex, {
                          items: group.items.map((current, index) => index === itemIndex ? { ...current, label: event.target.value } : current),
                        })}
                        placeholder="Label"
                      />
                      <Input
                        aria-label={`${item.label || "Specification"} value`}
                        value={item.value}
                        onChange={(event) => updateGroup(groupIndex, {
                          items: group.items.map((current, index) => index === itemIndex ? { ...current, value: event.target.value } : current),
                        })}
                        placeholder="Value"
                      />
                      <Button type="button" size="icon" variant="ghost" disabled={itemIndex === 0} onClick={() => updateGroup(groupIndex, { items: move(group.items, itemIndex, itemIndex - 1) })} aria-label="Move specification up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" disabled={itemIndex === group.items.length - 1} onClick={() => updateGroup(groupIndex, { items: move(group.items, itemIndex, itemIndex + 1) })} aria-label="Move specification down">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => updateGroup(groupIndex, { items: group.items.filter((_, index) => index !== itemIndex) })} aria-label="Remove specification">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button type="button" size="sm" variant="outline" onClick={() => updateGroup(groupIndex, { items: [...group.items, { label: "", value: "" }] })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Specification
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onChange([...groups, { name: "", items: [] }])}>
              <Plus className="mr-2 h-4 w-4" /> Add Group
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              if (groups.length === 0) onChange([{ name: "General", items: [{ label: "", value: "" }] }]);
              else updateGroup(groups.length - 1, { items: [...groups[groups.length - 1].items, { label: "", value: "" }] });
            }}>
              <Plus className="mr-2 h-4 w-4" /> Add Specification
            </Button>
          </div>
        </>
      ) : null}

      <Dialog open={pendingTemplate !== null} onOpenChange={(open) => { if (!open) setPendingTemplate(null); }}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>Change specification template?</DialogTitle>
            <DialogDescription>
              Changing the template may modify the current specification structure. Merge keeps current values and adds missing preset fields.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setPendingTemplate(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => applyTemplate("replace")}>Replace Current Specifications</Button>
            <Button type="button" onClick={() => applyTemplate("merge")}>Merge Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={autoFillOpen} onOpenChange={(open) => { if (!open) closeAutoFill(); }}>
        <DialogContent className="z-[70] max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto Fill Specifications</DialogTitle>
            <DialogDescription>
              {parseResult ? "Review the detected specifications before applying them." : "Paste a group name followed by Label: Value lines."}
            </DialogDescription>
          </DialogHeader>

          {!parseResult ? (
            <div className="space-y-4">
              <Textarea rows={14} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={"General\nBrand: Dell\nModel: Inspiron 15\n\nProcessor\nProcessor Model: Core i5-1335U"} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void copyFormat("laptop")}>
                  <Clipboard className="mr-2 h-4 w-4" /> Copy Laptop Format
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyFormat("desktop")}>
                  <Clipboard className="mr-2 h-4 w-4" /> Copy Desktop PC Format
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <strong>{parseResult.itemCount} specifications detected.</strong>
                {parseResult.warnings.length > 0 ? ` ${parseResult.warnings.length} lines could not be parsed.` : " No parsing warnings."}
              </div>
              {parseResult.warnings.length > 0 ? (
                <details className="rounded-lg border p-3 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium">Parsing warnings</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {parseResult.warnings.map((warning, index) => (
                      <li key={`${warning.line}-${index}`}>{warning.line ? `Line ${warning.line}: ` : ""}{warning.reason} ({warning.text})</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
                {parseResult.groups.map((group, groupIndex) => (
                  <div key={`${group.name}-${groupIndex}`}>
                    <h4 className="font-semibold">{group.name}</h4>
                    <dl className="mt-1 space-y-1 text-sm">
                      {group.items.map((item, itemIndex) => (
                        <div key={`${item.label}-${itemIndex}`} className="grid grid-cols-[minmax(0,0.45fr)_auto_minmax(0,0.55fr)] gap-2">
                          <dt>{item.label}</dt><span aria-hidden>→</span><dd className="text-muted-foreground">{item.value || <em>Empty</em>}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              {hasValues ? (
                <fieldset className="space-y-2 rounded-lg border p-3">
                  <legend className="px-1 text-sm font-semibold">Existing specification data detected</legend>
                  {([
                    ["fill-empty", "Fill Empty Fields Only"],
                    ["merge", "Merge and Update Matching Fields"],
                    ["replace", "Replace All Specifications"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="specification-apply-mode" value={value} checked={applyMode === value} onChange={() => setApplyMode(value)} />
                      {label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={parseResult ? () => setParseResult(null) : closeAutoFill}>
              {parseResult ? "Back" : "Cancel"}
            </Button>
            <Button type="button" onClick={parseResult ? applyImport : startPreview} disabled={!parseResult && !importText.trim()}>
              {parseResult ? "Apply Specifications" : "Auto Fill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
