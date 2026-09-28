import bcrypt from "bcrypt";
import { Prisma } from "../../../generated/prisma";
import type { ScmSeedPrisma } from "./types";

export function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export async function ensureGlobalRoleAssignment(
  prisma: ScmSeedPrisma,
  userId: string,
  roleName: string,
) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    select: { id: true },
  });

  if (!role) {
    throw new Error(`Missing role during SCM seed: ${roleName}`);
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

export async function upsertUserWithRole(
  prisma: ScmSeedPrisma,
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

  await ensureGlobalRoleAssignment(prisma, user.id, input.roleName);

  return user;
}

export async function ensureWarehouseMembership(
  prisma: ScmSeedPrisma,
  input: {
    userId: string;
    warehouseId: number;
    assignedById?: string | null;
    isPrimary?: boolean;
  },
) {
  const existing = await prisma.warehouseMembership.findFirst({
    where: {
      userId: input.userId,
      warehouseId: input.warehouseId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.warehouseMembership.update({
      where: { id: existing.id },
      data: {
        isPrimary: input.isPrimary ?? false,
        status: "ACTIVE",
        assignedById: input.assignedById ?? null,
      },
    });
    return existing.id;
  }

  const membership = await prisma.warehouseMembership.create({
    data: {
      userId: input.userId,
      warehouseId: input.warehouseId,
      isPrimary: input.isPrimary ?? false,
      status: "ACTIVE",
      assignedById: input.assignedById ?? null,
    },
    select: { id: true },
  });

  return membership.id;
}
