import { NextRequest, NextResponse } from "next/server";
import { getStorefrontDynamicFacets, parseCatalogFilters } from "@/lib/storefront-catalog";
import { catalogFacetPage } from "@/lib/catalog-facet-page";

export async function GET(request: NextRequest) {
  const category = parseCatalogFilters({ category: request.nextUrl.searchParams.get("category") ?? "" }).category;
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  }
  const facets = await getStorefrontDynamicFacets(category);
  return NextResponse.json(catalogFacetPage(facets, offset));
}
