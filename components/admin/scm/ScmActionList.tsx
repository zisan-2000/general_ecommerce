"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Clock3, Building2, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScmStatusChip } from "@/components/admin/scm/ScmStatusChip";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

export type ScmActionItem = {
  key: string;
  module: string;
  title: string;
  description: string;
  href: string;
  status: string;
  actionLabel: string;
  priority: "critical" | "high" | "normal";
  ageDays: number;
  dueAt: string | null;
  createdAt: string;
  warehouseName: string | null;
};

function fmtDate(value: string | null | undefined, locale: string, unavailable: string) {
  if (!value) return unavailable;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return unavailable;
  return parsed.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getPriorityClass(priority: ScmActionItem["priority"]) {
  switch (priority) {
    case "critical":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "high":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-border/70 bg-background/80 text-muted-foreground";
  }
}

// Metadata item component for consistency
function MetadataItem({ 
  icon: Icon, 
  label, 
  value, 
  isWarning = false 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  isWarning?: boolean;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 sm:gap-1.5",
      isWarning && "text-warning"
    )}>
      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      <span className="text-[10px] sm:text-xs">
        {label}: {value}
      </span>
    </span>
  );
}

export function ScmActionList({
  items,
  empty,
}: {
  items: ScmActionItem[];
  empty?: ReactNode;
}) {
  const t = useTranslations("AdminScmCommon");
  const locale = useLocale();
  if (items.length === 0) {
    return <>{empty ?? null}</>;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {items.map((item) => (
        <Card 
          key={item.key} 
          className="shadow-none transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 group"
        >
          <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-4 md:p-5">
            {/* Main Content Row - Responsive */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              {/* Left Content */}
              <div className="min-w-0 flex-1 space-y-2">
                {/* Badges Row - Responsive wrapping */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.15em] sm:tracking-[0.18em] text-muted-foreground">
                    {item.module}
                  </span>
                  <ScmStatusChip status={item.status} />
                  <span className={cn(
                    "rounded-full border px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-[11px] font-medium",
                    getPriorityClass(item.priority)
                  )}>
                    {t(`priority.${item.priority}` as any)}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-sm sm:text-base font-semibold text-foreground break-words line-clamp-2">
                    {item.title}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words line-clamp-2 sm:line-clamp-3">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Action Button - Responsive */}
              <Button 
                asChild 
                size="sm" 
                className={cn(
                  "w-full lg:w-auto",
                  "lg:self-center",
                  "mt-1 lg:mt-0",
                  "transition-all duration-200 hover:scale-105"
                )}
              >
                <Link href={item.href} className="flex items-center justify-center gap-1.5">
                  {item.actionLabel}
                  <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Link>
              </Button>
            </div>

            {/* Metadata Row - Responsive grid with proper separators */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-4 sm:gap-y-2 text-[10px] sm:text-xs text-muted-foreground border-t border-border/50 pt-2 sm:pt-3">
              <MetadataItem 
                icon={Clock3} 
                label={t("metadata.age")}
                value={t("metadata.days", { count: item.ageDays })}
              />
              
              {item.warehouseName && (
                <>
                  <span className="hidden sm:inline text-border/50">•</span>
                  <MetadataItem 
                    icon={Building2} 
                    label={t("metadata.warehouse")}
                    value={item.warehouseName} 
                  />
                </>
              )}
              
              <>
                <span className="hidden sm:inline text-border/50">•</span>
                <MetadataItem 
                  icon={Calendar} 
                  label={t("metadata.created")}
                  value={fmtDate(item.createdAt, locale, t("notAvailable"))}
                />
              </>
              
              {item.dueAt && (
                <>
                  <span className="hidden sm:inline text-border/50">•</span>
                  <MetadataItem 
                    icon={AlertCircle} 
                    label={t("metadata.due")}
                    value={fmtDate(item.dueAt, locale, t("notAvailable"))}
                    isWarning={true}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
