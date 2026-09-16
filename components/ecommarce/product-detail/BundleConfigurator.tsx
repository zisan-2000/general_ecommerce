"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, Minus, Plus } from "lucide-react";
import type { ProductPurchaseData } from "@/lib/product-purchase";

type BundleGroup = ProductPurchaseData["bundleGroups"][number];

export type BundleConfigurationPreview = {
  selections: Array<{ groupId: number; optionId: number | null; quantity: number; omitted?: boolean }>;
  finalPrice: number;
  regularTotal: number;
  availableQuantity: number;
  valid: boolean;
  summary: string[];
};

const money = (value: number, currency: string) =>
  currency.toUpperCase() === "BDT"
    ? `৳${Math.round(value).toLocaleString("en-US")}`
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

function initialSelections(groups: BundleGroup[]) {
  return Object.fromEntries(
    groups.map((group) => [
      group.id,
      {
        optionIds: group.options.filter((option) => option.isDefault).map((option) => option.id),
        quantity: group.defaultQuantity,
      },
    ]),
  ) as Record<number, { optionIds: number[]; quantity: number }>;
}

export default function BundleConfigurator({
  groups,
  currency,
  basePrice,
  stockLimit,
  onChange,
}: {
  groups: BundleGroup[];
  currency: string;
  basePrice: number;
  stockLimit: number | null;
  onChange: (preview: BundleConfigurationPreview) => void;
}) {
  const [selected, setSelected] = useState(() => initialSelections(groups));

  const preview = useMemo<BundleConfigurationPreview>(() => {
    const selections: BundleConfigurationPreview["selections"] = [];
    const summary: string[] = [];
    const demand = new Map<number, { stock: number; quantity: number }>();
    let adjustment = 0;
    let regularTotal = 0;
    let valid = groups.length >= 2;

    for (const group of groups) {
      const state = selected[group.id] ?? { optionIds: [], quantity: group.defaultQuantity };
      const minimum = group.required ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);
      if (state.optionIds.length < minimum || state.optionIds.length > group.maxSelect) valid = false;
      const names: string[] = [];
      for (const optionId of state.optionIds) {
        const option = group.options.find((candidate) => candidate.id === optionId);
        if (!option || !option.product.available) {
          valid = false;
          continue;
        }
        const quantity = state.quantity;
        selections.push({ groupId: group.id, optionId, quantity });
        adjustment += Number(option.priceAdjustment) * quantity;
        const unitPrice = Number(option.variant?.price ?? option.product.basePrice);
        regularTotal += unitPrice * quantity;
        const label = option.variant?.options && typeof option.variant.options === "object"
          ? Object.values(option.variant.options as Record<string, unknown>).join(" / ")
          : option.variant?.sku;
        names.push(`${option.product.name}${label ? ` (${label})` : ""} × ${quantity}`);
        if (option.product.type === "PHYSICAL") {
          if (!option.variant || !option.variant.active) {
            valid = false;
          } else {
            const current = demand.get(option.variant.id) ?? {
              stock: Math.max(0, Number(option.variant.stock)),
              quantity: 0,
            };
            current.quantity += quantity;
            demand.set(option.variant.id, current);
          }
        }
      }
      if (state.optionIds.length === 0 && !group.required) {
        selections.push({
          groupId: group.id,
          optionId: null,
          quantity: state.quantity,
          omitted: true,
        });
      }
      summary.push(`${group.name}: ${names.length ? names.join(", ") : "Not selected"}`);
    }
    const componentCapacity = demand.size
      ? Math.min(...Array.from(demand.values()).map((item) => Math.floor(item.stock / item.quantity)))
      : 0;
    const availableQuantity = stockLimit === null
      ? componentCapacity
      : Math.min(componentCapacity, stockLimit);
    if (availableQuantity <= 0) valid = false;
    return {
      selections,
      finalPrice: Math.max(0, basePrice + adjustment),
      regularTotal,
      availableQuantity: Math.max(0, availableQuantity),
      valid,
      summary,
    };
  }, [basePrice, groups, selected, stockLimit]);

  useEffect(() => onChange(preview), [onChange, preview]);

  const toggleOption = (group: BundleGroup, optionId: number) => {
    if (group.selectionType === "FIXED") return;
    setSelected((current) => {
      const state = current[group.id] ?? { optionIds: [], quantity: group.defaultQuantity };
      const exists = state.optionIds.includes(optionId);
      let optionIds: number[];
      if (exists) {
        optionIds = state.optionIds.filter((id) => id !== optionId);
      } else if (group.maxSelect === 1) {
        optionIds = [optionId];
      } else if (state.optionIds.length < group.maxSelect) {
        optionIds = [...state.optionIds, optionId];
      } else {
        optionIds = state.optionIds;
      }
      return { ...current, [group.id]: { ...state, optionIds } };
    });
  };

  const changeQuantity = (group: BundleGroup, delta: number) => {
    setSelected((current) => {
      const state = current[group.id] ?? { optionIds: [], quantity: group.defaultQuantity };
      const quantity = Math.min(group.maxQuantity, Math.max(group.minQuantity, state.quantity + delta));
      return { ...current, [group.id]: { ...state, quantity } };
    });
  };

  return (
    <div className="mt-4 space-y-3" aria-label="Configure this bundle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Configure your bundle</h2>
          <p className="text-xs text-muted-foreground">Choose only from the options selected by the store.</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {preview.availableQuantity} available
        </span>
      </div>

      {groups.map((group) => {
        const state = selected[group.id] ?? { optionIds: [], quantity: group.defaultQuantity };
        return (
          <fieldset key={group.id} className="rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-bold">
              {group.name} {group.required ? <span className="text-rose-600">*</span> : "(optional)"}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => {
                const active = state.optionIds.includes(option.id);
                const variantText = option.variant?.options && typeof option.variant.options === "object"
                  ? Object.values(option.variant.options as Record<string, unknown>).join(" / ")
                  : option.variant?.sku;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(group, option.id)}
                    disabled={group.selectionType === "FIXED" || !option.product.available}
                    aria-pressed={active}
                    className={`flex min-h-16 items-center gap-3 rounded-md border p-2 text-left transition ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                    } disabled:cursor-default disabled:opacity-80`}
                  >
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-white">
                      <Image src={option.product.image || "/placeholder.svg"} alt="" fill sizes="44px" className="object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{option.product.name}</span>
                      {variantText ? <span className="block truncate text-[11px] text-muted-foreground">{variantText}</span> : null}
                      <span className="block text-[11px] font-medium text-primary">
                        {Number(option.priceAdjustment) === 0
                          ? "Included"
                          : `${Number(option.priceAdjustment) > 0 ? "+" : "−"}${money(Math.abs(Number(option.priceAdjustment)), currency)}`}
                      </span>
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            {!group.required && state.optionIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelected((current) => ({
                  ...current,
                  [group.id]: { ...state, optionIds: [] },
                }))}
                className="mt-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Remove this optional item
              </button>
            ) : null}
            {group.allowQuantityChange && state.optionIds.length > 0 ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="font-medium">Quantity per bundle</span>
                <button type="button" onClick={() => changeQuantity(group, -1)} disabled={state.quantity <= group.minQuantity} className="rounded border p-1 disabled:opacity-40" aria-label={`Decrease ${group.name} quantity`}><Minus className="h-3 w-3" /></button>
                <strong>{state.quantity}</strong>
                <button type="button" onClick={() => changeQuantity(group, 1)} disabled={state.quantity >= group.maxQuantity} className="rounded border p-1 disabled:opacity-40" aria-label={`Increase ${group.name} quantity`}><Plus className="h-3 w-3" /></button>
              </div>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
