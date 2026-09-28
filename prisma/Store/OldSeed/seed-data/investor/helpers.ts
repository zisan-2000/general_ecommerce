import bcrypt from "bcrypt";
import { Prisma } from "../../../generated/prisma";
import type { InvestorSeedPrisma } from "./types";

export function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function ensureGlobalRoleAssignmentIfRoleExists(
  prisma: InvestorSeedPrisma,
  userId: string,
  roleName: string,
) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    select: { id: true, name: true },
  });

  if (!role) {
    console.warn(
      `⚠️ Investor seed role not found in RBAC table, skipped UserRole assignment: ${roleName}`,
    );
    return null;
  }

  const existing = await prisma.userRole.findFirst({
    where: {
      userId,
      roleId: role.id,
      scopeType: "GLOBAL",
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        scopeType: "GLOBAL",
      },
    });
  }

  return role.id;
}

export async function upsertInvestorUserWithRole(
  prisma: InvestorSeedPrisma,
  input: {
    email: string;
    password: string;
    name: string;
    roleName: string;
    phone?: string | null;
    note?: string | null;
  },
) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.roleName,
      phone: input.phone ?? null,
      passwordHash,
      emailVerified: new Date(),
      banned: false,
      banReason: null,
      banExpires: null,
      note: input.note ?? null,
    },
    create: {
      email: input.email,
      name: input.name,
      role: input.roleName,
      phone: input.phone ?? null,
      passwordHash,
      emailVerified: new Date(),
      banned: false,
      banReason: null,
      banExpires: null,
      note: input.note ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  await ensureGlobalRoleAssignmentIfRoleExists(prisma, user.id, input.roleName);

  return user;
}
