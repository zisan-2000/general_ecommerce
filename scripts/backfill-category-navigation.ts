import { prisma } from "../lib/prisma";

const LEGACY_TECH_ROOT_ORDER = [
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

async function main() {
  const roots = await prisma.category.findMany({
    where: { deleted: false, parentId: null },
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      featured: true,
    },
  });

  const deletedResult = await prisma.category.updateMany({
    where: { deleted: true, isActive: true },
    data: { isActive: false },
  });

  let orderingInitialized = false;
  if (roots.length > 0 && roots.every((category) => category.sortOrder === 0)) {
    const legacyRank = new Map(
      LEGACY_TECH_ROOT_ORDER.map((slug, index) => [slug, index]),
    );
    const ordered = [...roots].sort((a, b) => {
      const aRank = legacyRank.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
      const bRank = legacyRank.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
      return (
        aRank - bRank ||
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }) ||
        a.id - b.id
      );
    });

    await prisma.$transaction(
      ordered.map((category, index) =>
        prisma.category.update({
          where: { id: category.id },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ),
    );
    orderingInitialized = true;
  }

  let featuredInitialized = false;
  if (roots.length > 0 && !roots.some((category) => category.featured)) {
    const legacyHomepageRoots = roots.slice(0, 5);
    if (legacyHomepageRoots.length > 0) {
      await prisma.category.updateMany({
        where: { id: { in: legacyHomepageRoots.map((category) => category.id) } },
        data: { featured: true },
      });
      featuredInitialized = true;
    }
  }

  console.log(
    JSON.stringify(
      {
        roots: roots.length,
        disabledDeletedCategories: deletedResult.count,
        orderingInitialized,
        featuredInitialized,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Category navigation backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
