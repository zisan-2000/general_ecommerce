import { PrismaClient } from "../generated/prisma";
import {
  PHASE9_MANUAL_TEST_ACCOUNTS,
  PHASE9_MANUAL_TEST_PRODUCTS,
} from "./phase9-manual-fixtures";

const prisma = new PrismaClient();

async function main() {
  const failures: string[] = [];

  for (const fixture of PHASE9_MANUAL_TEST_PRODUCTS) {
    const product = await prisma.product.findUnique({
      where: { slug: fixture.slug },
      select: {
        available: true,
        deleted: true,
        category: { select: { slug: true, isActive: true, deleted: true } },
        variants: {
          where: { sku: fixture.sku },
          select: { active: true, stock: true, stockLevels: { select: { quantity: true, reserved: true } } },
        },
        attributes: { select: { attribute: { select: { name: true } } } },
      },
    });
    const variant = product?.variants[0];
    const warehouseQuantity = variant?.stockLevels.reduce((total, stock) => total + stock.quantity - stock.reserved, 0);
    if (!product || !product.available || product.deleted || product.category.slug !== "general" || !product.category.isActive || product.category.deleted) {
      failures.push(`${fixture.slug} is not storefront-ready`);
    }
    if (!variant?.active || variant.stock !== fixture.stock || warehouseQuantity !== fixture.stock) {
      failures.push(`${fixture.sku} stock is not ready`);
    }
    if ((product?.attributes.length ?? 0) < 2) failures.push(`${fixture.slug} typed attributes are missing`);
  }

  const [admin, customer] = await Promise.all([
    prisma.user.findUnique({
      where: { email: PHASE9_MANUAL_TEST_ACCOUNTS.admin },
      select: { passwordHash: true, banned: true, userRoles: { where: { role: { name: "superadmin" }, scopeType: "GLOBAL" }, select: { id: true } } },
    }),
    prisma.user.findUnique({ where: { email: PHASE9_MANUAL_TEST_ACCOUNTS.customer }, select: { passwordHash: true, banned: true } }),
  ]);
  if (!admin?.passwordHash || admin.banned || admin.userRoles.length !== 1) failures.push("manual admin account is not ready");
  if (!customer?.passwordHash || customer.banned) failures.push("manual customer account is not ready");

  if (failures.length) throw new Error(`Phase 9 manual fixture verification failed: ${failures.join("; ")}.`);
  console.log("Phase 9 manual-test fixture verification passed.", {
    products: PHASE9_MANUAL_TEST_PRODUCTS.length,
    accounts: Object.keys(PHASE9_MANUAL_TEST_ACCOUNTS).length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
