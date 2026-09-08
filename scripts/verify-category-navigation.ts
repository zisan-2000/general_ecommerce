import { prisma } from "../lib/prisma";
import { CATEGORY_SORT_ORDER_MAX } from "../lib/category-navigation";

async function main() {
  const [categories, footerColumns] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        parentId: true,
        deleted: true,
        isActive: true,
        sortOrder: true,
        showInHeader: true,
        showInFooter: true,
        featured: true,
      },
    }),
    prisma.$queryRaw<Array<{ column_default: string | null }>>`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Category'
        AND column_name = 'showInFooter'
    `,
  ]);

  const failures: string[] = [];
  const footerDefault = footerColumns[0]?.column_default ?? null;
  if (!footerDefault || !footerDefault.toLowerCase().includes("false")) {
    failures.push("Category.showInFooter database default must be false");
  }
  const byId = new Map(categories.map((category) => [category.id, category]));

  for (const category of categories) {
    if (
      !Number.isInteger(category.sortOrder) ||
      category.sortOrder < 0 ||
      category.sortOrder > CATEGORY_SORT_ORDER_MAX
    ) {
      failures.push(`${category.id}:${category.name} has invalid sortOrder`);
    }
    if (category.deleted && category.isActive) {
      failures.push(`${category.id}:${category.name} is deleted but still active`);
    }
    if (category.parentId !== null && !byId.has(category.parentId)) {
      failures.push(`${category.id}:${category.name} references a missing parent`);
    }

    const visited = new Set<number>([category.id]);
    let parentId = category.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) {
        failures.push(`${category.id}:${category.name} participates in a category cycle`);
        break;
      }
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }

  const activeRoots = categories.filter(
    (category) => !category.deleted && category.isActive && category.parentId === null,
  );
  const headerRoots = activeRoots.filter((category) => category.showInHeader);
  const footerRoots = activeRoots.filter((category) => category.showInFooter);
  const featuredRoots = activeRoots.filter((category) => category.featured);
  if (activeRoots.length > 0 && featuredRoots.length === 0) {
    failures.push("No active root category is configured for homepage featuring");
  }

  const result = {
    categoryCount: categories.length,
    activeRootCount: activeRoots.length,
    headerRootCount: headerRoots.length,
    footerRootCount: footerRoots.length,
    featuredRootCount: featuredRoots.length,
    newCategoryFooterDefault: footerDefault,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Category navigation verification failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
