import { INVESTOR_ROLE_USERS, INVESTOR_SEED_PASSWORD } from "./constants";
import { upsertInvestorUserWithRole } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";

export async function seedInvestorUsers(
  prisma: InvestorSeedPrisma,
  adminUserId: string | null,
): Promise<InvestorSeedContext> {
  const users: InvestorSeedContext["users"] = {};

  for (const record of INVESTOR_ROLE_USERS) {
    const user = await upsertInvestorUserWithRole(prisma, {
      email: record.email,
      password: INVESTOR_SEED_PASSWORD,
      name: record.name,
      roleName: record.roleName,
      phone: record.phone,
      note: "Seeded investor demo user",
    });

    users[record.key] = {
      id: user.id,
      email: user.email,
      name: user.name ?? record.name,
      roleName: record.roleName,
    };
  }

  console.log(
    `✅ Investor role users ensured: ${Object.keys(users).length} accounts (password: ${INVESTOR_SEED_PASSWORD})`,
  );

  return {
    adminUserId,
    users,
    investors: {},
    variants: {},
  };
}
