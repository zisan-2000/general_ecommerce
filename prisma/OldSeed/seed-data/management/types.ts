import type { PrismaClient } from "../../../generated/prisma";

export type TxClient = PrismaClient;

export type ManagementSeedContext = {
  adminUserId?: string | null;
  categories: Record<string, number>;
  brands: Record<string, number>;
  couriers: Record<string, number>;
  vatClasses: Record<string, number>;
  newsletters: Record<string, string>;
  subscribers: Record<string, string>;
  coupons: Record<string, string>;
  blogs: Record<string, number>;
};
