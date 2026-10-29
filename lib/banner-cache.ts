import "server-only";

import { revalidateTag } from "next/cache.js";

export function revalidateStorefrontBanners() {
  revalidateTag("banners", { expire: 0 });
  revalidateTag("storefront-home", { expire: 0 });
}
