import { PrismaClient } from "../generated/prisma";
import {
  disableKnownDemoCredentials,
  KNOWN_DEMO_ACCOUNT_EMAILS,
  unsafeKnownDemoAccountWhere,
} from "../lib/demo-credential-safety";

const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.user.findMany({
    where: { email: { in: [...KNOWN_DEMO_ACCOUNT_EMAILS] } },
    select: { id: true, email: true, banned: true, passwordHash: true },
    orderBy: { email: "asc" },
  });
  const unsafeCount = await prisma.user.count({ where: unsafeKnownDemoAccountWhere });

  console.log("Known demo credential audit", {
    matchedAccounts: matches.length,
    unsafeAccounts: unsafeCount,
  });

  if (unsafeCount === 0) return;
  if (process.env.ALLOW_DEMO_CREDENTIAL_DISABLE !== "true") {
    throw new Error(
      "Credential repair blocked. Set ALLOW_DEMO_CREDENTIAL_DISABLE=true after confirming the exact demo-account audit.",
    );
  }

  const result = await prisma.$transaction((tx) =>
    disableKnownDemoCredentials(tx),
  );
  const remaining = await prisma.user.count({ where: unsafeKnownDemoAccountWhere });
  if (remaining !== 0) {
    throw new Error(`${remaining} unsafe known demo credential account(s) remain.`);
  }
  console.log("Known demo credentials disabled.", { updated: result.count });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

