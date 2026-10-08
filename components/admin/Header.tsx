"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Home,
  LogOut,
  LayoutDashboard,
  Moon,
  Sun,
  Check,
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Globe2,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isDarkLikeTheme } from "@/lib/theme";
import { DEFAULT_SITE_TITLE } from "@/lib/site-defaults";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  getLocaleDirection,
  localeCookieName,
  type AppLocale,
} from "@/i18n/config";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "zh", label: "中文", shortLabel: "中文" },
  { value: "ar", label: "العربية", shortLabel: "AR" },
  { value: "ne", label: "नेपाली", shortLabel: "NE" },
  { value: "id", label: "Bahasa Indonesia", shortLabel: "ID" },
  { value: "bn", label: "বাংলা", shortLabel: "BN" },
] as const;

type ScmNotificationPreview = {
  id: number;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  href: string;
  readAt: string | null;
};

type ScmNotificationsResponse = {
  unreadCount: number;
  rows: ScmNotificationPreview[];
};

type InvestorNotificationPreview = {
  id: number;
  type: string;
  title: string;
  message: string;
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type InvestorNotificationsResponse = {
  unreadCount: number;
  rows: InvestorNotificationPreview[];
};

type AdminNotificationPreview = ScmNotificationPreview & {
  source: "scm" | "investor";
};

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AdminHeader");
  const { data: session } = useSession();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isPending, setIsPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [siteSettings, setSiteSettings] = useState<any>(null);
  const [loadingSite, setLoadingSite] = useState(true);
  const [scmNotifications, setScmNotifications] =
    useState<ScmNotificationsResponse | null>(null);
  const [investorNotifications, setInvestorNotifications] =
    useState<InvestorNotificationsResponse | null>(null);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [clearingNotifications, setClearingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const notificationRequestVersion = useRef(0);
  const clearingNotificationsRef = useRef(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch site settings
  useEffect(() => {
    const fetchSiteSettings = async () => {
      try {
        const response = await fetch("/api/site");
        const data = await response.json();
        setSiteSettings(data);
      } catch (error) {
        console.error("Failed to fetch site settings:", error);
      } finally {
        setLoadingSite(false);
      }
    };

    fetchSiteSettings();
  }, []);

  const permissionKeys = Array.isArray((session?.user as any)?.permissions)
    ? (((session?.user as any).permissions as string[]) ?? [])
    : [];
  const canViewScmNotifications = permissionKeys.includes("scm.access") ||
    ((session?.user as any)?.globalPermissions as string[] | undefined)?.includes("orders.read_all") === true;
  const canViewInvestorNotifications = permissionKeys.includes(
    "investor.notifications.read",
  );
  const canViewAnyAdminNotifications =
    canViewScmNotifications || canViewInvestorNotifications;

  const markNotificationRead = (row: AdminNotificationPreview) => {
    if (row.readAt) return;
    const endpoint = row.source === "investor"
      ? "/api/admin/investor-notifications" : "/api/scm/notifications";
    void fetch(endpoint, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, type: row.type }), keepalive: true,
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("admin-notifications-changed"));
    }).catch((error: unknown) => console.error("Failed to mark notification read:", error));
  };

  const clearAllNotifications = async () => {
    if (clearingNotificationsRef.current) return;
    clearingNotificationsRef.current = true;
    setClearingNotifications(true);
    setNotificationError(null);
    notificationRequestVersion.current += 1;
    const clearSource = async (source: "scm" | "investor") => {
      const endpoint = source === "investor"
        ? "/api/admin/investor-notifications" : "/api/scm/notifications";
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (!response.ok) throw new Error("Failed to clear notifications.");
      if (source === "scm") setScmNotifications({ unreadCount: 0, rows: [] });
      else setInvestorNotifications({ unreadCount: 0, rows: [] });
    };
    try {
      const requests: Promise<void>[] = [];
      if (canViewScmNotifications) requests.push(clearSource("scm"));
      if (canViewInvestorNotifications) requests.push(clearSource("investor"));
      const results = await Promise.allSettled(requests);
      if (results.some((result) => result.status === "rejected")) {
        setNotificationError(t("notifications.clearError"));
      }
    } finally {
      clearingNotificationsRef.current = false;
      setClearingNotifications(false);
      window.dispatchEvent(new Event("admin-notifications-changed"));
    }
  };

  useEffect(() => {
    if (!canViewAnyAdminNotifications) {
      setScmNotifications(null);
      setInvestorNotifications(null);
      return;
    }

    let active = true;
    const scmController = new AbortController();
    const investorController = new AbortController();

    const fetchNotifications = async () => {
      if (clearingNotificationsRef.current) return;
      const requestVersion = ++notificationRequestVersion.current;
      try {
        setLoadingNotifications(true);
        const requests: Promise<void>[] = [];

        if (canViewScmNotifications) {
          requests.push(
            fetch("/api/scm/notifications?limit=10&preview=true&unreadOnly=true", {
              cache: "no-store",
              signal: scmController.signal,
            })
              .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                  throw new Error(
                    payload?.error || "Failed to load SCM notifications.",
                  );
                }
                if (active && requestVersion === notificationRequestVersion.current) {
                  setScmNotifications(payload as ScmNotificationsResponse);
                }
              })
              .catch((error: any) => {
                if (active && error?.name !== "AbortError") {
                  console.error("Failed to load SCM notification preview:", error);
                }
              }),
          );
        } else if (active) {
          setScmNotifications(null);
        }

        if (canViewInvestorNotifications) {
          requests.push(
            fetch("/api/admin/investor-notifications?limit=10&unreadOnly=true", {
              cache: "no-store",
              signal: investorController.signal,
            })
              .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (!response.ok) {
                  throw new Error(
                    payload?.error || "Failed to load investor notifications.",
                  );
                }
                if (active && requestVersion === notificationRequestVersion.current) {
                  setInvestorNotifications(payload as InvestorNotificationsResponse);
                }
              })
              .catch((error: any) => {
                if (active && error?.name !== "AbortError") {
                  console.error(
                    "Failed to load investor notification preview:",
                    error,
                  );
                }
              }),
          );
        } else if (active) {
          setInvestorNotifications(null);
        }

        await Promise.all(requests);
      } finally {
        if (active && requestVersion === notificationRequestVersion.current) {
          setLoadingNotifications(false);
        }
      }
    };

    void fetchNotifications();
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 15000);
    const refreshNotifications = () => { void fetchNotifications(); };
    window.addEventListener("admin-notifications-changed", refreshNotifications);
    window.addEventListener("focus", refreshNotifications);

    return () => {
      active = false;
      scmController.abort();
      investorController.abort();
      window.clearInterval(interval);
      window.removeEventListener("admin-notifications-changed", refreshNotifications);
      window.removeEventListener("focus", refreshNotifications);
    };
  }, [
    canViewAnyAdminNotifications,
    canViewInvestorNotifications,
    canViewScmNotifications,
  ]);

  const handleLogout = async () => {
    setIsPending(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsPending(false);
    }
  };

  const handleLanguageChange = (nextLocale: AppLocale) => {
    if (nextLocale === locale) return;

    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = getLocaleDirection(nextLocale);
    router.refresh();
  };

  const activeTheme =
    theme === "dark" || resolvedTheme === "dark" ? "dark" : "light";
  const darkLikeActiveTheme = isDarkLikeTheme(activeTheme);

  const userName = (session?.user as any)?.name || t("user");
  const userRole =
    Array.isArray((session?.user as any)?.roleNames) &&
    ((session?.user as any).roleNames as string[]).length > 0
      ? ((session?.user as any).roleNames as string[]).join(", ")
      : (session?.user as any)?.role || t("admin");

  const scmUnreadNotificationCount = scmNotifications?.unreadCount ?? 0;
  const investorUnreadNotificationCount = investorNotifications?.unreadCount ?? 0;
  const unreadNotificationCount =
    scmUnreadNotificationCount + investorUnreadNotificationCount;

  const notificationRows = useMemo<AdminNotificationPreview[]>(() => [
    ...(scmNotifications?.rows ?? []).map((row) => ({ ...row, source: "scm" as const })),
    ...(investorNotifications?.rows ?? []).map((row) => ({
      ...row,
      source: "investor" as const,
      href: row.targetUrl || "/admin/investors/notifications",
    })),
  ].filter((row) => !row.readAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id),
  [scmNotifications, investorNotifications]);

  return (
    <header className="w-full h-20 bg-background border-border border-b flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shadow-sm">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden bg-muted hover:bg-interaction hover:text-interaction-foreground transition-all duration-300 hover:scale-105"
        onClick={onMenuClick}
        aria-label={t("toggleMenu")}
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Logo and Title */}
      <div className="flex items-center space-x-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-foreground hidden sm:block">
            {loadingSite ? (
              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
            ) : siteSettings?.siteTitle ? (
              `${siteSettings.siteTitle} ${t("admin")}`
            ) : (
              `${DEFAULT_SITE_TITLE} ${t("admin")}`
            )}
          </h1>
          <h1 className="text-lg font-bold text-foreground sm:hidden">
            {loadingSite ? (
              <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              siteSettings?.siteTitle?.split(" ")[0] || t("admin")
            )}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Language selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full bg-muted px-2.5 text-foreground hover:bg-interaction hover:text-interaction-foreground"
              title={t("changeLanguage")}
              aria-label={t("changeLanguage")}
            >
              <Globe2 className="h-5 w-5" aria-hidden="true" />
              <span className="hidden text-xs font-semibold sm:inline">
                {LANGUAGE_OPTIONS.find((option) => option.value === locale)
                  ?.shortLabel ?? locale.toUpperCase()}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LANGUAGE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleLanguageChange(option.value)}
                className="flex items-center justify-between gap-4"
              >
                <span>{option.label}</span>
                {locale === option.value ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-primary hover:bg-interaction hover:text-interaction-foreground text-foreground"
                title={t("selectTheme")}
              >
                {darkLikeActiveTheme ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className="flex items-center hover:bg-interaction hover:text-interaction-foreground justify-between"
                >
                  <span>{t(`themes.${option.value}`)}</span>
                  {activeTheme === option.value ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canViewAnyAdminNotifications ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full bg-muted hover:bg-interaction hover:text-interaction-foreground text-foreground"
                title={t("notifications.title")}
                aria-label={t("notifications.title")}
              >
                <Bell className="h-5 w-5" />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-destructive px-1 text-[10px] font-semibold leading-5 text-destructive-foreground">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={12}
              className="w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border-border/70 p-0 shadow-xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">{t("notifications.title")}</p>
                  <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                    {loadingNotifications && !scmNotifications && !investorNotifications
                      ? t("notifications.loading")
                      : t("notifications.unread", { count: unreadNotificationCount })}
                  </p>
                </div>
                <DropdownMenuItem
                  asChild
                  disabled={clearingNotifications || unreadNotificationCount === 0}
                  onSelect={(event) => event.preventDefault()}
                  className="rounded-lg focus:bg-primary/10 focus:text-primary"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={clearingNotifications || unreadNotificationCount === 0}
                    onClick={() => void clearAllNotifications()}
                    className="h-8 shrink-0 gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-interaction/10 hover:text-interaction"
                  >
                    {clearingNotifications
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      : <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t(clearingNotifications ? "notifications.clearing" : "notifications.clearAll")}
                  </Button>
                </DropdownMenuItem>
              </div>
              <div className="max-h-[400px] overflow-y-auto overscroll-contain p-1.5">
                {notificationRows.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {loadingNotifications && !scmNotifications && !investorNotifications
                        ? t("notifications.loading") : t("notifications.empty")}
                    </p>
                  </div>
                ) : notificationRows.map((row) => (
                  <DropdownMenuItem key={`${row.source}-${row.type}-${row.id}`} asChild>
                    <Link
                      href={row.href}
                      onClick={() => markNotificationRead(row)}
                      className="group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-start hover:bg-interaction/5 focus:bg-primary/5 focus:text-foreground"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium leading-5">{row.title}</span>
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{row.message}</span>
                        <time dateTime={row.createdAt} className="mt-1.5 block text-[11px] text-muted-foreground/75">
                          {new Date(row.createdAt).toLocaleString(locale, {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </time>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
              {notificationError ? (
                <p role="alert" className="border-t border-border/60 px-4 py-3 text-xs text-destructive">{notificationError}</p>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {/* View Site Link */}
        <Link
          href="/"
          className="text-sm font-medium transition-all duration-300 hover:scale-105"
          title={t("viewSite")}
        >
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex bg-muted hover:bg-interaction hover:text-interaction-foreground text-foreground border-border hover:border-border rounded-full px-4"
          >
            <Home className="w-4 h-4 mr-2" />
            {t("viewSite")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden bg-muted hover:bg-interaction hover:text-interaction-foreground text-foreground rounded-full"
          >
            <Home className="w-4 h-4" />
          </Button>
        </Link>

        {/* User Info & Avatar */}
        <div className="hidden md:flex flex-col text-right">
          <p className="text-foreground text-sm font-semibold leading-none">
            {userName}
          </p>
          <p className="text-muted-foreground text-xs leading-none mt-1">
            {userRole}
          </p>
        </div>

        <Link href="/admin/profile" title={t("viewProfile")}>
          <Avatar className="h-9 w-9 border-2 border-border cursor-pointer hover:opacity-80 transition-all duration-300 hover:scale-105 hover:border-interaction">
            <AvatarImage
              src={(session?.user as any)?.image ?? undefined}
              alt={session?.user?.name ?? t("profile")}
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
              {(session?.user?.name || t("me"))
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          disabled={isPending}
          className="hidden sm:flex bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold px-6 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105"
        >
          {isPending ? (
            <div className="animate-spin rounded-full h-4 w-4"></div>
          ) : (
            <>
              <LogOut className="w-4 h-4 mr-2" />
              {t("logout")}
            </>
          )}
        </Button>
        <Button
          onClick={handleLogout}
          disabled={isPending}
          variant="ghost"
          size="icon"
          className="sm:hidden bg-muted hover:bg-interaction hover:text-interaction-foreground text-foreground rounded-full"
          title={t("logout")}
        >
          {isPending ? (
            <div className="animate-spin rounded-full h-4 w-4"></div>
          ) : (
            <LogOut className="w-4 h-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
