"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cachedFetchJson } from "@/lib/client-cache-fetch";
import { DEFAULT_SITE_TITLE } from "@/lib/site-defaults";
import {
  compareCategoryNavigation,
  getEffectiveCategoryNavigationIds,
} from "@/lib/category-navigation";
import SpotlightCard from "../SpotlightCard";
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
  CircleHelp,
  Shield,
  Truck,
  HeadphonesIcon,
  Send,
  Heart,
  CreditCard,
  Clock,
  ChevronRight,
  Award,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type ApiCategory = {
  id: number | string;
  name: string;
  slug?: string | null;
  parentId?: number | string | null;
  isActive?: boolean;
  sortOrder?: number;
  showInHeader?: boolean;
  showInFooter?: boolean;
  featured?: boolean;
};

function footerCategoryLinks(input: ApiCategory[]) {
  const normalized = input.map((category) => ({
    ...category,
    id: Number(category.id),
    parentId:
      category.parentId === null || category.parentId === undefined
        ? null
        : Number(category.parentId),
    isActive: category.isActive !== false,
    sortOrder: Number.isInteger(Number(category.sortOrder)) ? Number(category.sortOrder) : 0,
    showInHeader: category.showInHeader !== false,
    showInFooter: category.showInFooter !== false,
    featured: category.featured === true,
  })).filter((category) => Number.isFinite(category.id));
  const visibleIds = getEffectiveCategoryNavigationIds(normalized, "footer");
  return normalized
    .filter((category) => category.parentId === null && visibleIds.has(category.id))
    .sort(compareCategoryNavigation)
    .map((category) => ({
      href: `/ecommerce/products?category=${encodeURIComponent(String(category.slug ?? category.id))}`,
      label: String(category.name ?? "").trim(),
    }))
    .filter((category) => category.label);
}

type SiteSettings = {
  logo?: string | null;
  siteTitle?: string | null;
  storeName?: string | null;
  storeTagline?: string | null;
  footerDescription?: string | null;
  contactNumber?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  facebookLink?: string | null;
  instagramLink?: string | null;
  twitterLink?: string | null;
  tiktokLink?: string | null;
  youtubeLink?: string | null;
};

export default function Footer({
  siteSettingsData,
  categoriesData,
}: {
  siteSettingsData?: SiteSettings;
  categoriesData?: ApiCategory[];
}) {
  const t = useTranslations("StorefrontShell.footer");
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Site settings
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(
    siteSettingsData ?? {},
  );

  // Load site settings
  useEffect(() => {
    const loadSiteSettings = async () => {
      try {
        const data =
          siteSettingsData ??
          (await cachedFetchJson<any>("/api/site?view=storefront", {
            ttlMs: 5 * 60 * 1000,
          }));
        setSiteSettings(data);
      } catch (error) {
        console.error("Failed to load site settings:", error);
      }
    };

    loadSiteSettings();
  }, [siteSettingsData]);

  // ✅ categories from API
  const [categories, setCategories] = useState<
    Array<{ href: string; label: string }>
  >(() => footerCategoryLinks(categoriesData ?? []));

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      try {
        const data =
          categoriesData ??
          ((await cachedFetchJson<ApiCategory[]>("/api/categories?view=storefront", {
            ttlMs: 5 * 60 * 1000,
          })) as ApiCategory[]);
        if (!mounted) return;

        const list = Array.isArray(data) ? data : [];

        setCategories(footerCategoryLinks(list));
      } catch (e) {
        // fail silently in footer
        console.error("Failed to load categories:", e);
      }
    };

    loadCategories();
    return () => {
      mounted = false;
    };
  }, [categoriesData]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error(t("newsletter.errors.emailRequired"));
      return;
    }

    setIsSubscribing(true);

    try {
      const checkRes = await fetch("/api/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const check = await checkRes.json();

      if (!check.valid) {
        toast.error(t("newsletter.errors.invalidOrExists"));
        setIsSubscribing(false);
        return;
      }

      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        toast.success(t("newsletter.success"));
        setEmail("");
      } else {
        toast.error(t("newsletter.errors.failed"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("newsletter.errors.tryAgain"));
    } finally {
      setIsSubscribing(false);
    }
  };

  const features = [
    { icon: Truck, label: t("features.delivery.label"), desc: t("features.delivery.description") },
    { icon: Clock, label: t("features.ordering.label"), desc: t("features.ordering.description") },
    { icon: CreditCard, label: t("features.payment.label"), desc: t("features.payment.description") },
    {
      icon: Award,
      label: t("features.authentic.label"),
      desc: t("features.authentic.description"),
    },
  ];

  const quickLinks = [
    { href: "/ecommerce/products", label: t("links.allProducts") },
    { href: "/ecommerce/flash-sale", label: t("links.flashSale") },
    { href: "/ecommerce/blogs", label: t("links.blogs") },
    { href: "/ecommerce/bestsellers", label: t("links.bestsellers") },
    { href: "/ecommerce/about", label: t("links.about") },
    { href: "/ecommerce/contact", label: t("links.contact") },
  ];

  const customerService = [
    { href: "/ecommerce/shipping", label: t("links.shippingPolicy"), icon: Truck },
    {
      href: "/ecommerce/returns",
      label: t("links.returnPolicy"),
      icon: HeadphonesIcon,
    },
    { href: "/ecommerce/privacy", label: t("links.privacyPolicy"), icon: Shield },
    { href: "/ecommerce/faq", label: t("links.faq"), icon: CircleHelp },
  ];

  const socialLinks = [
    { icon: Facebook, href: siteSettings.facebookLink, label: "Facebook" },
    { icon: Instagram, href: siteSettings.instagramLink, label: "Instagram" },
    { icon: Twitter, href: siteSettings.twitterLink, label: "Twitter" },
    { icon: Youtube, href: siteSettings.youtubeLink, label: "YouTube" },
  ].filter((social): social is typeof social & { href: string } =>
    Boolean(social.href),
  );

  return (
    <footer className="bg-card border-t border-border">
      {/* Features Bar */}
      <div className="border-b border-border bg-muted/30 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {feature.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-3 space-y-6">
            <Link href="/" className="inline-block group">
              <div className="flex items-center gap-3">
                <div className="bg-primary rounded-2xl text-primary-foreground">
                  <Image
                    src={siteSettings.logo || "/assets/examplelogo.jpg"}
                    alt={t("logoAlt")}
                    width={50}
                    height={50}
                    className="object-contain rounded-2xl"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    {siteSettings.storeName?.trim() ||
                      siteSettings.siteTitle?.trim() ||
                      DEFAULT_SITE_TITLE}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {siteSettings.storeTagline ||
                      t("brand.defaultTagline")}
                  </p>
                </div>
              </div>
            </Link>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {siteSettings.footerDescription ||
                t("brand.defaultDescription")}
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("contact.callUs")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {siteSettings.contactNumber || t("contact.phoneUnavailable")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("contact.emailUs")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {siteSettings.contactEmail || t("contact.emailUnavailable")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 group cursor-pointer">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 mt-1">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("contact.address")}</p>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {siteSettings.address || t("contact.addressUnavailable")}
                  </p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className={`lg:col-span-6 grid gap-6 ${categories.length > 0 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            {/* Quick Links */}
            <div className="relative">
              <div className="absolute -left-3 top-0 w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {t("sections.quickLinks")}
              </h3>
              <ul className="space-y-1.5">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground hover:pl-2 flex items-center gap-2 group transition-all duration-300 relative"
                    >
                      <span className="absolute left-0 w-0 h-px bg-primary group-hover:w-4 transition-all duration-300" />
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      <span className="group-hover:font-medium">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* ✅ Categories (from /api/categories) - Only show if categories exist */}
            {categories.length > 0 && (
              <div className="relative">
                <div className="absolute -left-3 top-0 w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {t("sections.categories")}
                </h3>
                <ul className="space-y-1.5">
                  {categories.slice(0, 10).map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground hover:pl-2 flex items-center gap-2 group transition-all duration-300 relative"
                      >
                        <span className="absolute left-0 w-0 h-px bg-primary group-hover:w-4 transition-all duration-300" />
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                        <span className="group-hover:font-medium">{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Customer Service */}
            <div className="relative">
              <div className="absolute -left-3 top-0 w-1 h-6 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {t("sections.customerService")}
              </h3>
              <ul className="space-y-1.5">
                {customerService.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground hover:pl-2 flex items-center gap-2 group transition-all duration-300 relative"
                    >
                      <span className="absolute left-0 w-0 h-px bg-primary group-hover:w-4 transition-all duration-300" />
                      <link.icon className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors duration-300" />
                      <span className="group-hover:font-medium">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter Column */}
          <div className="lg:col-span-3">
            <SpotlightCard
              className="!p-0 !border-border !bg-card !rounded-xl overflow-hidden"
              spotlightColor="rgba(0, 229, 255, 0.1)"
            >
              <div className="bg-muted/30 rounded-xl p-6 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t("newsletter.title")}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("newsletter.description")}
                </p>

                <form onSubmit={handleSubscribe} className="space-y-3">
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder={t("newsletter.placeholder")}
                      aria-label={t("newsletter.emailLabel")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-background border-border text-foreground placeholder:text-muted-foreground/50 pr-10"
                    />
                    <Send className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubscribing}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 disabled:opacity-50"
                  >
                    {isSubscribing ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        {t("newsletter.subscribing")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t("newsletter.subscribe")}
                        <Send className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      {t("secureTransactions")}
                    </p>
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">
              {t("rights", {
                year: currentYear,
                site: siteSettings.siteTitle?.trim() || DEFAULT_SITE_TITLE,
              })}
            </p>

            <div className="flex items-center gap-6">
              {[
                { href: "/ecommerce/privacy", label: t("links.privacyPolicy") },
                { href: "/ecommerce/terms", label: t("links.terms") },
                { href: "/sitemap.xml", label: t("links.sitemap") },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-background border border-border rounded text-xs text-muted-foreground">
                Visa
              </div>
              <div className="px-2 py-1 bg-background border border-border rounded text-xs text-muted-foreground">
                Mastercard
              </div>
              <div className="px-2 py-1 bg-background border border-border rounded text-xs text-muted-foreground">
                bkash
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
