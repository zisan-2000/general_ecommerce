import type { PrismaClient } from "../../generated/prisma";
import source from "./banners.json";

type BannerSeedFile = {
  schemaVersion: number;
  banners: Array<{
    title: string;
    image: string;
    type: "HERO" | "BANNER1" | "BANNER2" | "PROMOTION" | "POPUP";
    position: number;
    isActive: boolean;
  }>;
};

const bannerSeed = source as BannerSeedFile;

export async function seedBanners(prisma: PrismaClient) {
  if (
    bannerSeed.schemaVersion !== 1 ||
    !Array.isArray(bannerSeed.banners) ||
    bannerSeed.banners.length === 0
  ) {
    throw new Error("Invalid banner seed file.");
  }

  for (const banner of bannerSeed.banners) {
    const { title, image, type, position, isActive } = banner;
    const data = { title, image, type, position, isActive };
    const existing = await prisma.banner.findFirst({
      where: { title },
      select: { id: true },
    });

    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data });
    } else {
      await prisma.banner.create({ data });
    }
  }

  console.log(`${bannerSeed.banners.length} banners seeded.`);
}
