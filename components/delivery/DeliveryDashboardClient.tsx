"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliveryAssignmentCard } from "@/components/delivery/DeliveryAssignmentCard";
import { DeliveryDashboardSkeleton } from "@/components/ui/DeliveryDashboardSkeleton";
import type {
  DeliveryAssignmentData,
  DeliveryAssignmentsApiResponse,
  DeliveryAssignmentStatusValue,
} from "@/components/delivery/types";

type TabKey =
  | "newlyAssigned"
  | "accepted"
  | "rejected"
  | "pickedUp"
  | "inTransit"
  | "delivered"
  | "exceptions";

const TAB_KEYS: TabKey[] = [
  "newlyAssigned",
  "accepted",
  "rejected",
  "pickedUp",
  "inTransit",
  "delivered",
  "exceptions",
];

const TAB_STATUSES: Record<TabKey, DeliveryAssignmentStatusValue[]> = {
  newlyAssigned: ["ASSIGNED"],
  accepted: ["ACCEPTED"],
  rejected: ["REJECTED"],
  pickedUp: ["PICKUP_CONFIRMED"],
  inTransit: ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
  delivered: ["DELIVERED"],
  exceptions: ["FAILED", "RETURNED"],
};

const SUMMARY_CARD_STYLES: Record<string, string> = {
  assigned: "delivery-summary-card delivery-summary-card-assigned",
  accepted: "delivery-summary-card delivery-summary-card-accepted",
  rejected: "delivery-summary-card delivery-summary-card-rejected",
  pickedFromWarehouse:
    "delivery-summary-card delivery-summary-card-picked-from-warehouse",
  inTransit: "delivery-summary-card delivery-summary-card-in-transit",
  delivered: "delivery-summary-card delivery-summary-card-delivered",
};

export function DeliveryDashboardClient() {
  const t = useTranslations("AdminDeliveryDashboard");

  const [assignments, setAssignments] = useState<DeliveryAssignmentData[]>([]);
  const [summary, setSummary] = useState({
    assigned: 0,
    accepted: 0,
    rejected: 0,
    pickedFromWarehouse: 0,
    inTransit: 0,
    delivered: 0,
  });
  const [activeTab, setActiveTab] = useState<TabKey>("newlyAssigned");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadAssignments(showRefreshing = false) {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const response = await fetch(
        "/api/delivery-assignments?currentOnly=true&limit=200",
        { cache: "no-store" },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<DeliveryAssignmentsApiResponse>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || t("errors.loadFailed"));
      }

      setAssignments(payload.data.assignments || []);
      setSummary(payload.data.summary || summary);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : t("errors.loadFailed"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedAssignments = useMemo(() => {
    return TAB_KEYS.reduce<Record<TabKey, DeliveryAssignmentData[]>>(
      (accumulator, key) => {
        accumulator[key] = assignments.filter((assignment) =>
          TAB_STATUSES[key].includes(assignment.status),
        );
        return accumulator;
      },
      {
        newlyAssigned: [],
        accepted: [],
        rejected: [],
        pickedUp: [],
        inTransit: [],
        delivered: [],
        exceptions: [],
      },
    );
  }, [assignments]);

  const summaryCards = [
    { key: "assigned", value: summary.assigned },
    { key: "accepted", value: summary.accepted },
    { key: "rejected", value: summary.rejected },
    { key: "pickedFromWarehouse", value: summary.pickedFromWarehouse },
    { key: "inTransit", value: summary.inTransit },
    { key: "delivered", value: summary.delivered },
  ] as const;

  if (loading) {
    return <DeliveryDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("hero.badge")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                {t("hero.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {t("hero.description")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadAssignments(true)}
              className="btn-outline rounded-xl px-4 py-3 text-sm font-medium"
            >
              {refreshing ? t("actions.refreshing") : t("actions.refresh")}
            </button>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <article
              key={card.key}
              className={`rounded-3xl border border-border p-5 shadow-sm ${
                SUMMARY_CARD_STYLES[card.key] ?? "delivery-summary-card"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t(`summary.${card.key}`)}
              </p>
              <p className="mt-3 text-3xl font-semibold text-foreground">
                {card.value}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabKey)}
          >
            <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-background p-2 scrollbar-hide">
              {TAB_KEYS.map((key) => (
                <TabsTrigger key={key} value={key} className="rounded-xl">
                  {t(`tabs.${key}`)}
                  <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {groupedAssignments[key].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {TAB_KEYS.map((key) => (
              <TabsContent key={key} value={key} className="mt-6">
                {groupedAssignments[key].length ? (
                  <div className="space-y-5">
                    {groupedAssignments[key].map((assignment) => (
                      <DeliveryAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onChanged={async (message) => {
                          setNotice(message);
                          await loadAssignments(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center">
                    <p className="text-lg font-medium text-foreground">
                      {t("empty.title", {
                        tab: t(`tabs.${key}`).toLowerCase(),
                      })}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("empty.description")}
                    </p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </div>
    </div>
  );
}
