import { loadEnvConfig } from "@next/env";
import { hash } from "bcryptjs";
import { PrismaClient } from "../generated/prisma";
import { disconnectStartech, seedGroceries, seedStartech } from "./startech-seed";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

async function main() {
  // Upserts make reruns safe; only these seed accounts have their passwords reset.
  const adminPassword = await hash(process.env.SEED_ADMIN_PASSWORD || "admin123", 12);
  const userPassword = await hash(process.env.SEED_USER_PASSWORD || "user123", 12);
  await prisma.$transaction(async (tx) => {
    const adminData = {
      name: "Administrator", role: "admin", passwordHash: adminPassword,
      emailVerified: new Date(), banned: false, banReason: null, banExpires: null,
    };
    const admin = await tx.user.upsert({
      where: { email: "admin@example.com" },
      create: { email: "admin@example.com", ...adminData }, update: adminData,
    });
    const role = await tx.role.upsert({
      where: { name: "superadmin" },
      create: { name: "superadmin", label: "Super Admin", isSystem: true, isImmutable: true },
      update: { deletedAt: null, isSystem: true, isImmutable: true },
    });
    // Nullable warehouseId cannot be used reliably as an upsert unique key.
    const assignment = await tx.userRole.findFirst({
      where: { userId: admin.id, roleId: role.id, scopeType: "GLOBAL", warehouseId: null },
    });
    if (!assignment) await tx.userRole.create({
      data: { userId: admin.id, roleId: role.id, scopeType: "GLOBAL" },
    });
    await tx.user.upsert({
      where: { email: "user@example.com" },
      create: { email: "user@example.com", name: "Demo User", role: "user", passwordHash: userPassword, emailVerified: new Date() },
      update: { passwordHash: userPassword, emailVerified: new Date(), banned: false, banReason: null, banExpires: null },
    });
  });
  console.log("Admin and user accounts seeded.");
  await seedStartech();
  await seedGroceries();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.all([prisma.$disconnect(), disconnectStartech()]);
});
