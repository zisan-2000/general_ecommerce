import {
  InvestorInternalNotificationStatus,
  InvestorInternalNotificationType,
  InvestorStatementDeliveryFormat,
  InvestorStatementScheduleFrequency,
  InvestorStatementScheduleStatus,
} from "../../../generated/prisma";
import { daysAgo, daysFromNow } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

type StatementScenario = {
  key: string;
  investorKey: string;
  frequency: InvestorStatementScheduleFrequency;
  deliveryFormat: InvestorStatementDeliveryFormat;
  statementWindowDays: number;
  status: InvestorStatementScheduleStatus;
  nextRunAt: Date;
  lastRunAt?: Date | null;
  lastDispatchedAt?: Date | null;
  lastDispatchNote?: string | null;
};

const STATEMENT_SCENARIOS: StatementScenario[] = [
  {
    key: "seed001_monthly_pdf",
    investorKey: "seed_001",
    frequency: InvestorStatementScheduleFrequency.MONTHLY,
    deliveryFormat: InvestorStatementDeliveryFormat.PDF,
    statementWindowDays: 30,
    status: InvestorStatementScheduleStatus.ACTIVE,
    nextRunAt: daysFromNow(8),
    lastRunAt: daysAgo(22),
    lastDispatchedAt: daysAgo(21),
    lastDispatchNote: "Seeded monthly statement dispatched for portal statement testing.",
  },
  {
    key: "seed002_quarterly_both",
    investorKey: "seed_002",
    frequency: InvestorStatementScheduleFrequency.QUARTERLY,
    deliveryFormat: InvestorStatementDeliveryFormat.BOTH,
    statementWindowDays: 90,
    status: InvestorStatementScheduleStatus.ACTIVE,
    nextRunAt: daysFromNow(28),
    lastRunAt: daysAgo(60),
    lastDispatchedAt: daysAgo(59),
    lastDispatchNote: "Seeded quarterly PDF/CSV statement delivery.",
  },
  {
    key: "seed003_weekly_csv",
    investorKey: "seed_003",
    frequency: InvestorStatementScheduleFrequency.WEEKLY,
    deliveryFormat: InvestorStatementDeliveryFormat.CSV,
    statementWindowDays: 7,
    status: InvestorStatementScheduleStatus.ACTIVE,
    nextRunAt: daysFromNow(3),
    lastRunAt: daysAgo(4),
    lastDispatchedAt: daysAgo(4),
    lastDispatchNote: "Seeded weekly CSV statement delivery.",
  },
  {
    key: "seed007_paused_monthly",
    investorKey: "seed_007",
    frequency: InvestorStatementScheduleFrequency.MONTHLY,
    deliveryFormat: InvestorStatementDeliveryFormat.PDF,
    statementWindowDays: 30,
    status: InvestorStatementScheduleStatus.PAUSED,
    nextRunAt: daysFromNow(14),
    lastRunAt: daysAgo(40),
    lastDispatchedAt: daysAgo(39),
    lastDispatchNote: "Seeded paused statement schedule for suspended investor.",
  },
  {
    key: "seed010_active_monthly",
    investorKey: "seed_010",
    frequency: InvestorStatementScheduleFrequency.MONTHLY,
    deliveryFormat: InvestorStatementDeliveryFormat.BOTH,
    statementWindowDays: 30,
    status: InvestorStatementScheduleStatus.ACTIVE,
    nextRunAt: daysFromNow(11),
    lastRunAt: null,
    lastDispatchedAt: null,
    lastDispatchNote: "Seeded new statement schedule, not dispatched yet.",
  },
];

async function upsertStatementSchedule(
  prisma: InvestorSeedPrisma,
  input: StatementScenario & { investorId: number; adminUserId: string | null },
) {
  const existing = await prisma.investorStatementSchedule.findFirst({
    where: {
      investorId: input.investorId,
      frequency: input.frequency,
      deliveryFormat: input.deliveryFormat,
    },
    select: { id: true },
  });

  const data = {
    investorId: input.investorId,
    frequency: input.frequency,
    deliveryFormat: input.deliveryFormat,
    statementWindowDays: input.statementWindowDays,
    status: input.status,
    nextRunAt: input.nextRunAt,
    lastRunAt: input.lastRunAt ?? null,
    lastDispatchedAt: input.lastDispatchedAt ?? null,
    lastDispatchNote: input.lastDispatchNote ?? null,
    createdById: input.adminUserId,
    updatedById: input.adminUserId,
  };

  if (existing) {
    return prisma.investorStatementSchedule.update({
      where: { id: existing.id },
      data,
      select: { id: true, investorId: true, frequency: true, status: true },
    });
  }

  return prisma.investorStatementSchedule.create({
    data,
    select: { id: true, investorId: true, frequency: true, status: true },
  });
}

async function upsertStatementInternalNotification(
  prisma: InvestorSeedPrisma,
  input: {
    userId: string;
    createdById: string | null;
  },
) {
  const title = "Seeded statement dispatch review queue";
  const existing = await prisma.investorInternalNotification.findFirst({
    where: {
      userId: input.userId,
      title,
      entity: "InvestorStatementSchedule",
      entityId: "INV-STMT-SEED",
    },
    select: { id: true },
  });

  const data = {
    userId: input.userId,
    type: InvestorInternalNotificationType.STATEMENT_SCHEDULE,
    title,
    message: "Seeded statement schedules are ready for statement/export/dashboard testing.",
    status: InvestorInternalNotificationStatus.UNREAD,
    targetUrl: "/admin/investors/statements",
    entity: "InvestorStatementSchedule",
    entityId: "INV-STMT-SEED",
    metadata: {
      seededSchedules: STATEMENT_SCENARIOS.length,
      windows: [7, 30, 90],
    },
    createdById: input.createdById,
    readAt: null,
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

export async function seedInvestorStatementScenarios(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    statementSchedules: { ...(ctx.statementSchedules ?? {}) },
    internalNotifications: { ...(ctx.internalNotifications ?? {}) },
  };

  for (const scenario of STATEMENT_SCENARIOS) {
    const investor = ctx.investors[scenario.investorKey];
    if (!investor) {
      console.warn(`⚠️ Investor statement scenario skipped, missing investor: ${scenario.key}`);
      continue;
    }

    const schedule = await upsertStatementSchedule(prisma, {
      ...scenario,
      investorId: investor.id,
      adminUserId: ctx.adminUserId,
    });

    nextCtx.statementSchedules![scenario.key] = {
      id: schedule.id,
      investorId: schedule.investorId,
      frequency: schedule.frequency,
      status: schedule.status,
    };
  }

  const analyst = ctx.users.investor_analyst;
  if (analyst) {
    const notification = await upsertStatementInternalNotification(prisma, {
      userId: analyst.id,
      createdById: ctx.adminUserId,
    });
    nextCtx.internalNotifications!.statement_review_queue = {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      status: notification.status,
    };
  }

  console.log("✅ Investor statement scenarios ensured: schedules, dispatch states, statement notification");

  return nextCtx;
}
