import "server-only";

import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";

export async function requireBookManager() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(
    session?.user as { id?: string; role?: string } | undefined,
  );
  if (!access.userId) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!access.has("products.manage")) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, access };
}

export function parsePositiveRouteId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function revalidateBookTaxonomy() {
  revalidateStorefrontCatalog();
  revalidatePath("/ecommerce/books");
  revalidatePath("/ecommerce/authors", "layout");
  revalidatePath("/ecommerce/publishers", "layout");
}
