import "server-only";

import { revalidateTag } from "next/cache.js";

export function revalidateStorefrontCatalog() {
  // Commerce and storefront-navigation mutations must not deliberately serve a
  // stale response on the next request. Route Handlers cannot use updateTag,
  // so expire every affected tag immediately.
  revalidateTag("storefront-catalog", { expire: 0 });
  revalidateTag("storefront-home", { expire: 0 });
  revalidateTag("products", { expire: 0 });
  revalidateTag("flash-sales", { expire: 0 });
  revalidateTag("categories", { expire: 0 });
}
