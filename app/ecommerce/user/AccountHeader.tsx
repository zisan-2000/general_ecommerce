"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";
import { useTranslations } from "next-intl";

interface ProfileData {
  name: string | null;
  image: string | null;
}

export default function AccountHeader() {
  const t = useTranslations("CustomerAccount.header");
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/user/profile", {
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const userName =
    profile?.name ||
    session?.user?.name ||
    (session?.user?.email
      ? session.user.email.split("@")[0]
      : t("user"));

  const userImage = profile?.image || null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-center gap-5 mb-8">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden">
          {userImage ? (
            <img
              src={userImage}
              alt={t("profileImage")}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-9 w-9 text-muted-foreground" />
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">{t("hello")}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            {loading ? t("loading") : userName}
          </h1>
        </div>
      </div>
    </div>
  );
}
