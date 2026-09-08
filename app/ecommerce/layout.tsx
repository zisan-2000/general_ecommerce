import { cache, Suspense, type ReactNode } from "react";
import Header from "@/components/ecommarce/header";
import Footer from "@/components/ecommarce/footer";
import FloatingCartButton from "@/components/ecommarce/FloatingCartButton";
import CustomerNotificationPoller from "@/components/ecommarce/CustomerNotificationPoller";
import { getStorefrontCatalogFacets } from "@/lib/storefront-catalog";
import { getStoreFeatureRegistry } from "@/lib/store-features-server";

const getNavigation = cache(getStorefrontCatalogFacets);

async function StorefrontHeader() {
  const [navigation, registry] = await Promise.all([
    getNavigation(),
    getStoreFeatureRegistry(),
  ]);
  return (
    <Header
      siteSettingsData={navigation.siteSettings}
      categoriesData={navigation.categories}
      featureVisibility={{
        compare: registry.features.COMPARE.enabled,
        pcBuilder: registry.features.PC_BUILDER.enabled,
      }}
    />
  );
}

async function StorefrontFooter() {
  const navigation = await getNavigation();
  return (
    <Footer
      siteSettingsData={navigation.siteSettings}
      categoriesData={navigation.categories}
    />
  );
}

export default function EcommerceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="storefront-type min-h-full">
      <div className="flex min-h-screen flex-col">
        <Suspense
          fallback={<div className="h-20 border-b bg-background" aria-hidden />}
        >
          <StorefrontHeader />
        </Suspense>
        <div className="flex-1">{children}</div>
        <CustomerNotificationPoller />
        <FloatingCartButton />
        <Suspense
          fallback={<div className="h-72 border-t bg-card" aria-hidden />}
        >
          <StorefrontFooter />
        </Suspense>
      </div>
    </div>
  );
}
