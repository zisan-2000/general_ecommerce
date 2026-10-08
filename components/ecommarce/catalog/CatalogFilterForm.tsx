"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

type CatalogFilterFormProps = {
  children: ReactNode;
  className?: string;
};

const DESKTOP_QUERY = "(min-width: 1024px)";
const DEBOUNCE_MS = 450;

function catalogParams(form: HTMLFormElement) {
  const params = new URLSearchParams();

  for (const [name, rawValue] of new FormData(form).entries()) {
    if (typeof rawValue !== "string" || name === "page") continue;
    const value = rawValue.trim();
    if (!value) continue;
    if (name === "sort" && value === "newest") continue;
    if (name === "perPage" && value === "24") continue;
    params.append(name, value);
  }

  return params;
}

export default function CatalogFilterForm({
  children,
  className,
}: CatalogFilterFormProps) {
  const t = useTranslations("StorefrontCatalog.filters");
  const pathname = usePathname();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  // Keep the form mounted (including all nested scroll positions), while
  // syncing uncontrolled fields after URL navigation, clear, or browser Back.
  useLayoutEffect(() => {
    if (isPending) return;
    const form = formRef.current;
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const selectedByName = new Map<string, Set<string>>();
    for (const [name, rawValue] of params.entries()) {
      if (!name) continue;
      const values = selectedByName.get(name) ?? new Set<string>();
      values.add(rawValue);
      selectedByName.set(name, values);
    }

    for (const field of Array.from(form.elements)) {
      if (field instanceof HTMLInputElement) {
        const values = selectedByName.get(field.name);
        if (field.type === "checkbox" || field.type === "radio") {
          field.checked = values ? values.has(field.value) : field.defaultChecked;
        } else {
          const valueFromUrl = values ? Array.from(values)[0] : undefined;
          field.value = valueFromUrl ?? field.defaultValue;
        }
      } else if (field instanceof HTMLSelectElement) {
        const values = selectedByName.get(field.name);
        const selectedValue = values ? Array.from(values)[0] : undefined;
        const options = Array.from(field.options);
        const defaultOption =
          options.find((option) => option.defaultSelected) ?? options[0];
        const matchedOption =
          selectedValue !== undefined
            ? options.find((option) => option.value === selectedValue)
            : undefined;
        field.value = (matchedOption ?? defaultOption)?.value ?? "";
      }
    }
  }, [children, isPending, pathname]);

  useEffect(() => {
    const results = document.getElementById("catalog-results");
    results?.setAttribute("aria-busy", String(isPending));
    return () => results?.setAttribute("aria-busy", "false");
  }, [isPending]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function clearDebounce() {
    if (!debounceRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }

  function navigate(form: HTMLFormElement, addHistoryEntry: boolean) {
    if (!form.checkValidity()) return;

    clearDebounce();
    const params = catalogParams(form);
    const href = params.size ? `${pathname}?${params.toString()}` : pathname;

    startTransition(() => {
      if (addHistoryEntry) {
        router.push(href, { scroll: false });
      } else {
        router.replace(href, { scroll: false });
      }
    });
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    const isDebouncedInput =
      target instanceof HTMLInputElement &&
      ["text", "search", "number"].includes(target.type);

    if (!isDebouncedInput) {
      navigate(event.currentTarget, false);
      return;
    }

    clearDebounce();
    const form = event.currentTarget;
    debounceRef.current = setTimeout(() => navigate(form, false), DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
    navigate(event.currentTarget, !isDesktop);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action="/ecommerce/products"
      className={className}
      aria-busy={isPending}
      onChange={handleChange}
      onSubmit={handleSubmit}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {children}
      </div>

      <div className="shrink-0 space-y-2 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:border-t-0 lg:p-4">

      <div
        className="min-h-5 text-center text-xs font-medium text-muted-foreground"
        aria-live="polite"
        aria-atomic="true"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {t("updating")}
          </span>
        ) : (
          <span className="hidden lg:inline">{t("automatic")}</span>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-interaction hover:text-interaction-foreground disabled:cursor-wait disabled:opacity-70 lg:hidden"
      >
        {isPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        )}
        {isPending ? t("updatingShort") : t("showProducts")}
      </button>

      <noscript>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          {t("apply")}
        </button>
      </noscript>
      </div>
    </form>
  );
}
