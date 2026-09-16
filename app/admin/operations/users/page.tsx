"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import UserTable from "@/components/admin/users/UserTable";
import UserFilters from "@/components/admin/users/UserFilters";
import Pagination from "@/components/admin/users/Pagination";
import {
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: number | null;
  note: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    orders: number;
    reviews: number;
  };
}

interface Role {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isImmutable: boolean;
  userCount: number;
  permissions: Array<{
    id: string;
    key: string;
    description: string | null;
  }>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UsersCacheEntry {
  users: User[];
  pagination: PaginationInfo;
}

interface UsersQueryState {
  page: number;
  limit: number;
  search: string;
  role: string;
}

const usersCache = new Map<string, UsersCacheEntry>();
let lastUsersQueryState: UsersQueryState = {
  page: 1,
  limit: 10,
  search: "",
  role: "",
};

const getCacheKey = (query: UsersQueryState) =>
  JSON.stringify({
    page: query.page,
    limit: query.limit,
    search: query.search,
    role: query.role,
  });

export default function AdminUsersPage() {
  const t = useTranslations("AdminUsers");
  const { data: session } = useSession();
  const initialCacheKey = getCacheKey(lastUsersQueryState);
  const initialCachedEntry = usersCache.get(initialCacheKey);
  const canCreateUsers = Array.isArray(
    (session?.user as any)?.globalPermissions,
  )
    ? ((session?.user as any).globalPermissions as string[]).includes(
        "users.manage",
      )
    : false;

  const [users, setUsers] = useState<User[]>(
    () => initialCachedEntry?.users ?? [],
  );
  const [pagination, setPagination] = useState<PaginationInfo>(() => ({
    page: lastUsersQueryState.page,
    limit: lastUsersQueryState.limit,
    total: initialCachedEntry?.pagination.total ?? 0,
    totalPages: initialCachedEntry?.pagination.totalPages ?? 0,
  }));
  const [filters, setFilters] = useState({
    search: lastUsersQueryState.search,
    role: lastUsersQueryState.role,
  });
  const [loading, setLoading] = useState(() => !initialCachedEntry);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    role: "user",
    phone: "",
    password: "",
    addresses: [""],
  });
  const [showPassword, setShowPassword] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      const response = await fetch("/api/admin/rbac/roles");

      if (!response.ok) {
        throw new Error(t("errors.loadRoles"));
      }

      const rolesData = await response.json();
      setRoles(rolesData);
    } catch (err) {
      console.error("Error fetching roles:", err);
    } finally {
      setRolesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (roles.length > 0 && newUser.role === "user") {
      const defaultRole = roles.find((r) => !r.isSystem) || roles[0];
      if (defaultRole) {
        setNewUser((prev) => ({ ...prev, role: defaultRole.name }));
      }
    }
  }, [roles, newUser.role]);

  const fetchUsers = useCallback(
    async (showRefresh = false) => {
      const queryState: UsersQueryState = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search.trim(),
        role: filters.role,
      };
      const cacheKey = getCacheKey(queryState);
      lastUsersQueryState = queryState;

      if (!showRefresh && usersCache.has(cacheKey)) {
        const cachedData = usersCache.get(cacheKey);
        if (cachedData) {
          setUsers(cachedData.users);
          setPagination(cachedData.pagination);
          setFilters({
            search: queryState.search,
            role: queryState.role,
          });
          setError("");
          setLoading(false);
          return;
        }
      }

      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams({
          page: queryState.page.toString(),
          limit: queryState.limit.toString(),
          ...(queryState.search && { search: queryState.search }),
          ...(queryState.role && { role: queryState.role }),
        });

        const response = await fetch(`/api/users?${params}`);

        if (!response.ok) {
          throw new Error(t("errors.loadUsers"));
        }

        const data = await response.json();

        usersCache.set(cacheKey, {
          users: data.users,
          pagination: data.pagination,
        });

        setUsers(data.users);
        setPagination(data.pagination);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.loadUsers"));
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pagination.page, pagination.limit, filters.search, filters.role, t],
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleRoleChange = useCallback((role: string) => {
    setFilters((prev) => ({ ...prev, role }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleRefresh = useCallback(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  const handleUserUpdate = useCallback(
    (userId: string, updates: Partial<User>) => {
      setUsers((prev) => {
        const nextUsers = prev.map((user) =>
          user.id === userId ? { ...user, ...updates } : user,
        );

        const cacheKey = getCacheKey({
          page: pagination.page,
          limit: pagination.limit,
          search: filters.search.trim(),
          role: filters.role,
        });
        const cached = usersCache.get(cacheKey);
        if (cached) {
          usersCache.set(cacheKey, {
            ...cached,
            users: nextUsers,
          });
        }

        return nextUsers;
      });
    },
    [filters.role, filters.search, pagination.limit, pagination.page],
  );

  const handleUserDelete = useCallback(
    (userId: string) => {
      setUsers((prev) => {
        const nextUsers = prev.filter((user) => user.id !== userId);

        const cacheKey = getCacheKey({
          page: pagination.page,
          limit: pagination.limit,
          search: filters.search.trim(),
          role: filters.role,
        });
        const cached = usersCache.get(cacheKey);
        if (cached) {
          usersCache.set(cacheKey, {
            ...cached,
            users: nextUsers,
            pagination: {
              ...cached.pagination,
              total: Math.max(0, cached.pagination.total - 1),
            },
          });
        }

        return nextUsers;
      });
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
    },
    [filters.role, filters.search, pagination.limit, pagination.page],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ search: "", role: "" });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const filteredUsers = useMemo(() => {
    return users;
  }, [users]);

  const paginationData = useMemo(() => pagination, [pagination]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newUser.email || !newUser.password) {
      setCreateError(t("create.errors.emailPasswordRequired"));
      return;
    }

    const normalizedAddresses = newUser.addresses
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (normalizedAddresses.length === 0) {
      setCreateError(t("create.errors.addressRequired"));
      return;
    }

    try {
      setCreating(true);

      const requestData = {
        email: newUser.email,
        name: newUser.name || "",
        role: newUser.role,
        phone: newUser.phone || "",
        password: newUser.password,
        addresses: normalizedAddresses,
      };

      console.log("Sending user creation request:", requestData);

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      console.log("Response status:", response.status, response.statusText);

      if (!response.ok) {
        const data = await response.json().catch((e) => {
          console.error("Error parsing JSON response:", e);
          return {};
        });
        console.error("Create user error response:", data);
        setCreateError(
          data?.error || data?.message || t("create.errors.failed"),
        );
        return;
      }

      const successData = await response.json();
      console.log("User created successfully:", successData);
      setShowCreateModal(false);

      const defaultRole = roles.find((r) => !r.isSystem) ||
        roles[0] || { name: "user" };
      setNewUser({
        email: "",
        name: "",
        role: defaultRole.name,
        phone: "",
        password: "",
        addresses: [""],
      });
      usersCache.clear();
      await fetchUsers(true);
    } catch (err) {
      console.error("Error creating user:", err);
      setCreateError(t("create.errors.generic"));
    } finally {
      setCreating(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <div className="p-4 sm:p-8">
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="h-10 bg-muted rounded w-48 mb-2 animate-pulse"></div>
                <div className="h-4 bg-muted/60 rounded w-56 animate-pulse mt-2"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
                <div className="h-10 bg-muted rounded-lg w-10 animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-3 bg-muted rounded w-24 mb-3 animate-pulse"></div>
                    <div className="h-7 bg-muted rounded w-12 animate-pulse"></div>
                  </div>
                  <div className="w-12 h-12 bg-muted rounded-lg animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-lg border border-border p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-10 bg-muted rounded animate-pulse"></div>
              <div className="h-10 bg-muted rounded animate-pulse"></div>
              <div className="h-10 bg-muted rounded animate-pulse"></div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-5 border-b border-border bg-muted/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-5 bg-muted rounded w-32 mb-1 animate-pulse"></div>
                  <div className="h-3 bg-muted/60 rounded w-24 mt-2 animate-pulse"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 bg-muted rounded w-20 animate-pulse"></div>
                  <div className="h-8 bg-muted rounded w-24 animate-pulse"></div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-muted/60 rounded w-24 mb-2 animate-pulse"></div>
                        <div className="h-2 bg-muted/60 rounded w-32 animate-pulse"></div>
                      </div>
                    </div>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-3 bg-muted/60 rounded w-20 animate-pulse"
                      ></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <div className="p-4 sm:p-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  {t("title")}
                </h1>
                <p className="text-muted-foreground mt-2 text-base">
                  {t("subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canCreateUsers ? (
                  <button
                    onClick={() => {
                      setCreateError("");
                      setShowCreateModal(true);
                    }}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 font-medium text-sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{t("actions.addUser")}</span>
                  </button>
                ) : null}

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-300"
                  title={t("actions.refreshTitle")}
                >
                  <RefreshCw
                    className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg shadow-sm">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <p className="text-destructive font-medium text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError("")}
                className="text-destructive/70 hover:text-destructive transition-colors duration-200 p-1 rounded hover:bg-destructive/10"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          <div className="rounded-lg border border-border bg-card p-3 transition-colors duration-300 hover:border-primary/30 sm:p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                  {t("stats.totalUsers")}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground sm:mt-2 sm:text-2xl">
                  {pagination.total}
                </p>
              </div>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-10 sm:w-10 md:h-12 md:w-12">
                <Users className="h-4 w-4 text-primary sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 transition-colors duration-300 hover:border-primary/30 sm:p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                  {t("stats.activeUsers")}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground sm:mt-2 sm:text-2xl">
                  {
                    users.filter(
                      (u) =>
                        !u.banned ||
                        (u.banExpires && Date.now() > u.banExpires * 1000),
                    ).length
                  }
                </p>
              </div>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/10 sm:h-10 sm:w-10 md:h-12 md:w-12">
                <Users className="h-4 w-4 text-green-500 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 transition-colors duration-300 hover:border-primary/30 sm:p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                  {t("stats.adminAccounts")}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground sm:mt-2 sm:text-2xl">
                  {
                    users.filter((u) =>
                      (u.role || "").toLowerCase().includes("admin"),
                    ).length
                  }
                </p>
              </div>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 sm:h-10 sm:w-10 md:h-12 md:w-12">
                <Users className="h-4 w-4 text-purple-500 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/30 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground sm:text-lg">
                  {t("list.title")}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {t("list.subtitle")}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:flex-row sm:items-center">
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground">
                  {t("list.totalUsers", { count: pagination.total })}
                </div>

                {pagination.totalPages > 1 && (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground">
                    {t("list.pageOf", {
                      page: pagination.page,
                      totalPages: pagination.totalPages,
                    })}
                  </div>
                )}

                <select
                  value={pagination.limit}
                  onChange={(e) =>
                    setPagination((prev) => ({
                      ...prev,
                      limit: parseInt(e.target.value),
                      page: 1,
                    }))
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="10">{t("list.perPage", { count: 10 })}</option>
                  <option value="25">{t("list.perPage", { count: 25 })}</option>
                  <option value="50">{t("list.perPage", { count: 50 })}</option>
                  <option value="100">
                    {t("list.perPage", { count: 100 })}
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <UserFilters
                search={filters.search}
                role={filters.role}
                roles={roles}
                onSearchChange={handleSearchChange}
                onRoleChange={handleRoleChange}
                onReset={handleResetFilters}
              />
            </div>
          </div>

          {users.length === 0 ? (
            <div className="px-4 py-12 text-center sm:px-6 sm:py-16">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted sm:h-16 sm:w-16">
                <Users className="h-7 w-7 text-muted-foreground sm:h-8 sm:w-8" />
              </div>

              <h3 className="mb-2 text-base font-semibold text-foreground sm:text-lg">
                {t("empty.title")}
              </h3>

              <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
                {filters.search || filters.role
                  ? t("empty.filtered")
                  : t("empty.noUsers")}
              </p>

              {(filters.search || filters.role) && (
                <button
                  onClick={handleResetFilters}
                  className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80"
                >
                  {t("empty.clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <div className="min-w-[900px]">
                  <UserTable
                    users={filteredUsers}
                    onUserUpdate={handleUserUpdate}
                    onUserDelete={handleUserDelete}
                  />
                </div>
              </div>

              {pagination.totalPages > 1 && (
                <div className="border-t border-border bg-muted/30 p-4 sm:p-5">
                  <Pagination
                    currentPage={paginationData.page}
                    totalPages={paginationData.totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {canCreateUsers && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/50 backdrop-blur-sm">
          <div className="bg-card rounded-lg shadow-lg border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {t("create.title")}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("create.subtitle")}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("create.email")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder-muted-foreground"
                  placeholder={t("create.emailPlaceholder")}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("create.name")}
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder-muted-foreground"
                    placeholder={t("create.namePlaceholder")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("create.phone")}
                  </label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder-muted-foreground"
                    placeholder={t("create.phonePlaceholder")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("create.role")}{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, role: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    disabled={rolesLoading}
                  >
                    {rolesLoading ? (
                      <option value="">{t("create.loadingRoles")}</option>
                    ) : roles.length > 0 ? (
                      roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.label}{" "}
                          {role.isSystem && t("create.systemSuffix")}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="user">{t("roles.user")}</option>
                        <option value="admin">{t("roles.admin")}</option>
                        <option value="moderator">
                          {t("roles.moderator")}
                        </option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("create.password")}{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder-muted-foreground pr-9"
                      placeholder={t("create.passwordPlaceholder")}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-foreground">
                  {t("create.addresses")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                {newUser.addresses.map((addr, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={addr}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewUser((prev) => {
                            const next = { ...prev };
                            const copy = [...next.addresses];
                            copy[index] = value;
                            next.addresses = copy;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder-muted-foreground"
                        placeholder={
                          index === 0
                            ? t("create.mainAddressPlaceholder")
                            : t("create.additionalAddressPlaceholder", {
                                index,
                              })
                        }
                      />
                    </div>
                    {newUser.addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewUser((prev) => ({
                            ...prev,
                            addresses: prev.addresses.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                        className="px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors"
                      >
                        {t("create.remove")}
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setNewUser((prev) => ({
                      ...prev,
                      addresses: [...prev.addresses, ""],
                    }))
                  }
                  className="text-xs px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {t("create.addAnother")}
                </button>
              </div>

              {createError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-xs text-destructive">{createError}</p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium"
                >
                  {t("create.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-60 flex items-center gap-2"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>
                    {creating ? t("create.creating") : t("create.submit")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
