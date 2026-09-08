export const CATEGORY_SORT_ORDER_MAX = 1_000_000;

export type CategoryNavigationPlacement = "header" | "footer";

export type CategoryNavigationRecord = {
  id: number;
  name: string;
  parentId: number | null;
  isActive: boolean;
  sortOrder: number;
  showInHeader: boolean;
  showInFooter: boolean;
  featured: boolean;
};

export type CategoryNavigationPatch = Partial<
  Pick<
    CategoryNavigationRecord,
    "isActive" | "sortOrder" | "showInHeader" | "showInFooter" | "featured"
  >
>;

export const CATEGORY_NAVIGATION_DEFAULTS = {
  isActive: true,
  sortOrder: 0,
  showInHeader: true,
  showInFooter: false,
  featured: false,
} as const;

export function compareCategoryNavigation(
  a: Pick<CategoryNavigationRecord, "id" | "name" | "sortOrder">,
  b: Pick<CategoryNavigationRecord, "id" | "name" | "sortOrder">,
) {
  return (
    a.sortOrder - b.sortOrder ||
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
    a.id - b.id
  );
}

export function parseCategoryNavigationPatch(
  input: unknown,
): { ok: true; value: CategoryNavigationPatch } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid category payload" };
  }

  const body = input as Record<string, unknown>;
  const value: CategoryNavigationPatch = {};
  const booleanKeys = [
    "isActive",
    "showInHeader",
    "showInFooter",
    "featured",
  ] as const;

  for (const key of booleanKeys) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") {
      return { ok: false, error: `${key} must be a boolean` };
    }
    value[key] = body[key] as boolean;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > CATEGORY_SORT_ORDER_MAX
    ) {
      return {
        ok: false,
        error: `sortOrder must be an integer between 0 and ${CATEGORY_SORT_ORDER_MAX}`,
      };
    }
    value.sortOrder = sortOrder;
  }

  return { ok: true, value };
}

function isVisibleForPlacement(
  category: CategoryNavigationRecord,
  placement: CategoryNavigationPlacement,
) {
  return (
    category.isActive &&
    (placement === "header" ? category.showInHeader : category.showInFooter)
  );
}

export function getEffectiveCategoryNavigationIds(
  categories: CategoryNavigationRecord[],
  placement: CategoryNavigationPlacement,
) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const visible = new Set<number>();

  const isEffectivelyVisible = (category: CategoryNavigationRecord) => {
    if (!isVisibleForPlacement(category, placement)) return false;

    const visited = new Set<number>([category.id]);
    let parentId = category.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) return false;
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent || !isVisibleForPlacement(parent, placement)) return false;
      parentId = parent.parentId;
    }
    return true;
  };

  for (const category of categories) {
    if (isEffectivelyVisible(category)) visible.add(category.id);
  }

  return visible;
}

export function sortCategoryNavigation<T extends CategoryNavigationRecord>(categories: T[]) {
  return [...categories].sort(compareCategoryNavigation);
}
