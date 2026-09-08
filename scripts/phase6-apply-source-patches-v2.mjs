import fs from "node:fs";

const path = "lib/storefront-home.ts";
const source = fs.readFileSync(path, "utf8");
const before = `        prisma.category.findMany({
          where: { deleted: false },
          orderBy: { id: "desc" },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            parentId: true,`;
const after = `      prisma.category.findMany({
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

if (!source.includes(after)) {
  if (!source.includes(before)) {
    throw new Error("Storefront home category projection target was not found");
  }
  fs.writeFileSync(path, source.replace(before, after));
  console.log("normalized lib/storefront-home.ts");
}

await import("./phase6-apply-source-patches.mjs");
