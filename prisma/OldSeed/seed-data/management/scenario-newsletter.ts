import {
  MANAGEMENT_NEWSLETTER_SUBSCRIBERS,
  MANAGEMENT_NEWSLETTERS,
} from "./constants";
import { daysAgo } from "./helpers";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementNewsletter(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  for (const item of MANAGEMENT_NEWSLETTER_SUBSCRIBERS) {
    const record = await prisma.newsletterSubscriber.upsert({
      where: { email: item.email },
      update: {
        status: item.status,
        unsubscribedAt: item.status === "unsubscribed" ? daysAgo(5) : null,
      },
      create: {
        email: item.email,
        status: item.status,
        unsubscribedAt: item.status === "unsubscribed" ? daysAgo(5) : null,
      },
      select: { id: true },
    });

    ctx.subscribers[item.key] = record.id;
  }

  for (const item of MANAGEMENT_NEWSLETTERS) {
    const existing = await prisma.newsletter.findFirst({
      where: { title: item.title },
      select: { id: true },
    });

    const data = {
      title: item.title,
      subject: item.subject,
      content: `Seeded newsletter: ${item.subject}. This content is for management newsletter UI testing.`,
      status: item.status,
      sentAt: item.status === "sent" ? daysAgo(3) : null,
    };

    const record = existing
      ? await prisma.newsletter.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await prisma.newsletter.create({
          data,
          select: { id: true },
        });

    ctx.newsletters[item.key] = record.id;
  }

  return ctx;
}
