import bcrypt from "bcrypt";
import { WAREHOUSE_LIST, WAREHOUSE_SEED_PASSWORD, WAREHOUSE_USERS } from "./constants";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehouseDashboard(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  const passwordHash = await bcrypt.hash(WAREHOUSE_SEED_PASSWORD, 10);

  for (const user of WAREHOUSE_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        phone: user.phone,
        role: user.role,
        passwordHash,
        emailVerified: new Date(),
        banned: false,
        banReason: null,
        note: "Seeded warehouse demo user",
      },
      create: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        passwordHash,
        emailVerified: new Date(),
        note: "Seeded warehouse demo user",
      },
      select: { id: true },
    });

    ctx.users[user.key] = record.id;
  }

  for (const [index, warehouse] of WAREHOUSE_LIST.entries()) {
    const record = await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: {
        name: warehouse.name,
        country: "BD",
        division: warehouse.division,
        district: warehouse.district,
        area: warehouse.area,
        postCode: warehouse.postCode,
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
        coverageRadiusKm: warehouse.radius,
        isDefault: index === 0,
        isMapEnabled: true,
        mapLabel: warehouse.name,
        locationNote: `${warehouse.area}, ${warehouse.district}`,
        address: {
          line1: `${warehouse.name} Road`,
          area: warehouse.area,
          district: warehouse.district,
          postCode: warehouse.postCode,
        },
      },
      create: {
        code: warehouse.code,
        name: warehouse.name,
        country: "BD",
        division: warehouse.division,
        district: warehouse.district,
        area: warehouse.area,
        postCode: warehouse.postCode,
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
        coverageRadiusKm: warehouse.radius,
        isDefault: index === 0,
        isMapEnabled: true,
        mapLabel: warehouse.name,
        locationNote: `${warehouse.area}, ${warehouse.district}`,
        address: {
          line1: `${warehouse.name} Road`,
          area: warehouse.area,
          district: warehouse.district,
          postCode: warehouse.postCode,
        },
      },
      select: { id: true },
    });

    ctx.warehouses[warehouse.key] = record.id;

    const member = await prisma.warehouseMembership.findFirst({
      where: {
        userId: ctx.users.manager,
        warehouseId: record.id,
      },
      select: { id: true },
    });

    if (member) {
      await prisma.warehouseMembership.update({
        where: { id: member.id },
        data: {
          isPrimary: index === 0,
          status: "ACTIVE",
          assignedById: ctx.adminUserId ?? ctx.users.manager,
        },
      });
    } else {
      await prisma.warehouseMembership.create({
        data: {
          userId: ctx.users.manager,
          warehouseId: record.id,
          isPrimary: index === 0,
          status: "ACTIVE",
          assignedById: ctx.adminUserId ?? ctx.users.manager,
        },
      });
    }
  }

  return ctx;
}
