import fs from "node:fs";

function patchRequired(path, before, after, message) {
  const source = fs.readFileSync(path, "utf8");
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`${message} target was not found in ${path}`);
  }
  fs.writeFileSync(path, source.replace(before, after));
  console.log(message);
}

const homePath = "lib/storefront-home.ts";
const homeSource = fs.readFileSync(homePath, "utf8");
const homeBefore = `        prisma.category.findMany({
          where: { deleted: false },
          orderBy: { id: "desc" },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            parentId: true,`;
const homeAfter = `      prisma.category.findMany({
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
          featured: true,`;

if (!homeSource.includes(homeAfter)) {
  if (!homeSource.includes(homeBefore)) {
    throw new Error("Storefront home category projection target was not found");
  }
  fs.writeFileSync(homePath, homeSource.replace(homeBefore, homeAfter));
  console.log("normalized lib/storefront-home.ts");
}

const headerPath = "components/ecommarce/header.tsx";
const headerSource = fs.readFileSync(headerPath, "utf8");
const legacyDesktopCategoryOrder = `const DESKTOP_CATEGORY_ORDER = [
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

`;

if (headerSource.includes(legacyDesktopCategoryOrder)) {
  fs.writeFileSync(
    headerPath,
    headerSource.replace(legacyDesktopCategoryOrder, ""),
  );
  console.log("removed DESKTOP_CATEGORY_ORDER from header");
}

const categoryItemPath = "app/api/categories/[id]/route.ts";
let categoryItemSource = fs.readFileSync(categoryItemPath, "utf8");
const combinedDeleteUpdate = `    await prisma.category.update({
      where: { id },
      data: { deleted: true, isActive: false },
    });`;
const compatibleDeleteUpdate = `    await prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: { id },
        data: { deleted: true },
      });
      await tx.category.update({
        where: { id },
        data: { isActive: false },
      });
    });`;
if (!categoryItemSource.includes(compatibleDeleteUpdate)) {
  if (!categoryItemSource.includes(combinedDeleteUpdate)) {
    throw new Error("Category soft-delete compatibility target was not found");
  }
  categoryItemSource = categoryItemSource.replace(
    combinedDeleteUpdate,
    compatibleDeleteUpdate,
  );
  fs.writeFileSync(categoryItemPath, categoryItemSource);
  console.log("preserved Phase 1 category soft-delete contract");
}

await import("./phase6-apply-source-patches.mjs");

patchRequired(
  "app/admin/management/categories/page.tsx",
  `  parentId?: number | null;\n  parentName?: string | null;`,
  `  parentId: number | null;\n  parentName?: string | null;`,
  "aligned admin category parentId type",
);

patchRequired(
  "scripts/backfill-category-navigation.ts",
  `    const legacyRank = new Map(\n      LEGACY_TECH_ROOT_ORDER.map((slug, index) => [slug, index]),\n    );`,
  `    const legacyRank = new Map<string, number>(\n      LEGACY_TECH_ROOT_ORDER.map((slug, index) => [slug, index]),\n    );`,
  "widened legacy category rank lookup type",
);

patchRequired(
  headerPath,
  `              image: c.image ?? null,\n\n              parentId:\n                c.parentId === null ||\n                c.parentId === undefined ||\n                c.parentId === ""\n                  ? null\n                  : Number(c.parentId),`,
  `              image: c.image ?? null,\n\n              isActive: c.isActive !== false,\n\n              sortOrder: Number.isInteger(Number(c.sortOrder)) ? Number(c.sortOrder) : 0,\n\n              showInHeader: c.showInHeader !== false,\n\n              showInFooter: c.showInFooter !== false,\n\n              featured: c.featured === true,\n\n              parentId:\n                c.parentId === null ||\n                c.parentId === undefined ||\n                c.parentId === ""\n                  ? null\n                  : Number(c.parentId),`,
  "completed header category fallback projection",
);

patchRequired(
  "lib/storefront-catalog.ts",
  `        parentId: category.parentId,\n        depth: category.depth,\n        productCount: totalProducts(category.id),`,
  `        parentId: category.parentId,\n        isActive: category.isActive,\n        sortOrder: category.sortOrder,\n        showInHeader: category.showInHeader,\n        showInFooter: category.showInFooter,\n        featured: category.featured,\n        depth: category.depth,\n        productCount: totalProducts(category.id),`,
  "completed storefront catalog category projection",
);

patchRequired(
  "lib/storefront-home.ts",
  `        parentId: category.parentId,\n        parentName:\n          category.parentId === null`,
  `        parentId: category.parentId,\n        isActive: category.isActive,\n        sortOrder: category.sortOrder,\n        showInHeader: category.showInHeader,\n        showInFooter: category.showInFooter,\n        featured: category.featured,\n        parentName:\n          category.parentId === null`,
  "completed storefront home category projection",
);

const finalHeader = fs.readFileSync(headerPath, "utf8");
if (finalHeader.includes("DESKTOP_CATEGORY_ORDER")) {
  throw new Error("DESKTOP_CATEGORY_ORDER still exists after Phase 6 patch");
}
if (!finalHeader.includes("getEffectiveCategoryNavigationIds")) {
  throw new Error("Header is not using the Phase 6 category navigation resolver");
}
if (!finalHeader.includes("showInHeader: c.showInHeader !== false")) {
  throw new Error("Header fallback category projection is incomplete");
}

const finalCategoryItem = fs.readFileSync(categoryItemPath, "utf8");
if (!/data:\s*\{\s*deleted:\s*true\s*\}/.test(finalCategoryItem)) {
  throw new Error("Phase 1 category soft-delete contract was not preserved");
}
if (!/data:\s*\{\s*isActive:\s*false\s*\}/.test(finalCategoryItem)) {
  throw new Error("Phase 6 category deactivation was not preserved");
}

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
for (const field of [
  "isActive",
  "sortOrder",
  "showInHeader",
  "showInFooter",
  "featured",
]) {
  if (!schema.includes(field)) {
    throw new Error(`Prisma Category model is missing ${field}`);
  }
}

const packageJson = fs.readFileSync("package.json", "utf8");
for (const script of [
  "test:universal-phase6",
  "verify:universal-phase6",
  "backfill:category-navigation",
  "verify:category-navigation-db",
]) {
  if (!packageJson.includes(`\"${script}\"`)) {
    throw new Error(`package.json is missing ${script}`);
  }
}

const finalCatalog = fs.readFileSync("lib/storefront-catalog.ts", "utf8");
const finalHome = fs.readFileSync("lib/storefront-home.ts", "utf8");
for (const field of ["isActive", "sortOrder", "showInHeader", "showInFooter", "featured"]) {
  if (!finalCatalog.includes(`${field}: category.${field}`)) {
    throw new Error(`Storefront catalog projection is missing ${field}`);
  }
  if (!finalHome.includes(`${field}: category.${field}`)) {
    throw new Error(`Storefront home projection is missing ${field}`);
  }
}

console.log("Phase 6 post-patch assertions passed.");
