import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  resolveSiteSettings,
  type ResolvedSiteSettings,
} from "@/lib/site-settings";

export type SiteSettingsSeo = ResolvedSiteSettings;

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function toAbsoluteUrl(path?: string | null) {
  const siteUrl = getSiteUrl();

  if (!path) return siteUrl;
  if (/^https?:\/\//i.test(path)) return path;

  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function stripHtml(html?: string | null) {
  if (!html) return "";

  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, " ")
    .replace(/<script[^>]*>.*?<\/script>/gis, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(text: string, maxLength = 160) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const shortened = normalized.slice(0, maxLength);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}...`;
}

const loadSiteSettingsForSeo = unstable_cache(async (): Promise<SiteSettingsSeo> => {
  try {
    const [settings, rootCategories] = await Promise.all([
      prisma.sitesettings.findFirst({
        orderBy: { id: "asc" },
        select: {
          siteTitle: true,
          storeName: true,
          storeTagline: true,
          defaultSeoTitle: true,
          defaultSeoDescription: true,
          defaultSeoKeywords: true,
          defaultOgImage: true,
          favicon: true,
          currency: true,
          currencyPosition: true,
          timezone: true,
          locale: true,
          storeType: true,
          footerDescription: true,
          logo: true,
          contactEmail: true,
          contactNumber: true,
          address: true,
          facebookLink: true,
          instagramLink: true,
          twitterLink: true,
          tiktokLink: true,
          youtubeLink: true,
        },
      }),
      prisma.category.findMany({
        where: { deleted: false, isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 20,
        select: { name: true },
      }),
    ]);

    return resolveSiteSettings(
      settings,
      rootCategories.map((category) => category.name),
    );
  } catch {
    return resolveSiteSettings();
  }
}, ["site-settings-seo"], { revalidate: 3600, tags: ["site-settings"] });

export async function getSiteSettingsForSeo(): Promise<SiteSettingsSeo> {
  return loadSiteSettingsForSeo();
}

export async function buildDefaultMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const settings = await getSiteSettingsForSeo();
  const ogImageUrl = toAbsoluteUrl(settings.ogImage);

  return {
    metadataBase: new URL(siteUrl),
    applicationName: settings.siteTitle,
    title: {
      default: settings.defaultSeoTitle,
      template: `%s | ${settings.siteTitle}`,
    },
    description: settings.defaultSeoDescription,
    alternates: {
      canonical: siteUrl,
    },
    keywords: settings.defaultSeoKeywords,
    authors: [{ name: settings.siteTitle }],
    creator: settings.siteTitle,
    publisher: settings.siteTitle,
    category: "shopping",
    classification: "E-commerce",
    referrer: "origin-when-cross-origin",
    icons: {
      icon: settings.favicon,
      shortcut: settings.favicon,
      apple: settings.favicon,
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      url: siteUrl,
      siteName: settings.siteTitle,
      title: settings.defaultSeoTitle,
      description: settings.defaultSeoDescription,
      locale: settings.locale.replace("-", "_"),
      images: [
        {
          url: ogImageUrl,
          alt: settings.siteTitle,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: settings.defaultSeoTitle,
      description: settings.defaultSeoDescription,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      yandex: process.env.YANDEX_VERIFICATION,
    },
    other: {
      "msapplication-TileColor": "#000000",
      "msapplication-config": "/browserconfig.xml",
      ...(process.env.BING_SITE_VERIFICATION && {
        'msvalidate.01': process.env.BING_SITE_VERIFICATION,
      }),
    },
  };
}

export async function getOrganizationJsonLd() {
  const settings = await getSiteSettingsForSeo();
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}#organization`,
    name: settings.siteTitle,
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: toAbsoluteUrl(settings.logo),
    },
    email: settings.contactEmail || undefined,
    telephone: settings.contactNumber || undefined,
    address: settings.address || undefined,
    sameAs: [
      settings.facebookLink,
      settings.instagramLink,
      settings.twitterLink,
      settings.tiktokLink,
      settings.youtubeLink,
    ].filter((value): value is string => Boolean(value)),
  };
}
