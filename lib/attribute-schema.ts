export const ATTRIBUTE_TYPES = [
  "TEXT",
  "NUMBER",
  "SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
  "COLOR",
] as const;

export type CatalogAttributeType = (typeof ATTRIBUTE_TYPES)[number];

export type AttributeDefinition = {
  id: number;
  type: CatalogAttributeType;
  values: Array<{ id: number; value: string }>;
};

export type TypedProductAttributeData = {
  value: string;
  valueText: string | null;
  valueNumber: string | null;
  valueBoolean: boolean | null;
  attributeValueId: number | null;
};

export type LegacyProductAttributeInput = {
  attributeId: number;
  value: string;
};

const BOOLEAN_VALUES = new Map<string, boolean>([
  ["true", true],
  ["yes", true],
  ["1", true],
  ["false", false],
  ["no", false],
  ["0", false],
]);

export function isAttributeType(value: unknown): value is CatalogAttributeType {
  return typeof value === "string" && ATTRIBUTE_TYPES.includes(value as CatalogAttributeType);
}

export function parseAttributeDefinitionInput(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
  const name = String(source.name ?? "").trim();
  const type = source.type === undefined ? "SELECT" : source.type;
  const unit = source.unit === undefined || source.unit === null
    ? null
    : String(source.unit).trim() || null;

  if (!name || name.length > 100) {
    return { ok: false as const, error: "Name must be between 1 and 100 characters" };
  }
  if (!isAttributeType(type)) {
    return { ok: false as const, error: "Invalid attribute type" };
  }
  if (unit && unit.length > 30) {
    return { ok: false as const, error: "Unit must be at most 30 characters" };
  }

  return { ok: true as const, value: { name, type, unit } };
}

export function parseCategoryAttributeMappings(input: unknown) {
  if (!Array.isArray(input)) {
    return { ok: false as const, error: "Attributes must be an array" };
  }
  if (input.length > 128) {
    return { ok: false as const, error: "A category can have at most 128 attributes" };
  }

  const unique = new Map<number, {
    attributeId: number;
    isRequired: boolean;
    isFilterable: boolean;
    isVariant: boolean;
    sortOrder: number;
  }>();

  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false as const, error: "Invalid category attribute" };
    }
    const source = item as Record<string, unknown>;
    const attributeId = Number(source.attributeId);
    const sortOrder = source.sortOrder === undefined ? 0 : Number(source.sortOrder);
    if (!Number.isInteger(attributeId) || attributeId < 1) {
      return { ok: false as const, error: "Invalid attribute id" };
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) {
      return { ok: false as const, error: "Sort order must be between 0 and 10000" };
    }
    for (const flag of ["isRequired", "isFilterable", "isVariant"] as const) {
      if (source[flag] !== undefined && typeof source[flag] !== "boolean") {
        return { ok: false as const, error: `${flag} must be a boolean` };
      }
    }
    unique.set(attributeId, {
      attributeId,
      isRequired: source.isRequired === true,
      isFilterable: source.isFilterable !== false,
      isVariant: source.isVariant === true,
      sortOrder,
    });
  }

  return { ok: true as const, value: [...unique.values()] };
}

export function buildTypedProductAttributeData(
  definition: AttributeDefinition,
  rawValue: string,
): TypedProductAttributeData {
  const value = rawValue.trim();
  const result: TypedProductAttributeData = {
    value,
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    attributeValueId: null,
  };

  if (definition.type === "TEXT" || definition.type === "MULTI_SELECT") {
    result.valueText = value;
  } else if (definition.type === "NUMBER") {
    const numberMatch = value.match(/^[-+]?(?:\d+\.?\d*|\.\d+)$/);
    const [integerPart = "", fractionPart = ""] = value.replace(/^[-+]/, "").split(".");
    const integerDigits = integerPart.replace(/^0+/, "").length || 1;
    const fractionDigits = fractionPart.length;
    if (numberMatch && integerDigits + fractionDigits <= 18 && fractionDigits <= 6) {
      result.valueNumber = value;
    }
  } else if (definition.type === "BOOLEAN") {
    result.valueBoolean = BOOLEAN_VALUES.get(value.toLowerCase()) ?? null;
  } else if (definition.type === "SELECT" || definition.type === "COLOR") {
    result.attributeValueId = definition.values.find(
      (candidate) => candidate.value.trim().toLowerCase() === value.toLowerCase(),
    )?.id ?? null;
  }

  return result;
}

export function buildProductAttributeStorageRows(
  inputs: LegacyProductAttributeInput[],
  definitions: AttributeDefinition[],
) {
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

  return inputs.map((input) => {
    const definition = definitionById.get(input.attributeId);
    if (!definition) {
      throw new Error(`Attribute ${input.attributeId} does not exist`);
    }
    return {
      attributeId: input.attributeId,
      ...buildTypedProductAttributeData(definition, input.value),
    };
  });
}
