import { PrismaClient } from "../generated/prisma";
import { parseStorePreset, seedStorePreset } from "../prisma/seed-data/presets";

const prisma = new PrismaClient();

async function main() {
  const preset = parseStorePreset(process.env.STORE_PRESET);
  if (process.env.ALLOW_STORE_PRESET_APPLY !== "true") {
    throw new Error(
      "Preset apply blocked. Set ALLOW_STORE_PRESET_APPLY=true after reviewing the target database and preset-owned category slugs.",
    );
  }
  const result = await prisma.$transaction((tx) => seedStorePreset(tx, preset));
  console.log("Store preset applied.", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

