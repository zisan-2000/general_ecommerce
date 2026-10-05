// app/ecommerce/user/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { getDashboardRoute } from "@/lib/dashboard-route";

function LayoutSkeleton() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-background via-background to-muted/25">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl space-y-5 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-56 animate-pulse rounded bg-muted/80" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [profileImage, setProfileImage] = useState<string | undefined>(
    undefined,
  );
  const pathname = usePathname();
  const router = useRouter();

  // not logged in হলে signin এ পাঠাই
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
      return;
    }

    if (status === "authenticated") {
      const dashboardRoute = getDashboardRoute(
        (session?.user ?? null) as {
          role?: string | null;
          permissions?: string[];
          defaultAdminRoute?: "/admin" | "/admin/warehouse";
        } | null,
      );

      if (
        dashboardRoute !== "/ecommerce/user/" &&
        (pathname === "/ecommerce/user" ||
          pathname.startsWith("/ecommerce/user/"))
      ) {
        router.replace(dashboardRoute);
      }
    }
  }, [pathname, router, session, status]);

  // সর্বশেষ প্রোফাইল ইমেজ লোড করি, যেন sidebar সব সময় আপডেট থাকে
  useEffect(() => {
    const loadProfileImage = async () => {
      if (status !== "authenticated") return;
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (data.image) {
          setProfileImage(data.image as string);
        }
      } catch {
        // ignore
      }
    };

    loadProfileImage();
  }, [status]);

  if (status === "loading") {
    return <LayoutSkeleton />;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div>
      <div>
        {/* MAIN CONTENT AREA – সব child route এখানেই render হবে */}
        <main>{children}</main>
      </div>
    </div>
  );
}
