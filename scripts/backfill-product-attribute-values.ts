import { buildTypedProductAttributeData } from "../lib/attribute-schema";
import { prisma } from "../lib/prisma";

const BATCH_SIZE = 100;

async function main() {
  const rows = await prisma.productAttribute.findMany({
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
          type: true,
          values: { select: { id: true, value: true } },
        },
      },
    },
  });

  let updated = 0;
  let alreadyTyped = 0;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const writes = batch.flatMap((row) => {
      const data = buildTypedProductAttributeData(row.attribute, row.value);
      const resolved =
        data.valueText !== null ||
        data.valueNumber !== null ||
        data.valueBoolean !== null ||
        data.attributeValueId !== null;
      if (!resolved) return [];

      const isCurrent =
        row.valueText === data.valueText &&
        (row.valueNumber === null ? null : row.valueNumber.toString()) === data.valueNumber &&
        row.valueBoolean === data.valueBoolean &&
        row.attributeValueId === data.attributeValueId;
      if (isCurrent) {
        alreadyTyped += 1;
        return [];
      }

      updated += 1;
      return [prisma.productAttribute.update({ where: { id: row.id }, data })];
    });
    if (writes.length) await prisma.$transaction(writes);
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        updated,
        alreadyTyped,
        unresolved: rows.length - updated - alreadyTyped,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Product attribute backfill failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
