"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import BannerManager from "@/components/Settings/BannerManager";
import PaymentGatewayManager from "@/components/PaymentSystem";
import SiteSettingsForm from "@/components/Settings/SiteSettingsForm";
import { useTranslations } from "next-intl";

interface Banner {
  id: number;
  title: string;
  image: string;
  type: string;
  position: number;
  isActive: boolean;
}

export default function SettingsPage() {
  const t = useTranslations("AdminSettingsPage");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("site");

  const loadBanners = async () => {
    try {
      const res = await fetch("/api/banners", { cache: "no-store" });
      const data = await res.json();
      setBanners(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBanner = async (data: any) => {
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error();

      await loadBanners();
      toast.success(t("toasts.created"));
    } catch {
      toast.error(t("toasts.createFailed"));
    }
  };

  const handleUpdateBanner = async (id: number, data: any) => {
    try {
      const res = await fetch(`/api/banners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error();

      await loadBanners();
      toast.success(t("toasts.updated"));
    } catch {
      toast.error(t("toasts.updateFailed"));
    }
  };

  const handleDeleteBanner = async (id: number) => {
    try {
      const res = await fetch(`/api/banners/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error();

      await loadBanners();
      toast.success(t("toasts.deleted"));
    } catch {
      toast.error(t("toasts.deleteFailed"));
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("header.title")}</h1>
        <p className="text-muted-foreground">
          {t("header.description")}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
   <TabsList className="grid w-full grid-cols-3 rounded-md bg-primary/10">
  <TabsTrigger
    value="site"
    className="text-[11px] sm:text-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
  >
    {t("tabs.site")}
  </TabsTrigger>

  <TabsTrigger
    value="banners"
    className="text-[11px] sm:text-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
  >
    {t("tabs.banners")}
  </TabsTrigger>

  <TabsTrigger
    value="payments"
    className="text-[11px] sm:text-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
  >
    {t("tabs.payments")}
  </TabsTrigger>
</TabsList>

        {/* SITE SETTINGS */}
        <TabsContent value="site" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sections.site")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SiteSettingsForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* BANNERS */}
       <TabsContent value="banners" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">
                {t("sections.banners")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="text-sm text-muted-foreground">
                    {t("loadingBanners")}
                  </div>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <BannerManager
                    banners={banners}
                    onCreate={handleCreateBanner}
                    onUpdate={handleUpdateBanner}
                    onDelete={handleDeleteBanner}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENT */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sections.payments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentGatewayManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
