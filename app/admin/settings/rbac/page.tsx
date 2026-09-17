"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Search,
  ShieldCheck,
  RefreshCcw,
  Filter,
  CheckSquare,
  Square,
} from "lucide-react";
import { useTranslations } from "next-intl";

type Permission = {
  key: string;
  description?: string | null;
};

type Role = {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  isSystem: boolean;
  isImmutable: boolean;
  userCount: number;
  permissions: Permission[];
};

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string" ? payload.error : "Request failed.",
    );
  }
  return payload as T;
}

function normalizeRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 40);
}

export default function RbacSettingsPage() {
  const t = useTranslations("AdminRbacSettings");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<
    string[]
  >([]);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [assignableRoles, setAssignableRoles] = useState<Role[]>([]);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const isCreateMode = !selectedRole;

  const visibleRoles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase();
    if (!query) return roles;
    return roles.filter((role) => {
      return (
        role.label.toLowerCase().includes(query) ||
        role.name.toLowerCase().includes(query) ||
        (role.description || "").toLowerCase().includes(query)
      );
    });
  }, [roles, roleSearch]);

  const visiblePermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (
        showSelectedOnly &&
        !selectedPermissionKeys.includes(permission.key)
      ) {
        return false;
      }
      if (!query) return true;
      return (
        permission.key.toLowerCase().includes(query) ||
        (permission.description || "").toLowerCase().includes(query)
      );
    });
  }, [permissions, permissionSearch, selectedPermissionKeys, showSelectedOnly]);

  const selectedPermissionCount = selectedPermissionKeys.length;
  const canSubmitCreate =
    normalizeRoleKey(name).length > 0 &&
    label.trim().length > 0 &&
    selectedPermissionCount > 0;

  const loadRbacData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [permissionData, roleData] = await Promise.all([
        fetchJson<Permission[]>("/api/admin/rbac/permissions"),
        fetchJson<Role[]>("/api/admin/rbac/roles"),
      ]);
      setPermissions(permissionData);
      setRoles(roleData);
    } catch (loadError) {
      setError(
        t("errors.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRbacData();
  }, [loadRbacData]);

  useEffect(() => {
    if (!selectedRole) return;
    setName(selectedRole.name);
    setLabel(selectedRole.label);
    setDescription(selectedRole.description ?? "");
    setSelectedPermissionKeys(
      selectedRole.permissions.map((permission) => permission.key),
    );
  }, [selectedRole]);

  const togglePermission = (key: string) => {
    setSelectedPermissionKeys((prev) =>
      prev.includes(key)
        ? prev.filter((value) => value !== key)
        : [...prev, key],
    );
  };

  const resetRoleForm = useCallback(() => {
    setName("");
    setLabel("");
    setDescription("");
    setSelectedPermissionKeys([]);
    setPermissionSearch("");
    setShowSelectedOnly(false);
  }, []);

  const startCreateRole = useCallback(() => {
    setSelectedRoleId(null);
    resetRoleForm();
  }, [resetRoleForm]);

  const selectAllVisiblePermissions = () => {
    setSelectedPermissionKeys((prev) => {
      const merged = new Set(prev);
      for (const permission of visiblePermissions) {
        merged.add(permission.key);
      }
      return [...merged];
    });
  };

  const clearVisiblePermissions = () => {
    const visibleKeys = new Set(
      visiblePermissions.map((permission) => permission.key),
    );
    setSelectedPermissionKeys((prev) =>
      prev.filter((key) => !visibleKeys.has(key)),
    );
  };

  const createRole = async () => {
    const normalizedName = normalizeRoleKey(name);
    if (!normalizedName || !label.trim() || selectedPermissionCount === 0) {
      setError(t("validation.createRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await fetchJson<{ id: string }>("/api/admin/rbac/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          label: label.trim(),
          description,
          permissionKeys: selectedPermissionKeys,
        }),
      });
      setSelectedRoleId(created.id);
      await loadRbacData();
    } catch (createError) {
      setError(
        t("errors.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async () => {
    if (!selectedRole) return;
    if (!label.trim() || selectedPermissionCount === 0) {
      setError(t("validation.updateRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/admin/rbac/roles/${selectedRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description,
          permissionKeys: selectedPermissionKeys,
        }),
      });
      await loadRbacData();
    } catch (updateError) {
      setError(
        t("errors.updateFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!selectedRole) return;
    if (!confirm(t("confirm.deleteRole", { role: selectedRole.label }))) return;

    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/admin/rbac/roles/${selectedRole.id}`, {
        method: "DELETE",
      });
      startCreateRole();
      await loadRbacData();
    } catch (deleteError) {
      setError(
        t("errors.deleteFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    try {
      const data = await fetchJson<{ users: UserRow[] }>(
        `/api/users?page=1&limit=10&search=${encodeURIComponent(userSearch.trim())}`,
      );
      setSearchResults(data.users);
    } catch (searchError) {
      setError(
        t("errors.searchUsersFailed"),
      );
    }
  };

  const loadUserRoles = async (user: UserRow) => {
    setSelectedUser(user);
    try {
      const data = await fetchJson<{
        user: { assignedRoles: Role[] };
        roles: Role[];
      }>(`/api/admin/rbac/users/${user.id}/roles`);
      setAssignableRoles(data.roles);
      setAssignedRoleIds(data.user.assignedRoles.map((role) => role.id));
    } catch (loadError) {
      setError(
        t("errors.loadUserRolesFailed"),
      );
    }
  };

  const toggleAssignedRole = (roleId: string) => {
    setAssignedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  const saveUserRoles = async () => {
    if (!selectedUser) return;
    setSavingAssignment(true);
    try {
      await fetchJson(`/api/admin/rbac/users/${selectedUser.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: assignedRoleIds }),
      });
      await loadRbacData();
    } catch (saveError) {
      setError(
        t("errors.assignRolesFailed"),
      );
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("header.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("header.description")}
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="h-[74vh] overflow-hidden">
          <div className="space-y-3 border-b p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t("roles.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("roles.total", { count: roles.length })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadRbacData()}
                >
                  <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                  {t("actions.reload")}
                </Button>
                <Button size="sm" onClick={startCreateRole}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("actions.newRole")}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={roleSearch}
                onChange={(event) => setRoleSearch(event.target.value)}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
                placeholder={t("roles.searchPlaceholder")}
              />
            </div>
          </div>

          <div className="h-[calc(74vh-125px)] overflow-y-auto">
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : visibleRoles.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t("roles.empty")}
              </p>
            ) : (
              visibleRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full border-b p-3 text-left transition-colors hover:bg-primary/10 ${
                    selectedRoleId === role.id
                      ? "bg-primary/20 text-primary"
                      : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{role.label}</p>
                    <span className="text-[11px] text-primary">
                      {t("roles.users", { count: role.userCount })}
                    </span>
                  </div>
                  <div className="mb-2 flex items-center gap-1.5">
                    {role.isSystem ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-primary">
                        {t("roles.system")}
                      </span>
                    ) : null}
                    {role.isImmutable ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                        {t("roles.immutable")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{role.name}</p>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">
                {isCreateMode
                  ? t("editor.createTitle")
                  : t("editor.editTitle", { role: selectedRole?.label ?? "" })}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isCreateMode
                ? t("editor.createHint")
                : t("editor.editHint")}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("fields.roleKey")}
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => {
                  if (!selectedRole) {
                    setName((prev) => normalizeRoleKey(prev));
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="support_manager"
                disabled={Boolean(selectedRole)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("fields.storedKey")}: {" "}
                <span className="font-mono">
                  {normalizeRoleKey(name) || "-"}
                </span>
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("fields.label")}
              </label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("placeholders.label")}
                disabled={Boolean(selectedRole?.isImmutable)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("fields.description")}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("placeholders.description")}
              disabled={Boolean(selectedRole?.isImmutable)}
            />
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("permissions.selected", { count: selectedPermissionCount })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={showSelectedOnly ? "default" : "outline"}
                  onClick={() => setShowSelectedOnly((prev) => !prev)}
                >
                  <Filter className="mr-1 h-3.5 w-3.5" />
                  {t("actions.selectedOnly")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllVisiblePermissions}
                >
                  <CheckSquare className="mr-1 h-3.5 w-3.5" />
                  {t("actions.selectVisible")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearVisiblePermissions}
                >
                  <Square className="mr-1 h-3.5 w-3.5" />
                  {t("actions.clearVisible")}
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
                placeholder={t("permissions.searchPlaceholder")}
              />
            </div>

            <div className="grid max-h-[300px] gap-2 overflow-y-auto rounded-md border p-3 md:grid-cols-2">
              {visiblePermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("permissions.empty")}
                </p>
              ) : (
                visiblePermissions.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissionKeys.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                      disabled={Boolean(selectedRole?.isImmutable)}
                    />
                    <span>
                      <span className="block font-medium">
                        {permission.key}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {permission.description || t("permissions.noDescription")}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {selectedRole?.isImmutable ? (
            <p className="text-xs text-yellow-700">
              {t("roles.immutableHint")}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {isCreateMode ? (
              <Button
                onClick={() => void createRole()}
                disabled={saving || !canSubmitCreate}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("actions.createRole")}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => void updateRole()}
                  disabled={saving || Boolean(selectedRole?.isImmutable)}
                >
                  {t("actions.saveChanges")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void deleteRole()}
                  disabled={saving || Boolean(selectedRole?.isImmutable)}
                >
                  {t("actions.deleteRole")}
                </Button>
                <Button variant="outline" onClick={startCreateRole}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t("actions.switchToCreate")}
                </Button>
              </>
            )}
          </div>

          {isCreateMode ? (
            <p className="text-xs text-muted-foreground">
              {t("validation.createHint")}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
