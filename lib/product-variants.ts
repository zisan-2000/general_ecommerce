export type VariantOptionInput = {
  name: string;
  values: string[];
};

export type VariantMediaMeta = {
  image?: string;
  gallery?: string[];
};

export function normalizeVariantOptions(input: unknown): VariantOptionInput[] {
  if (!Array.isArray(input)) return [];

  const optionsByName = new Map<string, VariantOptionInput>();

  input.forEach((option: any) => {
    const name = String(option?.name || "").trim();
    const values: string[] = Array.isArray(option?.values)
      ? option.values
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];
    if (!name || values.length === 0) return;

    const key = name.toLocaleLowerCase();
    const existing = optionsByName.get(key);
    if (!existing) {
      optionsByName.set(key, { name, values: Array.from(new Set(values)) });
      return;
    }

    const existingValueKeys = new Set(
      existing.values.map((value) => value.toLocaleLowerCase()),
    );
    values.forEach((value) => {
      const valueKey = value.toLocaleLowerCase();
      if (!existingValueKeys.has(valueKey)) {
        existing.values.push(value);
        existingValueKeys.add(valueKey);
      }
    });
  });

  return Array.from(optionsByName.values());
}

export function normalizeVariantMediaMeta(input: unknown) {
  if (!input || typeof input !== "object") return undefined;

  const source = input as Record<string, unknown>;
  const image =
    typeof source.image === "string" && source.image.trim()
      ? source.image.trim()
      : undefined;
  const gallery = Array.isArray(source.gallery)
    ? Array.from(
        new Set(
          source.gallery
            .map((value) =>
              typeof value === "string" && value.trim() ? value.trim() : "",
            )
            .filter(Boolean),
        ),
      )
    : [];

  if (!image && gallery.length === 0) return undefined;

  return {
    ...(image ? { image } : {}),
    ...(gallery.length > 0 ? { gallery } : {}),
  } satisfies VariantMediaMeta;
}

export function getVariantMediaMeta(options: unknown) {
  if (!options || typeof options !== "object") return undefined;

  return normalizeVariantMediaMeta(
    (options as Record<string, unknown>).__meta,
  );
}

export function sortOptionObject(
  options: Record<string, unknown>,
  orderedNames: string[],
) {
  const sortedEntries = orderedNames
    .map((name) => [name, options[name]])
    .filter(([, value]) => value !== undefined);

  const mediaMeta = normalizeVariantMediaMeta(options.__meta);
  if (mediaMeta) {
    sortedEntries.push(["__meta", mediaMeta]);
  }

  return Object.fromEntries(sortedEntries);
}
