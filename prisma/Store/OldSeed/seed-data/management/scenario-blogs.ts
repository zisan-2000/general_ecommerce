import { MANAGEMENT_BLOGS } from "./constants";
import { daysAgo } from "./helpers";
import type { ManagementSeedContext, TxClient } from "./types";

export async function seedManagementBlogs(
  prisma: TxClient,
  ctx: ManagementSeedContext,
): Promise<ManagementSeedContext> {
  let index = 0;

  for (const item of MANAGEMENT_BLOGS) {
    const record = await prisma.blog.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        summary: item.summary,
        content: `${item.summary}\n\nThis is seeded management blog content for demo and UI testing.`,
        date: daysAgo(index + 1),
        author: item.author,
        image: item.image,
        ads: index % 2 === 0 ? "management-demo-ad" : null,
      },
      create: {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        content: `${item.summary}\n\nThis is seeded management blog content for demo and UI testing.`,
        date: daysAgo(index + 1),
        author: item.author,
        image: item.image,
        ads: index % 2 === 0 ? "management-demo-ad" : null,
      },
      select: { id: true },
    });

    ctx.blogs[item.key] = record.id;
    index += 1;
  }

  return ctx;
}
