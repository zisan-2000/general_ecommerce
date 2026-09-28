import {
  InvestorLedgerDirection,
  InvestorTransactionType,
} from "../../../generated/prisma";
import { daysAgo, decimal } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

type LedgerScenario = {
  key: string;
  transactionNumber: string;
  investorKey: string;
  variantSku?: string;
  transactionDate: Date;
  type: InvestorTransactionType;
  direction: InvestorLedgerDirection;
  amount: string;
  referenceType: string;
  referenceNumber: string;
  note: string;
};

const LEDGER_SCENARIOS: LedgerScenario[] = [
  {
    key: "seed001_capital_commitment",
    transactionNumber: "TXN-INV-001",
    investorKey: "seed_001",
    variantSku: "SCM-BOOT-BLK-42",
    transactionDate: daysAgo(92),
    type: InvestorTransactionType.CAPITAL_COMMITMENT,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "500000",
    referenceType: "SEED_CAPITAL_COMMITMENT",
    referenceNumber: "COMMIT-INV-001",
    note: "Seeded capital commitment for Yousuf Growth Capital.",
  },
  {
    key: "seed001_capital_contribution",
    transactionNumber: "TXN-INV-002",
    investorKey: "seed_001",
    variantSku: "SCM-BOOT-BLK-42",
    transactionDate: daysAgo(88),
    type: InvestorTransactionType.CAPITAL_CONTRIBUTION,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "350000",
    referenceType: "BANK_DEPOSIT",
    referenceNumber: "DEP-INV-001",
    note: "Seeded paid capital contribution for Yousuf Growth Capital.",
  },
  {
    key: "seed002_capital_contribution",
    transactionNumber: "TXN-INV-003",
    investorKey: "seed_002",
    variantSku: "SCM-CARTON-MED",
    transactionDate: daysAgo(82),
    type: InvestorTransactionType.CAPITAL_CONTRIBUTION,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "275000",
    referenceType: "BANK_DEPOSIT",
    referenceNumber: "DEP-INV-002",
    note: "Seeded paid capital contribution for Mahin Retail Capital.",
  },
  {
    key: "seed003_capital_contribution",
    transactionNumber: "TXN-INV-004",
    investorKey: "seed_003",
    variantSku: "SCM-POLY-L",
    transactionDate: daysAgo(76),
    type: InvestorTransactionType.CAPITAL_CONTRIBUTION,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "220000",
    referenceType: "BANK_DEPOSIT",
    referenceNumber: "DEP-INV-003",
    note: "Seeded paid capital contribution for Salehin Ecommerce Partners.",
  },
  {
    key: "seed001_adjustment_credit",
    transactionNumber: "TXN-INV-005",
    investorKey: "seed_001",
    transactionDate: daysAgo(45),
    type: InvestorTransactionType.ADJUSTMENT,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "15000",
    referenceType: "MANUAL_ADJUSTMENT",
    referenceNumber: "ADJ-INV-001",
    note: "Seeded credit adjustment for reconciliation test.",
  },
  {
    key: "seed002_adjustment_debit",
    transactionNumber: "TXN-INV-006",
    investorKey: "seed_002",
    transactionDate: daysAgo(40),
    type: InvestorTransactionType.ADJUSTMENT,
    direction: InvestorLedgerDirection.DEBIT,
    amount: "8500",
    referenceType: "MANUAL_ADJUSTMENT",
    referenceNumber: "ADJ-INV-002",
    note: "Seeded debit adjustment for reconciliation test.",
  },
  {
    key: "seed003_withdrawal",
    transactionNumber: "TXN-INV-007",
    investorKey: "seed_003",
    transactionDate: daysAgo(32),
    type: InvestorTransactionType.WITHDRAWAL,
    direction: InvestorLedgerDirection.DEBIT,
    amount: "25000",
    referenceType: "WITHDRAWAL_REQUEST",
    referenceNumber: "WDR-INV-SEED-001",
    note: "Seeded settled withdrawal movement.",
  },
  {
    key: "seed001_profit_allocation",
    transactionNumber: "TXN-INV-008",
    investorKey: "seed_001",
    variantSku: "SCM-BOOT-BLK-42",
    transactionDate: daysAgo(18),
    type: InvestorTransactionType.PROFIT_ALLOCATION,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "42000",
    referenceType: "PROFIT_RUN",
    referenceNumber: "RUN-INV-SEED-001",
    note: "Seeded profit allocation ledger movement for portal statement testing.",
  },
  {
    key: "seed002_loss_allocation",
    transactionNumber: "TXN-INV-009",
    investorKey: "seed_002",
    variantSku: "SCM-CARTON-MED",
    transactionDate: daysAgo(16),
    type: InvestorTransactionType.LOSS_ALLOCATION,
    direction: InvestorLedgerDirection.DEBIT,
    amount: "6500",
    referenceType: "PROFIT_RUN",
    referenceNumber: "RUN-INV-SEED-LOSS-001",
    note: "Seeded loss allocation movement for negative scenario testing.",
  },
  {
    key: "seed001_distribution",
    transactionNumber: "TXN-INV-010",
    investorKey: "seed_001",
    transactionDate: daysAgo(10),
    type: InvestorTransactionType.DISTRIBUTION,
    direction: InvestorLedgerDirection.DEBIT,
    amount: "30000",
    referenceType: "PAYOUT",
    referenceNumber: "PAYOUT-INV-SEED-001",
    note: "Seeded profit distribution/payout ledger movement.",
  },
  {
    key: "seed009_capital_contribution_no_portal",
    transactionNumber: "TXN-INV-011",
    investorKey: "seed_009",
    variantSku: "SCM-SCAN-USB",
    transactionDate: daysAgo(22),
    type: InvestorTransactionType.CAPITAL_CONTRIBUTION,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "125000",
    referenceType: "BANK_DEPOSIT",
    referenceNumber: "DEP-INV-009",
    note: "Seeded active investor capital contribution without portal access.",
  },
  {
    key: "seed010_capital_contribution_unverified_beneficiary",
    transactionNumber: "TXN-INV-012",
    investorKey: "seed_010",
    variantSku: "SCM-PRINTER-4IN",
    transactionDate: daysAgo(20),
    type: InvestorTransactionType.CAPITAL_CONTRIBUTION,
    direction: InvestorLedgerDirection.CREDIT,
    amount: "180000",
    referenceType: "BANK_DEPOSIT",
    referenceNumber: "DEP-INV-010",
    note: "Seeded verified KYC investor with unverified beneficiary capital movement.",
  },
];

export async function seedInvestorLedgerScenarios(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    transactions: {
      ...(ctx.transactions ?? {}),
    },
  };

  for (const record of LEDGER_SCENARIOS) {
    const investor = ctx.investors[record.investorKey];
    if (!investor) {
      console.warn(
        `⚠️ Investor ledger scenario skipped, missing investor key: ${record.investorKey}`,
      );
      continue;
    }

    const variant = record.variantSku ? ctx.variants[record.variantSku] : null;

    const transaction = await prisma.investorCapitalTransaction.upsert({
      where: { transactionNumber: record.transactionNumber },
      update: {
        investorId: investor.id,
        transactionDate: record.transactionDate,
        type: record.type,
        direction: record.direction,
        amount: decimal(record.amount),
        currency: "BDT",
        note: record.note,
        referenceType: record.referenceType,
        referenceNumber: record.referenceNumber,
        productVariantId: variant?.id ?? null,
        createdById: ctx.adminUserId,
      },
      create: {
        transactionNumber: record.transactionNumber,
        investorId: investor.id,
        transactionDate: record.transactionDate,
        type: record.type,
        direction: record.direction,
        amount: decimal(record.amount),
        currency: "BDT",
        note: record.note,
        referenceType: record.referenceType,
        referenceNumber: record.referenceNumber,
        productVariantId: variant?.id ?? null,
        createdById: ctx.adminUserId,
      },
      select: {
        id: true,
        transactionNumber: true,
        investorId: true,
        amount: true,
      },
    });

    nextCtx.transactions![record.key] = transaction;
  }

  console.log(
    `✅ Investor ledger scenarios ensured: ${Object.keys(nextCtx.transactions ?? {}).length} transactions`,
  );

  return nextCtx;
}
