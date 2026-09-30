import { redirect } from "next/navigation";
import { catalogUrl, parseCatalogFilters, type CatalogSearchParams } from "@/lib/storefront-catalog";

export default async function BestsellersPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  redirect(catalogUrl(parseCatalogFilters({ ...await searchParams, sort: "popular" })));
}
