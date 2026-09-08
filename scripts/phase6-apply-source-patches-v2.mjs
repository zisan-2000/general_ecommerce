import fs from "node:fs";

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

await import("./phase6-apply-source-patches.mjs");

const finalHeader = fs.readFileSync(headerPath, "utf8");
if (finalHeader.includes("DESKTOP_CATEGORY_ORDER")) {
  throw new Error("DESKTOP_CATEGORY_ORDER still exists after Phase 6 patch");
}
if (!finalHeader.includes("getEffectiveCategoryNavigationIds")) {
  throw new Error("Header is not using the Phase 6 category navigation resolver");
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

console.log("Phase 6 post-patch assertions passed.");
