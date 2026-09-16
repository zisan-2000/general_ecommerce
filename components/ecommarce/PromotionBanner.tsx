"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Banner {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image: string;
  mobileImage?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
  position: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  type: string;
}

interface PromotionBannerProps {
  banners: Banner[];
}

export default function PromotionBanner({ banners }: PromotionBannerProps) {
  const promotionBanners = banners
    .filter((b) => b.type === "PROMOTION" && b.isActive)
    .sort((a, b) => a.position - b.position)
    .slice(0, 4);

  if (!promotionBanners.length) return null;

  const count = promotionBanners.length;

  if (count === 1) {
    return (
      <section className="container px-3 py-3 sm:px-6 sm:py-8">
        <SectionHeader />

        <PromoCard
          banner={promotionBanners[0]}
          className="h-[120px] sm:h-[420px] md:h-[500px]"
          mobileCompact
        />
      </section>
    );
  }

  if (count === 2) {
    return (
      <section className="container px-3 py-3 sm:px-6 sm:py-8">
        <SectionHeader />

        {/* Mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 sm:hidden no-scrollbar">
          {promotionBanners.map((b) => (
            <PromoCard
              key={b.id}
              banner={b}
              className="h-[120px] min-w-[250px] max-w-[250px]"
              mobileCompact
            />
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 md:gap-4">
          {promotionBanners.map((b) => (
            <PromoCard key={b.id} banner={b} className="h-[340px]" />
          ))}
        </div>
      </section>
    );
  }

  if (count === 3) {
    const [featured, ...rest] = promotionBanners;

    return (
      <section className="container px-3 py-3 sm:px-6 sm:py-8">
        <SectionHeader />

        {/* Mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 sm:hidden no-scrollbar">
          {promotionBanners.map((b) => (
            <PromoCard
              key={b.id}
              banner={b}
              className="h-[120px] min-w-[250px] max-w-[250px]"
              mobileCompact
            />
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden grid-cols-1 gap-3 sm:grid md:gap-4 lg:grid-cols-2">
          <PromoCard banner={featured} className="h-[340px] lg:h-[536px]" />

          <div className="grid grid-cols-1 gap-3 md:gap-4">
            {rest.map((b) => (
              <PromoCard key={b.id} banner={b} className="h-[260px]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const [featured, second, third, fourth] = promotionBanners;

  return (
    <section className="container px-3 py-3 sm:px-4 sm:py-4">
      <SectionHeader />

      {/* Mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 sm:hidden no-scrollbar">
        {promotionBanners.map((banner) => (
          <PromoCard
            key={banner.id}
            banner={banner}
            className="h-[120px] min-w-[250px] max-w-[250px]"
            mobileCompact
          />
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden grid-cols-1 gap-3 sm:grid md:gap-4 lg:grid-cols-2">
        <PromoCard banner={featured} className="h-[340px] lg:h-[536px]" />

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <PromoCard banner={second} className="h-[260px]" />
          <PromoCard banner={third} className="h-[260px]" />
          <PromoCard banner={fourth} className="col-span-2 h-[260px]" />
        </div>
      </div>
    </section>
  );
}

function SectionHeader() {
  const t = useTranslations("Landing.Promotions");

  return (
    <div className="mb-3 flex items-center justify-between gap-3 sm:mb-6 sm:gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
          {t("title")}
        </h2>

        <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">
          {t("subtitle")}
        </p>
      </div>

      <Link
        href="/ecommerce/products"
        className="shrink-0 text-xs font-semibold text-primary underline-offset-4 transition hover:underline sm:text-sm"
      >
        {t("seeAll")}
      </Link>
    </div>
  );
}

function PromoCard({
  banner,
  className = "",
  mobileCompact = false,
}: {
  banner: Banner;
  className?: string;
  mobileCompact?: boolean;
}) {
  const t = useTranslations("Landing.Promotions");

  return (
    <Link
      href={banner.buttonLink || "/ecommerce/products"}
      className={`group relative block w-full overflow-hidden border border-border/60 bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        mobileCompact ? "rounded-2xl" : "rounded-[24px]"
      } ${className}`}
    >
      <Image
        src={banner.mobileImage || banner.image}
        alt={banner.title}
        fill
        className="object-cover transition duration-700 group-hover:scale-105"
        sizes={mobileCompact ? "250px" : "(max-width: 768px) 100vw, 50vw"}
      />

      {!mobileCompact && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

          <div className="relative z-10 flex h-full flex-col justify-between p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex w-fit rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md">
                {t("featuredDeal")}
              </span>

              {banner.subtitle && (
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                  {banner.subtitle}
                </span>
              )}
            </div>

            <div className="max-w-[75%] space-y-3">
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold uppercase leading-[1.05] tracking-tight text-white drop-shadow-md md:text-4xl">
                  {banner.title}
                </h3>

                {banner.description && (
                  <p className="max-w-lg text-sm leading-6 text-white/85 md:text-base">
                    {banner.description}
                  </p>
                )}
              </div>

              {banner.buttonText && (
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-black transition hover:bg-primary hover:text-primary-foreground"
                >
                  {banner.buttonText}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Link>
  );
}
