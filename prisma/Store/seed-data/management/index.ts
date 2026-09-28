import type { PrismaClient } from "../../../generated/prisma";
import { seedManagementBlogs } from "./scenario-blogs";
import { seedManagementBrands } from "./scenario-brands";
import { seedManagementCategories } from "./scenario-categories";
import { seedManagementCoupons } from "./scenario-coupons";
import { seedManagementCouriers } from "./scenario-couriers";
import { seedManagementNewsletter } from "./scenario-newsletter";
import { seedManagementVat } from "./scenario-vat";
import type { ManagementSeedContext } from "./types";

export async function seedManagementDemo(
  prisma: PrismaClient,
  adminUserId?: string | null,
) {
  let ctx: ManagementSeedContext = {
    adminUserId,
    categories: {},
    brands: {},
    couriers: {},
    vatClasses: {},
    newsletters: {},
    subscribers: {},
    coupons: {},
    blogs: {},
  };

  ctx = await seedManagementCategories(prisma, ctx);
  ctx = await seedManagementBrands(prisma, ctx);
  ctx = await seedManagementCouriers(prisma, ctx);
  ctx = await seedManagementVat(prisma, ctx);
  ctx = await seedManagementBlogs(prisma, ctx);
  ctx = await seedManagementNewsletter(prisma, ctx);
  ctx = await seedManagementCoupons(prisma, ctx);

  console.log("✅ Management demo seed ensured", {
    categories: Object.keys(ctx.categories).length,
    brands: Object.keys(ctx.brands).length,
    couriers: Object.keys(ctx.couriers).length,
    vatClasses: Object.keys(ctx.vatClasses).length,
    blogs: Object.keys(ctx.blogs).length,
    subscribers: Object.keys(ctx.subscribers).length,
    newsletters: Object.keys(ctx.newsletters).length,
    coupons: Object.keys(ctx.coupons).length,
  });
}
