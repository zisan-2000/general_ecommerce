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
  name?: string;
  type: CatalogAttributeType;
  unit?: string | null;
  values: Array<{ id: number; value: string }>;
};

export type CategoryAttributePolicy = {
  attributeId: number;
  isRequired: boolean;
  isFilterable: boolean;
  isVariant: boolean;
  sortOrder: number;
  attribute: AttributeDefinition & { name: string };
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

export function parseMultiSelectValue(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(parsed.map((item) => String(item).trim()).filter(Boolean)),
        );
      }
    } catch {
      return [];
    }
  }
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

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

export function validateTypedProductAttributeData(
  definition: AttributeDefinition,
  rawValue: string,
): { ok: true; value: TypedProductAttributeData } | { ok: false; error: string } {
  const label = definition.name || `Attribute ${definition.id}`;
  const value = rawValue.trim();
  if (!value || value.length > 500) {
    return { ok: false, error: `${label} must be between 1 and 500 characters` };
  }

  if (definition.type === "MULTI_SELECT") {
    const selected = parseMultiSelectValue(value);
    if (!selected.length) {
      return { ok: false, error: `${label} needs at least one selected value` };
    }
    const managedByName = new Map(
      definition.values.map((item) => [item.value.toLowerCase(), item.value]),
    );
    const normalized = selected.map((item) => managedByName.get(item.toLowerCase()) ?? item);
    if (
      definition.values.length > 0 &&
      normalized.some((item) => !managedByName.has(item.toLowerCase()))
    ) {
      return { ok: false, error: `${label} contains an unsupported selection` };
    }
    const canonical = JSON.stringify(normalized);
    return {
      ok: true,
      value: {
        value: normalized.join(", "),
        valueText: canonical,
        valueNumber: null,
        valueBoolean: null,
        attributeValueId: null,
      },
    };
  }

  const typed = buildTypedProductAttributeData(definition, value);
  if (definition.type === "NUMBER" && typed.valueNumber === null) {
    return { ok: false, error: `${label} must be a valid number with up to 6 decimal places` };
  }
  if (definition.type === "BOOLEAN" && typed.valueBoolean === null) {
    return { ok: false, error: `${label} must be true or false` };
  }
  if (
    (definition.type === "SELECT" || definition.type === "COLOR") &&
    typed.attributeValueId === null
  ) {
    return { ok: false, error: `${label} must use a managed value` };
  }

  if (definition.type === "BOOLEAN") {
    typed.value = typed.valueBoolean ? "true" : "false";
  } else if (definition.type === "SELECT" || definition.type === "COLOR") {
    typed.value = definition.values.find((item) => item.id === typed.attributeValueId)?.value ?? value;
  }
  return { ok: true, value: typed };
}

export function validateCategoryProductAttributePolicy(input: {
  productAttributes: LegacyProductAttributeInput[];
  definitions: AttributeDefinition[];
  mappings: CategoryAttributePolicy[];
  variantOptions?: Array<{ name: string; values: string[] }>;
}) {
  const definitionsById = new Map(input.definitions.map((item) => [item.id, item]));
  const mappingById = new Map(input.mappings.map((item) => [item.attributeId, item]));
  const configured = input.mappings.length > 0;
  const rows = [] as Array<{ attributeId: number } & TypedProductAttributeData>;

  for (const item of input.productAttributes) {
    const definition = definitionsById.get(item.attributeId);
    if (!definition) {
      return { ok: false as const, error: "One or more product attributes do not exist" };
    }
    if (configured && !mappingById.has(item.attributeId)) {
      return {
        ok: false as const,
        error: `${definition.name || `Attribute ${definition.id}`} is not assigned to this category`,
      };
    }
    const validated = configured
      ? validateTypedProductAttributeData(definition, item.value)
      : { ok: true as const, value: buildTypedProductAttributeData(definition, item.value) };
    if (!validated.ok) return validated;
    rows.push({ attributeId: item.attributeId, ...validated.value });
  }

  const variantNames = new Set(
    (input.variantOptions ?? []).map((option) => option.name.trim().toLowerCase()),
  );
  if (configured) {
    for (const option of input.variantOptions ?? []) {
      const mapping = input.mappings.find(
        (item) => item.attribute.name.toLowerCase() === option.name.trim().toLowerCase(),
      );
      if (!mapping?.isVariant) {
        return { ok: false as const, error: `${option.name} is not a variant attribute for this category` };
      }
      for (const optionValue of option.values) {
        const validated = validateTypedProductAttributeData(mapping.attribute, optionValue);
        if (!validated.ok) return validated;
      }
    }

    const suppliedIds = new Set(rows.map((row) => row.attributeId));
    const missing = input.mappings.find(
      (mapping) =>
        mapping.isRequired &&
        !suppliedIds.has(mapping.attributeId) &&
        !(mapping.isVariant && variantNames.has(mapping.attribute.name.toLowerCase())),
    );
    if (missing) {
      return { ok: false as const, error: `${missing.attribute.name} is required for this category` };
    }
  }

  return { ok: true as const, value: rows };
}
