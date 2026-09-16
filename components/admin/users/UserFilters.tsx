"use client";

import { Search, RotateCcw, Shield } from "lucide-react";
import { useTranslations } from "next-intl";

interface Role {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isImmutable: boolean;
  userCount: number;
}

interface UserFiltersProps {
  search: string;
  role: string;
  roles: Role[];
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onReset: () => void;
}

export default function UserFilters({
  search,
  role,
  roles,
  onSearchChange,
  onRoleChange,
  onReset,
}: UserFiltersProps) {
  const t = useTranslations("AdminUserFilters");

  const formatRoleLabel = (roleName: string) => {
    const role = roles.find((r) => r.name === roleName);
    return role
      ? role.label
      : roleName
          .split("_")
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
  };

  return (
    <div className="bg-gradient-to-r from-background to-muted p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-lg border-border mb-6 sm:mb-8">
      <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="sm:col-span-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-foreground placeholder-muted-foreground shadow-sm text-sm sm:text-base"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="w-full px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-foreground shadow-sm text-sm sm:text-base"
          >
            <option value="">{t("allRoles")}</option>
            {roles.length > 0 ? (
              roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.label} {role.isSystem && t("systemSuffix")}
                </option>
              ))
            ) : (
              <>
                <option value="user">{t("fallbackRoles.user")}</option>
                <option value="admin">{t("fallbackRoles.admin")}</option>
                <option value="moderator">
                  {t("fallbackRoles.moderator")}
                </option>
                <option value="manager">{t("fallbackRoles.manager")}</option>
              </>
            )}
          </select>
        </div>

        <div className="sm:flex sm:items-end">
          <button
            onClick={onReset}
            className="w-full py-2.5 sm:py-3 px-4 rounded-lg sm:rounded-xl bg-background border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-2 group text-sm sm:text-base"
          >
            <RotateCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>{t("resetFilters")}</span>
          </button>
        </div>
      </div>

      {(search || role) && (
        <div className="mt-4 p-2.5 sm:p-3 bg-muted bg-opacity-50 rounded-lg border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
              <span className="text-foreground font-medium text-xs sm:text-sm">
                {t("activeFilters")}
              </span>
              <div className="flex flex-wrap gap-2">
                {search && (
                  <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary bg-opacity-20 text-foreground text-xs border-border border-opacity-30">
                    <Search className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                    <span className="truncate max-w-[150px] sm:max-w-none">
                      "{search}"
                    </span>
                  </span>
                )}
                {role && (
                  <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary bg-opacity-20 text-foreground text-xs border-border border-opacity-30">
                    <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                    {formatRoleLabel(role)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onReset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center space-x-1 sm:self-start"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t("clearAll")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
