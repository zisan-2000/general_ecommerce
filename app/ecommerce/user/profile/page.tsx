"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import AccountMenu from "../AccountMenu";
import AccountHeader from "../AccountHeader";
import { Home, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  note?: string | null;
  role?: string;
}

export default function ProfilePage() {
  const t = useTranslations("CustomerAccount");
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState("");

  const userEmail = session?.user?.email || profile?.email || "";

  // ✅ Toast helpers
  const showSuccess = (msg: string) => {
    toast.success(msg, { duration: 3000 });
  };

  const showError = (msg: string) => {
    toast.error(msg, { duration: 4000 });
  };

  // ✅ Load profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);

        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (res.status === 401) {
          showError(t("common.unauthorized"));
          return;
        }
        if (!res.ok) {
          showError(t("profile.errors.load"));
          return;
        }

        const data: ProfileData = await res.json();
        setProfile(data);

        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setImage(data.image ?? "");
      } catch {
        showError(t("common.error"));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // ✅ Upload image
  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const folder = "userProfilePic";

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/upload/${folder}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(t("profile.errors.upload"));
        return;
      }

      const url: string | undefined = data?.url;
      if (!url) {
        showError(t("profile.errors.missingUrl"));
        return;
      }

      setImage(url);
      toast.success(t("profile.success.uploaded"), { duration: 2500 });
    } catch {
      showError(t("profile.errors.upload"));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // ✅ Update profile
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: name || null,
        phone: phone || null,
        image: image || null,
      };

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        showError(t("common.unauthorized"));
        return;
      }

      if (!res.ok) {
        showError(t("profile.errors.update"));
        return;
      }

      setProfile(data);
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setImage(data.image ?? "");

      // ✅ Professional success toast
      toast.success(t("profile.success.updated"), {
        duration: 3000,
      });
    } catch {
      showError(t("profile.errors.update"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Breadcrumb */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 hover:text-foreground">
            <Home className="h-4 w-4" />
            <span>{t("common.home")}</span>
          </Link>
          <span>›</span>
          <Link href="/ecommerce/user" className="hover:text-foreground">
            {t("common.account")}
          </Link>
          <span>›</span>
          <span className="text-foreground">{t("profile.title")}</span>
        </div>
      </div>

      <AccountHeader />
      <AccountMenu />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-medium mb-6">{t("profile.title")}</h2>

        {loading ? (
          <Card className="p-6 bg-card text-card-foreground border border-border">
            <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>
          </Card>
        ) : (
          <Card className="p-6 bg-card text-card-foreground border border-border rounded-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Name */}
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">
                    {t("profile.name")}
                  </p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Email */}
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">
                    {t("profile.email")}
                  </p>
                  <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                    {userEmail || "—"}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">
                    {t("profile.phone")}
                  </p>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="text"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Image */}
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-2">
                    {t("profile.image")}
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="text-sm text-muted-foreground"
                  />

                  {uploadingImage && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("profile.uploading")}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-4">
                    <div className="h-16 w-16 rounded-full border border-border bg-muted overflow-hidden flex items-center justify-center">
                      {image ? (
                        <img
                          src={image}
                          alt={t("profile.preview")}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? t("common.saving") : t("profile.saveChanges")}
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
