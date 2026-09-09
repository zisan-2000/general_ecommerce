import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.sitesettings.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (!settings) {
    throw new Error("Phase 9 legacy settings fixture requires an existing settings row.");
  }

  await prisma.sitesettings.update({
    where: { id: settings.id },
    data: {
      storeName: null,
      siteTitle: null,
      currency: null,
      currencyPosition: null,
      timezone: null,
      locale: null,
      storeType: null,
    },
  });

  console.log("Phase 9 legacy settings fixture prepared.", { id: settings.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
