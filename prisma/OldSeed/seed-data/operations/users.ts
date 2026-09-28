import bcrypt from "bcrypt";
import { OPERATION_USERS, OPERATIONS_PASSWORD } from "./constants";
import type { OperationsSeedContext, TxClient } from "./types";

export async function seedOperationsUsers(
  prisma: TxClient,
  ctx: OperationsSeedContext,
): Promise<OperationsSeedContext> {
  const passwordHash = await bcrypt.hash(OPERATIONS_PASSWORD, 10);

  for (const user of OPERATION_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        phone: user.phone,
        role: user.role,
        passwordHash,
        emailVerified: new Date(),
        banned: false,
        banReason: null,
        banExpires: null,
        note: "Seeded operations demo user",
      },
      create: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        passwordHash,
        emailVerified: new Date(),
        note: "Seeded operations demo user",
      },
      select: { id: true },
    });

    ctx.users[user.key] = record.id;
  }

  return ctx;
}
