import type { PrismaClient } from "../../../generated/prisma";

export type TxClient = PrismaClient;

export type WarehouseSeedContext = {
  adminUserId?: string | null;
  users: Record<string, string>;
  categories: Record<string, number>;
  brands: Record<string, number>;
  products: Record<string, number>;
  variants: Record<string, number>;
  warehouses: Record<string, number>;
  zones: Record<string, number>;
  aisles: Record<string, number>;
  bins: Record<string, number>;
  stockLevels: Record<string, number>;
  couriers: Record<string, number>;
  shippingRates: Record<string, number>;
  orders: Record<string, number>;
  orderItems: Record<string, number>;
  shipments: Record<string, number>;
  deliveryProfiles: Record<string, string>;
  payrollProfiles: Record<string, number>;
  payrollPeriodId?: number;
};
