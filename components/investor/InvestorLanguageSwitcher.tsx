"use client";

import { Check, Globe2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getLocaleDirection,
  languageOptions,
  localeCookieName,
  type AppLocale,
} from "@/i18n/config";
import { cn } from "@/lib/utils";

type InvestorLanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

export default function InvestorLanguageSwitcher({
  compact = false,
  className,
}: InvestorLanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("InvestorPortal");
  const activeLanguage =
    languageOptions.find((option) => option.value === locale) ??
    languageOptions[0];

  const handleLanguageChange = (nextLocale: AppLocale) => {
    if (nextLocale === locale) return;

    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = getLocaleDirection(nextLocale);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "default"}
          className={cn(!compact && "w-full justify-start gap-2", className)}
          title={t("layout.changeLanguage")}
          aria-label={t("layout.changeLanguage")}
        >
          <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {compact ? (
            <span className="sr-only">{t("layout.changeLanguage")}</span>
          ) : (
            <>
              <span className="flex-1 text-start">{t("layout.changeLanguage")}</span>
              <span className="text-xs font-semibold text-muted-foreground">
                {activeLanguage.shortLabel}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {languageOptions.map((option) => (
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
  );
}
