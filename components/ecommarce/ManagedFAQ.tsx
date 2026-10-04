"use client";

import { Suspense, useMemo, useState, type ComponentType } from "react";
import {
  ChevronDown,
  ChevronUp,
  Home,
  Mail,
  Package,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type FAQItem = { id: string; question: string; answer: string };
type FAQCategory = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  questions: FAQItem[];
};

type Entry = { id: string; question: string; answer: string; category: string };

function FAQPageContent({ entries }: { entries: Entry[] }) {
  const t = useTranslations("StorefrontSupport.faq");
  const [openCategory, setOpenCategory] = useState<string | null>(entries[0]?.category || "general");
  const [searchTerm, setSearchTerm] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set(entries[0] ? [entries[0].id] : []));
  const faqCategories = useMemo<FAQCategory[]>(() => {
    const groups = new Map<string, FAQCategory>();
    for (const entry of entries) {
      const id = entry.category || "general";
      if (!groups.has(id)) groups.set(id, { id, title: entry.category || t("title"), icon: Package, questions: [] });
      groups.get(id)!.questions.push(entry);
    }
    return Array.from(groups.values());
  }, [entries, t]);

  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    if (!query) return faqCategories;

    return faqCategories
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (item) =>
            item.question.toLocaleLowerCase().includes(query) ||
            item.answer.toLocaleLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [faqCategories, searchTerm]);

  const toggleItem = (itemId: string) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-gradient-to-r from-primary to-primary/80 py-16 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/90">
            {t("subtitle")}
          </p>
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search
              className="absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <label htmlFor="faq-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <input
              id="faq-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-12 w-full rounded-xl border-0 bg-background ps-12 pe-4 text-foreground shadow-lg outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-12">
        <div className="space-y-5">
          {filteredCategories.map((category) => {
            const isOpen = searchTerm.trim() !== "" || openCategory === category.id;
            return (
              <article key={category.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() =>
                    setOpenCategory((current) =>
                      current === category.id ? null : category.id,
                    )
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-start hover:bg-muted/40"
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-lg bg-primary/10 p-2 text-primary">
                      <category.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-bold">{category.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("questionCount", { count: category.questions.length })}
                      </span>
                    </span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
                  )}
                </button>

                {isOpen ? (
                  <div className="border-t border-border">
                    {category.questions.map((item) => {
                      const itemOpen = openItems.has(item.id) || searchTerm.trim() !== "";
                      return (
                        <div key={item.id} className="border-b border-border last:border-b-0">
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            aria-expanded={itemOpen}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-sm font-semibold hover:bg-muted/30"
                          >
                            <span>{item.question}</span>
                            {itemOpen ? (
                              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                            )}
                          </button>
                          {itemOpen ? (
                            <p className="whitespace-pre-wrap break-words px-5 pb-5 text-sm leading-7 text-muted-foreground">
                              {item.answer}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}

          {filteredCategories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-14 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
              <h2 className="mt-4 text-lg font-bold">{t("noResultsTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("noResultsDescription")}</p>
              <Button onClick={() => setSearchTerm("")} className="mt-6">
                {t("viewAll")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="bg-gradient-to-r from-primary to-primary/80 py-16 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">{t("moreHelp")}</h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              { href: "/ecommerce/products", icon: Package, label: t("allProducts") },
              { href: "/ecommerce/contact", icon: Mail, label: t("contact") },
              { href: "/ecommerce/about", icon: User, label: t("about") },
              { href: "/", icon: Home, label: t("homepage") },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-lg bg-background/10 p-6 transition-colors hover:bg-background/20"
              >
                <link.icon className="mx-auto mb-3 h-8 w-8 transition-transform group-hover:scale-110" aria-hidden />
                <span className="font-semibold">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ManagedFAQ({ entries }: { entries: Entry[] }) {
  const t = useTranslations("StorefrontSupport.faq");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      }
    >
      <FAQPageContent entries={entries} />
    </Suspense>
  );
}
