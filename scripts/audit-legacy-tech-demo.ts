import nextEnv from "@next/env";
import { PrismaClient } from "../generated/prisma";
import {
  collectLegacyTechDemoState,
  printLegacyTechDemoAudit,
} from "./legacy-tech-demo-state";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const state = await collectLegacyTechDemoState(prisma);
  printLegacyTechDemoAudit(state);

  if (!state.looksLikeLegacyTechDemo) {
    console.log(
      "No high-confidence legacy TechHub demo fingerprint was detected. No changes were made.",
    );
    return;
  }

  console.log("Dry-run only. No database rows were changed.");
  console.log(
    "If this is the demo storefront you intend to convert, take a database backup and run the guarded reset command.",
  );
}

main()
  .catch((error) => {
    console.error("Legacy TechHub demo audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
