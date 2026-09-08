import { buildTypedProductAttributeData } from "../lib/attribute-schema";
import { prisma } from "../lib/prisma";

async function main() {
  const [rows, mappingCount] = await Promise.all([
    prisma.productAttribute.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        value: true,
        valueText: true,
        valueNumber: true,
        valueBoolean: true,
        attributeValueId: true,
        attribute: {
          select: {
            id: true,
            name: true,
            type: true,
            values: { select: { id: true, value: true } },
          },
        },
      },
    }),
    prisma.categoryAttribute.count(),
  ]);

  const unresolved = rows.flatMap((row) => {
    const expected = buildTypedProductAttributeData(row.attribute, row.value);
    const isResolved =
      expected.valueText !== null ||
      expected.valueNumber !== null ||
      expected.valueBoolean !== null ||
      expected.attributeValueId !== null;
    if (!isResolved) {
      return [{ id: row.id, attribute: row.attribute.name, reason: "legacy value cannot be typed" }];
    }

    const matches =
      row.valueText === expected.valueText &&
      (row.valueNumber === null ? null : row.valueNumber.toString()) === expected.valueNumber &&
      row.valueBoolean === expected.valueBoolean &&
      row.attributeValueId === expected.attributeValueId;
    return matches
      ? []
      : [{ id: row.id, attribute: row.attribute.name, reason: "typed value is missing or stale" }];
  });

  console.log(
    JSON.stringify(
      {
        productAttributes: rows.length,
        categoryMappings: mappingCount,
        unresolvedCount: unresolved.length,
        unresolved: unresolved.slice(0, 50),
      },
      null,
      2,
    ),
  );
  if (unresolved.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Product attribute verification failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
