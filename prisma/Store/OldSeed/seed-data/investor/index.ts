import { seedInvestorMasters } from "./masters";
import { seedInvestorAllocationScenarios } from "./scenario-allocations";
import { seedInvestorLedgerScenarios } from "./scenario-ledger";
import { seedInvestorPayoutScenarios } from "./scenario-payouts";
import { seedInvestorPortalScenarios } from "./scenario-portal";
import { seedInvestorProfitRunScenarios } from "./scenario-profit-runs";
import { seedInvestorStatementScenarios } from "./scenario-statements";
import type { InvestorSeedPrisma } from "./types";
import { seedInvestorUsers } from "./users";

export async function seedInvestorFoundation(
  prisma: InvestorSeedPrisma,
  adminUserId: string | null,
) {
  const userContext = await seedInvestorUsers(prisma, adminUserId);
  const foundationContext = await seedInvestorMasters(prisma, userContext);

  console.log("✅ Investor foundation seed ensured");

  return foundationContext;
}

export async function seedInvestorDemo(
  prisma: InvestorSeedPrisma,
  adminUserId: string | null,
) {
  let ctx = await seedInvestorFoundation(prisma, adminUserId);

  ctx = await seedInvestorLedgerScenarios(prisma, ctx);
  console.log("✅ Investor ledger scenarios ensured");

  ctx = await seedInvestorAllocationScenarios(prisma, ctx);
  console.log("✅ Investor allocation scenarios ensured");

  ctx = await seedInvestorProfitRunScenarios(prisma, ctx);
  console.log("✅ Investor profit run scenarios ensured");

  ctx = await seedInvestorPayoutScenarios(prisma, ctx);
  console.log("✅ Investor payout scenarios ensured");

  ctx = await seedInvestorPortalScenarios(prisma, ctx);
  console.log("✅ Investor portal scenarios ensured");

  ctx = await seedInvestorStatementScenarios(prisma, ctx);
  console.log("✅ Investor statement and exception scenarios ensured");

  console.log("✅ Investor full demo seed ensured (Pass 1 + Pass 2 + Pass 3 + Pass 4)");

  return ctx;
}
