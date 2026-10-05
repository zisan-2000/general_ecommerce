import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDashboardRoute } from "@/lib/dashboard-route";
import { resolveInvestorPortalContext } from "@/lib/investor-portal";
import InvestorLayoutClient from "@/components/investor/InvestorLayoutClient";

export default async function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/signin?returnUrl=/investor");
  }

  const resolved = await resolveInvestorPortalContext(
    session.user as { id?: string; role?: string } | undefined,
  );

  if (!resolved.ok) {
    if (resolved.status === 401) {
      redirect("/signin?returnUrl=/investor");
    }

    const fallbackRoute = getDashboardRoute(
      session.user as {
        role?: string | null;
        permissions?: string[] | null;
        defaultAdminRoute?: "/admin" | "/admin/warehouse" | null;
      },
    );

    redirect(fallbackRoute.startsWith("/investor") ? "/ecommerce/user/" : fallbackRoute);
  }

  return (
    <div className="min-h-screen bg-background">
      <InvestorLayoutClient
        investorName={resolved.context.investorName}
        investorCode={resolved.context.investorCode}
      >
        {children}
      </InvestorLayoutClient>
    </div>
  );
}
