import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";
import {
  PHASE9_MANUAL_TEST_ACCOUNTS,
  PHASE9_MANUAL_TEST_PRODUCTS,
} from "./phase9-manual-fixtures";

const prisma = new PrismaClient();

function requireManualFixturePassword() {
  const password = process.env.PHASE9_MANUAL_PASSWORD?.trim() ?? "";
  if (password.length < 16) {
    throw new Error("PHASE9_MANUAL_PASSWORD must contain at least 16 characters.");
  }
  return password;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Phase 9 manual fixtures are blocked in production.");
  }
  if (process.env.ALLOW_PHASE9_MANUAL_FIXTURES !== "true") {
    throw new Error("Set ALLOW_PHASE9_MANUAL_FIXTURES=true to create local manual-test fixtures.");
  }

  const passwordHash = await bcrypt.hash(requireManualFixturePassword(), 12);

  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { slug: "general" } });
    if (!category || category.deleted || !category.isActive) {
      throw new Error("The active universal 'general' category is required.");
    }

    const warehouse = await tx.warehouse.findFirst({
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    if (!warehouse) throw new Error("At least one warehouse is required for physical test stock.");

    const brand = await tx.brand.upsert({
      where: { slug: "phase9-manual-test-brand" },
      update: { name: "Phase 9 Manual Test", deleted: false },
      create: { name: "Phase 9 Manual Test", slug: "phase9-manual-test-brand" },
    });

    const colorAttribute =
      (await tx.attribute.findFirst({ where: { name: "Phase 9 Test Color" }, orderBy: { id: "asc" } })) ??
      (await tx.attribute.create({ data: { name: "Phase 9 Test Color", type: "COLOR" } }));
    const warrantyAttribute =
      (await tx.attribute.findFirst({ where: { name: "Phase 9 Test Warranty" }, orderBy: { id: "asc" } })) ??
      (await tx.attribute.create({ data: { name: "Phase 9 Test Warranty", type: "NUMBER", unit: "month" } }));

    for (const [sortOrder, attributeId] of [colorAttribute.id, warrantyAttribute.id].entries()) {
      await tx.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: category.id, attributeId } },
        update: { isRequired: false, isFilterable: true, isVariant: false, sortOrder },
        create: { categoryId: category.id, attributeId, isRequired: false, isFilterable: true, isVariant: false, sortOrder },
      });
    }

    for (const productFixture of PHASE9_MANUAL_TEST_PRODUCTS) {
      const product = await tx.product.upsert({
        where: { slug: productFixture.slug },
        update: {
          name: productFixture.name,
          type: "PHYSICAL",
          categoryId: category.id,
          brandId: brand.id,
          description: `${productFixture.name} is an isolated local fixture for Phase 1-9 manual acceptance testing.`,
          shortDesc: "Local manual-test fixture",
          basePrice: productFixture.price,
          currency: "BDT",
          available: true,
          featured: true,
          deleted: false,
          image: productFixture.image,
          gallery: [productFixture.image],
          lowStockThreshold: 5,
        },
        create: {
          name: productFixture.name,
          slug: productFixture.slug,
          type: "PHYSICAL",
          sku: productFixture.sku,
          categoryId: category.id,
          brandId: brand.id,
          description: `${productFixture.name} is an isolated local fixture for Phase 1-9 manual acceptance testing.`,
          shortDesc: "Local manual-test fixture",
          basePrice: productFixture.price,
          currency: "BDT",
          available: true,
          featured: true,
          deleted: false,
          image: productFixture.image,
          gallery: [productFixture.image],
          lowStockThreshold: 5,
        },
        select: { id: true, slug: true },
      });

      let variant = await tx.productVariant.findFirst({
        where: { productId: product.id, sku: productFixture.sku },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (variant) {
        variant = await tx.productVariant.update({
          where: { id: variant.id },
          data: { price: productFixture.price, currency: "BDT", stock: productFixture.stock, options: {}, active: true, isDefault: true },
          select: { id: true },
        });
      } else {
        variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: productFixture.sku,
            price: productFixture.price,
            currency: "BDT",
            stock: productFixture.stock,
            options: {},
            active: true,
            isDefault: true,
            lowStockThreshold: 5,
          },
          select: { id: true },
        });
      }

      await tx.stockLevel.upsert({
        where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variant.id } },
        update: { quantity: productFixture.stock, reserved: 0 },
        create: { warehouseId: warehouse.id, productVariantId: variant.id, quantity: productFixture.stock, reserved: 0 },
      });

      const attributeFixtures = [
        { attributeId: colorAttribute.id, value: productFixture.color, valueText: productFixture.color, valueNumber: null },
        { attributeId: warrantyAttribute.id, value: String(productFixture.warrantyMonths), valueText: null, valueNumber: productFixture.warrantyMonths },
      ];
      for (const attributeFixture of attributeFixtures) {
        const existing = await tx.productAttribute.findFirst({
          where: { productId: product.id, attributeId: attributeFixture.attributeId },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        if (existing) {
          await tx.productAttribute.update({ where: { id: existing.id }, data: attributeFixture });
        } else {
          await tx.productAttribute.create({ data: { productId: product.id, ...attributeFixture } });
        }
      }
    }

    const users = [];
    for (const [kind, email] of Object.entries(PHASE9_MANUAL_TEST_ACCOUNTS)) {
      users.push(await tx.user.upsert({
        where: { email },
        update: { name: `Phase 9 Manual ${kind}`, role: kind === "admin" ? "admin" : "user", passwordHash, banned: false, banReason: null, emailVerified: new Date() },
        create: { email, name: `Phase 9 Manual ${kind}`, role: kind === "admin" ? "admin" : "user", passwordHash, banned: false, emailVerified: new Date() },
        select: { id: true, email: true },
      }));
    }

    const adminRole = await tx.role.findUnique({ where: { name: "superadmin" }, select: { id: true } });
    const adminUser = users.find(({ email }) => email === PHASE9_MANUAL_TEST_ACCOUNTS.admin);
    if (!adminRole || !adminUser) throw new Error("The seeded superadmin RBAC role is required.");
    const existingAdminAssignment = await tx.userRole.findFirst({
      where: { userId: adminUser.id, roleId: adminRole.id, scopeType: "GLOBAL", warehouseId: null },
      select: { id: true },
    });
    if (!existingAdminAssignment) {
      await tx.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id, scopeType: "GLOBAL" } });
    }

    return { products: PHASE9_MANUAL_TEST_PRODUCTS.length, accounts: users.length, warehouse: warehouse.name };
  });

  console.log("Phase 9 local manual-test fixtures are ready.", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
