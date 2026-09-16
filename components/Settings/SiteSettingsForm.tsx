"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

type SiteSettings = {
  id?: number;
  logo?: string | null;
  siteTitle?: string | null;
  storeName?: string | null;
  storeTagline?: string | null;
  defaultSeoTitle?: string | null;
  defaultSeoDescription?: string | null;
  defaultSeoKeywords?: string[];
  defaultOgImage?: string | null;
  favicon?: string | null;
  currency?: string | null;
  currencyPosition?: string | null;
  timezone?: string | null;
  locale?: string | null;
  storeType?: string | null;
  footerDescription?: string | null;
  contactNumber?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  facebookLink?: string | null;
  instagramLink?: string | null;
  twitterLink?: string | null;
  tiktokLink?: string | null;
  youtubeLink?: string | null;
};

const STORE_TYPES = ["GENERAL", "TECH", "FASHION", "GROCERY", "BOOK"] as const;

export default function SiteSettingsForm() {
  const t = useTranslations("AdminSiteSettings");

  const [data, setData] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/site")
      .then((res) => {
        if (!res.ok) throw new Error(t("errors.loadFailed"));
        return res.json();
      })
      .then((res) => {
        setData(res);
      })
      .catch((error) => toast.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = async (file: File, folder: string) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/upload/${folder}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      throw new Error(data?.message || t("errors.uploadFailed"));
    }

    return data.url as string;
  };

  const handleAssetUpload = async (
    field: "logo" | "favicon" | "defaultOgImage",
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(field);
      const url = await uploadFile(file, "site");
      setData((current) => ({ ...current, [field]: url }));
    } catch (err: any) {
      toast.error(err?.message || t("errors.imageUploadFailed"));
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeName: data.storeName || data.siteTitle,
          storeTagline: data.storeTagline,
          logo: data.logo,
          favicon: data.favicon,
          defaultOgImage: data.defaultOgImage,
          defaultSeoTitle: data.defaultSeoTitle,
          defaultSeoDescription: data.defaultSeoDescription,
          defaultSeoKeywords: data.defaultSeoKeywords,
          currency: data.currency,
          currencyPosition: data.currencyPosition,
          timezone: data.timezone,
          locale: data.locale,
          storeType: data.storeType,
          footerDescription: data.footerDescription,
          contactNumber: data.contactNumber,
          contactEmail: data.contactEmail,
          address: data.address,
          facebookLink: data.facebookLink,
          instagramLink: data.instagramLink,
          twitterLink: data.twitterLink,
          tiktokLink: data.tiktokLink,
          youtubeLink: data.youtubeLink,
        }),
      });

      if (!res.ok) throw new Error(t("errors.updateFailed"));

      const result = await res.json();
      setData(result);

      toast.success(t("success.updated"));
    } catch (err: any) {
      toast.error(err?.message || t("errors.updateFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-6 bg-card border rounded-xl space-y-6">
      <h2 className="text-xl font-semibold">{t("title")}</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* ================= IDENTITY + SEO ================= */}
          <div className="space-y-6 border rounded-lg p-6">
            <h3 className="text-lg font-semibold">{t("identity.title")}</h3>

            <div className="space-y-2">
              <Label htmlFor="store-name">{t("identity.storeName")}</Label>
              <Input
                id="store-name"
                required
                maxLength={120}
                value={data.storeName || data.siteTitle || ""}
                onChange={(e) =>
                  setData((current) => ({
                    ...current,
                    storeName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-tagline">
                {t("identity.storeTagline")}
              </Label>
              <Input
                id="store-tagline"
                maxLength={200}
                value={data.storeTagline || ""}
                onChange={(e) =>
                  setData((current) => ({
                    ...current,
                    storeTagline: e.target.value,
                  }))
                }
                placeholder={t("placeholders.storeTagline")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-type">{t("identity.storeType")}</Label>
              <select
                id="store-type"
                value={data.storeType || "GENERAL"}
                onChange={(e) =>
                  setData((current) => ({
                    ...current,
                    storeType: e.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {STORE_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {t(`storeTypes.${value}`)}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {t("identity.storeTypeHint")}
              </p>
            </div>

            {/* LOGO */}
            <div className="space-y-2">
              <Label>{t("assets.logo")}</Label>

              {data.logo ? (
                <div className="relative w-32">
                  <Image
                    src={data.logo}
                    alt={t("assets.logoPreviewAlt")}
                    width={120}
                    height={120}
                    className="rounded border border-border object-contain"
                  />

                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    aria-label={t("assets.removeLogo")}
                    onClick={() =>
                      setData((current) => ({ ...current, logo: "" }))
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Input
                  key={data.logo ? "has-logo" : "no-logo"}
                  type="file"
                  accept="image/*"
                  disabled={uploading === "logo"}
                  onChange={(event) => handleAssetUpload("logo", event)}
                />
              )}
            </div>

            {(["favicon", "defaultOgImage"] as const).map((field) => {
              const label =
                field === "favicon"
                  ? t("assets.favicon")
                  : t("assets.defaultOgImage");
              return (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  {data[field] ? (
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Image
                        src={data[field] || ""}
                        alt={t("assets.previewAlt", { label })}
                        width={field === "favicon" ? 48 : 120}
                        height={field === "favicon" ? 48 : 63}
                        className="rounded border object-contain"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setData((current) => ({ ...current, [field]: "" }))
                        }
                      >
                        {t("actions.remove")}
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={uploading === field}
                      onChange={(event) => handleAssetUpload(field, event)}
                    />
                  )}
                </div>
              );
            })}

            <div className="space-y-2 border-t pt-5">
              <Label htmlFor="seo-title">{t("seo.title")}</Label>
              <Input
                id="seo-title"
                maxLength={160}
                value={data.defaultSeoTitle || ""}
                onChange={(e) =>
                  setData((current) => ({
                    ...current,
                    defaultSeoTitle: e.target.value,
                  }))
                }
                placeholder={t("placeholders.seoTitle")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-description">{t("seo.description")}</Label>
              <textarea
                id="seo-description"
                maxLength={320}
                value={data.defaultSeoDescription || ""}
                onChange={(e) =>
                  setData((current) => ({
                    ...current,
                    defaultSeoDescription: e.target.value,
                  }))
                }
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-keywords">{t("seo.keywords")}</Label>
              <Input
                id="seo-keywords"
                value={(data.defaultSeoKeywords || []).join(", ")}
                onChange={(e) =>
                  setData((current) => ({
                    ...current,
                    defaultSeoKeywords: e.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder={t("placeholders.seoKeywords")}
              />
            </div>

            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">{t("regional.currency")}</Label>
                <Input
                  id="currency"
                  required
                  maxLength={3}
                  value={data.currency || "BDT"}
                  onChange={(e) =>
                    setData((current) => ({
                      ...current,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency-position">
                  {t("regional.currencyPosition")}
                </Label>
                <select
                  id="currency-position"
                  value={data.currencyPosition || "BEFORE"}
                  onChange={(e) =>
                    setData((current) => ({
                      ...current,
                      currencyPosition: e.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="BEFORE">
                    {t("regional.currencyPositions.BEFORE")}
                  </option>
                  <option value="AFTER">
                    {t("regional.currencyPositions.AFTER")}
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">{t("regional.timezone")}</Label>
                <Input
                  id="timezone"
                  required
                  value={data.timezone || "Asia/Dhaka"}
                  onChange={(e) =>
                    setData((current) => ({
                      ...current,
                      timezone: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">{t("regional.locale")}</Label>
                <Input
                  id="locale"
                  required
                  value={data.locale || "en-BD"}
                  onChange={(e) =>
                    setData((current) => ({
                      ...current,
                      locale: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* ================= FOOTER SECTION ================= */}
          <div className="space-y-6 border rounded-lg p-6">
            <h3 className="text-lg font-semibold">{t("footer.title")}</h3>

            <div className="space-y-2">
              <Label>{t("footer.description")}</Label>
              <textarea
                value={data.footerDescription || ""}
                onChange={(e) =>
                  setData({ ...data, footerDescription: e.target.value })
                }
                className="w-full border rounded-md px-3 py-2 bg-background min-h-[100px]"
                rows={4}
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">{t("footer.contactTitle")}</h4>

              <div className="space-y-2">
                <Label>{t("footer.contactNumber")}</Label>
                <Input
                  value={data.contactNumber || ""}
                  onChange={(e) =>
                    setData({ ...data, contactNumber: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("footer.contactEmail")}</Label>
                <Input
                  type="email"
                  value={data.contactEmail || ""}
                  onChange={(e) =>
                    setData({ ...data, contactEmail: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("footer.address")}</Label>
                <textarea
                  value={data.address || ""}
                  onChange={(e) =>
                    setData({ ...data, address: e.target.value })
                  }
                  className="w-full border rounded-md px-3 py-2 bg-background min-h-[80px]"
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">{t("footer.socialTitle")}</h4>

              <div className="space-y-2">
                <Label>{t("footer.facebook")}</Label>
                <Input
                  type="url"
                  value={data.facebookLink || ""}
                  onChange={(e) =>
                    setData({ ...data, facebookLink: e.target.value })
                  }
                  placeholder={t("placeholders.facebook")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("footer.instagram")}</Label>
                <Input
                  type="url"
                  value={data.instagramLink || ""}
                  onChange={(e) =>
                    setData({ ...data, instagramLink: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("footer.twitter")}</Label>
                <Input
                  type="url"
                  value={data.twitterLink || ""}
                  onChange={(e) =>
                    setData({ ...data, twitterLink: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("footer.tiktok")}</Label>
                <Input
                  type="url"
                  value={data.tiktokLink || ""}
                  onChange={(e) =>
                    setData({ ...data, tiktokLink: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t("footer.youtube")}</Label>
                <Input
                  type="url"
                  value={data.youtubeLink || ""}
                  onChange={(e) =>
                    setData({ ...data, youtubeLink: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("actions.saving") : t("actions.update")}
        </Button>
      </form>
    </div>
  );
}
