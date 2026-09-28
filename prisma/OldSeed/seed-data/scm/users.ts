import { SCM_ROLE_USERS, SCM_SEED_PASSWORD } from "./constants";
import { upsertUserWithRole } from "./helpers";
import type { ScmSeedContext, ScmSeedPrisma } from "./types";

export async function seedScmUsers(
  prisma: ScmSeedPrisma,
  adminUserId: string | null,
): Promise<ScmSeedContext> {
  const users: ScmSeedContext["users"] = {};

  for (const record of SCM_ROLE_USERS) {
    const user = await upsertUserWithRole(prisma, {
      email: record.email,
      password: SCM_SEED_PASSWORD,
      name: record.name,
      roleName: record.roleName,
      phone: record.phone,
      note: "Seeded SCM demo user",
    });

    users[record.key] = {
      id: user.id,
      email: user.email,
      name: user.name ?? record.name,
      roleName: record.roleName,
    };
  }

  console.log(
    `✅ SCM role users ensured: ${Object.keys(users).length} accounts (password: ${SCM_SEED_PASSWORD})`,
  );

  return {
    adminUserId,
    users,
    warehouses: {},
    suppliers: {},
    variants: {},
  };
}
