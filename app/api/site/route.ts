import { GOOGLE_ANALYTICS_DEFAULTS, parseGoogleAnalyticsSettings } from "@/lib/analytics/config";
// app/api/site/route.ts

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { getAccessContext } from "@/lib/rbac";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isStorefrontRequest, privateJson, publicJson } from "@/lib/public-cache";
import {
  parseSiteSettingsInput,
  SITE_SETTINGS_DEFAULTS,
} from "@/lib/site-settings";

function toSiteSettingsLogSnapshot(settings: {
  id: number;
  googleTrackingEnabled: boolean;
  googleTagManagerEnabled: boolean;
  googleTagManagerId: string | null;
  googleAnalyticsEnabled: boolean;
  googleAnalyticsMeasurementId: string | null;
  googleAnalyticsDebugMode: boolean;
  logo: string | null;
  siteTitle: string | null;
  storeName: string | null;
  storeTagline: string | null;
  defaultSeoTitle: string | null;
  defaultSeoDescription: string | null;
  defaultSeoKeywords: string[];
  defaultOgImage: string | null;
  favicon: string | null;
  currency: string | null;
  currencyPosition: string | null;
  timezone: string | null;
  locale: string | null;
  storeType: string | null;
  footerDescription: string | null;
  homeFooterDescriptionEnabled: boolean;
  homeFooterDescriptionTitle: string | null;
  homeFooterDescription: string | null;
  contactNumber: string | null;
  contactEmail: string | null;
  address: string | null;
  facebookLink: string | null;
  instagramLink: string | null;
  twitterLink: string | null;
  tiktokLink: string | null;
  youtubeLink: string | null;
}) {
  return {
    id: settings.id,
    googleTrackingEnabled: settings.googleTrackingEnabled,
    googleTagManagerEnabled: settings.googleTagManagerEnabled,
    googleTagManagerId: settings.googleTagManagerId,
    googleAnalyticsEnabled: settings.googleAnalyticsEnabled,
    googleAnalyticsMeasurementId: settings.googleAnalyticsMeasurementId,
    googleAnalyticsDebugMode: settings.googleAnalyticsDebugMode,
    logo: settings.logo,
    siteTitle: settings.siteTitle,
    storeName: settings.storeName,
    storeTagline: settings.storeTagline,
    defaultSeoTitle: settings.defaultSeoTitle,
    defaultSeoDescription: settings.defaultSeoDescription,
    defaultSeoKeywords: settings.defaultSeoKeywords,
    defaultOgImage: settings.defaultOgImage,
    favicon: settings.favicon,
    currency: settings.currency,
    currencyPosition: settings.currencyPosition,
    timezone: settings.timezone,
    locale: settings.locale,
    storeType: settings.storeType,
    footerDescription: settings.footerDescription,
    homeFooterDescriptionEnabled: settings.homeFooterDescriptionEnabled,
    homeFooterDescriptionTitle: settings.homeFooterDescriptionTitle,
    homeFooterDescription: settings.homeFooterDescription,
    contactNumber: settings.contactNumber,
    contactEmail: settings.contactEmail,
    address: settings.address,
    facebookLink: settings.facebookLink,
    instagramLink: settings.instagramLink,
    twitterLink: settings.twitterLink,
    tiktokLink: settings.tiktokLink,
    youtubeLink: settings.youtubeLink,
  };
}

/* =========================
   GET SITE SETTINGS
========================= */
export async function GET(req: Request) {
  try {
    const settings = await prisma.sitesettings.findFirst({
      orderBy: { id: "asc" },
    });

    if (!settings) {
      const created = await prisma.sitesettings.create({
        data: {
          logo: null,
          siteTitle: SITE_SETTINGS_DEFAULTS.storeName,
          storeName: SITE_SETTINGS_DEFAULTS.storeName,
          storeTagline: SITE_SETTINGS_DEFAULTS.storeTagline,
          defaultSeoTitle: SITE_SETTINGS_DEFAULTS.storeName,
          defaultSeoDescription: SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
          defaultSeoKeywords: [],
          defaultOgImage: null,
          favicon: null,
          currency: SITE_SETTINGS_DEFAULTS.currency,
          currencyPosition: SITE_SETTINGS_DEFAULTS.currencyPosition,
          timezone: SITE_SETTINGS_DEFAULTS.timezone,
          locale: SITE_SETTINGS_DEFAULTS.locale,
          storeType: SITE_SETTINGS_DEFAULTS.storeType,
          footerDescription: null,
          homeFooterDescriptionEnabled: false,
          homeFooterDescriptionTitle: null,
          homeFooterDescription: null,
          contactNumber: null,
          contactEmail: null,
          address: null,
          facebookLink: null,
          instagramLink: null,
          twitterLink: null,
          tiktokLink: null,
          youtubeLink: null,
        },
      });

      return isStorefrontRequest(req)
        ? publicJson(created, { maxAge: 300, staleWhileRevalidate: 3600 })
        : privateJson(created);
    }

    return isStorefrontRequest(req)
      ? publicJson(settings, { maxAge: 300, staleWhileRevalidate: 3600 })
      : privateJson(settings);
  } catch (error) {
    console.error("GET site settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch site settings" },
      { status: 500 },
    );
  }
}

/* =========================
   CREATE / UPDATE SITE SETTINGS
========================= */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("settings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingSettings = await prisma.sitesettings.findFirst({ orderBy: { id: "asc" } });
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    // Older settings forms omit these fields. Preserve the stored tracking configuration.
    const tracking = Object.fromEntries(Object.keys(GOOGLE_ANALYTICS_DEFAULTS).map((key) => [key, (existingSettings as unknown as Record<string, unknown> | null)?.[key] ?? GOOGLE_ANALYTICS_DEFAULTS[key as keyof typeof GOOGLE_ANALYTICS_DEFAULTS]]));
    const parsed = parseSiteSettingsInput({ ...tracking, ...body });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const settingsData = {
      ...parsed.value,
      // Compatibility window: legacy readers continue to receive the current name.
      siteTitle: parsed.value.storeName,
    };

    if (!existingSettings) {
      const created = await prisma.sitesettings.create({
        data: {
          ...settingsData,
        },
      });

      await logActivity({
        action: "create_site_settings",
        entity: "settings",
        entityId: created.id,
        access,
        request: req,
        metadata: {
          message: "General settings created",
        },
        after: toSiteSettingsLogSnapshot(created),
      });

      revalidateTag("site-settings", "max");
      return privateJson(created);
    }

    const updated = await prisma.sitesettings.update({
      where: { id: existingSettings.id },
      data: settingsData,
    });

    await logActivity({
      action: "update_site_settings",
      entity: "settings",
      entityId: updated.id,
      access,
      request: req,
      metadata: {
        message: "General settings updated",
      },
      before: toSiteSettingsLogSnapshot(existingSettings),
      after: toSiteSettingsLogSnapshot(updated),
    });

    revalidateTag("site-settings", "max");
    return privateJson(updated);
  } catch (error) {
    console.error("POST site settings error:", error);
    return NextResponse.json(
      { error: "Failed to update site settings" },
      { status: 500 },
    );
  }
}

/* =========================
   DELETE SITE SETTINGS
========================= */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(
      session?.user as { id?: string; role?: string } | undefined,
    );
    if (!access.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!access.has("settings.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await prisma.sitesettings.findFirst({
      orderBy: { id: "asc" },
    });

    if (!settings) {
      return NextResponse.json({ message: "Nothing to delete" });
    }

    const updated = await prisma.sitesettings.update({
      where: { id: settings.id },
      data: {
        ...GOOGLE_ANALYTICS_DEFAULTS,
        logo: null,
        siteTitle: SITE_SETTINGS_DEFAULTS.storeName,
        storeName: SITE_SETTINGS_DEFAULTS.storeName,
        storeTagline: SITE_SETTINGS_DEFAULTS.storeTagline,
        defaultSeoTitle: SITE_SETTINGS_DEFAULTS.storeName,
        defaultSeoDescription: SITE_SETTINGS_DEFAULTS.defaultSeoDescription,
        defaultSeoKeywords: [],
        defaultOgImage: null,
        favicon: null,
        currency: SITE_SETTINGS_DEFAULTS.currency,
        currencyPosition: SITE_SETTINGS_DEFAULTS.currencyPosition,
        timezone: SITE_SETTINGS_DEFAULTS.timezone,
        locale: SITE_SETTINGS_DEFAULTS.locale,
        storeType: SITE_SETTINGS_DEFAULTS.storeType,
        footerDescription: null,
        homeFooterDescriptionEnabled: false,
        homeFooterDescriptionTitle: null,
        homeFooterDescription: null,
        contactNumber: null,
        contactEmail: null,
        address: null,
        facebookLink: null,
        instagramLink: null,
        twitterLink: null,
        tiktokLink: null,
        youtubeLink: null,
      },
    });

    await logActivity({
      action: "reset_site_settings",
      entity: "settings",
      entityId: updated.id,
      access,
      request: req,
      metadata: {
        message: "General settings reset",
      },
      before: toSiteSettingsLogSnapshot(settings),
      after: toSiteSettingsLogSnapshot(updated),
    });

    revalidateTag("site-settings", "max");
    return privateJson(updated);
  } catch (error) {
    console.error("DELETE site settings error:", error);
    return NextResponse.json(
      { error: "Failed to delete site settings" },
      { status: 500 },
    );
  }
}

// Narrow update for GeneralSettings: never overwrites store identity, SEO or contact data.
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getAccessContext(session?.user as { id?: string; role?: string } | undefined);
    if (!access.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!access.has("settings.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid tracking configuration" }, { status: 400 });
    const existing = await prisma.sitesettings.findFirst({ orderBy: { id: "asc" } });
    const previousTracking = Object.fromEntries(
      Object.keys(GOOGLE_ANALYTICS_DEFAULTS).map((key) => [
        key,
        (existing as unknown as Record<string, unknown> | null)?.[key] ??
          GOOGLE_ANALYTICS_DEFAULTS[key as keyof typeof GOOGLE_ANALYTICS_DEFAULTS],
      ]),
    );
    let data: ReturnType<typeof parseGoogleAnalyticsSettings>;
    try { data = parseGoogleAnalyticsSettings({ ...previousTracking, ...body }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid tracking configuration" }, { status: 400 }); }
    const saved = existing
      ? await prisma.sitesettings.update({ where: { id: existing.id }, data })
      : await prisma.sitesettings.create({ data: { ...data, storeName: SITE_SETTINGS_DEFAULTS.storeName, currency: SITE_SETTINGS_DEFAULTS.currency } });
    await logActivity({ action: "update_google_tracking", entity: "settings", entityId: saved.id, access, request: req,
      before: existing ? toSiteSettingsLogSnapshot(existing) : undefined, after: data });
    revalidateTag("site-settings", { expire: 0 });
    return privateJson(data);
  } catch (error) {
    console.error("Google tracking settings update failed", error);
    return NextResponse.json({ error: "Failed to save Google tracking settings" }, { status: 500 });
  }
}
