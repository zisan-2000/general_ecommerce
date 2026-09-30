import {
  PC_BUILDER_SLOTS,
  getPcBuilderCategorySlugs,
  type PcBuilderSlotKey,
} from "./pc-builder-core";
import { readPcBuilderAttribute } from "./pc-builder-taxonomy";

type DerivationInput = {
  categorySlug: string | null | undefined;
  name: string;
  shortDesc?: string | null;
  description?: string | null;
  attributes?: Record<string, string> | null;
};

function plainText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function slotForCategory(categorySlug: string | null | undefined) {
  const slug = String(categorySlug ?? "").trim().toLowerCase();
  return (
    PC_BUILDER_SLOTS.find((slot) =>
      getPcBuilderCategorySlugs(slot.key).includes(slug),
    )?.key ?? null
  );
}

function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function socketsIn(text: string) {
  const sockets = new Set<string>();
  for (const match of text.matchAll(/\b((?:FC)?LGA\s*-?\s*\d{3,4}|AM\s*-?\s*[2-5])\b/gi)) {
    sockets.add(match[1].replace(/\s|-/g, "").replace(/^FC/i, ""));
  }
  return [...sockets];
}

function memoryType(text: string) {
  return firstMatch(text, /\b(DDR[2-6])(?:\s+SDRAM)?\b/i).toUpperCase();
}

function formFactor(text: string) {
  const value = firstMatch(
    text,
    /\b(Micro[ -]?ATX|mATX|Mini[ -]?ITX|E[ -]?ATX|Extended[ -]?ATX|ATX)\b/i,
  );
  if (/^(?:micro[ -]?atx|matx)$/i.test(value)) return "Micro-ATX";
  if (/^mini[ -]?itx$/i.test(value)) return "Mini-ITX";
  if (/^(?:e[ -]?atx|extended[ -]?atx)$/i.test(value)) return "E-ATX";
  return value.toUpperCase();
}

function wattage(text: string, labels: RegExp) {
  return firstMatch(
    text,
    new RegExp(`(?:${labels.source})(?:\\s+(?:rating|support|capacity))?(?:\\s+of)?[^0-9]{0,24}(\\d{2,4}\\s*W)\\b`, "i"),
  ).replace(/\s+/g, "");
}

function setIfMissing(
  output: Record<string, string>,
  names: string[],
  canonicalName: string,
  value: string,
) {
  if (value && !readPcBuilderAttribute(output, names)) output[canonicalName] = value;
}

function deriveForSlot(
  slot: PcBuilderSlotKey,
  text: string,
  output: Record<string, string>,
) {
  const sockets = socketsIn(text);

  if (slot === "processor") {
    setIfMissing(output, ["Socket", "CPU Socket"], "Socket", sockets[0] ?? "");
    setIfMissing(output, ["TDP", "Power Draw"], "TDP", wattage(text, /TDP|thermal design power/));

    const noGraphics = /\b(?:no|without)\s+(?:an?\s+)?(?:integrated\s+)?(?:GPU|graphics)\b/i.test(text);
    const hasGraphics = /\b(?:integrated\s+(?:GPU|graphics)|Intel\s+(?:UHD|HD)\s+Graphics|Radeon\s+Graphics)\b/i.test(text);
    setIfMissing(output, ["Integrated Graphics", "iGPU"], "Integrated Graphics", noGraphics ? "No" : hasGraphics ? "Yes" : "");

    const noCooler = /\b(?:tray(?:\s+box)?|OEM)\b|\b(?:no|without)\s+(?:a\s+)?cooler\b/i.test(text);
    const hasCooler = /\b(?:cooler included|includes?\s+(?:a\s+)?(?:stock\s+)?cooler|with\s+(?:a\s+)?(?:stock\s+)?cooler)\b/i.test(text);
    setIfMissing(output, ["Cooler Included", "Stock Cooler"], "Cooler Included", noCooler ? "No" : hasCooler ? "Yes" : "");
  }

  if (slot === "motherboard") {
    setIfMissing(output, ["Socket", "CPU Socket"], "Socket", sockets[0] ?? "");
    setIfMissing(output, ["Memory Type", "RAM Type"], "Memory Type", memoryType(text));
    setIfMissing(output, ["Form Factor"], "Form Factor", formFactor(text));
  }

  if (slot === "memory") {
    setIfMissing(output, ["Memory Type", "RAM Type"], "Memory Type", memoryType(text));
    setIfMissing(output, ["Capacity"], "Capacity", firstMatch(text, /\b(\d{1,4}\s*GB)\b/i).replace(/\s+/g, ""));
    setIfMissing(output, ["Speed", "Frequency"], "Speed", firstMatch(text, /\b(\d{3,5}\s*(?:MHz|MT\/s))\b/i).replace(/\s+/g, ""));
  }

  if (slot === "cooler") {
    const family = sockets.length ? sockets.join(" / ") : /\bAMD\b/i.test(text) ? "AMD" : /\bIntel\b/i.test(text) ? "Intel" : "";
    setIfMissing(output, ["Socket Support", "Supported Sockets"], "Socket Support", family);
    setIfMissing(output, ["TDP Support", "Cooling Capacity"], "TDP Support", wattage(text, /TDP/));
  }

  if (slot === "powerSupply") {
    setIfMissing(output, ["Wattage", "Power", "Capacity"], "Wattage", firstMatch(text, /\b(\d{3,4}\s*W)\b/i).replace(/\s+/g, ""));
  }
}

/** Derives only unambiguous facts and never overwrites structured merchant data. */
export function derivePcBuilderCompatibilityAttributes(input: DerivationInput) {
  const output = { ...(input.attributes ?? {}) };
  const slot = slotForCategory(input.categorySlug);
  if (!slot) return output;

  const text = plainText([input.name, input.shortDesc, input.description].filter(Boolean).join(" "));
  deriveForSlot(slot, text, output);
  return output;
}
