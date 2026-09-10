export type SpecificationTemplateKey = "blank" | "laptop" | "desktop";

export interface SpecificationItemInput {
  label: string;
  value: string;
}

export interface SpecificationGroupInput {
  name: string;
  items: SpecificationItemInput[];
}

export type SpecificationApplyMode = "fill-empty" | "merge" | "replace";

export interface SpecificationParseWarning {
  line: number;
  text: string;
  reason: string;
}

export interface SpecificationParseResult {
  groups: SpecificationGroupInput[];
  warnings: SpecificationParseWarning[];
  itemCount: number;
}

const makePreset = (
  groups: ReadonlyArray<readonly [string, readonly string[]]>,
): SpecificationGroupInput[] =>
  groups.map(([name, labels]) => ({
    name,
    items: labels.map((label) => ({ label, value: "" })),
  }));

const LAPTOP_GROUPS = [
  ["General", ["Brand", "Model", "Series", "Color"]],
  [
    "Processor",
    [
      "Processor Brand",
      "Processor Model",
      "Processor Generation",
      "Processor Base Frequency",
      "Processor Max Frequency",
      "Processor Core",
      "Processor Thread",
      "CPU Cache",
    ],
  ],
  ["Memory", ["RAM", "RAM Type", "RAM Bus Speed", "Max RAM Support", "RAM Slot"]],
  ["Storage", ["Storage Type", "Storage Capacity", "SSD Interface", "Extra Storage Slot"]],
  [
    "Display",
    ["Display Size", "Display Type", "Resolution", "Refresh Rate", "Brightness", "Touch Screen"],
  ],
  ["Graphics", ["Graphics Type", "Graphics Model", "Graphics Memory"]],
  ["Keyboard & Input", ["Keyboard Type", "Backlit Keyboard", "Touchpad", "Fingerprint Sensor"]],
  [
    "Connectivity",
    ["Wi-Fi", "Bluetooth", "LAN", "HDMI", "USB Type-A", "USB Type-C", "Audio Jack", "Card Reader"],
  ],
  ["Camera & Audio", ["Webcam", "Microphone", "Speaker"]],
  ["Battery & Power", ["Battery Type", "Battery Capacity", "Adapter"]],
  ["Software", ["Operating System"]],
  ["Physical", ["Dimensions", "Weight"]],
  ["Warranty", ["Warranty Type", "Warranty Period"]],
] as const;

const DESKTOP_GROUPS = [
  ["General", ["Brand", "Model", "PC Type"]],
  ["Processor", ["Processor Brand", "Processor Model", "Generation", "Core", "Thread", "Cache"]],
  ["Motherboard", ["Motherboard Brand", "Motherboard Model", "Chipset"]],
  ["Memory", ["RAM", "RAM Type", "RAM Bus", "RAM Slot", "Maximum RAM"]],
  ["Storage", ["SSD", "HDD", "SSD Interface", "Extra Storage Support"]],
  ["Graphics", ["Graphics Type", "Graphics Card", "VRAM"]],
  ["Power Supply", ["PSU Brand", "PSU Wattage", "PSU Certification"]],
  ["Casing", ["Case Type", "Case Model", "Cooling Fan"]],
  ["Connectivity", ["LAN", "Wi-Fi", "Bluetooth", "USB", "HDMI", "DisplayPort", "Audio"]],
  ["Operating System", ["Operating System"]],
  ["Warranty", ["Warranty"]],
] as const;

export const SPECIFICATION_TEMPLATE_LABELS: Record<SpecificationTemplateKey, string> = {
  blank: "Blank / Custom",
  laptop: "Laptop",
  desktop: "Desktop PC",
};

export function getSpecificationPreset(template: SpecificationTemplateKey) {
  if (template === "laptop") return makePreset(LAPTOP_GROUPS);
  if (template === "desktop") return makePreset(DESKTOP_GROUPS);
  return [];
}

export function createSpecificationCopyFormat(template: Exclude<SpecificationTemplateKey, "blank">) {
  return getSpecificationPreset(template)
    .flatMap((group) => [
      "###GROUP###",
      group.name,
      "",
      ...group.items.map((item) => `${item.label}: `),
      "",
    ])
    .join("\n")
    .trimEnd();
}

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FIELD_ALIASES: Record<string, string> = {
  cpu: "processor",
  "cpu model": "processor model",
  generation: "processor generation",
  core: "processor core",
  thread: "processor thread",
  cache: "cpu cache",
  "ram bus": "ram bus speed",
  ssd: "storage capacity",
  "screen size": "display size",
  os: "operating system",
  gpu: "graphics model",
  vram: "graphics memory",
};

const fieldKey = (label: string) => FIELD_ALIASES[normalize(label)] ?? normalize(label);

const labelsMatch = (left: string, right: string) => {
  const leftKey = fieldKey(left);
  const rightKey = fieldKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
};

export function parseSpecificationText(text: string): SpecificationParseResult {
  const warnings: SpecificationParseWarning[] = [];
  const groups: SpecificationGroupInput[] = [];
  let currentGroup: SpecificationGroupInput | null = null;
  let expectsExplicitGroupName = false;

  const addGroup = (name: string, line: number) => {
    const cleanName = name.trim();
    if (!cleanName) {
      warnings.push({ line, text: name, reason: "Group name is empty" });
      return;
    }
    currentGroup = { name: cleanName, items: [] };
    groups.push(currentGroup);
  };

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || /^[-=_]{3,}$/.test(line)) return;

    if (/^###\s*group\s*###$/i.test(line)) {
      expectsExplicitGroupName = true;
      currentGroup = null;
      return;
    }

    if (expectsExplicitGroupName) {
      if (line.includes(":")) {
        warnings.push({ line: lineNumber, text: rawLine, reason: "Expected a group name" });
        expectsExplicitGroupName = false;
      } else {
        addGroup(line, lineNumber);
        expectsExplicitGroupName = false;
        return;
      }
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      addGroup(line, lineNumber);
      return;
    }

    const label = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!label) {
      warnings.push({ line: lineNumber, text: rawLine, reason: "Specification label is empty" });
      return;
    }
    if (!currentGroup) {
      warnings.push({ line: lineNumber, text: rawLine, reason: "Specification has no group" });
      return;
    }
    currentGroup.items.push({ label, value });
  });

  if (expectsExplicitGroupName) {
    warnings.push({ line: text.split(/\r?\n/).length, text: "###GROUP###", reason: "Missing group name" });
  }

  const populatedGroups = groups.filter((group) => {
    if (group.items.length > 0) return true;
    warnings.push({ line: 0, text: group.name, reason: "Group contains no specifications" });
    return false;
  });

  return {
    groups: populatedGroups,
    warnings,
    itemCount: populatedGroups.reduce((total, group) => total + group.items.length, 0),
  };
}

function findGroup(groups: SpecificationGroupInput[], name: string) {
  const key = normalize(name);
  return groups.find((group) => normalize(group.name) === key);
}

export function mergeSpecificationGroups(
  current: SpecificationGroupInput[],
  incoming: SpecificationGroupInput[],
  mode: SpecificationApplyMode,
): SpecificationGroupInput[] {
  if (mode === "replace") {
    return incoming.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item })) }));
  }

  const result = current.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }));

  incoming.forEach((incomingGroup) => {
    let targetGroup = findGroup(result, incomingGroup.name);
    if (!targetGroup) {
      targetGroup = { name: incomingGroup.name, items: [] };
      result.push(targetGroup);
    }

    incomingGroup.items.forEach((incomingItem) => {
      const targetItem = targetGroup?.items.find((item) => labelsMatch(item.label, incomingItem.label));
      if (!targetItem) {
        targetGroup?.items.push({ ...incomingItem });
        return;
      }
      if (mode === "merge" || !targetItem.value.trim()) {
        targetItem.value = incomingItem.value;
      }
    });
  });

  return result;
}

export function parseSpecificationGroupsInput(input: unknown):
  | { ok: true; value: SpecificationGroupInput[] }
  | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Specification groups must be an array" };
  if (input.length > 30) return { ok: false, error: "A product can have at most 30 specification groups" };

  const groups: SpecificationGroupInput[] = [];
  let itemCount = 0;
  for (const rawGroup of input) {
    if (!rawGroup || typeof rawGroup !== "object") {
      return { ok: false, error: "Each specification group must be an object" };
    }
    const record = rawGroup as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name || name.length > 100) {
      return { ok: false, error: "Each specification group needs a name of 100 characters or fewer" };
    }
    if (!Array.isArray(record.items)) {
      return { ok: false, error: `Specifications for ${name} must be an array` };
    }
    const items: SpecificationItemInput[] = [];
    for (const rawItem of record.items) {
      if (!rawItem || typeof rawItem !== "object") {
        return { ok: false, error: `Each specification in ${name} must be an object` };
      }
      const item = rawItem as Record<string, unknown>;
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const value = typeof item.value === "string" ? item.value.trim() : "";
      if (!label || label.length > 120) {
        return { ok: false, error: `Each specification in ${name} needs a label of 120 characters or fewer` };
      }
      if (value.length > 2000) {
        return { ok: false, error: `${label} must be 2000 characters or fewer` };
      }
      items.push({ label, value });
      itemCount += 1;
      if (itemCount > 300) {
        return { ok: false, error: "A product can have at most 300 specifications" };
      }
    }
    groups.push({ name, items });
  }
  return { ok: true, value: groups };
}
