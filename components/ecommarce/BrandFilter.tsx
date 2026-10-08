"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Brand = {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  productCount: number;
};

type BrandFilterProps = {
  brands: Brand[];
  loading: boolean;
  selectedIds: Set<number>;
  setSelectedIds: (ids: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
};

export default function BrandFilter({
  brands,
  loading,
  selectedIds,
  setSelectedIds,
}: BrandFilterProps) {
  const [expanded, setExpanded] = useState<boolean>(true);

  const toggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  const toggleBrand = (id: number) => {
    setSelectedIds((prev: Set<number>) => {
      const next = new Set<number>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => setSelectedIds(new Set<number>());

  const getSelectedCount = () => selectedIds.size;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Filter By Brands
        </h3>
        <div className="mt-3 text-sm text-muted-foreground py-2">
          Loading brands...
        </div>
      </div>
    );
  }

  if (!brands || brands.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Filter By Brands
        </h3>
        <div className="mt-3 text-sm text-muted-foreground py-2">
          No brands for filter
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Filter By Brands
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-interaction underline underline-offset-2"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={toggleExpand}
            className="w-5 h-5 flex items-center justify-center"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-[320px] overflow-auto pr-1">
        {expanded && (
          <div className="space-y-1">
            {brands.map((brand) => {
              const isSelected = selectedIds.has(brand.id);
              return (
                <label
                  key={brand.id}
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-interaction/50 rounded px-2 py-1 transition"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleBrand(brand.id)}
                    className="h-4 w-4 accent-foreground"
                  />
                  <span className="text-foreground flex-1">{brand.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({brand.productCount})
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {getSelectedCount() === 0
          ? "No brands selected."
          : `${getSelectedCount()} brand${getSelectedCount() > 1 ? "s" : ""} selected.`}
      </div>
    </div>
  );
}
