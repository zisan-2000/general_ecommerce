"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertCircle, Check, Minus, Plus } from "lucide-react";
import type { ProductPurchaseData } from "@/lib/product-purchase";
import {
  calculateConfiguredBundlePricing,
  getBundleOptionUnitPrice,
} from "@/lib/bundle-configuration-pricing";

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
      : 99;
    const availableQuantity = stockLimit === null
      ? componentCapacity
      : Math.min(componentCapacity, stockLimit);
    if (availableQuantity <= 0) valid = false;
    const pricing = calculateConfiguredBundlePricing({ basePrice, groups, selections });
    return {
      selections,
      finalPrice: pricing.finalPrice,
      regularTotal: pricing.regularTotal,
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
      const minimum = group.required ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);
      let optionIds: number[];
      if (exists) {
        optionIds = state.optionIds.length > minimum
          ? state.optionIds.filter((id) => id !== optionId)
          : state.optionIds;
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
    <div className="mt-4 space-y-4" aria-label="Configure this bundle">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
            <h2 className="text-base font-bold">Build your bundle</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose from the store-approved products. Your price and stock update instantly.</p>
        </div>
          <div className="text-right" aria-live="polite">
            <p className="text-xs font-medium text-muted-foreground">Your bundle price</p>
            <p className="text-xl font-black text-primary">{money(preview.finalPrice, currency)}</p>
            <p className={`text-xs font-semibold ${preview.finalPrice > basePrice ? "text-amber-700" : preview.finalPrice < basePrice ? "text-emerald-700" : "text-muted-foreground"}`}>
              {preview.finalPrice === basePrice
                ? "Base configuration"
                : `${preview.finalPrice > basePrice ? "+" : "−"}${money(Math.abs(preview.finalPrice - basePrice), currency)} from base`}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-background px-3 py-1 font-semibold text-foreground">{preview.availableQuantity} available</span>
          <span className={`rounded-full px-3 py-1 font-semibold ${preview.valid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {preview.valid ? "Configuration ready" : "Selection required"}
          </span>
        </div>
      </div>

      {groups.map((group) => {
        const state = selected[group.id] ?? { optionIds: [], quantity: group.defaultQuantity };
        const minimum = group.required ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);
        const selectionValid = state.optionIds.length >= minimum && state.optionIds.length <= group.maxSelect;
        const defaultUnitPrice = group.options
          .filter((option) => option.isDefault)
          .reduce((total, option) => total + getBundleOptionUnitPrice(option), 0);
        return (
          <fieldset key={group.id} className={`rounded-xl border p-4 ${selectionValid ? "border-border" : "border-amber-400 bg-amber-50/50"}`}>
            <legend className="px-1 text-sm font-bold">
              {group.name} {group.required ? <span className="text-rose-600" aria-label="required">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
            </legend>
            <p className="mb-3 text-xs text-muted-foreground">
              {group.selectionType === "FIXED"
                ? "Included in every bundle"
                : group.minSelect === group.maxSelect
                  ? `Choose ${group.maxSelect}`
                  : `Choose ${group.minSelect} to ${group.maxSelect}`}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => {
                const active = state.optionIds.includes(option.id);
                const unavailable = !option.product.available || (
                  option.product.type === "PHYSICAL" &&
                  (!option.variant || !option.variant.active || option.variant.stock <= 0)
                );
                const selectionLimitReached =
                  !active &&
                  group.maxSelect > 1 &&
                  state.optionIds.length >= group.maxSelect;
                const variantText = option.variant?.options && typeof option.variant.options === "object"
                  ? Object.values(option.variant.options as Record<string, unknown>).join(" / ")
                  : option.variant?.sku;
                const unitPrice = getBundleOptionUnitPrice(option);
                const automaticDifference = group.selectionType === "OPTIONAL" && !group.options.some((candidate) => candidate.isDefault)
                  ? unitPrice
                  : unitPrice - defaultUnitPrice;
                const displayedAdjustment = group.pricingMode === "MANUAL"
                  ? Number(option.priceAdjustment)
                  : automaticDifference;
                const showIndividualAdjustment =
                  group.pricingMode === "MANUAL" || group.maxSelect === 1;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(group, option.id)}
                    disabled={group.selectionType === "FIXED" || unavailable || selectionLimitReached}
                    aria-pressed={active}
                    className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 text-left transition ${
                      active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/50 hover:bg-muted/40"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-white">
                      <Image src={option.product.image || "/placeholder.svg"} alt="" fill sizes="44px" className="object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{option.product.name}</span>
                      {variantText ? <span className="block truncate text-[11px] text-muted-foreground">{variantText}</span> : null}
                      <span className="block text-[11px] text-muted-foreground">Item value {money(unitPrice, currency)}</span>
                      <span className="block text-[11px] font-semibold text-primary">
                        {unavailable
                          ? "Out of stock"
                          : selectionLimitReached
                            ? "Maximum selected"
                            : !showIndividualAdjustment
                              ? "Price updates from selected items"
                            : displayedAdjustment === 0
                          ? "Included"
                          : `${displayedAdjustment > 0 ? "+" : "−"}${money(Math.abs(displayedAdjustment), currency)}`}
                      </span>
                    </span>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center border ${group.maxSelect === 1 ? "rounded-full" : "rounded"} ${active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                      {active ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {!selectionValid ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800" role="alert">
                <AlertCircle className="h-3.5 w-3.5" />Select {minimum === group.maxSelect ? minimum : `${minimum}–${group.maxSelect}`} option{group.maxSelect === 1 ? "" : "s"} to continue.
              </p>
            ) : null}
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
