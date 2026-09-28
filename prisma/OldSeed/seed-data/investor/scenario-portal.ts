import {
  InvestorInternalNotificationStatus,
  InvestorInternalNotificationType,
  InvestorMasterChangeRequestStatus,
  InvestorPortalNotificationStatus,
  InvestorPortalNotificationType,
  InvestorProfileUpdateRequestStatus,
  InvestorWithdrawalRequestStatus,
  Prisma,
} from "../../../generated/prisma";
import { daysAgo, daysFromNow, decimal } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

type PortalNotificationScenario = {
  key: string;
  investorKey: string;
  type: InvestorPortalNotificationType;
  title: string;
  message: string;
  status: InvestorPortalNotificationStatus;
  targetUrl?: string;
  metadata?: Prisma.InputJsonValue;
};

const PORTAL_NOTIFICATIONS: PortalNotificationScenario[] = [
  {
    key: "seed001_statement_ready",
    investorKey: "seed_001",
    type: InvestorPortalNotificationType.STATEMENT_READY,
    title: "Monthly investor statement is ready",
    message: "Your seeded monthly investor statement is ready for review.",
    status: InvestorPortalNotificationStatus.UNREAD,
    targetUrl: "/investor-portal/statements",
    metadata: { statementPeriod: "current-month", seedCode: "INV-PORTAL-NOTIF-001" },
  },
  {
    key: "seed002_payout_paid",
    investorKey: "seed_002",
    type: InvestorPortalNotificationType.PAYOUT_STATUS,
    title: "Payout status updated",
    message: "A seeded payout was approved/paid for testing payout visibility.",
    status: InvestorPortalNotificationStatus.READ,
    targetUrl: "/investor-portal/payouts",
    metadata: { payoutNumber: "PAYOUT-INV-004", seedCode: "INV-PORTAL-NOTIF-002" },
  },
  {
    key: "seed004_document_review",
    investorKey: "seed_004",
    type: InvestorPortalNotificationType.DOCUMENT_REVIEW,
    title: "KYC document review pending",
    message: "Seeded pending KYC document review notification for portal exception testing.",
    status: InvestorPortalNotificationStatus.UNREAD,
    targetUrl: "/investor-portal/documents",
    metadata: { kycStatus: "PENDING", seedCode: "INV-PORTAL-NOTIF-003" },
  },
  {
    key: "seed010_unverified_beneficiary",
    investorKey: "seed_010",
    type: InvestorPortalNotificationType.SYSTEM,
    title: "Beneficiary verification required",
    message: "Please complete beneficiary verification before payout settlement.",
    status: InvestorPortalNotificationStatus.UNREAD,
    targetUrl: "/investor-portal/profile",
    metadata: { exception: "BENEFICIARY_NOT_VERIFIED", seedCode: "INV-PORTAL-NOTIF-004" },
  },
];

type InternalNotificationScenario = {
  key: string;
  userKey: string;
  type: InvestorInternalNotificationType;
  title: string;
  message: string;
  status: InvestorInternalNotificationStatus;
  targetUrl?: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

const INTERNAL_NOTIFICATIONS: InternalNotificationScenario[] = [
  {
    key: "profit_run_pending_approval",
    userKey: "profit_approver",
    type: InvestorInternalNotificationType.PROFIT_RUN,
    title: "Seeded profit run pending approval",
    message: "A seeded investor profit run is waiting for approval.",
    status: InvestorInternalNotificationStatus.UNREAD,
    targetUrl: "/admin/investors/profit-runs",
    entity: "InvestorProfitRun",
    entityId: "RUN-INV-001",
    metadata: { status: "PENDING_APPROVAL" },
  },
  {
    key: "payout_pending_payment",
    userKey: "payout_payer",
    type: InvestorInternalNotificationType.PAYOUT,
    title: "Seeded payout waiting for payment",
    message: "A seeded approved payout is waiting for payment proof/posting.",
    status: InvestorInternalNotificationStatus.UNREAD,
    targetUrl: "/admin/investors/payouts",
    entity: "InvestorProfitPayout",
    entityId: "PAYOUT-INV-002",
    metadata: { status: "APPROVED" },
  },
  {
    key: "document_review_queue",
    userKey: "investor_relations",
    type: InvestorInternalNotificationType.DOCUMENT_REVIEW,
    title: "Seeded investor KYC review queue",
    message: "Pending and under-review KYC investors are available for review testing.",
    status: InvestorInternalNotificationStatus.READ,
    targetUrl: "/admin/investors/documents",
    entity: "InvestorDocument",
    entityId: "INV-SEED-004",
    metadata: { investorCode: "INV-SEED-004" },
  },
];

async function upsertPortalNotification(
  prisma: InvestorSeedPrisma,
  input: PortalNotificationScenario & { investorId: number; createdById: string | null },
) {
  const existing = await prisma.investorPortalNotification.findFirst({
    where: {
      investorId: input.investorId,
      title: input.title,
    },
    select: { id: true },
  });

  const data = {
    investorId: input.investorId,
    type: input.type,
    title: input.title,
    message: input.message,
    status: input.status,
    targetUrl: input.targetUrl ?? null,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    createdById: input.createdById,
    readAt: input.status === InvestorPortalNotificationStatus.READ ? daysAgo(2) : null,
  };

  if (existing) {
    return prisma.investorPortalNotification.update({
      where: { id: existing.id },
      data,
      select: { id: true, investorId: true, type: true, status: true },
    });
  }

  return prisma.investorPortalNotification.create({
    data,
    select: { id: true, investorId: true, type: true, status: true },
  });
}

async function upsertInternalNotification(
  prisma: InvestorSeedPrisma,
  input: InternalNotificationScenario & { userId: string; createdById: string | null },
) {
  const existing = await prisma.investorInternalNotification.findFirst({
    where: {
      userId: input.userId,
      title: input.title,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
    },
    select: { id: true },
  });

  const data = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    status: input.status,
    targetUrl: input.targetUrl ?? null,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    createdById: input.createdById,
    readAt: input.status === InvestorInternalNotificationStatus.READ ? daysAgo(1) : null,
  };

  if (existing) {
    return prisma.investorInternalNotification.update({
      where: { id: existing.id },
      data,
      select: { id: true, userId: true, type: true, status: true },
    });
  }

  return prisma.investorInternalNotification.create({
    data,
    select: { id: true, userId: true, type: true, status: true },
  });
}

export async function seedInvestorPortalScenarios(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    portalNotifications: { ...(ctx.portalNotifications ?? {}) },
    internalNotifications: { ...(ctx.internalNotifications ?? {}) },
  };

  for (const scenario of PORTAL_NOTIFICATIONS) {
    const investor = ctx.investors[scenario.investorKey];
    if (!investor) {
      console.warn(`⚠️ Investor portal notification skipped, missing investor: ${scenario.key}`);
      continue;
    }

    const notification = await upsertPortalNotification(prisma, {
      ...scenario,
      investorId: investor.id,
      createdById: ctx.adminUserId,
    });

    nextCtx.portalNotifications![scenario.key] = {
      id: notification.id,
      investorId: notification.investorId,
      type: notification.type,
      status: notification.status,
    };
  }

  for (const scenario of INTERNAL_NOTIFICATIONS) {
    const user = ctx.users[scenario.userKey];
    if (!user) {
      console.warn(`⚠️ Investor internal notification skipped, missing user: ${scenario.key}`);
      continue;
    }

    const notification = await upsertInternalNotification(prisma, {
      ...scenario,
      userId: user.id,
      createdById: ctx.adminUserId,
    });

    nextCtx.internalNotifications![scenario.key] = {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      status: notification.status,
    };
  }

  const seed001 = ctx.investors.seed_001;
  const seed002 = ctx.investors.seed_002;
  const seed004 = ctx.investors.seed_004;
  const seed010 = ctx.investors.seed_010;

  if (seed001) {
    const existing = await prisma.investorProfileUpdateRequest.findFirst({
      where: { investorId: seed001.id, requestNote: "Seeded profile update request for portal workflow testing." },
      select: { id: true },
    });
    const data = {
      investorId: seed001.id,
      status: InvestorProfileUpdateRequestStatus.PENDING,
      requestedChanges: {
        phone: "01729999991",
        bankName: "DBBL Updated Branch",
      },
      currentSnapshot: {
        phone: "01720000001",
        bankName: "DBBL",
      },
      requestNote: "Seeded profile update request for portal workflow testing.",
      submittedById: ctx.adminUserId,
      submittedAt: daysAgo(3),
    };
    if (existing) {
      await prisma.investorProfileUpdateRequest.update({ where: { id: existing.id }, data });
    } else {
      await prisma.investorProfileUpdateRequest.create({ data });
    }
  }

  if (seed002) {
    const existing = await prisma.investorMasterChangeRequest.findFirst({
      where: { investorId: seed002.id, changeSummary: "Seeded approved master change request." },
      select: { id: true },
    });
    const data = {
      investorId: seed002.id,
      status: InvestorMasterChangeRequestStatus.APPROVED,
      requestedChanges: {
        notes: "Approved seeded master data governance change.",
      },
      currentSnapshot: {
        notes: "Seeded active verified investor with portal access.",
      },
      changeSummary: "Seeded approved master change request.",
      reviewNote: "Approved during investor seed demo.",
      requestedById: ctx.adminUserId,
      reviewedById: ctx.adminUserId,
      requestedAt: daysAgo(12),
      reviewedAt: daysAgo(10),
      appliedAt: daysAgo(9),
    };
    if (existing) {
      await prisma.investorMasterChangeRequest.update({ where: { id: existing.id }, data });
    } else {
      await prisma.investorMasterChangeRequest.create({ data });
    }
  }

  if (seed004) {
    const existing = await prisma.investorWithdrawalRequest.findUnique({
      where: { requestNumber: "WDR-INV-SEED-001" },
      select: { id: true },
    });
    const data = {
      investorId: seed004.id,
      requestedAmount: decimal(25000),
      approvedAmount: null,
      currency: "BDT",
      availableBalanceSnapshot: decimal(10000),
      activeCommittedAmountSnapshot: decimal(0),
      pendingPayoutAmountSnapshot: decimal(0),
      withdrawableBalanceSnapshot: decimal(10000),
      beneficiaryNameSnapshot: seed004.name,
      beneficiaryBankNameSnapshot: null,
      beneficiaryAccountNumberSnapshot: null,
      beneficiaryVerifiedAt: null,
      status: InvestorWithdrawalRequestStatus.REJECTED,
      requestedSettlementDate: daysFromNow(7),
      requestNote: "Seeded withdrawal request with incomplete KYC/beneficiary state.",
      reviewNote: "Seeded rejection for investor exceptions testing.",
      rejectionReason: "KYC and beneficiary verification are not complete.",
      submittedById: ctx.adminUserId,
      submittedAt: daysAgo(8),
      reviewedById: ctx.adminUserId,
      reviewedAt: daysAgo(6),
    };
    if (existing) {
      await prisma.investorWithdrawalRequest.update({ where: { id: existing.id }, data });
    } else {
      await prisma.investorWithdrawalRequest.create({ data: { requestNumber: "WDR-INV-SEED-001", ...data } });
    }
  }

  if (seed010) {
    const existing = await prisma.investorWithdrawalRequest.findUnique({
      where: { requestNumber: "WDR-INV-SEED-002" },
      select: { id: true },
    });
    const data = {
      investorId: seed010.id,
      requestedAmount: decimal(18000),
      approvedAmount: null,
      currency: "BDT",
      availableBalanceSnapshot: decimal(180000),
      activeCommittedAmountSnapshot: decimal(85000),
      pendingPayoutAmountSnapshot: decimal(9000),
      withdrawableBalanceSnapshot: decimal(86000),
      beneficiaryNameSnapshot: seed010.name,
      beneficiaryBankNameSnapshot: "NCC Bank",
      beneficiaryAccountNumberSnapshot: "200000000010",
      beneficiaryVerifiedAt: null,
      status: InvestorWithdrawalRequestStatus.REQUESTED,
      requestedSettlementDate: daysFromNow(5),
      requestNote: "Seeded pending withdrawal request waiting for beneficiary verification.",
      submittedById: ctx.adminUserId,
      submittedAt: daysAgo(2),
    };
    if (existing) {
      await prisma.investorWithdrawalRequest.update({ where: { id: existing.id }, data });
    } else {
      await prisma.investorWithdrawalRequest.create({ data: { requestNumber: "WDR-INV-SEED-002", ...data } });
    }
  }

  console.log("✅ Investor portal scenarios ensured: notifications, profile requests, change requests, withdrawals");

  return nextCtx;
}
