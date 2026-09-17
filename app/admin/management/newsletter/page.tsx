"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import NewsletterManagement from "@/components/newsletter/NewsletterManager";
import SubscriberManagement from "@/components/newsletter/SubscriberManagement";

const NewsletterPage = memo(function NewsletterPage() {
  const t = useTranslations("AdminNewsletterPage");

  const [activeTab, setActiveTab] = useState<"newsletters" | "subscribers">(
    "newsletters",
  );
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  const handleTabChange = useCallback(
    (tab: "newsletters" | "subscribers") => {
      if (tab === activeTab) return;

      setTabLoading(true);
      setTimeout(() => {
        setActiveTab(tab);
        setTabLoading(false);
      }, 150);
    },
    [activeTab],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="space-y-8">
          {/* Header Skeleton */}
          <div className="bg-muted rounded-2xl shadow-lg p-6 animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-64"></div>
          </div>

          {/* Tab Navigation Skeleton */}
          <div className="bg-card border border-border rounded-2xl shadow-lg p-4">
            <div className="flex space-x-1 bg-muted rounded-xl p-1">
              <div className="flex-1 h-12 bg-muted rounded-xl animate-pulse"></div>
              <div className="flex-1 h-12 bg-muted rounded-xl animate-pulse"></div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-2xl shadow-lg p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-4 bg-muted rounded w-20 mb-2 animate-pulse"></div>
                      <div className="h-8 bg-muted rounded w-12 animate-pulse"></div>
                    </div>
                    <div className="w-12 h-12 bg-muted rounded-full animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-muted rounded w-32 animate-pulse"></div>
                  <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="p-6">
                    <div className="space-y-3">
                      <div className="h-5 bg-muted rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
                <div className="flex items-center space-x-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 bg-muted rounded animate-pulse"
                    ></div>
                  ))}
                </div>
                <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div>
        {/* Header */}
        <div className="bg-card border border-border shadow-lg p-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t("header.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("header.description")}
          </p>
        </div>

        {/* Tab Navigation */}
        <Card className="bg-card border border-border rounded-2xl shadow-lg mb-8">
          <CardContent className="p-4">
            <div className="flex space-x-1 bg-muted rounded-xl p-1">
              <button
                onClick={() => handleTabChange("newsletters")}
                disabled={tabLoading}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === "newsletters"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-foreground hover:bg-muted"
                } ${tabLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {tabLoading && activeTab !== "newsletters" ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  t("tabs.newsletters")
                )}
              </button>
              <button
                onClick={() => handleTabChange("subscribers")}
                disabled={tabLoading}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                  activeTab === "subscribers"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-foreground hover:bg-muted"
                } ${tabLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {tabLoading && activeTab !== "subscribers" ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  t("tabs.subscribers")
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <div
          className={`transition-opacity pl-6 pr-6 duration-300 ${
            tabLoading ? "opacity-50" : "opacity-100"
          }`}
        >
          {activeTab === "newsletters" && <NewsletterManagement />}
          {activeTab === "subscribers" && <SubscriberManagement />}
        </div>
      </div>
    </div>
  );
});

export default NewsletterPage;
