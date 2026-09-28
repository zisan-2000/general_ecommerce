import type { PrismaClient } from "../../../generated/prisma";

export type TxClient = PrismaClient;

export type OperationsSeedContext = {
  adminUserId?: string | null;
  users: Record<string, string>;
  categories: Record<string, number>;
  brands: Record<string, number>;
  products: Record<string, number>;
  variants: Record<string, number>;
  warehouses: Record<string, number>;
  couriers: Record<string, number>;
  orders: Record<string, number>;
  shipments: Record<string, number>;
};
