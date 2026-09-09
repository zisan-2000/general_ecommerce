import { PrismaClient } from "../generated/prisma";
import { seedUniversalStorefront } from "./seed-data/universal";

const prisma = new PrismaClient();

async function main() {
  const summary = await seedUniversalStorefront(prisma);
  console.log("Universal ecommerce baseline seed complete.", summary);
}

main()
  .catch((error) => {
    console.error("Universal seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
