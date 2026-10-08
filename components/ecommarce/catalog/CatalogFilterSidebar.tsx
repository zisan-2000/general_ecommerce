"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Content as SheetPanel } from "@radix-ui/react-dialog";
import { Filter, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "./CatalogLink";
import { Sheet, SheetClose, SheetDescription, SheetOverlay, SheetPortal, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const DESKTOP_QUERY = "(min-width: 1024px)";
function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export default function CatalogFilterSidebar({ children, activeFilterCount }: {
  children: ReactNode;
  activeFilterCount: number;
}) {
  const t = useTranslations("StorefrontCatalog.page");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(51);
  const isDesktop = useSyncExternalStore(subscribeToViewport,
    () => window.matchMedia(DESKTOP_QUERY).matches, () => true);

  useEffect(() => {
    const root = document.querySelector(".storefront-type");
    if (!root) return;
    let resizeObserver: ResizeObserver | undefined;
    const connectHeader = () => {
      const header = root.querySelector("header");
      if (!header || resizeObserver) return;
      const update = () => setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
      update();
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(header);
    };
    // The header can arrive later through Suspense.
    const mutationObserver = new MutationObserver(connectHeader);
    mutationObserver.observe(root, { childList: true, subtree: true });
    connectHeader();
    return () => { mutationObserver.disconnect(); resizeObserver?.disconnect(); };
  }, []);

  useEffect(() => { if (isDesktop) setOpen(false); }, [isDesktop]);

  const badge = activeFilterCount > 0 ? (
    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{activeFilterCount}</span>
  ) : null;
  const clearLink = activeFilterCount > 0 ? (
    <Link prefetch={false} href="/ecommerce/products" className="shrink-0 text-xs font-semibold text-primary hover:underline">{t("clear")}</Link>
  ) : null;

  if (isDesktop) return (
    <aside className="hidden rounded-2xl border bg-card shadow-sm lg:sticky lg:top-[136px] lg:flex lg:max-h-[calc(100dvh-152px)] lg:flex-col lg:overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-4">
        <h2 className="flex items-center gap-2 font-bold"><Filter className="h-4 w-4 text-primary" aria-hidden="true" />{t("filters")}{badge}</h2>
        {clearLink}
      </div>
      {children}
    </aside>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="fixed inset-x-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-3 shadow-sm backdrop-blur sm:px-6 lg:hidden" style={{ top: headerHeight }}>
        <SheetTrigger asChild>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Filter className="h-4 w-4 text-primary" aria-hidden="true" />{t("filters")}{badge}
          </button>
        </SheetTrigger>
        {clearLink}
      </div>
      <SheetPortal>
        <SheetOverlay className="z-[100] bg-black/45" />
        <SheetPanel
          className="fixed inset-y-0 left-0 z-[101] flex h-[100dvh] w-[60vw] min-w-[240px] max-w-[calc(100vw-40px)] flex-col overflow-hidden border-r bg-card text-card-foreground shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:w-[50vw] sm:max-w-[360px]"
          onSubmitCapture={(event) => { if (event.target instanceof HTMLFormElement && event.target.checkValidity()) setOpen(false); }}
          onClickCapture={(event) => { if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false); }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3">
            <SheetTitle className="flex items-center gap-2 text-base font-bold">{t("filters")}{badge}</SheetTitle>
            <SheetClose asChild>
              <button type="button" aria-label={locale.startsWith("bn") ? "ফিল্টার বন্ধ করুন" : "Close filters"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-interaction/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{locale.startsWith("bn") ? "ফিল্টার বেছে নিয়ে প্রোডাক্ট দেখুন।" : "Choose filters, then apply them to view products."}</SheetDescription>
          {children}
        </SheetPanel>
      </SheetPortal>
    </Sheet>
  );
}
