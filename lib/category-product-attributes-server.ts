import "server-only";

import type { LegacyProductAttributeInput } from "@/lib/attribute-schema";
import {
  buildTypedProductAttributeData,
  validateCategoryProductAttributePolicy,
  validateTypedProductAttributeData,
} from "@/lib/attribute-schema";
import { prisma } from "@/lib/prisma";

export async function validateCategoryProductAttributes(input: {
  categoryId: number;
  productAttributes: LegacyProductAttributeInput[];
  variantOptions?: Array<{ name: string; values: string[] }>;
}) {
  const attributeIds = input.productAttributes.map((item) => item.attributeId);
  const [category, definitions] = await Promise.all([
    prisma.category.findFirst({
      where: { id: input.categoryId, deleted: false },
      select: {
        id: true,
        categoryAttributes: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            attributeId: true,
            isRequired: true,
            isFilterable: true,
            isVariant: true,
            sortOrder: true,
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                unit: true,
                values: { select: { id: true, value: true } },
              },
            },
          },
        },
      },
    }),
    attributeIds.length
      ? prisma.attribute.findMany({
          where: { id: { in: attributeIds } },
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            values: { select: { id: true, value: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!category) {
    return { ok: false as const, error: "Category not found" };
  }

  const definitionsById = new Map(definitions.map((item) => [item.id, item]));
  for (const mapping of category.categoryAttributes) {
    definitionsById.set(mapping.attributeId, mapping.attribute);
  }

  return validateCategoryProductAttributePolicy({
    productAttributes: input.productAttributes,
    definitions: [...definitionsById.values()],
    mappings: category.categoryAttributes,
    variantOptions: input.variantOptions,
  });
}

export async function validateSingleCategoryProductAttribute(input: {
  categoryId: number;
  attributeId: number;
  value: string;
}) {
  const [definition, mappings] = await Promise.all([
    prisma.attribute.findUnique({
      where: { id: input.attributeId },
      select: {
        id: true,
        name: true,
        type: true,
        unit: true,
        values: { select: { id: true, value: true } },
      },
    }),
    prisma.categoryAttribute.findMany({
      where: { categoryId: input.categoryId },
      select: { attributeId: true },
    }),
  ]);
  if (!definition) {
    return { ok: false as const, error: "Attribute not found" };
  }
  if (mappings.length > 0 && !mappings.some((item) => item.attributeId === input.attributeId)) {
    return { ok: false as const, error: `${definition.name} is not assigned to this category` };
  }

  const validated = mappings.length > 0
    ? validateTypedProductAttributeData(definition, input.value)
    : { ok: true as const, value: buildTypedProductAttributeData(definition, input.value) };
  return validated;
}

export async function canDeleteCategoryProductAttribute(input: {
  categoryId: number;
  attributeId: number;
}) {
  const mapping = await prisma.categoryAttribute.findUnique({
    where: {
      categoryId_attributeId: {
        categoryId: input.categoryId,
        attributeId: input.attributeId,
      },
    },
    select: { isRequired: true, attribute: { select: { name: true } } },
  });
  return mapping?.isRequired
    ? { ok: false as const, error: `${mapping.attribute.name} is required for this category` }
    : { ok: true as const };
}
