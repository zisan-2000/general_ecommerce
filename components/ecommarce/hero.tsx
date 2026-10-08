"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cachedFetchJson } from "@/lib/client-cache-fetch";
import { cn } from "@/lib/utils";

interface Banner {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image: string;
  mobileImage?: string | null;
  buttonText?: string | null;
  type: string;
  position: number;
  isActive: boolean;
  href?: string;
}

type Props = {
  heroInterval?: number;
  banner1Interval?: number;
  banner2Interval?: number;
  bannersData?: Banner[];
};

type SideBannerProps = {
  slides: Banner[];
  current: number;
  onSelect: (index: number) => void;
  priority?: boolean;
};

const FALLBACK_LINK = "/ecommerce/products";

function SideBanner({
  slides,
  current,
  onSelect,
  priority = false,
}: SideBannerProps) {
  if (slides.length === 0) return null;

  return (
    <div className="group/side relative h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
      {slides.map((banner, index) => (
        <article
          key={banner.id}
          aria-hidden={index !== current}
          className={cn(
            "absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none",
            index === current
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <Link
            href={banner.href ?? FALLBACK_LINK}
            aria-label={`${banner.title}${banner.buttonText ? ` — ${banner.buttonText}` : ""}`}
            tabIndex={index === current ? 0 : -1}
            className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <Image
              src={banner.image}
              alt={banner.title}
              fill
              priority={priority && index === 0}
              className="object-cover transition-transform duration-700 group-hover/side:scale-[1.025] motion-reduce:transition-none"
              sizes="(max-width: 1023px) 100vw, 32vw"
            />
          </Link>
        </article>
      ))}

      {slides.length > 1 ? (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-1 shadow-sm backdrop-blur-sm">
          {slides.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Show ${banner.title}`}
              aria-current={index === current ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                index === current ? "w-5 bg-primary" : "w-1.5 bg-slate-300",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Hero({
  heroInterval = 6000,
  banner1Interval = 7000,
  banner2Interval = 8000,
  bannersData,
}: Props) {
  const [banners, setBanners] = useState<Banner[]>(() =>
    (bannersData ?? []).filter(
      (banner) => banner.isActive && banner.type !== "POPUP",
    ),
  );
  const [currentHero, setCurrentHero] = useState(0);
  const [currentBanner1, setCurrentBanner1] = useState(0);
  const [currentBanner2, setCurrentBanner2] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(false);

  useEffect(() => {
    if (bannersData) return;

    let cancelled = false;
    const load = async () => {
      try {
        const data = await cachedFetchJson<Banner[]>(
          "/api/banners?view=storefront&active=true",
          { ttlMs: 2 * 60 * 1000 },
        );
        if (!cancelled) {
          setBanners(
            data.filter((banner) => banner.isActive && banner.type !== "POPUP"),
          );
        }
      } catch (error) {
        console.error("Failed to load homepage banners", error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bannersData]);

  const heroSlides = useMemo(
    () =>
      banners
        .filter((banner) => banner.type === "HERO")
        .sort((a, b) => a.position - b.position),
    [banners],
  );
  const banner1Slides = useMemo(
    () =>
      banners
        .filter((banner) => banner.type === "BANNER1")
        .sort((a, b) => a.position - b.position),
    [banners],
  );
  const banner2Slides = useMemo(
    () =>
      banners
        .filter((banner) => banner.type === "BANNER2")
        .sort((a, b) => a.position - b.position),
    [banners],
  );

  useEffect(() => {
    setCurrentHero((current) =>
      Math.min(current, Math.max(heroSlides.length - 1, 0)),
    );
  }, [heroSlides.length]);
  useEffect(() => {
    setCurrentBanner1((current) =>
      Math.min(current, Math.max(banner1Slides.length - 1, 0)),
    );
  }, [banner1Slides.length]);
  useEffect(() => {
    setCurrentBanner2((current) =>
      Math.min(current, Math.max(banner2Slides.length - 1, 0)),
    );
  }, [banner2Slides.length]);

  useEffect(() => {
    if (autoplayPaused || heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentHero((current) => (current + 1) % heroSlides.length);
    }, heroInterval);
    return () => window.clearInterval(timer);
  }, [autoplayPaused, heroInterval, heroSlides.length]);

  useEffect(() => {
    if (autoplayPaused || banner1Slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentBanner1((current) => (current + 1) % banner1Slides.length);
    }, banner1Interval);
    return () => window.clearInterval(timer);
  }, [autoplayPaused, banner1Interval, banner1Slides.length]);

  useEffect(() => {
    if (autoplayPaused || banner2Slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentBanner2((current) => (current + 1) % banner2Slides.length);
    }, banner2Interval);
    return () => window.clearInterval(timer);
  }, [autoplayPaused, banner2Interval, banner2Slides.length]);

  if (heroSlides.length === 0) return null;

  const hasSideBanners = banner1Slides.length > 0 || banner2Slides.length > 0;
  const showPreviousHero = () =>
    setCurrentHero(
      (current) => (current - 1 + heroSlides.length) % heroSlides.length,
    );
  const showNextHero = () =>
    setCurrentHero((current) => (current + 1) % heroSlides.length);

  return (
    <section
      aria-label="Featured promotions"
      aria-roledescription="carousel"
      className="w-full bg-background"
      onMouseEnter={() => setAutoplayPaused(true)}
      onMouseLeave={() => setAutoplayPaused(false)}
      onFocusCapture={() => setAutoplayPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setAutoplayPaused(false);
        }
      }}
    >
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 lg:px-6 lg:py-5">
        <div
          className={cn(
            "grid gap-3",
            hasSideBanners
              ? "lg:h-[clamp(350px,25.8vw,420px)] lg:grid-cols-[minmax(0,2.28fr)_minmax(320px,1fr)]"
              : "lg:h-[clamp(350px,25.8vw,420px)] lg:grid-cols-1",
          )}
        >
          <div className="group/hero relative aspect-[16/9] min-h-0 overflow-hidden rounded-xl bg-slate-950 shadow-[0_3px_16px_rgba(15,23,42,0.10)] sm:aspect-[2/1] lg:aspect-auto lg:h-full">
            {heroSlides.map((banner, index) => (
              <article
                key={banner.id}
                aria-hidden={index !== currentHero}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none",
                  index === currentHero
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0",
                )}
              >
                <Link
                  href={banner.href ?? FALLBACK_LINK}
                  aria-label={`${banner.title}${banner.buttonText ? ` — ${banner.buttonText}` : ""}`}
                  tabIndex={index === currentHero ? 0 : -1}
                  className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                >
                  <Image
                    src={banner.image}
                    alt={banner.title}
                    fill
                    priority={index === 0}
                    className="object-cover transition-transform duration-1000 group-hover/hero:scale-[1.018] motion-reduce:transition-none"
                    sizes="(max-width: 1023px) 100vw, 69vw"
                  />
                </Link>
              </article>
            ))}

            {heroSlides.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPreviousHero}
                  aria-label="Show previous promotion"
                  className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-[0_3px_12px_rgba(15,23,42,0.18)] transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:left-4 sm:h-11 sm:w-11"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={showNextHero}
                  aria-label="Show next promotion"
                  className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-[0_3px_12px_rgba(15,23,42,0.18)] transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-4 sm:h-11 sm:w-11"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/35 px-3 py-2 backdrop-blur-sm">
                  {heroSlides.map((banner, index) => (
                    <button
                      key={banner.id}
                      type="button"
                      onClick={() => setCurrentHero(index)}
                      aria-label={`Show ${banner.title}`}
                      aria-current={index === currentHero ? "true" : undefined}
                      className={cn(
                        "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                        index === currentHero
                          ? "w-8 bg-white"
                          : "w-2 bg-white/55 hover:bg-white/80",
                      )}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {hasSideBanners ? (
            <div className="grid min-h-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
              {banner1Slides.length > 0 ? (
                <div className="relative aspect-[9/4] min-h-0 lg:aspect-auto">
                  <SideBanner
                    slides={banner1Slides}
                    current={currentBanner1}
                    onSelect={setCurrentBanner1}
                    priority
                  />
                </div>
              ) : null}
              {banner2Slides.length > 0 ? (
                <div className="relative aspect-[9/4] min-h-0 lg:aspect-auto">
                  <SideBanner
                    slides={banner2Slides}
                    current={currentBanner2}
                    onSelect={setCurrentBanner2}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
