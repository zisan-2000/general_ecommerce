"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type AttributeValue = {
  id: number;
  value: string;
  attributeId: number;
};

type Attribute = {
  id: number;
  name: string;
  values: AttributeValue[];
};

type AttributeFilterProps = {
  attributes: Attribute[];
  loading: boolean;
  selectedValues: Set<string>;
  setSelectedValues: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export default function AttributeFilter({
  attributes,
  loading,
  selectedValues,
  setSelectedValues,
}: AttributeFilterProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set<number>());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Initialize expanded state when attributes load
  useEffect(() => {
    if (attributes.length > 0 && isExpanded) {
      setExpanded(new Set(attributes.map(attr => attr.id)));
    }
  }, [attributes, isExpanded]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set<number>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllExpand = () => {
    if (isExpanded) {
      setExpanded(new Set<number>());
      setIsExpanded(false);
    } else {
      setExpanded(new Set(attributes.map(attr => attr.id)));
      setIsExpanded(true);
    }
  };

  const toggleValue = (attributeId: number, value: string) => {
    const key = `${attributeId}:${value}`;
    setSelectedValues((prev) => {
      const next = new Set<string>(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const reset = () => setSelectedValues(new Set<string>());

  const isValueSelected = (attributeId: number, value: string) => {
    return selectedValues.has(`${attributeId}:${value}`);
  };

  const getSelectedCount = () => selectedValues.size;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Filter By Attributes
        </h3>
        <div className="mt-3 text-sm text-muted-foreground py-2">
          Loading attributes...
        </div>
      </div>
    );
  }

  if (!attributes || attributes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Filter By Attributes
        </h3>
        <div className="mt-3 text-sm text-muted-foreground py-2">
          No attributes found.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Filter By Attributes
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
            onClick={toggleAllExpand}
            className="w-5 h-5 flex items-center justify-center"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 max-h-[320px] overflow-auto pr-1 space-y-3">
          {attributes.map((attr) => {
            const hasValues = attr.values && attr.values.length > 0;
            const isAttrExpanded = expanded.has(attr.id);

            if (!hasValues) return null;

            return (
              <div key={attr.id} className="border-b border-border/30 pb-3 last:border-b-0">
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-interaction transition cursor-pointer"
                  onClick={() => toggleExpand(attr.id)}
                >
                  <span className="w-5 flex items-center justify-center">
                    {isAttrExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>

                  <span className="text-sm font-medium text-foreground leading-snug">
                    {attr.name}
                  </span>

                  <span className="text-xs text-muted-foreground ml-auto">
                    {attr.values.length}
                  </span>
                </div>

                {isAttrExpanded && (
                  <div className="mt-2 space-y-1 pl-7">
                    {attr.values.map((val) => {
                      const isSelected = isValueSelected(attr.id, val.value);
                      return (
                        <label
                          key={val.id}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-interaction/50 rounded px-2 py-1 transition"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleValue(attr.id, val.value)}
                            className="h-4 w-4 accent-foreground"
                          />
                          <span className="text-foreground">{val.value}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        {getSelectedCount() === 0
          ? "No filters applied."
          : `${getSelectedCount()} filter${getSelectedCount() > 1 ? "s" : ""} applied.`}
      </div>
    </div>
  );
}
