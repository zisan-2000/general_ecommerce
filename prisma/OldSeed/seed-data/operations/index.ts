import type { PrismaClient } from "../../../generated/prisma";
import { seedOperationsUsers } from "./users";
import { seedOperationsMasters } from "./masters";
import { seedOperationsReviews } from "./scenario-reviews";
import { seedOperationsOrders } from "./scenario-orders";
import { seedOperationsShipments } from "./scenario-shipments";
import { seedOperationsDelivery } from "./scenario-delivery";
import type { OperationsSeedContext } from "./types";

export async function seedOperationsDemo(
  prisma: PrismaClient,
  adminUserId?: string | null,
): Promise<void> {
  let ctx: OperationsSeedContext = {
    adminUserId,
    users: {},
    categories: {},
    brands: {},
    products: {},
    variants: {},
    warehouses: {},
    couriers: {},
    orders: {},
    shipments: {},
  };

  ctx = await seedOperationsUsers(prisma, ctx);
  ctx = await seedOperationsMasters(prisma, ctx);
  await seedOperationsReviews(prisma, ctx);
  ctx = await seedOperationsOrders(prisma, ctx);
  ctx = await seedOperationsShipments(prisma, ctx);
  await seedOperationsDelivery(prisma, ctx);

  console.log("✅ Operations demo seed ensured");
}
