import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Boxes,
  Headphones,
  PackageCheck,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSiteSettingsForSeo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettingsForSeo();
  return {
    title: "About Us",
    description: `Learn how ${settings.siteTitle} makes product discovery, ordering and support straightforward.`,
    alternates: { canonical: "/ecommerce/about" },
  };
}

const capabilities = [
  {
    icon: ShoppingBag,
    title: "Customer-first catalog",
    description:
      "Products are organized around the categories, options and information buyers actually need.",
  },
  {
    icon: BadgeCheck,
    title: "Verified product information",
    description:
      "Clear model, variant, stock and warranty information helps customers make confident decisions.",
  },
  {
    icon: Boxes,
    title: "Inventory visibility",
    description:
      "Warehouse-aware stock management reduces overselling and keeps product availability dependable.",
  },
  {
    icon: ShieldCheck,
    title: "Secure shopping",
    description:
      "Protected accounts, trusted payment options and auditable order operations are part of every purchase.",
  },
  {
    icon: Truck,
    title: "Nationwide delivery",
    description:
      "Delivery coverage across Bangladesh with order tracking and a clear fulfilment process.",
  },
  {
    icon: Headphones,
    title: "After-sales support",
    description:
      "Our support team assists with order questions, product guidance, returns and warranty directions.",
  },
];

export default async function AboutPage() {
  const settings = await getSiteSettingsForSeo();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-primary-foreground/75">
              About {settings.siteTitle}
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Shopping built around clarity, availability and support
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-primary-foreground/85 sm:text-base">
              {settings.storeTagline} We connect reliable product information,
              secure checkout and dependable fulfilment in one storefront.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/ecommerce/products">Explore products</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/ecommerce/contact">Contact our team</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 backdrop-blur-sm">
            {[
              { icon: PackageCheck, label: "Genuine products" },
              { icon: Wrench, label: "Product guidance" },
              { icon: Truck, label: "Delivery coverage" },
              { icon: ShieldCheck, label: "Secure checkout" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4"
              >
                <feature.icon className="mb-3 h-6 w-6" aria-hidden />
                <p className="text-sm font-semibold">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-14 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            What we stand for
          </p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
            A dependable retail experience
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            Our storefront and operations are designed to keep product discovery,
            pricing, inventory, payment and fulfilment connected from first click
            to after-sales support.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability) => (
            <article
              key={capability.title}
              className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <capability.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-base font-bold">{capability.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {capability.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/35">
        <div className="container mx-auto grid gap-8 px-4 py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Our commitment
            </p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Accurate information before the sale, responsible support after it
            </h2>
          </div>
          <div className="space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              We continuously improve catalog accuracy, stock visibility and
              operational controls so customers know what they are buying and
              when they can expect it.
            </p>
            <p>
              Product availability, delivery estimates and warranty conditions
              can vary by model and location; the applicable details are confirmed
              during ordering and fulfilment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
