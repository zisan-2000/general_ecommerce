import { prisma } from "../lib/prisma";
import { SITE_SETTINGS_DEFAULTS } from "../lib/site-settings";

async function main() {
  const settings = await prisma.sitesettings.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      siteTitle: true,
      storeName: true,
      storeTagline: true,
      defaultSeoTitle: true,
      defaultSeoDescription: true,
      defaultOgImage: true,
      favicon: true,
      logo: true,
      currency: true,
      currencyPosition: true,
      timezone: true,
      locale: true,
      storeType: true,
      footerDescription: true,
    },
  });

  let updated = 0;
  let unchanged = 0;
  for (const row of settings) {
    const storeName =
      row.storeName?.trim() ||
      row.siteTitle?.trim() ||
      SITE_SETTINGS_DEFAULTS.storeName;
    const data = {
      ...(!row.storeName?.trim() ? { storeName } : {}),
      ...(!row.siteTitle?.trim() ? { siteTitle: storeName } : {}),
      ...(!row.storeTagline?.trim()
        ? {
            storeTagline:
              row.footerDescription?.trim().slice(0, 200) ||
              SITE_SETTINGS_DEFAULTS.storeTagline,
          }
        : {}),
      ...(!row.defaultSeoTitle?.trim() ? { defaultSeoTitle: storeName } : {}),
      ...(!row.defaultSeoDescription?.trim()
        ? {
            defaultSeoDescription:
              row.footerDescription?.trim() ||
              SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
          }
        : {}),
      ...(!row.defaultOgImage && row.logo ? { defaultOgImage: row.logo } : {}),
      ...(!row.favicon && row.logo ? { favicon: row.logo } : {}),
      ...(!row.currency ? { currency: SITE_SETTINGS_DEFAULTS.currency } : {}),
      ...(!row.currencyPosition
        ? { currencyPosition: SITE_SETTINGS_DEFAULTS.currencyPosition }
        : {}),
      ...(!row.timezone ? { timezone: SITE_SETTINGS_DEFAULTS.timezone } : {}),
      ...(!row.locale ? { locale: SITE_SETTINGS_DEFAULTS.locale } : {}),
      ...(!row.storeType ? { storeType: SITE_SETTINGS_DEFAULTS.storeType } : {}),
    };

    if (Object.keys(data).length === 0) {
      unchanged += 1;
      continue;
    }
    await prisma.sitesettings.update({ where: { id: row.id }, data });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      { settingsRows: settings.length, updated, unchanged },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Store identity backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
