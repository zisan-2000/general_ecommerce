import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.ALLOW_PHASE9_DEMO_FIXTURE !== "true"
  ) {
    throw new Error("Demo credential fixture is restricted to an explicitly authorized test database.");
  }
  const passwordHash = await bcrypt.hash("phase9-test-only", 10);
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash, banned: false, role: "admin" },
    create: { email: "admin@example.com", passwordHash, banned: false, role: "admin" },
  });
  console.log("Phase 9 demo credential fixture prepared.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

