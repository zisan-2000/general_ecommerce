import { prisma } from "../lib/prisma";
import { CURRENCY_POSITIONS, STORE_TYPES } from "../lib/site-settings";

const expectedColumns = [
  "storeName",
  "storeTagline",
  "defaultSeoTitle",
  "defaultSeoDescription",
  "defaultSeoKeywords",
  "defaultOgImage",
  "favicon",
  "currency",
  "currencyPosition",
  "timezone",
  "locale",
  "storeType",
] as const;

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function validLocale(value: string) {
  try {
    return Boolean(new Intl.Locale(value).baseName);
  } catch {
    return false;
  }
}

async function main() {
  const [settings, columns] = await Promise.all([
    prisma.sitesettings.findMany({ orderBy: { id: "asc" } }),
    prisma.$queryRaw<Array<{ column_name: string; column_default: string | null }>>`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sitesettings'
    `,
  ]);
  const failures: string[] = [];
  const columnMap = new Map(columns.map((column) => [column.column_name, column]));

  for (const column of expectedColumns) {
    if (!columnMap.has(column)) failures.push(`Missing sitesettings.${column} column`);
  }
  const keywordsDefault = columnMap.get("defaultSeoKeywords")?.column_default ?? "";
  if (!keywordsDefault.includes("ARRAY[]")) {
    failures.push("sitesettings.defaultSeoKeywords must default to an empty array");
  }
  if (settings.length > 1) {
    failures.push("Multiple site settings rows exist; runtime identity would be ambiguous");
  }

  for (const row of settings) {
    const label = `sitesettings:${row.id}`;
    if (!row.storeName?.trim()) failures.push(`${label} has no storeName`);
    if (!row.siteTitle?.trim()) failures.push(`${label} has no compatibility siteTitle`);
    if (
      row.storeName?.trim() &&
      row.siteTitle?.trim() &&
      row.storeName.trim() !== row.siteTitle.trim()
    ) {
      failures.push(`${label} storeName and siteTitle are not dual-write compatible`);
    }
    if (!row.currency || !/^[A-Z]{3}$/.test(row.currency)) {
      failures.push(`${label} has an invalid currency`);
    }
    if (!CURRENCY_POSITIONS.includes(row.currencyPosition as never)) {
      failures.push(`${label} has an invalid currencyPosition`);
    }
    if (!row.timezone || !validTimezone(row.timezone)) {
      failures.push(`${label} has an invalid timezone`);
    }
    if (!row.locale || !validLocale(row.locale)) {
      failures.push(`${label} has an invalid locale`);
    }
    if (!STORE_TYPES.includes(row.storeType as never)) {
      failures.push(`${label} has an invalid storeType`);
    }
  }

  const result = {
    settingsRows: settings.length,
    identityColumns: expectedColumns.length,
    configuredStoreName: settings[0]?.storeName ?? null,
    configuredStoreType: settings[0]?.storeType ?? null,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Store identity verification failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
