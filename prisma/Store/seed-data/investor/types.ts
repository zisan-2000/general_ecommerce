import type { PrismaClient } from "../../../generated/prisma";

export type InvestorSeedUserRef = {
  id: string;
  email: string;
  name: string;
  roleName: string;
};

export type InvestorSeedInvestorRef = {
  id: number;
  code: string;
  name: string;
  email: string | null;
};

export type InvestorSeedVariantRef = {
  id: number;
  sku: string;
  productId: number;
  productName: string;
};

export type InvestorSeedTransactionRef = {
  id: number;
  transactionNumber: string;
  investorId: number;
  amount: unknown;
};

export type InvestorSeedAllocationRef = {
  id: number;
  investorId: number;
  productVariantId: number;
  status: string;
};

export type InvestorSeedProfitRunRef = {
  id: number;
  runNumber: string;
  status: string;
};

export type InvestorSeedPayoutRef = {
  id: number;
  payoutNumber: string;
  investorId: number;
  runId: number;
  status: string;
};

export type InvestorSeedPortalNotificationRef = {
  id: number;
  investorId: number;
  type: string;
  status: string;
};

export type InvestorSeedInternalNotificationRef = {
  id: number;
  userId: string;
  type: string;
  status: string;
};

export type InvestorSeedStatementScheduleRef = {
  id: number;
  investorId: number;
  frequency: string;
  status: string;
};

export type InvestorSeedContext = {
  adminUserId: string | null;
  users: Record<string, InvestorSeedUserRef>;
  investors: Record<string, InvestorSeedInvestorRef>;
  variants: Record<string, InvestorSeedVariantRef>;
  transactions?: Record<string, InvestorSeedTransactionRef>;
  allocations?: Record<string, InvestorSeedAllocationRef>;
  profitRuns?: Record<string, InvestorSeedProfitRunRef>;
  payouts?: Record<string, InvestorSeedPayoutRef>;
  portalNotifications?: Record<string, InvestorSeedPortalNotificationRef>;
  internalNotifications?: Record<string, InvestorSeedInternalNotificationRef>;
  statementSchedules?: Record<string, InvestorSeedStatementScheduleRef>;
};

export type InvestorSeedPrisma = PrismaClient;
