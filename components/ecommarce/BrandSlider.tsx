"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cachedFetchJson } from "@/lib/client-cache-fetch";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

type Brand = {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function BrandSlider({
  title,
  subtitle,
  limit = 20,
}: {
  title?: string;
  subtitle?: string;
  limit?: number;
}) {
  const t = useTranslations("Landing.Brands");

  const resolvedTitle = title ?? t("title");
  const resolvedSubtitle = subtitle ?? t("subtitle");

  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const brandsData = await cachedFetchJson<Brand[]>(
          "/api/brands?view=storefront",
          {
            ttlMs: 5 * 60 * 1000,
          },
        );

        if (!mounted) return;

        setBrands(Array.isArray(brandsData) ? brandsData : []);
      } catch (e: any) {
        if (!mounted) return;

        setError(e?.message || t("loadError"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [t]);

  const visible = useMemo(
    () =>
      [...brands]
        .filter((brand) => brand.productCount > 0)
        .sort(
          (first, second) =>
            second.productCount - first.productCount ||
            first.name.localeCompare(second.name),
        )
        .slice(0, limit),
    [brands, limit],
  );

  const updateScrollControls = useCallback(() => {
    const element = scrollerRef.current;

    if (!element) return;

    const maxScrollLeft = Math.max(
      0,
      element.scrollWidth - element.clientWidth,
    );

    setCanScrollLeft(element.scrollLeft > 2);
    setCanScrollRight(element.scrollLeft < maxScrollLeft - 2);
  }, []);

  useEffect(() => {
    const element = scrollerRef.current;

    if (!element) return;

    const frame = window.requestAnimationFrame(updateScrollControls);

    element.addEventListener("scroll", updateScrollControls, {
      passive: true,
    });

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollControls);

    observer?.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener("scroll", updateScrollControls);
      observer?.disconnect();
    };
  }, [updateScrollControls, visible.length]);

  const scrollByCards = (direction: "left" | "right") => {
    const element = scrollerRef.current;

    if (!element) return;

    const card = element.querySelector<HTMLElement>(
      "[data-brand-card='1']",
    );

    const cardWidth = card ? card.offsetWidth : 108;

    const distance = Math.max(
      cardWidth * 5,
      element.clientWidth * 0.75,
    );

    element.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  return (
    <section className="w-full bg-background">
      <div className="container px-3 py-5 sm:px-5 sm:py-7">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-foreground sm:text-[24px]">
              {resolvedTitle}
            </h2>

            <p className="mt-1 text-[12px] text-muted-foreground sm:text-[13px]">
              {resolvedSubtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByCards("left")}
              disabled={!canScrollLeft}
              aria-label={t("previous")}
              className="
                inline-flex h-9 w-9
                items-center justify-center
                rounded-full
                border border-border
                bg-card
                text-muted-foreground
                shadow-sm
                transition-all
                hover:border-interaction/40
                hover:bg-interaction
                hover:text-interaction-foreground
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => scrollByCards("right")}
              disabled={!canScrollRight}
              aria-label={t("next")}
              className="
                inline-flex h-9 w-9
                items-center justify-center
                rounded-full
                border border-border
                bg-card
                text-muted-foreground
                shadow-sm
                transition-all
                hover:border-interaction/40
                hover:bg-interaction
                hover:text-interaction-foreground
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <Link
              href="/ecommerce/brands"
              className="
                hidden h-9
                items-center gap-1
                rounded-full
                border border-border
                bg-card
                px-4
                text-[11px]
                font-semibold
                text-foreground
                shadow-sm
                transition
                hover:border-interaction
                hover:text-interaction
                sm:inline-flex
              "
            >
              {t("viewAll")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Slider */}
        <div className="relative">
          <div
            ref={scrollerRef}
            className="
              no-scrollbar
              flex snap-x snap-mandatory
              gap-3 overflow-x-auto
              scroll-smooth
              px-1 pb-3
              sm:gap-4
              md:gap-5
            "
          >
            {loading
              ? Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="
                      h-[84px] w-[84px] min-w-[84px]
                      animate-pulse
                      rounded-xl
                      border border-border
                      bg-muted
                      sm:h-[96px] sm:w-[96px] sm:min-w-[96px]
                      lg:h-[108px] lg:w-[108px] lg:min-w-[108px]
                    "
                  />
                ))
              : visible.map((brand) => (
                  <Link
                    key={brand.id}
                    data-brand-card="1"
                    href={`/ecommerce/products?brand=${encodeURIComponent(
                      brand.slug,
                    )}`}
                    aria-label={`Shop ${brand.name}`}
                    title={brand.name}
                    className="
                      group
                      relative
                      flex
                      h-[84px] w-[84px] min-w-[84px]
                      snap-start
                      items-center justify-center
                      overflow-hidden
                      rounded-xl
                      border border-slate-200/80
                      bg-white
                      shadow-[0_3px_12px_rgba(15,23,42,0.05)]
                      transition-all
                      duration-300

                      hover:-translate-y-1
                      hover:border-interaction/30
                      hover:shadow-[0_10px_26px_rgba(15,23,42,0.10)]

                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-primary/30

                      sm:h-[96px] sm:w-[96px] sm:min-w-[96px]
                      lg:h-[108px] lg:w-[108px] lg:min-w-[108px]
                    "
                  >
                    {/* Subtle premium background */}
                    <div
                      className="
                        pointer-events-none
                        absolute inset-0
                        bg-gradient-to-br
                        from-white
                        via-white
                        to-slate-50
                      "
                    />

                    {/* Hover glow */}
                    <div
                      className="
                        pointer-events-none
                        absolute -right-10 -top-10
                        h-20 w-20
                        rounded-full
                        bg-primary/0
                        blur-2xl
                        transition-all
                        duration-300
                        group-hover:bg-primary/10
                      "
                    />

                    {/* Logo */}
                    {brand.logo ? (
                      <div
                        className="
                          relative z-10
                          h-[44px] w-[58px]
                          transition-transform
                          duration-300
                          group-hover:scale-105

                          sm:h-[50px] sm:w-[68px]
                          lg:h-[56px] lg:w-[76px]
                        "
                      >
                        <Image
                          src={brand.logo}
                          alt={`${brand.name} logo`}
                          fill
                          sizes="
                            (max-width: 640px) 58px,
                            (max-width: 1024px) 68px,
                            76px
                          "
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <span
                        className="
                          relative z-10
                          max-w-[75%]
                          truncate
                          text-center
                          text-[11px]
                          font-black
                          uppercase
                          tracking-[-0.03em]
                          text-slate-700
                        "
                      >
                        {brand.name}
                      </span>
                    )}
                  </Link>
                ))}
          </div>

          {!loading && !error && visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-[12px] text-muted-foreground">
              Brand logos will appear here when products are available.
            </div>
          ) : null}
        </div>

        {/* Mobile View All */}
        <div className="mt-2 flex justify-center sm:hidden">
          <Link
            href="/ecommerce/brands"
            className="
              inline-flex h-9
              items-center gap-1.5
              rounded-full
              border border-border
              bg-card
              px-4
              text-[11px]
              font-semibold
              text-foreground
              shadow-sm
            "
          >
            {t("viewAll")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}