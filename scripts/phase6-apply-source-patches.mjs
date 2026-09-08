import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
  console.log(`patched ${path}`);
}

function replaceOnce(path, before, after) {
  const source = read(path);
  if (source.includes(after)) {
    console.log(`already patched ${path}`);
    return;
  }
  if (!source.includes(before)) {
    throw new Error(`Expected Phase 6 patch target was not found in ${path}`);
  }
  write(path, source.replace(before, after));
}

// Prisma Category model: additive navigation fields and lookup indexes.
replaceOnce(
  "prisma/schema.prisma",
`model Category {
  id                 Int                 @id @default(autoincrement())
  name               String
  slug               String              @unique
  image              String?
  parentId           Int?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  deleted            Boolean             @default(false)
  parent             Category?           @relation("CategoryToCategory", fields: [parentId], references: [id])
  children           Category[]          @relation("CategoryToCategory")
  products           Product[]
  categoryAttributes CategoryAttribute[]

  @@index([parentId])
}`,
`model Category {
  id                 Int                 @id @default(autoincrement())
  name               String
  slug               String              @unique
  image              String?
  parentId           Int?
  isActive           Boolean             @default(true)
  sortOrder          Int                 @default(0)
  showInHeader       Boolean             @default(true)
  showInFooter       Boolean             @default(true)
  featured           Boolean             @default(false)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  deleted            Boolean             @default(false)
  parent             Category?           @relation("CategoryToCategory", fields: [parentId], references: [id])
  children           Category[]          @relation("CategoryToCategory")
  products           Product[]
  categoryAttributes CategoryAttribute[]

  @@index([parentId])
  @@index([isActive, showInHeader, sortOrder])
  @@index([isActive, showInFooter, sortOrder])
  @@index([isActive, featured, sortOrder])
}`,
);

// Header: use shared hierarchy/placement rules and remove tech slug ordering.
replaceOnce(
  "components/ecommarce/header.tsx",
`import { useProductCompare } from "@/hooks/use-product-compare";`,
`import { useProductCompare } from "@/hooks/use-product-compare";
import {
  compareCategoryNavigation,
  getEffectiveCategoryNavigationIds,
} from "@/lib/category-navigation";`,
);

replaceOnce(
  "components/ecommarce/header.tsx",
`interface CategoryDTO {
  id: number;

  name: string;

  slug: string;

  image?: string | null;

  parentId: number | null;
}`,
`interface CategoryDTO {
  id: number;

  name: string;

  slug: string;

  image?: string | null;

  parentId: number | null;

  isActive: boolean;

  sortOrder: number;

  showInHeader: boolean;

  showInFooter: boolean;

  featured: boolean;
}`,
);

replaceOnce(
  "components/ecommarce/header.tsx",
`const DESKTOP_CATEGORY_ORDER = [
  "laptop",
  "desktop-pc",
  "components",
  "accessories",
  "monitor",
  "networking",
  "office-equipment",
  "smart-gadget",
  "cameras",
  "television",
  "power",
  "security",
  "gaming",
  "home-appliance",
  "software",
  "servers",
] as const;

`,
``,
);

replaceOnce(
  "components/ecommarce/header.tsx",
`        image: c.image ?? null,

        parentId: (() => {`,
`        image: c.image ?? null,

        isActive: c.isActive !== false,

        sortOrder: Number.isInteger(Number(c.sortOrder)) ? Number(c.sortOrder) : 0,

        showInHeader: c.showInHeader !== false,

        showInFooter: c.showInFooter !== false,

        featured: c.featured === true,

        parentId: (() => {`,
);

const oldTree = `function buildCategoryTree(list: CategoryDTO[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>();

  list.forEach((c) => map.set(c.id, { ...c, children: [] }));

  const roots: CategoryNode[] = [];

  map.forEach((node) => {
    if (
      node.parentId !== null &&
      node.parentId !== undefined &&
      map.has(node.parentId)
    ) {
      map.get(node.parentId)!.children.push(node);

      return;
    }

    roots.push(node);
  });

  const sortRec = (arr: CategoryNode[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name, "bn"));

    arr.forEach((x) => sortRec(x.children));
  };

  sortRec(roots);

  roots.sort((a, b) => {
    const aRank = DESKTOP_CATEGORY_ORDER.indexOf(
      a.slug as (typeof DESKTOP_CATEGORY_ORDER)[number],
    );
    const bRank = DESKTOP_CATEGORY_ORDER.indexOf(
      b.slug as (typeof DESKTOP_CATEGORY_ORDER)[number],
    );
    return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank);
  });

  return roots;
}`;

const newTree = `function buildCategoryTree(list: CategoryDTO[]): CategoryNode[] {
  const visibleIds = getEffectiveCategoryNavigationIds(list, "header");
  const visible = list.filter((category) => visibleIds.has(category.id));
  const map = new Map<number, CategoryNode>();

  visible.forEach((category) =>
    map.set(category.id, { ...category, children: [] }),
  );

  const roots: CategoryNode[] = [];
  map.forEach((node) => {
    if (node.parentId !== null && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
      return;
    }
    roots.push(node);
  });

  const sortRec = (items: CategoryNode[]) => {
    items.sort(compareCategoryNavigation);
    items.forEach((item) => sortRec(item.children));
  };
  sortRec(roots);
  return roots;
}`;
replaceOnce("components/ecommarce/header.tsx", oldTree, newTree);

// Footer: ancestor-safe footer roots ordered by configuration.
replaceOnce(
  "components/ecommarce/footer.tsx",
`import { DEFAULT_SITE_TITLE } from "@/lib/site-defaults";`,
`import { DEFAULT_SITE_TITLE } from "@/lib/site-defaults";
import {
  compareCategoryNavigation,
  getEffectiveCategoryNavigationIds,
} from "@/lib/category-navigation";`,
);
replaceOnce(
  "components/ecommarce/footer.tsx",
`type ApiCategory = {
  id: number | string;
  name: string;
  slug?: string | null;
  parentId?: number | string | null;
};`,
`type ApiCategory = {
  id: number | string;
  name: string;
  slug?: string | null;
  parentId?: number | string | null;
  isActive?: boolean;
  sortOrder?: number;
  showInHeader?: boolean;
  showInFooter?: boolean;
  featured?: boolean;
};

function footerCategoryLinks(input: ApiCategory[]) {
  const normalized = input.map((category) => ({
    ...category,
    id: Number(category.id),
    parentId:
      category.parentId === null || category.parentId === undefined
        ? null
        : Number(category.parentId),
    isActive: category.isActive !== false,
    sortOrder: Number.isInteger(Number(category.sortOrder)) ? Number(category.sortOrder) : 0,
    showInHeader: category.showInHeader !== false,
    showInFooter: category.showInFooter !== false,
    featured: category.featured === true,
  })).filter((category) => Number.isFinite(category.id));
  const visibleIds = getEffectiveCategoryNavigationIds(normalized, "footer");
  return normalized
    .filter((category) => category.parentId === null && visibleIds.has(category.id))
    .sort(compareCategoryNavigation)
    .map((category) => ({
      href: \`/ecommerce/products?category=\${encodeURIComponent(String(category.slug ?? category.id))}\`,
      label: String(category.name ?? "").trim(),
    }))
    .filter((category) => category.label);
}`,
);

const footerInitOld = `  >(() =>
    (categoriesData ?? [])
      .filter((category) => category.parentId === null)
      .map((category) => ({
        href: \`/ecommerce/products?category=\${encodeURIComponent(String(category.slug ?? category.id))}\`,
        label: String(category.name ?? ""),
      }))
      .filter((category) => category.label),
  );`;
const footerInitNew = `  >(() => footerCategoryLinks(categoriesData ?? []));`;
replaceOnce("components/ecommarce/footer.tsx", footerInitOld, footerInitNew);

const footerMapOld = `        // optional: show only root categories (parentId null)
        const roots = list.filter(
          (c) => c.parentId === null || c.parentId === undefined,
        );

        const mapped = roots
          .map((c) => {
            const id = Number(c.id);
            const label = String(c.name ?? "").trim();
            if (!label || !Number.isFinite(id)) return null;

            return {
              href: \`/ecommerce/products?category=\${encodeURIComponent(String(c.slug ?? id))}\`,
              label,
            };
          })
          .filter(Boolean) as Array<{ href: string; label: string }>;

        setCategories(mapped);`;
replaceOnce(
  "components/ecommarce/footer.tsx",
  footerMapOld,
  `        setCategories(footerCategoryLinks(list));`,
);

// Storefront catalog navigation projection.
replaceOnce(
  "lib/storefront-catalog.ts",
`      prisma.category.findMany({
        where: { deleted: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          parentId: true,`,
`      prisma.category.findMany({
        where: { deleted: false, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          parentId: true,
          isActive: true,
          sortOrder: true,
          showInHeader: true,
          showInFooter: true,
          featured: true,`,
);

// Storefront home category projection and deterministic ordering.
replaceOnce(
  "lib/storefront-home.ts",
`      prisma.category.findMany({
        where: { deleted: false },
        orderBy: { id: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          parentId: true,`,
`      prisma.category.findMany({
        where: { deleted: false, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          parentId: true,
          isActive: true,
          sortOrder: true,
          showInHeader: true,
          showInFooter: true,
          featured: true,`,
);

// Homepage category cards: configured featured roots, with compatibility fallback.
replaceOnce(
  "components/ecommarce/FeaturedCategories.tsx",
`  deleted?: boolean;
};`,
`  deleted?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  showInHeader?: boolean;
  showInFooter?: boolean;
  featured?: boolean;
};`,
);
replaceOnce(
  "components/ecommarce/FeaturedCategories.tsx",
`  const firstParentCategories = useMemo(() => {
    return cats
      .filter((item) => item.parentId === null && !item.deleted)
      .slice(0, 5);
  }, [cats]);`,
`  const firstParentCategories = useMemo(() => {
    const roots = cats
      .filter((item) => item.parentId === null && !item.deleted && item.isActive !== false)
      .sort(
        (a, b) =>
          Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
          a.id - b.id,
      );
    const configured = roots.filter((item) => item.featured === true);
    return (configured.length > 0 ? configured : roots).slice(0, 5);
  }, [cats]);`,
);

// Package scripts: Phase 6 release gate and DB helpers.
replaceOnce(
  "package.json",
`    "test:universal-phase5": "tsx --test tests/category-attribute-integration.test.mjs",
    "validate:schema":`,
`    "test:universal-phase5": "tsx --test tests/category-attribute-integration.test.mjs",
    "test:universal-phase6": "tsx --test tests/category-navigation.test.mjs",
    "validate:schema":`,
);
replaceOnce(
  "package.json",
`    "verify:universal-phase5": "npm run verify:universal-phase4 && npm run test:universal-phase5",
    "verify:business-network-m15":`,
`    "verify:universal-phase5": "npm run verify:universal-phase4 && npm run test:universal-phase5",
    "verify:universal-phase6": "npm run verify:universal-phase5 && npm run test:universal-phase6 && npm run validate:schema && npm run typecheck",
    "verify:business-network-m15":`,
);
replaceOnce(
  "package.json",
`    "verify:product-attributes-db": "tsx scripts/verify-product-attribute-values.ts",
    "seed:storefront-menu":`,
`    "verify:product-attributes-db": "tsx scripts/verify-product-attribute-values.ts",
    "backfill:category-navigation": "tsx scripts/backfill-category-navigation.ts",
    "verify:category-navigation-db": "tsx scripts/verify-category-navigation.ts",
    "seed:storefront-menu":`,
);

console.log("Phase 6 source patches applied successfully.");
