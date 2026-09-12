import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma";
import { SYSTEM_PERMISSIONS, SYSTEM_ROLE_DEFINITIONS } from "../lib/rbac-config";
import { seedUniversalStorefront } from "./seed-data/universal";
import { seedStorefrontDemo } from "./seed-data/storefront";
import { seedScmDemo } from "./seed-data/scm";
import { seedWarehouseDemo } from "./seed-data/warehouse";
import { seedManagementDemo } from "./seed-data/management";
import { seedInvestorDemo } from "./seed-data/investor";

const prisma = new PrismaClient();

// The demo seed modules (SCM, warehouse, management, investor) attach users to
// system roles such as `scm_admin`, so the RBAC roles and permissions have to
// exist before any of them run.
async function seedRolesAndPermissions() {
  for (const permission of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
  }

  for (const roleDef of SYSTEM_ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        label: roleDef.label,
        description: roleDef.description,
        isSystem: true,
        isImmutable: roleDef.immutable,
      },
      create: {
        name: roleDef.name,
        label: roleDef.label,
        description: roleDef.description,
        isSystem: true,
        isImmutable: roleDef.immutable,
      },
    });

    const assignedPermissionKeys = [...roleDef.permissions];

    const permissions = await prisma.permission.findMany({
      where: {
        key: { in: assignedPermissionKeys },
      },
      select: { id: true },
    });

    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}

// The SCM seed expects these supplier categories to already exist.
const DEFAULT_SUPPLIER_CATEGORIES = [
  {
    code: "APPAREL",
    name: "Apparel",
    description:
      "Garments, uniforms, fabric items, and stitched textile supply.",
  },
  {
    code: "PACKAGING",
    name: "Packaging",
    description:
      "Cartons, polybags, labels, wraps, and related packaging materials.",
  },
  {
    code: "ELECTRICAL",
    name: "Electrical",
    description:
      "Electrical goods, wiring items, fittings, and related maintenance supply.",
  },
  {
    code: "IT_EQUIPMENT",
    name: "IT Equipment",
    description:
      "Computers, networking devices, peripherals, and technology equipment.",
  },
  {
    code: "OFFICE_SUPPLIES",
    name: "Office Supplies",
    description:
      "Stationery, print consumables, filing, and day-to-day office materials.",
  },
  {
    code: "FURNITURE",
    name: "Furniture",
    description:
      "Office furniture, fixtures, storage, and workspace setup items.",
  },
  {
    code: "PRINTING",
    name: "Printing",
    description:
      "Printed materials, branding collateral, forms, and publication services.",
  },
  {
    code: "LOGISTICS_SERVICES",
    name: "Logistics Services",
    description:
      "Transport, courier, forwarding, and other delivery-related services.",
  },
  {
    code: "FACILITY_MAINTENANCE",
    name: "Facility Maintenance",
    description:
      "Repair, cleaning, maintenance, and facility support services.",
  },
  {
    code: "GENERAL_SERVICES",
    name: "General Services",
    description:
      "Professional or operational services not covered by a specific supply category.",
  },
] as const;

async function ensureDefaultSupplierCategories(createdById: string | null) {
  for (const category of DEFAULT_SUPPLIER_CATEGORIES) {
    await prisma.supplierCategory.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        isActive: true,
        createdById,
      },
    });
  }
}

async function ensureSeedAdmin() {
  const adminEmail = "admin@example.com";
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Admin User",
      role: "admin",
      passwordHash,
      emailVerified: new Date(),
    },
    create: {
      email: adminEmail,
      name: "Admin User",
      role: "admin",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const superAdminRole = await prisma.role.findUnique({
    where: { name: "superadmin" },
    select: { id: true },
  });

  if (superAdminRole) {
    const existingAssignment = await prisma.userRole.findFirst({
      where: {
        userId: admin.id,
        roleId: superAdminRole.id,
        scopeType: "GLOBAL",
      },
      select: { id: true },
    });

    if (!existingAssignment) {
      await prisma.userRole.create({
        data: {
          userId: admin.id,
          roleId: superAdminRole.id,
          scopeType: "GLOBAL",
        },
      });
    }
  }

  return admin.id;
}

async function main() {
  await seedRolesAndPermissions();
  console.log("System roles and permissions ensured");

  const adminUserId = await ensureSeedAdmin();
  console.log("Seed admin user ensured");

  await ensureDefaultSupplierCategories(adminUserId);
  console.log("Default supplier categories ensured");

  const summary = await seedUniversalStorefront(prisma);
  console.log("Universal ecommerce baseline seed complete.", summary);

  await seedScmDemo(prisma, adminUserId);
  console.log("SCM demo seed ensured");

  await seedWarehouseDemo(prisma, adminUserId);
  console.log("Warehouse demo seed ensured");

  await seedManagementDemo(prisma, adminUserId);
  console.log("Management demo seed ensured");

  await seedInvestorDemo(prisma, adminUserId);
  console.log("Investor demo seed ensured");

  // Run this last so operational seed modules keep their internal records
  // while the public catalog exposes only the curated storefront.
  const storefront = await seedStorefrontDemo(prisma, adminUserId);
  console.log("Storefront demo seed ensured.", storefront);
}

main()
  .catch((error) => {
    console.error("Universal seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
