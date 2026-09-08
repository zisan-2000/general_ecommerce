export type BookMetadataInput = {
  writerId: number | null;
  publisherId: number | null;
};

function parseNullableId(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: null };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false as const, error: `${label} must be a positive integer or null.` };
  }

  return { ok: true as const, value: parsed };
}

export function parseBookMetadataInput(value: unknown):
  | { ok: true; value: BookMetadataInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Book metadata payload must be an object." };
  }

  const input = value as Record<string, unknown>;
  const writerId = parseNullableId(input.writerId, "writerId");
  if (!writerId.ok) return writerId;
  const publisherId = parseNullableId(input.publisherId, "publisherId");
  if (!publisherId.ok) return publisherId;

  return {
    ok: true,
    value: {
      writerId: writerId.value,
      publisherId: publisherId.value,
    },
  };
}

export function hasBookMetadata(input: BookMetadataInput) {
  return input.writerId !== null || input.publisherId !== null;
}
