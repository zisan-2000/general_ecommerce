import type { PrismaClient } from "../../../generated/prisma";
import { seedWarehouseDashboard } from "./scenario-dashboard";
import { seedWarehouseStockManagement } from "./scenario-stock-management";
import { seedWarehouseBinLayout } from "./scenario-bin-layout";
import { seedWarehouseShippingRates } from "./scenario-shipping-rates";
import { seedWarehouseLogistics } from "./scenario-logistics";
import { seedWarehouseDeliveryman } from "./scenario-deliveryman";
import { seedWarehousePayroll } from "./scenario-payroll";
import type { WarehouseSeedContext } from "./types";

export async function seedWarehouseDemo(
  prisma: PrismaClient,
  adminUserId?: string | null,
) {
  let ctx: WarehouseSeedContext = {
    adminUserId,
    users: {},
    categories: {},
    brands: {},
    products: {},
    variants: {},
    warehouses: {},
    zones: {},
    aisles: {},
    bins: {},
    stockLevels: {},
    couriers: {},
    shippingRates: {},
    orders: {},
    orderItems: {},
    shipments: {},
    deliveryProfiles: {},
    payrollProfiles: {},
  };

  ctx = await seedWarehouseDashboard(prisma, ctx);
  ctx = await seedWarehouseStockManagement(prisma, ctx);
  ctx = await seedWarehouseBinLayout(prisma, ctx);
  ctx = await seedWarehouseShippingRates(prisma, ctx);
  ctx = await seedWarehouseLogistics(prisma, ctx);
  ctx = await seedWarehouseDeliveryman(prisma, ctx);
  ctx = await seedWarehousePayroll(prisma, ctx);

  console.log("✅ Warehouse demo seed ensured");
}
