import {
  InvestorProfitExpenseAllocationBasis,
  InvestorProfitRunStatus,
} from "../../../generated/prisma";
import { daysAgo, decimal } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

type ProfitRunLineInput = {
  variantSku: string;
  unitsSold: number;
  unitsRefunded: number;
  grossRevenue: number;
  refundAmount: number;
  grossCogs: number;
  refundCogs: number;
  allocatedExpense: number;
};

type ProfitRunScenario = {
  key: string;
  runNumber: string;
  fromDate: Date;
  toDate: Date;
  status: InvestorProfitRunStatus;
  allocationBasis: InvestorProfitExpenseAllocationBasis;
  marketingExpense: number;
  adsExpense: number;
  logisticsExpense: number;
  otherExpense: number;
  note: string;
  approved: boolean;
  posted: boolean;
  lines: ProfitRunLineInput[];
};

const PROFIT_RUN_SCENARIOS: ProfitRunScenario[] = [
  {
    key: "pending_current_month",
    runNumber: "RUN-INV-001",
    fromDate: daysAgo(30),
    toDate: daysAgo(1),
    status: InvestorProfitRunStatus.PENDING_APPROVAL,
    allocationBasis: InvestorProfitExpenseAllocationBasis.NET_REVENUE,
    marketingExpense: 12000,
    adsExpense: 18000,
    logisticsExpense: 9000,
    otherExpense: 3000,
    note: "Seeded pending approval profit run for current-month investor workflow testing.",
    approved: false,
    posted: false,
    lines: [
      {
        variantSku: "SCM-BOOT-BLK-42",
        unitsSold: 80,
        unitsRefunded: 3,
        grossRevenue: 336000,
        refundAmount: 12600,
        grossCogs: 236000,
        refundCogs: 8850,
        allocatedExpense: 22000,
      },
      {
        variantSku: "SCM-CARTON-MED",
        unitsSold: 1800,
        unitsRefunded: 40,
        grossRevenue: 86400,
        refundAmount: 1920,
        grossCogs: 55800,
        refundCogs: 1240,
        allocatedExpense: 11000,
      },
    ],
  },
  {
    key: "approved_previous_month",
    runNumber: "RUN-INV-002",
    fromDate: daysAgo(62),
    toDate: daysAgo(33),
    status: InvestorProfitRunStatus.APPROVED,
    allocationBasis: InvestorProfitExpenseAllocationBasis.NET_REVENUE,
    marketingExpense: 10000,
    adsExpense: 16000,
    logisticsExpense: 7000,
    otherExpense: 2500,
    note: "Seeded approved profit run awaiting posting.",
    approved: true,
    posted: false,
    lines: [
      {
        variantSku: "SCM-BOOT-BLK-42",
        unitsSold: 65,
        unitsRefunded: 2,
        grossRevenue: 273000,
        refundAmount: 8400,
        grossCogs: 191750,
        refundCogs: 5900,
        allocatedExpense: 17000,
      },
      {
        variantSku: "SCM-POLY-L",
        unitsSold: 6000,
        unitsRefunded: 120,
        grossRevenue: 72000,
        refundAmount: 1440,
        grossCogs: 42000,
        refundCogs: 840,
        allocatedExpense: 7000,
      },
    ],
  },
  {
    key: "posted_full_allocation",
    runNumber: "RUN-INV-003",
    fromDate: daysAgo(95),
    toDate: daysAgo(66),
    status: InvestorProfitRunStatus.POSTED,
    allocationBasis: InvestorProfitExpenseAllocationBasis.NET_REVENUE,
    marketingExpense: 9000,
    adsExpense: 14000,
    logisticsExpense: 6500,
    otherExpense: 2000,
    note: "Seeded posted profit run with fully allocated boot variant.",
    approved: true,
    posted: true,
    lines: [
      {
        variantSku: "SCM-BOOT-BLK-42",
        unitsSold: 92,
        unitsRefunded: 4,
        grossRevenue: 386400,
        refundAmount: 16800,
        grossCogs: 271400,
        refundCogs: 11800,
        allocatedExpense: 20500,
      },
    ],
  },
  {
    key: "rejected_variance_review",
    runNumber: "RUN-INV-004",
    fromDate: daysAgo(125),
    toDate: daysAgo(96),
    status: InvestorProfitRunStatus.REJECTED,
    allocationBasis: InvestorProfitExpenseAllocationBasis.NET_UNITS,
    marketingExpense: 8000,
    adsExpense: 9000,
    logisticsExpense: 6000,
    otherExpense: 1500,
    note: "Seeded rejected profit run for approval/rejection history testing.",
    approved: false,
    posted: false,
    lines: [
      {
        variantSku: "SCM-CARTON-MED",
        unitsSold: 1400,
        unitsRefunded: 60,
        grossRevenue: 67200,
        refundAmount: 2880,
        grossCogs: 43400,
        refundCogs: 1860,
        allocatedExpense: 7000,
      },
    ],
  },
  {
    key: "posted_partial_company_retained",
    runNumber: "RUN-INV-005",
    fromDate: daysAgo(155),
    toDate: daysAgo(126),
    status: InvestorProfitRunStatus.POSTED,
    allocationBasis: InvestorProfitExpenseAllocationBasis.NET_REVENUE,
    marketingExpense: 7000,
    adsExpense: 8500,
    logisticsExpense: 4500,
    otherExpense: 1200,
    note: "Seeded posted profit run with partial investor allocation and company-retained share.",
    approved: true,
    posted: true,
    lines: [
      {
        variantSku: "SCM-CARTON-MED",
        unitsSold: 2200,
        unitsRefunded: 30,
        grossRevenue: 105600,
        refundAmount: 1440,
        grossCogs: 68200,
        refundCogs: 930,
        allocatedExpense: 9500,
      },
      {
        variantSku: "SCM-POLY-L",
        unitsSold: 4500,
        unitsRefunded: 75,
        grossRevenue: 54000,
        refundAmount: 900,
        grossCogs: 31500,
        refundCogs: 525,
        allocatedExpense: 4800,
      },
    ],
  },
];

function netValues(line: ProfitRunLineInput) {
  const unitsNet = line.unitsSold - line.unitsRefunded;
  const netRevenue = line.grossRevenue - line.refundAmount;
  const netCogs = line.grossCogs - line.refundCogs;
  const netProfit = netRevenue - netCogs - line.allocatedExpense;

  return {
    unitsNet,
    netRevenue,
    netCogs,
    netProfit,
  };
}

function seededUserId(ctx: InvestorSeedContext, key: string) {
  return ctx.users[key]?.id ?? ctx.adminUserId ?? null;
}

export async function seedInvestorProfitRunScenarios(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    profitRuns: {
      ...(ctx.profitRuns ?? {}),
    },
  };

  for (const scenario of PROFIT_RUN_SCENARIOS) {
    const usableLines = scenario.lines.filter((line) => ctx.variants[line.variantSku]);

    if (usableLines.length === 0) {
      console.warn(
        `⚠️ Investor profit run skipped, no matching variants: ${scenario.runNumber}`,
      );
      continue;
    }

    const totals = usableLines.reduce(
      (acc, line) => {
        const net = netValues(line);
        acc.totalNetRevenue += net.netRevenue;
        acc.totalNetCogs += net.netCogs;
        acc.totalNetProfit += net.netProfit;
        return acc;
      },
      { totalNetRevenue: 0, totalNetCogs: 0, totalNetProfit: 0 },
    );

    const run = await prisma.investorProfitRun.upsert({
      where: { runNumber: scenario.runNumber },
      update: {
        fromDate: scenario.fromDate,
        toDate: scenario.toDate,
        status: scenario.status,
        allocationBasis: scenario.allocationBasis,
        marketingExpense: decimal(scenario.marketingExpense),
        adsExpense: decimal(scenario.adsExpense),
        logisticsExpense: decimal(scenario.logisticsExpense),
        otherExpense: decimal(scenario.otherExpense),
        totalOperatingExpense: decimal(
          scenario.marketingExpense +
            scenario.adsExpense +
            scenario.logisticsExpense +
            scenario.otherExpense,
        ),
        totalNetRevenue: decimal(totals.totalNetRevenue),
        totalNetCogs: decimal(totals.totalNetCogs),
        totalNetProfit: decimal(totals.totalNetProfit),
        note: scenario.note,
        createdById: seededUserId(ctx, "profit_manager"),
        approvedById: scenario.approved ? seededUserId(ctx, "profit_approver") : null,
        approvedAt: scenario.approved ? daysAgo(10) : null,
        postedById: scenario.posted ? seededUserId(ctx, "profit_poster") : null,
        postedAt: scenario.posted ? daysAgo(8) : null,
        postingNote: scenario.posted
          ? "Seeded posted profit run for investor payout testing."
          : null,
      },
      create: {
        runNumber: scenario.runNumber,
        fromDate: scenario.fromDate,
        toDate: scenario.toDate,
        status: scenario.status,
        allocationBasis: scenario.allocationBasis,
        marketingExpense: decimal(scenario.marketingExpense),
        adsExpense: decimal(scenario.adsExpense),
        logisticsExpense: decimal(scenario.logisticsExpense),
        otherExpense: decimal(scenario.otherExpense),
        totalOperatingExpense: decimal(
          scenario.marketingExpense +
            scenario.adsExpense +
            scenario.logisticsExpense +
            scenario.otherExpense,
        ),
        totalNetRevenue: decimal(totals.totalNetRevenue),
        totalNetCogs: decimal(totals.totalNetCogs),
        totalNetProfit: decimal(totals.totalNetProfit),
        note: scenario.note,
        createdById: seededUserId(ctx, "profit_manager"),
        approvedById: scenario.approved ? seededUserId(ctx, "profit_approver") : null,
        approvedAt: scenario.approved ? daysAgo(10) : null,
        postedById: scenario.posted ? seededUserId(ctx, "profit_poster") : null,
        postedAt: scenario.posted ? daysAgo(8) : null,
        postingNote: scenario.posted
          ? "Seeded posted profit run for investor payout testing."
          : null,
      },
      select: {
        id: true,
        runNumber: true,
        status: true,
      },
    });

    await prisma.investorProfitRunAllocation.deleteMany({
      where: { runId: run.id },
    });
    await prisma.investorProfitRunVariant.deleteMany({
      where: { runId: run.id },
    });

    for (const line of usableLines) {
      const variant = ctx.variants[line.variantSku];
      const net = netValues(line);

      const activeAllocations = await prisma.investorProductAllocation.findMany({
        where: {
          productVariantId: variant.id,
          status: "ACTIVE",
          investor: {
            status: "ACTIVE",
            kycStatus: "VERIFIED",
          },
        },
        select: {
          id: true,
          investorId: true,
          productVariantId: true,
          participationPercent: true,
        },
      });

      const allocatedPct = activeAllocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.participationPercent?.toString() ?? "0"),
        0,
      );
      const unallocatedSharePct = Math.max(0, 100 - allocatedPct);

      const variantLine = await prisma.investorProfitRunVariant.create({
        data: {
          runId: run.id,
          productVariantId: variant.id,
          unitsSold: line.unitsSold,
          unitsRefunded: line.unitsRefunded,
          unitsNet: net.unitsNet,
          grossRevenue: decimal(line.grossRevenue),
          refundAmount: decimal(line.refundAmount),
          netRevenue: decimal(net.netRevenue),
          grossCogs: decimal(line.grossCogs),
          refundCogs: decimal(line.refundCogs),
          netCogs: decimal(net.netCogs),
          allocatedExpense: decimal(line.allocatedExpense),
          netProfit: decimal(net.netProfit),
          unallocatedSharePct: decimal(unallocatedSharePct.toFixed(4)),
        },
        select: { id: true },
      });

      for (const allocation of activeAllocations) {
        const sharePct = Number(allocation.participationPercent?.toString() ?? "0");
        const allocatedRevenue = (net.netRevenue * sharePct) / 100;
        const allocatedNetProfit = (net.netProfit * sharePct) / 100;

        await prisma.investorProfitRunAllocation.create({
          data: {
            runId: run.id,
            variantLineId: variantLine.id,
            investorId: allocation.investorId,
            productVariantId: allocation.productVariantId,
            sourceAllocationId: allocation.id,
            participationSharePct: decimal(sharePct.toFixed(4)),
            allocatedRevenue: decimal(allocatedRevenue.toFixed(2)),
            allocatedNetProfit: decimal(allocatedNetProfit.toFixed(2)),
          },
        });
      }
    }

    nextCtx.profitRuns![scenario.key] = {
      id: run.id,
      runNumber: run.runNumber,
      status: run.status,
    };
  }

  console.log(
    `✅ Investor profit run scenarios ensured: ${Object.keys(nextCtx.profitRuns ?? {}).length} runs`,
  );

  return nextCtx;
}
