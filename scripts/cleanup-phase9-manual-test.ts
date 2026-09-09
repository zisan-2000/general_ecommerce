import { PrismaClient } from "../generated/prisma";
import {
  PHASE9_MANUAL_TEST_ACCOUNTS,
  PHASE9_MANUAL_TEST_PRODUCTS,
} from "./phase9-manual-fixtures";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Phase 9 manual fixture cleanup is blocked in production.");
  }
  if (process.env.ALLOW_PHASE9_MANUAL_FIXTURE_CLEANUP !== "true") {
    throw new Error("Set ALLOW_PHASE9_MANUAL_FIXTURE_CLEANUP=true to archive local manual-test fixtures.");
  }

  const [products, accounts] = await prisma.$transaction([
    prisma.product.updateMany({
      where: { slug: { in: PHASE9_MANUAL_TEST_PRODUCTS.map(({ slug }) => slug) } },
      data: { available: false, deleted: true, featured: false },
    }),
    prisma.user.updateMany({
      where: { email: { in: Object.values(PHASE9_MANUAL_TEST_ACCOUNTS) } },
      data: {
        passwordHash: null,
        banned: true,
        banReason: "Phase 9 local manual-test fixture archived",
        banExpires: null,
      },
    }),
  ]);

  console.log("Phase 9 local manual-test fixtures archived.", {
    products: products.count,
    accounts: accounts.count,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
