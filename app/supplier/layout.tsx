import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDashboardRoute } from "@/lib/dashboard-route";
import { resolveSupplierPortalContext } from "@/lib/supplier-portal";
import SupplierNav from "@/components/supplier/SupplierNav";

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const resolved = await resolveSupplierPortalContext(
    session?.user as { id?: string; role?: string } | undefined,
  );

  if (!session?.user) {
    redirect("/signin?returnUrl=/supplier");
  }

  if (!resolved.ok) {
    if (resolved.status === 401) {
      redirect("/signin?returnUrl=/supplier");
    }

    const fallbackRoute = getDashboardRoute(
      session.user as {
        role?: string | null;
        permissions?: string[] | null;
        defaultAdminRoute?: "/admin" | "/admin/warehouse" | null;
      },
    );

    redirect(fallbackRoute.startsWith("/supplier") ? "/ecommerce/user/" : fallbackRoute);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full">
        <SupplierNav
          supplierName={resolved.context.supplierName}
          supplierCode={resolved.context.supplierCode}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
