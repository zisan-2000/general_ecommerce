"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, Save, Shield, Warehouse } from "lucide-react";
import { toast } from "sonner";
import UserWarehouseAccessSkeleton from "@/components/ui/UserWarehouseAccessSkeleton";

type Role = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isImmutable: boolean;
};

type WarehouseOption = {
  id: number;
  name: string;
  code: string;
  isDefault: boolean;
};

type WarehouseAccessPayload = {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  warehouses: WarehouseOption[];
  roles: Role[];
  memberships: Array<{
    warehouseId: number;
    isPrimary: boolean;
    status: string;
    warehouse: WarehouseOption;
  }>;
  globalRoleIds: string[];
  warehouseRoleAssignments: Array<{
    warehouseId: number;
    roleIds: string[];
  }>;
};

export default function UserWarehouseAccessPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [data, setData] = useState<WarehouseAccessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memberships, setMemberships] = useState<Array<{ warehouseId: number; isPrimary: boolean }>>([]);
  const [globalRoleIds, setGlobalRoleIds] = useState<string[]>([]);
  const [warehouseRoleMap, setWarehouseRoleMap] = useState<Record<number, string[]>>({});

  const loadWarehouseAccess = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/rbac/users/${params.id}/warehouse-access`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load warehouse access");
      }

      setData(payload);
      setMemberships(
        (payload.memberships || []).map((membership: { warehouseId: number; isPrimary: boolean }) => ({
          warehouseId: membership.warehouseId,
          isPrimary: membership.isPrimary,
        })),
      );
      setGlobalRoleIds(payload.globalRoleIds || []);
      setWarehouseRoleMap(
        (payload.warehouseRoleAssignments || []).reduce(
          (acc: Record<number, string[]>, assignment: { warehouseId: number; roleIds: string[] }) => {
            acc[assignment.warehouseId] = assignment.roleIds;
            return acc;
          },
          {},
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load warehouse access");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      void loadWarehouseAccess();
    }
  }, [params.id]);

  const selectedWarehouseIds = useMemo(
    () => memberships.map((membership) => membership.warehouseId),
    [memberships],
  );

  const selectedWarehouses = useMemo(
    () =>
      data?.warehouses.filter((warehouse) => selectedWarehouseIds.includes(warehouse.id)) ?? [],
    [data?.warehouses, selectedWarehouseIds],
  );

  const scopedRoleOptions = useMemo(
    () => (data?.roles ?? []).filter((role) => role.name !== "superadmin"),
    [data?.roles],
  );
  const selectedGlobalRoleLabels = useMemo(
    () =>
      (data?.roles ?? [])
        .filter((role) => globalRoleIds.includes(role.id))
        .map((role) => role.label),
    [data?.roles, globalRoleIds],
  );
  const selectedScopedRoleLabels = useMemo(() => {
    const roleMap = new Map((data?.roles ?? []).map((role) => [role.id, role.label]));
    return selectedWarehouses.flatMap((warehouse) =>
      (warehouseRoleMap[warehouse.id] ?? []).map((roleId) => ({
        warehouseName: warehouse.name,
        roleLabel: roleMap.get(roleId) ?? roleId,
      })),
    );
  }, [data?.roles, selectedWarehouses, warehouseRoleMap]);
  const canManageGlobalRoles = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[]).includes("users.manage")
    : false;

  const toggleMembership = (warehouseId: number) => {
    setMemberships((current) => {
      const exists = current.some((membership) => membership.warehouseId === warehouseId);
      if (exists) {
        const next = current.filter((membership) => membership.warehouseId !== warehouseId);
        if (next.length > 0 && !next.some((membership) => membership.isPrimary)) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next;
      }

      return [
        ...current,
        {
          warehouseId,
          isPrimary: current.length === 0,
        },
      ];
    });

    setWarehouseRoleMap((current) => {
      if (current[warehouseId]) {
        const next = { ...current };
        delete next[warehouseId];
        return next;
      }
      return {
        ...current,
        [warehouseId]: [],
      };
    });
  };

  const setPrimaryWarehouse = (warehouseId: number) => {
    setMemberships((current) =>
      current.map((membership) => ({
        ...membership,
        isPrimary: membership.warehouseId === warehouseId,
      })),
    );
  };

  const toggleGlobalRole = (roleId: string) => {
    setGlobalRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((existingRoleId) => existingRoleId !== roleId)
        : [...current, roleId],
    );
  };

  const toggleScopedRole = (warehouseId: number, roleId: string) => {
    setWarehouseRoleMap((current) => {
      const existingRoleIds = current[warehouseId] ?? [];
      const nextRoleIds = existingRoleIds.includes(roleId)
        ? existingRoleIds.filter((existingRoleId) => existingRoleId !== roleId)
        : [...existingRoleIds, roleId];

      return {
        ...current,
        [warehouseId]: nextRoleIds,
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/rbac/users/${params.id}/warehouse-access`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberships,
          globalRoleIds,
          warehouseRoleAssignments: selectedWarehouseIds.map((warehouseId) => ({
            warehouseId,
            roleIds: warehouseRoleMap[warehouseId] ?? [],
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save warehouse access");
      }

      toast.success("Warehouse access updated.");
      await loadWarehouseAccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save warehouse access");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <UserWarehouseAccessSkeleton />;
  }

  if (!data) {
    return (
      <div className="min-h-screen p-6">
        <div className="rounded-3xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-destructive">Unable to load warehouse access for this user.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href={`/admin/operations/users/${data.user.id}`}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to user profile
              </Link>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Warehouse Access
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">
                {data.user.name || data.user.email}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Configure warehouse memberships, global roles, and warehouse-scoped roles for this
                user.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-interaction hover:text-interaction-foreground disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Access
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Warehouse Memberships</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Membership controls which warehouses this user belongs to. One warehouse should be
              marked as primary for default landing and reporting context.
            </p>

            <div className="mt-4 space-y-3">
              {data.warehouses.map((warehouse) => {
                const membership = memberships.find((item) => item.warehouseId === warehouse.id);
                return (
                  <label
                    key={warehouse.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border bg-background p-4"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(membership)}
                        onChange={() => toggleMembership(warehouse.id)}
                        className="mt-1 h-4 w-4 rounded border-border"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {warehouse.name} ({warehouse.code})
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {warehouse.isDefault ? "Default warehouse" : "Operational warehouse"}
                        </p>
                      </div>
                    </div>

                    {membership ? (
                      <button
                        type="button"
                        onClick={() => setPrimaryWarehouse(warehouse.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          membership.isPrimary
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {membership.isPrimary ? "Primary" : "Set Primary"}
                      </button>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </article>

          {canManageGlobalRoles ? (
            <article className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Global Roles</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Global roles apply across the whole admin system. Use these for HQ, super admin, or
                cross-warehouse staff.
              </p>
              {selectedGlobalRoleLabels.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                  <p className="font-medium text-foreground">Active global roles</p>
                  <p className="mt-1 text-muted-foreground">{selectedGlobalRoleLabels.join(", ")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Global roles still apply everywhere. If you want warehouse-only access, remove
                    the old global role from here as well.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.roles.map((role) => (
                  <label key={role.id} className="rounded-2xl border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={globalRoleIds.includes(role.id)}
                        onChange={() => toggleGlobalRole(role.id)}
                        className="mt-1 h-4 w-4 rounded border-border"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {role.label}
                          {role.name === "superadmin" ? " (Global only)" : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {role.description || "No role description provided."}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </article>
          ) : (
            <article className="rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Global Roles</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Global role assignment is restricted to global user managers. You can still manage
                memberships and warehouse-scoped roles below.
              </p>
            </article>
          )}
        </section>

        <section className="rounded-3xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Warehouse-Scoped Roles</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            These roles apply only inside the selected warehouse. They do not grant global
            cross-warehouse access.
          </p>
          {selectedScopedRoleLabels.length > 0 ? (
            <div className="mt-4 rounded-2xl border bg-background p-4 text-sm">
              <p className="font-medium text-foreground">Current scoped assignments</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {selectedScopedRoleLabels.map((assignment) => (
                  <p key={`${assignment.warehouseName}:${assignment.roleLabel}`}>
                    {assignment.warehouseName}: {assignment.roleLabel}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {selectedWarehouses.length ? (
              selectedWarehouses.map((warehouse) => (
                <div key={warehouse.id} className="rounded-2xl border bg-background p-4">
                  <div className="mb-4">
                    <p className="font-medium text-foreground">
                      {warehouse.name} ({warehouse.code})
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Assign warehouse-specific roles for this location.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {scopedRoleOptions.map((role) => (
                      <label key={`${warehouse.id}:${role.id}`} className="rounded-2xl border p-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={(warehouseRoleMap[warehouse.id] ?? []).includes(role.id)}
                            onChange={() => toggleScopedRole(warehouse.id, role.id)}
                            className="mt-1 h-4 w-4 rounded border-border"
                          />
                          <div>
                            <p className="font-medium text-foreground">{role.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {role.description || "No role description provided."}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                Select one or more warehouse memberships first, then assign scoped roles.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
