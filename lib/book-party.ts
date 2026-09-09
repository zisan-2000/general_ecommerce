export type BookPartyInput = { name: string; image: string | null };

export function parseBookPartyInput(value: unknown):
  | { ok: true; value: BookPartyInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "A JSON object is required." };
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 120) {
    return { ok: false, error: "Name must contain between 1 and 120 characters." };
  }
  const rawImage = input.image;
  if (rawImage !== undefined && rawImage !== null && typeof rawImage !== "string") {
    return { ok: false, error: "Image must be a URL or path." };
  }
  const image = typeof rawImage === "string" ? rawImage.trim() : "";
  if (image.length > 2_048) {
    return { ok: false, error: "Image URL is too long." };
  }
  return { ok: true, value: { name, image: image || null } };
}
