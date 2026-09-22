import { PrismaClient } from "../generated/prisma";
import { seedGroceryBundles } from "./seed-data/grocery-bundles";

const prisma = new PrismaClient();

seedGroceryBundles(prisma)
  .then((summary) => {
    console.log("✅ Monthly grocery bundles ready", summary);
  })
  .catch((error) => {
    console.error("❌ Monthly grocery bundle seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
