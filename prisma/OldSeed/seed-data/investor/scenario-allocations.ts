import { daysAgo, daysFromNow, decimal } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

type AllocationScenario = {
  key: string;
  investorKey: string;
  variantSku: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  participationPercent: string;
  committedAmount: string;
  status: string;
  note: string;
};

const ALLOCATION_SCENARIOS: AllocationScenario[] = [
  {
    key: "seed001_boot_active_40",
    investorKey: "seed_001",
    variantSku: "SCM-BOOT-BLK-42",
    effectiveFrom: daysAgo(80),
    participationPercent: "40",
    committedAmount: "200000",
    status: "ACTIVE",
    note: "ALLOC-INV-001: Active 40% allocation on Safety Boot Black size 42.",
  },
  {
    key: "seed002_boot_active_35",
    investorKey: "seed_002",
    variantSku: "SCM-BOOT-BLK-42",
    effectiveFrom: daysAgo(78),
    participationPercent: "35",
    committedAmount: "175000",
    status: "ACTIVE",
    note: "ALLOC-INV-002: Active 35% allocation on Safety Boot Black size 42.",
  },
  {
    key: "seed003_boot_active_25",
    investorKey: "seed_003",
    variantSku: "SCM-BOOT-BLK-42",
    effectiveFrom: daysAgo(76),
    participationPercent: "25",
    committedAmount: "125000",
    status: "ACTIVE",
    note: "ALLOC-INV-003: Active 25% allocation on Safety Boot Black size 42.",
  },
  {
    key: "seed001_carton_active_50",
    investorKey: "seed_001",
    variantSku: "SCM-CARTON-MED",
    effectiveFrom: daysAgo(70),
    participationPercent: "50",
    committedAmount: "140000",
    status: "ACTIVE",
    note: "ALLOC-INV-004: Active 50% allocation with remaining 50% company-retained share.",
  },
  {
    key: "seed002_carton_active_25",
    investorKey: "seed_002",
    variantSku: "SCM-CARTON-MED",
    effectiveFrom: daysAgo(69),
    participationPercent: "25",
    committedAmount: "70000",
    status: "ACTIVE",
    note: "ALLOC-INV-005: Active 25% allocation with partial investor coverage.",
  },
  {
    key: "seed003_polybag_active_60",
    investorKey: "seed_003",
    variantSku: "SCM-POLY-L",
    effectiveFrom: daysAgo(66),
    participationPercent: "60",
    committedAmount: "132000",
    status: "ACTIVE",
    note: "ALLOC-INV-006: Active 60% allocation with 40% company-retained share.",
  },
  {
    key: "seed009_scanner_active_no_portal",
    investorKey: "seed_009",
    variantSku: "SCM-SCAN-USB",
    effectiveFrom: daysAgo(30),
    participationPercent: "30",
    committedAmount: "125000",
    status: "ACTIVE",
    note: "ALLOC-INV-007: Active allocation for investor without portal access.",
  },
  {
    key: "seed010_printer_active_unverified_beneficiary",
    investorKey: "seed_010",
    variantSku: "SCM-PRINTER-4IN",
    effectiveFrom: daysAgo(28),
    participationPercent: "45",
    committedAmount: "180000",
    status: "ACTIVE",
    note: "ALLOC-INV-008: Active allocation for verified KYC investor with unverified beneficiary.",
  },
  {
    key: "seed007_tablet_suspended",
    investorKey: "seed_007",
    variantSku: "SCM-TAB-8IN",
    effectiveFrom: daysAgo(60),
    participationPercent: "20",
    committedAmount: "95000",
    status: "SUSPENDED",
    note: "ALLOC-INV-009: Suspended allocation for governance testing.",
  },
  {
    key: "seed008_polybag_closed",
    investorKey: "seed_008",
    variantSku: "SCM-POLY-L",
    effectiveFrom: daysAgo(120),
    effectiveTo: daysAgo(35),
    participationPercent: "15",
    committedAmount: "45000",
    status: "CLOSED",
    note: "ALLOC-INV-010: Closed historic allocation for reporting filters.",
  },
  {
    key: "seed004_carton_pending_kyc",
    investorKey: "seed_004",
    variantSku: "SCM-CARTON-MED",
    effectiveFrom: daysAgo(10),
    effectiveTo: daysFromNow(20),
    participationPercent: "10",
    committedAmount: "30000",
    status: "PENDING_KYC",
    note: "ALLOC-INV-011: Pending KYC allocation-style record for exception visibility.",
  },
];

async function upsertAllocationBySeedNote(
  prisma: InvestorSeedPrisma,
  record: AllocationScenario,
  investorId: number,
  productVariantId: number,
  createdById: string | null,
) {
  const seedCode = record.note.split(":")[0];
  const existing = await prisma.investorProductAllocation.findFirst({
    where: {
      investorId,
      productVariantId,
      note: {
        startsWith: seedCode,
      },
    },
    select: { id: true },
  });

  const data = {
    investorId,
    productVariantId,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo ?? null,
    participationPercent: decimal(record.participationPercent),
    committedAmount: decimal(record.committedAmount),
    status: record.status,
    note: record.note,
    createdById,
  };

  if (existing) {
    return prisma.investorProductAllocation.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        investorId: true,
        productVariantId: true,
        status: true,
      },
    });
  }

  return prisma.investorProductAllocation.create({
    data,
    select: {
      id: true,
      investorId: true,
      productVariantId: true,
      status: true,
    },
  });
}

export async function seedInvestorAllocationScenarios(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    allocations: {
      ...(ctx.allocations ?? {}),
    },
  };

  for (const record of ALLOCATION_SCENARIOS) {
    const investor = ctx.investors[record.investorKey];
    if (!investor) {
      console.warn(
        `⚠️ Investor allocation scenario skipped, missing investor key: ${record.investorKey}`,
      );
      continue;
    }

    const variant = ctx.variants[record.variantSku];
    if (!variant) {
      console.warn(
        `⚠️ Investor allocation scenario skipped, missing variant SKU: ${record.variantSku}`,
      );
      continue;
    }

    const allocation = await upsertAllocationBySeedNote(
      prisma,
      record,
      investor.id,
      variant.id,
      ctx.adminUserId,
    );

    nextCtx.allocations![record.key] = allocation;
  }

  console.log(
    `✅ Investor allocation scenarios ensured: ${Object.keys(nextCtx.allocations ?? {}).length} allocations`,
  );

  return nextCtx;
}
