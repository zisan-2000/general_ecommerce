import { seedScmMasters } from "./masters";
import { seedScmAlertScenarios } from "./scenario-alerts";
import { seedScmFinanceScenarios } from "./scenario-finance";
import { seedScmMaterialScenarios } from "./scenario-material";
import { seedScmProcurementScenarios } from "./scenario-procurement";
import { seedScmReceivingScenarios } from "./scenario-receiving";
import { seedScmReturnScenarios } from "./scenario-returns";
import { seedScmSlaScenarios } from "./scenario-sla";
import { seedScmTransferScenarios } from "./scenario-transfers";
import type { ScmSeedPrisma } from "./types";
import { seedScmUsers } from "./users";

export async function seedScmFoundation(
  prisma: ScmSeedPrisma,
  adminUserId: string | null,
) {
  const userContext = await seedScmUsers(prisma, adminUserId);
  const foundationContext = await seedScmMasters(prisma, userContext);

  console.log("✅ SCM foundation seed ensured");

  return foundationContext;
}

export async function seedScmDemo(
  prisma: ScmSeedPrisma,
  adminUserId: string | null,
) {
  let ctx = await seedScmFoundation(prisma, adminUserId);

  ctx = await seedScmProcurementScenarios(prisma, ctx);
  console.log("✅ SCM procurement scenarios ensured");

  ctx = await seedScmReceivingScenarios(prisma, ctx);
  console.log("✅ SCM receiving scenarios ensured");

  ctx = await seedScmFinanceScenarios(prisma, ctx);
  console.log("✅ SCM finance scenarios ensured");

  ctx = await seedScmReturnScenarios(prisma, ctx);
  console.log("✅ SCM return scenarios ensured");

  ctx = await seedScmMaterialScenarios(prisma, ctx);
  console.log("✅ SCM material scenarios ensured");

  ctx = await seedScmTransferScenarios(prisma, ctx);
  console.log("✅ SCM transfer scenarios ensured");

  ctx = await seedScmSlaScenarios(prisma, ctx);
  console.log("✅ SCM SLA scenarios ensured");

  ctx = await seedScmAlertScenarios(prisma, ctx);
  console.log("✅ SCM alert scenarios ensured");

  console.log("✅ SCM full demo seed ensured");

  return ctx;
}
