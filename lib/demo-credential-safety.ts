import type { Prisma, PrismaClient } from "@/generated/prisma";

export const KNOWN_DEMO_ACCOUNT_EMAILS = [
  "admin@example.com",
  "customer.one@storefront.demo",
  "customer.two@storefront.demo",
  "yousuf@z.shoes.com",
  "mahin@z.shoes.com",
  "salehin@z.shoes.com",
] as const;

export const unsafeKnownDemoAccountWhere = {
  email: { in: [...KNOWN_DEMO_ACCOUNT_EMAILS] },
  OR: [
    { banned: false },
    { banned: null },
    { passwordHash: { not: null } },
  ],
} as const satisfies Prisma.UserWhereInput;

type DemoCredentialClient = PrismaClient | Prisma.TransactionClient;

export async function disableKnownDemoCredentials(db: DemoCredentialClient) {
  return db.user.updateMany({
    where: { email: { in: [...KNOWN_DEMO_ACCOUNT_EMAILS] } },
    data: {
      passwordHash: null,
      banned: true,
      banReason: "Known demo credentials disabled during universalization",
      banExpires: null,
    },
  });
}

