import {
  InvestorLedgerDirection,
  InvestorPayoutPaymentMethod,
  InvestorProfitPayoutStatus,
  InvestorTransactionType,
} from "../../../generated/prisma";
import { daysAgo, decimal } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

type PayoutScenario = {
  key: string;
  payoutNumber: string;
  runKey: string;
  investorKey: string;
  status: InvestorProfitPayoutStatus;
  payoutPercent: number;
  holdbackPercent: number;
  fallbackGrossProfit: number;
  note: string;
  approvalNote?: string;
  rejectionReason?: string;
  holdReason?: string;
  releaseNote?: string;
  paymentMethod?: InvestorPayoutPaymentMethod;
  bankReference?: string;
  paymentProofUrl?: string;
  voidReason?: string;
  voidReversalReference?: string;
  createDistributionTransaction?: boolean;
};

const PAYOUT_SCENARIOS: PayoutScenario[] = [
  {
    key: "pending_seed001",
    payoutNumber: "PAYOUT-INV-001",
    runKey: "pending_current_month",
    investorKey: "seed_001",
    status: InvestorProfitPayoutStatus.PENDING_APPROVAL,
    payoutPercent: 100,
    holdbackPercent: 0,
    fallbackGrossProfit: 28000,
    note: "Seeded pending payout approval for current-month profit run.",
  },
  {
    key: "approved_seed002",
    payoutNumber: "PAYOUT-INV-002",
    runKey: "approved_previous_month",
    investorKey: "seed_002",
    status: InvestorProfitPayoutStatus.APPROVED,
    payoutPercent: 100,
    holdbackPercent: 0,
    fallbackGrossProfit: 21000,
    approvalNote: "Seeded approved payout waiting for payment posting.",
    note: "Seeded approved payout.",
  },
  {
    key: "approved_hold_seed003",
    payoutNumber: "PAYOUT-INV-003",
    runKey: "posted_full_allocation",
    investorKey: "seed_003",
    status: InvestorProfitPayoutStatus.APPROVED,
    payoutPercent: 90,
    holdbackPercent: 10,
    fallbackGrossProfit: 26000,
    approvalNote: "Approved with seeded holdback for review.",
    holdReason: "Seeded compliance holdback for payout governance testing.",
    note: "Seeded approved payout with holdback/hold reason.",
  },
  {
    key: "paid_seed001",
    payoutNumber: "PAYOUT-INV-004",
    runKey: "posted_full_allocation",
    investorKey: "seed_001",
    status: InvestorProfitPayoutStatus.PAID,
    payoutPercent: 100,
    holdbackPercent: 0,
    fallbackGrossProfit: 35000,
    approvalNote: "Approved and paid in seeded workflow.",
    paymentMethod: InvestorPayoutPaymentMethod.BANK_TRANSFER,
    bankReference: "BANK-INV-SEED-004",
    paymentProofUrl: "/seed/investor/payouts/PAYOUT-INV-004-proof.pdf",
    createDistributionTransaction: true,
    note: "Seeded paid payout with payment proof and ledger distribution transaction.",
  },
  {
    key: "rejected_seed004",
    payoutNumber: "PAYOUT-INV-005",
    runKey: "pending_current_month",
    investorKey: "seed_004",
    status: InvestorProfitPayoutStatus.REJECTED,
    payoutPercent: 100,
    holdbackPercent: 0,
    fallbackGrossProfit: 5000,
    rejectionReason: "Seeded rejected payout because KYC/beneficiary verification is incomplete.",
    note: "Seeded rejected payout for exception testing.",
  },
  {
    key: "void_seed002",
    payoutNumber: "PAYOUT-INV-006",
    runKey: "posted_partial_company_retained",
    investorKey: "seed_002",
    status: InvestorProfitPayoutStatus.VOID,
    payoutPercent: 100,
    holdbackPercent: 0,
    fallbackGrossProfit: 12000,
    voidReason: "Seeded void payout after duplicate approval request.",
    voidReversalReference: "VOID-REV-PAYOUT-INV-006",
    note: "Seeded void payout for governance/history testing.",
  },
  {
    key: "unverified_beneficiary_seed010",
    payoutNumber: "PAYOUT-INV-007",
    runKey: "approved_previous_month",
    investorKey: "seed_010",
    status: InvestorProfitPayoutStatus.PENDING_APPROVAL,
    payoutPercent: 100,
    holdbackPercent: 0,
    fallbackGrossProfit: 9000,
    note: "Seeded payout for verified KYC investor with unverified beneficiary snapshot.",
  },
];

function userId(ctx: InvestorSeedContext, key: string) {
  return ctx.users[key]?.id ?? ctx.adminUserId ?? null;
}

async function investorGrossProfit(
  prisma: InvestorSeedPrisma,
  runId: number,
  investorId: number,
  fallbackGrossProfit: number,
) {
  const lines = await prisma.investorProfitRunAllocation.findMany({
    where: {
      runId,
      investorId,
    },
    select: {
      allocatedNetProfit: true,
    },
  });

  const total = lines.reduce(
    (sum, line) => sum + Number(line.allocatedNetProfit.toString()),
    0,
  );

  return total > 0 ? total : fallbackGrossProfit;
}

async function upsertDistributionTransaction(
  prisma: InvestorSeedPrisma,
  input: {
    transactionNumber: string;
    investorId: number;
    amount: number;
    referenceNumber: string;
    createdById: string | null;
  },
) {
  return prisma.investorCapitalTransaction.upsert({
    where: { transactionNumber: input.transactionNumber },
    update: {
      investorId: input.investorId,
      transactionDate: daysAgo(3),
      type: InvestorTransactionType.DISTRIBUTION,
      direction: InvestorLedgerDirection.DEBIT,
      amount: decimal(input.amount.toFixed(2)),
      currency: "BDT",
      note: "Seeded payout settlement ledger transaction.",
      referenceType: "INVESTOR_PROFIT_PAYOUT",
      referenceNumber: input.referenceNumber,
      createdById: input.createdById,
    },
    create: {
      transactionNumber: input.transactionNumber,
      investorId: input.investorId,
      transactionDate: daysAgo(3),
      type: InvestorTransactionType.DISTRIBUTION,
      direction: InvestorLedgerDirection.DEBIT,
      amount: decimal(input.amount.toFixed(2)),
      currency: "BDT",
      note: "Seeded payout settlement ledger transaction.",
      referenceType: "INVESTOR_PROFIT_PAYOUT",
      referenceNumber: input.referenceNumber,
      createdById: input.createdById,
    },
    select: {
      id: true,
      transactionNumber: true,
      investorId: true,
      amount: true,
    },
  });
}

export async function seedInvestorPayoutScenarios(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    transactions: {
      ...(ctx.transactions ?? {}),
    },
    payouts: {
      ...(ctx.payouts ?? {}),
    },
  };

  for (const scenario of PAYOUT_SCENARIOS) {
    const run = ctx.profitRuns?.[scenario.runKey];
    const investor = ctx.investors[scenario.investorKey];

    if (!run || !investor) {
      console.warn(
        `⚠️ Investor payout scenario skipped, missing run/investor: ${scenario.payoutNumber}`,
      );
      continue;
    }

    const investorRecord = await prisma.investor.findUnique({
      where: { id: investor.id },
      select: {
        bankAccountName: true,
        bankName: true,
        bankAccountNumber: true,
        beneficiaryVerifiedAt: true,
        beneficiaryVerificationNote: true,
      },
    });

    const grossProfitAmount = await investorGrossProfit(
      prisma,
      run.id,
      investor.id,
      scenario.fallbackGrossProfit,
    );
    const holdbackAmount = (grossProfitAmount * scenario.holdbackPercent) / 100;
    const payoutAmount =
      (grossProfitAmount * scenario.payoutPercent) / 100 - holdbackAmount;

    const distributionTransaction = scenario.createDistributionTransaction
      ? await upsertDistributionTransaction(prisma, {
          transactionNumber: `TXN-${scenario.payoutNumber}`,
          investorId: investor.id,
          amount: payoutAmount,
          referenceNumber: scenario.payoutNumber,
          createdById: userId(ctx, "payout_payer"),
        })
      : null;

    if (distributionTransaction) {
      nextCtx.transactions![scenario.key] = distributionTransaction;
    }

    const approved =
      scenario.status === InvestorProfitPayoutStatus.APPROVED ||
      scenario.status === InvestorProfitPayoutStatus.PAID ||
      scenario.status === InvestorProfitPayoutStatus.VOID;
    const rejected = scenario.status === InvestorProfitPayoutStatus.REJECTED;
    const paid = scenario.status === InvestorProfitPayoutStatus.PAID;
    const voided = scenario.status === InvestorProfitPayoutStatus.VOID;

    const payout = await prisma.investorProfitPayout.upsert({
      where: { payoutNumber: scenario.payoutNumber },
      update: {
        runId: run.id,
        investorId: investor.id,
        transactionId: distributionTransaction?.id ?? null,
        currency: "BDT",
        payoutPercent: decimal(scenario.payoutPercent),
        holdbackPercent: decimal(scenario.holdbackPercent),
        grossProfitAmount: decimal(grossProfitAmount.toFixed(2)),
        holdbackAmount: decimal(holdbackAmount.toFixed(2)),
        payoutAmount: decimal(payoutAmount.toFixed(2)),
        beneficiaryNameSnapshot:
          investorRecord?.bankAccountName ?? investor.name,
        beneficiaryBankNameSnapshot: investorRecord?.bankName ?? null,
        beneficiaryAccountNumberSnapshot:
          investorRecord?.bankAccountNumber ?? null,
        beneficiaryVerifiedAt: investorRecord?.beneficiaryVerifiedAt ?? null,
        beneficiaryVerificationNote:
          investorRecord?.beneficiaryVerificationNote ?? null,
        status: scenario.status,
        approvalNote: scenario.approvalNote ?? null,
        approvedById: approved ? userId(ctx, "payout_approver") : null,
        approvedAt: approved ? daysAgo(5) : null,
        rejectedById: rejected ? userId(ctx, "payout_approver") : null,
        rejectedAt: rejected ? daysAgo(4) : null,
        rejectionReason: scenario.rejectionReason ?? null,
        paymentMethod: scenario.paymentMethod ?? null,
        bankReference: scenario.bankReference ?? null,
        paidById: paid ? userId(ctx, "payout_payer") : null,
        paidAt: paid ? daysAgo(2) : null,
        note: scenario.note,
        holdReason: scenario.holdReason ?? null,
        heldAt: scenario.holdReason ? daysAgo(4) : null,
        releasedById: scenario.releaseNote ? userId(ctx, "payout_approver") : null,
        releasedAt: scenario.releaseNote ? daysAgo(2) : null,
        releaseNote: scenario.releaseNote ?? null,
        paymentProofUrl: scenario.paymentProofUrl ?? null,
        paymentProofUploadedAt: scenario.paymentProofUrl ? daysAgo(2) : null,
        voidedById: voided ? userId(ctx, "payout_approver") : null,
        voidedAt: voided ? daysAgo(1) : null,
        voidReason: scenario.voidReason ?? null,
        voidReversalReference: scenario.voidReversalReference ?? null,
        createdById: userId(ctx, "payout_manager"),
      },
      create: {
        payoutNumber: scenario.payoutNumber,
        runId: run.id,
        investorId: investor.id,
        transactionId: distributionTransaction?.id ?? null,
        currency: "BDT",
        payoutPercent: decimal(scenario.payoutPercent),
        holdbackPercent: decimal(scenario.holdbackPercent),
        grossProfitAmount: decimal(grossProfitAmount.toFixed(2)),
        holdbackAmount: decimal(holdbackAmount.toFixed(2)),
        payoutAmount: decimal(payoutAmount.toFixed(2)),
        beneficiaryNameSnapshot:
          investorRecord?.bankAccountName ?? investor.name,
        beneficiaryBankNameSnapshot: investorRecord?.bankName ?? null,
        beneficiaryAccountNumberSnapshot:
          investorRecord?.bankAccountNumber ?? null,
        beneficiaryVerifiedAt: investorRecord?.beneficiaryVerifiedAt ?? null,
        beneficiaryVerificationNote:
          investorRecord?.beneficiaryVerificationNote ?? null,
        status: scenario.status,
        approvalNote: scenario.approvalNote ?? null,
        approvedById: approved ? userId(ctx, "payout_approver") : null,
        approvedAt: approved ? daysAgo(5) : null,
        rejectedById: rejected ? userId(ctx, "payout_approver") : null,
        rejectedAt: rejected ? daysAgo(4) : null,
        rejectionReason: scenario.rejectionReason ?? null,
        paymentMethod: scenario.paymentMethod ?? null,
        bankReference: scenario.bankReference ?? null,
        paidById: paid ? userId(ctx, "payout_payer") : null,
        paidAt: paid ? daysAgo(2) : null,
        note: scenario.note,
        holdReason: scenario.holdReason ?? null,
        heldAt: scenario.holdReason ? daysAgo(4) : null,
        releasedById: scenario.releaseNote ? userId(ctx, "payout_approver") : null,
        releasedAt: scenario.releaseNote ? daysAgo(2) : null,
        releaseNote: scenario.releaseNote ?? null,
        paymentProofUrl: scenario.paymentProofUrl ?? null,
        paymentProofUploadedAt: scenario.paymentProofUrl ? daysAgo(2) : null,
        voidedById: voided ? userId(ctx, "payout_approver") : null,
        voidedAt: voided ? daysAgo(1) : null,
        voidReason: scenario.voidReason ?? null,
        voidReversalReference: scenario.voidReversalReference ?? null,
        createdById: userId(ctx, "payout_manager"),
      },
      select: {
        id: true,
        payoutNumber: true,
        investorId: true,
        runId: true,
        status: true,
      },
    });

    nextCtx.payouts![scenario.key] = payout;
  }

  console.log(
    `✅ Investor payout scenarios ensured: ${Object.keys(nextCtx.payouts ?? {}).length} payouts`,
  );

  return nextCtx;
}
