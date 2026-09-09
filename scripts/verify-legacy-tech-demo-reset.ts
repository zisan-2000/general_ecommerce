import { PrismaClient } from "../generated/prisma";
import {
  assertLegacyTechDemoReset,
  collectLegacyTechDemoState,
  printLegacyTechDemoAudit,
} from "./legacy-tech-demo-state";

const prisma = new PrismaClient();

async function main() {
  const state = await collectLegacyTechDemoState(prisma);
  printLegacyTechDemoAudit(state);
  assertLegacyTechDemoReset(state);
  console.log("Legacy TechHub demo reset verification passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
