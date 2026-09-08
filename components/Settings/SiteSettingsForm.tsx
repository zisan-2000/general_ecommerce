"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Image from "next/image";
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

export default function SiteSettingsForm() {
  const [data, setData] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/site")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load site settings");
        return res.json();
      })
      .then((res) => {
        setData(res);
      })
      .catch((error) => toast.error(error.message));
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
      throw new Error(data?.message || "Upload failed");
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
      toast.error(err?.message || "Image upload failed");
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

      if (!res.ok) throw new Error("Failed to update site settings");

      const result = await res.json();
      setData(result);

      toast.success("Site settings updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update site settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-6 bg-card border rounded-xl space-y-6">
      <h2 className="text-xl font-semibold">Site Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* ================= IDENTITY + SEO ================= */}
          <div className="space-y-6 border rounded-lg p-6">
            <h3 className="text-lg font-semibold">Store Identity & SEO</h3>

            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name</Label>
              <Input
                id="store-name"
                required
                maxLength={120}
                value={data.storeName || data.siteTitle || ""}
                onChange={(e) =>
                  setData((current) => ({ ...current, storeName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-tagline">Store Tagline</Label>
              <Input
                id="store-tagline"
                maxLength={200}
                value={data.storeTagline || ""}
                onChange={(e) =>
                  setData((current) => ({ ...current, storeTagline: e.target.value }))
                }
                placeholder="Quality products, secure shopping and dependable service."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-type">Store Type</Label>
              <select
                id="store-type"
                value={data.storeType || "GENERAL"}
                onChange={(e) =>
                  setData((current) => ({ ...current, storeType: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {['GENERAL', 'TECH', 'FASHION', 'GROCERY', 'BOOK'].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Informational only. Features remain controlled from Feature Settings.
              </p>
            </div>

            {/* LOGO */}
            <div className="space-y-2">
              <Label>Logo</Label>

              {data.logo ? (
                <div className="relative w-32">
                  <Image
                    src={data.logo}
                    alt="Logo preview"
                    width={120}
                    height={120}
                    className="rounded border border-border object-contain"
                  />

                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    aria-label="Remove logo"
                    onClick={() => setData((current) => ({ ...current, logo: "" }))}
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
              const label = field === "favicon" ? "Favicon" : "Default Social Share Image";
              return (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  {data[field] ? (
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Image
                        src={data[field] || ""}
                        alt={`${label} preview`}
                        width={field === "favicon" ? 48 : 120}
                        height={field === "favicon" ? 48 : 63}
                        className="rounded border object-contain"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setData((current) => ({ ...current, [field]: "" }))}
                      >
                        Remove
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
              <Label htmlFor="seo-title">Default SEO Title</Label>
              <Input
                id="seo-title"
                maxLength={160}
                value={data.defaultSeoTitle || ""}
                onChange={(e) => setData((current) => ({ ...current, defaultSeoTitle: e.target.value }))}
                placeholder="Falls back to Store Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-description">Default SEO Description</Label>
              <textarea
                id="seo-description"
                maxLength={320}
                value={data.defaultSeoDescription || ""}
                onChange={(e) => setData((current) => ({ ...current, defaultSeoDescription: e.target.value }))}
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo-keywords">Default SEO Keywords</Label>
              <Input
                id="seo-keywords"
                value={(data.defaultSeoKeywords || []).join(", ")}
                onChange={(e) => setData((current) => ({
                  ...current,
                  defaultSeoKeywords: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                placeholder="product, category, online shopping"
              />
            </div>

            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" required maxLength={3} value={data.currency || "BDT"} onChange={(e) => setData((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency-position">Currency Position</Label>
                <select id="currency-position" value={data.currencyPosition || "BEFORE"} onChange={(e) => setData((current) => ({ ...current, currencyPosition: e.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="BEFORE">Before amount</option>
                  <option value="AFTER">After amount</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" required value={data.timezone || "Asia/Dhaka"} onChange={(e) => setData((current) => ({ ...current, timezone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">Locale</Label>
                <Input id="locale" required value={data.locale || "en-BD"} onChange={(e) => setData((current) => ({ ...current, locale: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* ================= FOOTER SECTION ================= */}
          <div className="space-y-6 border rounded-lg p-6">
            <h3 className="text-lg font-semibold">Footer Section</h3>

            {/* Footer Description */}
            <div className="space-y-2">
              <Label>Footer Description</Label>
              <textarea
                value={data.footerDescription || ""}
                onChange={(e) =>
                  setData({ ...data, footerDescription: e.target.value })
                }
                className="w-full border rounded-md px-3 py-2 bg-background min-h-[100px]"
                rows={4}
              />
            </div>

            {/* CONTACT */}
            <div className="space-y-4">
              <h4 className="font-medium">Contact Information</h4>

              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input
                  value={data.contactNumber || ""}
                  onChange={(e) =>
                    setData({ ...data, contactNumber: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={data.contactEmail || ""}
                  onChange={(e) =>
                    setData({ ...data, contactEmail: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
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

            {/* SOCIAL MEDIA */}
            <div className="space-y-4">
              <h4 className="font-medium">Social Media Links</h4>

              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input
                  type="url"
                  value={data.facebookLink || ""}
                  onChange={(e) =>
                    setData({ ...data, facebookLink: e.target.value })
                  }
                  placeholder="https://facebook.com/yourpage"
                />
              </div>

              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  type="url"
                  value={data.instagramLink || ""}
                  onChange={(e) =>
                    setData({ ...data, instagramLink: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Twitter</Label>
                <Input
                  type="url"
                  value={data.twitterLink || ""}
                  onChange={(e) =>
                    setData({ ...data, twitterLink: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>TikTok</Label>
                <Input
                  type="url"
                  value={data.tiktokLink || ""}
                  onChange={(e) =>
                    setData({ ...data, tiktokLink: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>YouTube</Label>
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

        {/* BUTTON */}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saving..." : "Update Settings"}
        </Button>
      </form>
    </div>
  );
}
