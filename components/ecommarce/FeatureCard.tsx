import { BadgePercent, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

const FEATURES = [
  {
    key: "discounts",
    Icon: BadgePercent,
    tint: "bg-emerald-500/10",
    iconTint: "text-emerald-600",
    darkIconTint: "dark:text-emerald-400",
    darkTint: "dark:bg-emerald-500/15",
  },
  {
    key: "delivery",
    Icon: Truck,
    tint: "bg-amber-500/10",
    iconTint: "text-amber-600",
    darkIconTint: "dark:text-amber-400",
    darkTint: "dark:bg-amber-500/15",
  },
  {
    key: "payment",
    Icon: ShieldCheck,
    tint: "bg-violet-500/10",
    iconTint: "text-violet-600",
    darkIconTint: "dark:text-violet-400",
    darkTint: "dark:bg-violet-500/15",
  },
  {
    key: "returns",
    Icon: RotateCcw,
    tint: "bg-rose-500/10",
    iconTint: "text-rose-600",
    darkIconTint: "dark:text-rose-400",
    darkTint: "dark:bg-rose-500/15",
  },
] as const;

export default function FeatureStrip() {
  const t = useTranslations("Landing.Features");

  return (
    <section className="w-full bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 sm:py-8">
        {/* 2x2 Grid for mobile, 4x1 for desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {FEATURES.map(({ key, Icon, tint, iconTint, darkIconTint, darkTint }) => (
            <div
              key={key}
              className={`
                group relative overflow-hidden rounded-xl border border-border 
                bg-gradient-to-br from-background to-muted/30
                ${tint} ${darkTint}
                transition-all duration-300 hover:shadow-lg hover:scale-[1.02]
                px-3 sm:px-4 py-3 sm:py-5
              `}
            >
              {/* Subtle hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Icon Container - Responsive sizing */}
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-border shadow-sm">
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconTint} ${darkIconTint} transition-transform duration-300 group-hover:scale-110`} />
                  </div>
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                    {t(`${key}.title`)}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {t(`${key}.subtitle`)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
