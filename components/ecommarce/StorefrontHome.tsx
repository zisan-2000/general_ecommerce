"use client";

import { useSession } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import type { StorefrontHomeData } from "@/lib/storefront-home";

import Header from "@/components/ecommarce/header";
import Hero from "@/components/ecommarce/hero";
import FeatureStrip from "@/components/ecommarce/FeatureCard";
import FeaturedCategories from "@/components/ecommarce/FeaturedCategories";
import FlashSale from "@/components/ecommarce/FlashSale";
import NewArrivals from "@/components/ecommarce/NewArrivals";
import BrandSlider from "@/components/ecommarce/BrandSlider";
import FeaturedProducts from "@/components/ecommarce/FeaturedProducts";
import PromotionBanner from "@/components/ecommarce/PromotionBanner";
import BestSelling from "@/components/ecommarce/BestSelling";
import PopupBanner from "@/components/ecommarce/PopupBanner";
import FloatingCartButton from "@/components/ecommarce/FloatingCartButton";
import ReviewCarousel from "@/components/ecommarce/ReviewCarosol";
import Footer from "@/components/ecommarce/footer";
import ProductRichText from "@/components/ecommarce/product-detail/ProductRichText";

import { ChevronDown } from "lucide-react";

export default function StorefrontHome({
  data,
  loadError = false,
}: {
  data: StorefrontHomeData;
  loadError?: boolean;
}) {
  const t = useTranslations("Landing.Home");

  const { status } = useSession();

  const isAuthenticated = status === "authenticated";

  const heroBanners = data.banners.map((banner) => ({
    ...banner,
    href: banner.buttonLink ?? undefined,
  }));

  const homeFooterDescription =
    data.siteSettings.homeFooterDescription?.trim();

  const shouldShowHomeFooterDescription =
    data.siteSettings.homeFooterDescriptionEnabled === true &&
    Boolean(homeFooterDescription);

  const homeFooterDescriptionTitle =
    data.siteSettings.homeFooterDescriptionTitle?.trim() ||
    `About ${
      data.siteSettings.storeName?.trim() ||
      data.siteSettings.siteTitle?.trim() ||
      "our store"
    }`;

  return (
    <div className="storefront-type min-h-screen w-full bg-background">
      {/* Header */}
      <Header
        siteSettingsData={data.siteSettings}
        categoriesData={data.categories}
      />

      {/* Main Content */}
      <main className="container mx-auto">
        {loadError ? (
          <div className="mx-3 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:mx-6">
            {t("dataLoadError")}
          </div>
        ) : null}

        <Hero bannersData={heroBanners} />

        <FeatureStrip />

        <FeaturedCategories categoriesData={data.categories} />

        <FlashSale
          productsData={data.flashSaleProducts}
          isAuthenticated={isAuthenticated}
        />

        <NewArrivals
          productsData={data.products}
          categoriesData={data.categories}
          reviewsData={[]}
          isAuthenticated={isAuthenticated}
        />

        <BrandSlider />

        <FeaturedProducts
          productsData={data.products}
          categoriesData={data.categories}
          reviewsData={[]}
          isAuthenticated={isAuthenticated}
        />

        <PromotionBanner banners={data.banners} />

        {/* Best Selling */}
        <BestSelling
          limit={20}
          topSellingData={data.topSellingProducts}
          reviewsData={[]}
          isAuthenticated={isAuthenticated}
        />

        {/* =====================================================
            SAME WIDTH SEPARATOR
        ====================================================== */}
        <div className="px-5 sm:px-6">
          <div className="h-px w-full bg-border/70" />
        </div>

        {/* =====================================================
            HOME FOOTER / SEO DESCRIPTION
        ====================================================== */}
        {shouldShowHomeFooterDescription ? (
          <section className="px-5 pb-6 sm:px-6 sm:pb-8">
            <details className="group" open>
              <summary
                className="
                  flex
                  cursor-pointer
                  list-none
                  items-center
                  justify-between
                  gap-4
                  py-5
                  text-sm
                  font-semibold
                  text-foreground
                  marker:content-none
                  sm:text-base
                "
              >
                <span className="min-w-0">
                  {homeFooterDescriptionTitle}
                </span>

                <ChevronDown
                  className="
                    h-5
                    w-5
                    shrink-0
                    text-muted-foreground
                    transition-transform
                    duration-200
                    group-open:rotate-180
                  "
                  aria-hidden="true"
                />
              </summary>

              <div className="pb-4">
                <ProductRichText
                  content={homeFooterDescription!}
                  className="
                    text-sm
                    leading-7
                    text-muted-foreground

                    [&_h1]:mb-4
                    [&_h1]:mt-6
                    [&_h1]:text-2xl
                    [&_h1]:font-bold
                    [&_h1]:text-foreground

                    [&_h2]:mb-3
                    [&_h2]:mt-6
                    [&_h2]:text-xl
                    [&_h2]:font-bold
                    [&_h2]:text-foreground

                    [&_h3]:mb-2
                    [&_h3]:mt-5
                    [&_h3]:text-lg
                    [&_h3]:font-semibold
                    [&_h3]:text-foreground

                    [&_p]:mb-4

                    [&_a]:font-medium
                    [&_a]:text-primary
                    [&_a]:underline-offset-2
                    hover:[&_a]:underline

                    [&_strong]:font-semibold
                    [&_strong]:text-foreground

                    [&_ul]:my-3
                    [&_ul]:list-disc
                    [&_ul]:pl-5

                    [&_ol]:my-3
                    [&_ol]:list-decimal
                    [&_ol]:pl-5

                    [&_li]:mb-1
                  "
                />
              </div>
            </details>
          </section>
        ) : null}

        <PopupBanner banners={data.banners} />
      </main>

      <FloatingCartButton />

      <ReviewCarousel />

      <Footer
        siteSettingsData={data.siteSettings}
        categoriesData={data.categories}
      />
    </div>
  );
}