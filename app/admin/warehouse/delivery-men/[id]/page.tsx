"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentStatusBadge } from "@/components/delivery/AssignmentStatusBadge";
import { DeliveryAssignmentCard } from "@/components/delivery/DeliveryAssignmentCard";
import { DeliveryDashboardSkeleton } from "@/components/ui/DeliveryDashboardSkeleton";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  RefreshCw,
  Eye,
  Edit,
} from "lucide-react";
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

const TAB_DEFINITIONS: Array<{
  key: TabKey;
  label: string;
  statuses: DeliveryAssignmentStatusValue[];
}> = [
  { key: "newlyAssigned", label: "Newly Assigned", statuses: ["ASSIGNED"] },
  { key: "accepted", label: "Accepted Deliveries", statuses: ["ACCEPTED"] },
  { key: "rejected", label: "Rejected Deliveries", statuses: ["REJECTED"] },
  { key: "pickedUp", label: "Picked Up", statuses: ["PICKUP_CONFIRMED"] },
  {
    key: "inTransit",
    label: "In Transit",
    statuses: ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
  },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "exceptions", label: "Exceptions", statuses: ["FAILED", "RETURNED"] },
];

export default function DeliveryManDetailsPage() {
  const params = useParams() ?? { id: "" };
  const router = useRouter();
  const deliveryManId = params.id as string;

  const [deliveryMan, setDeliveryMan] = useState<any>(null);
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

  async function loadDeliveryManDetails(showRefreshing = false) {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const response = await fetch(`/api/delivery-men/${deliveryManId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load delivery man details");
      }

      const data = await response.json();
      setDeliveryMan(data.deliveryMan);
      setAssignments(data.assignments || []);
      setSummary(data.summary || summary);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load delivery man details",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (deliveryManId) {
      void loadDeliveryManDetails();
    }
  }, [deliveryManId]);

  const groupedAssignments = assignments.reduce<
    Record<TabKey, DeliveryAssignmentData[]>
  >(
    (accumulator, assignment) => {
      const tabKey =
        TAB_DEFINITIONS.find((tab) => tab.statuses.includes(assignment.status))
          ?.key || "exceptions";

      accumulator[tabKey] = (accumulator[tabKey] || []).concat(assignment);
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

  const summaryCards = [
    {
      label: "Assigned",
      value: summary.assigned,
      icon: Package,
      color: "text-blue-600",
    },
    {
      label: "Accepted",
      value: summary.accepted,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      label: "Rejected",
      value: summary.rejected,
      icon: XCircle,
      color: "text-red-600",
    },
    {
      label: "Picked From Warehouse",
      value: summary.pickedFromWarehouse,
      icon: Truck,
      color: "text-orange-600",
    },
    {
      label: "In Transit",
      value: summary.inTransit,
      icon: Clock,
      color: "text-purple-600",
    },
    {
      label: "Delivered",
      value: summary.delivered,
      icon: CheckCircle,
      color: "text-emerald-600",
    },
  ];

  if (loading) {
    return <DeliveryDashboardSkeleton />;
  }

  if (error && !deliveryMan) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-center">
                <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Delivery Man Not Found
                </h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button
                  onClick={() => router.push("/admin/warehouse/delivery-men")}
                >
                  View All Delivery Men
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="shrink-0"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Delivery Personnel Management
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-foreground">
                  Delivery Man Details
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                className="bg-secondary "
                size="sm"
                onClick={() =>
                  router.push(
                    `/admin/warehouse/delivery-men/${deliveryManId}/edit`,
                  )
                }
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                type="button"
                onClick={() => void loadDeliveryManDetails(true)}
                variant="outline"
                disabled={refreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        {/* Delivery Man Information */}
        {deliveryMan && (
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Personal Information */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </label>
                  <p className="font-semibold text-foreground">
                    {deliveryMan.fullName}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Employee Code
                  </label>
                  <p className="font-semibold text-foreground">
                    {deliveryMan.employeeCode || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold text-foreground">
                      {deliveryMan.phone}
                    </p>
                  </div>
                </div>

                {deliveryMan.user?.email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="font-semibold text-foreground">
                        {deliveryMan.user.email}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <Badge
                    variant={
                      deliveryMan.status === "ACTIVE" ? "default" : "secondary"
                    }
                    className="mt-1"
                  >
                    {deliveryMan.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Warehouse Information */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Warehouse Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Assigned Warehouse
                  </label>
                  <p className="font-semibold text-foreground">
                    {deliveryMan.warehouse?.name || "N/A"}
                  </p>
                </div>

                {deliveryMan.warehouse?.code && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Warehouse Code
                    </label>
                    <p className="font-semibold text-foreground">
                      {deliveryMan.warehouse.code}
                    </p>
                  </div>
                )}

                {deliveryMan.warehouse?.area && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Area
                    </label>
                    <p className="font-semibold text-foreground">
                      {deliveryMan.warehouse.area}
                    </p>
                  </div>
                )}

                {deliveryMan.warehouse?.district && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      District
                    </label>
                    <p className="font-semibold text-foreground">
                      {deliveryMan.warehouse.district}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {summaryCards.map((card) => {
                  const IconComponent = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent className={`h-4 w-4 ${card.color}`} />
                        <span className="text-sm font-medium text-muted-foreground">
                          {card.label}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-foreground">
                        {card.value}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Delivery Assignments */}
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Delivery Assignments
            </h2>
            <p className="text-sm text-muted-foreground">
              Review all delivery assignments and their current status.
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabKey)}
          >
            <TabsList className="w-full justify-start overflow-x-auto rounded-2xl bg-background p-2 scrollbar-hide">
              {TAB_DEFINITIONS.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="rounded-xl data-[state=active]:bg-primary/80 data-[state=active]:text-primary-foreground"
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {groupedAssignments[tab.key]?.length || 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {TAB_DEFINITIONS.map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-6">
                {groupedAssignments[tab.key]?.length ? (
                  <div className="space-y-5">
                    {groupedAssignments[tab.key].map((assignment) => (
                      <DeliveryAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onChanged={async (message) => {
                          // You could show a toast notification here
                          await loadDeliveryManDetails(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border bg-background px-6 py-14 text-center">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No deliveries in {tab.label.toLowerCase()}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      New assignments and status updates will appear here
                      automatically.
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
