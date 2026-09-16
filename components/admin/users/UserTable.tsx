"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Eye,
  Ban,
  ShieldOff,
  Trash2,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Star,
  Shield,
  User as UserIcon,
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

interface UserTableProps {
  users: User[];
  onUserUpdate: (userId: string, updates: Partial<User>) => void;
  onUserDelete: (userId: string) => void;
}

export default function UserTable({
  users,
  onUserUpdate,
  onUserDelete,
}: UserTableProps) {
  const t = useTranslations("AdminUsersTable");
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("7");

  const handleBanUser = async (userId: string, email: string) => {
    if (!banReason) {
      alert(t("alerts.banReasonRequired"));
      return;
    }

    const banExpires =
      banDuration === "permanent"
        ? null
        : Date.now() + parseInt(banDuration) * 24 * 60 * 60 * 1000;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          banned: true,
          banReason,
          banExpires: banExpires ? Math.floor(banExpires / 1000) : null,
        }),
      });

      if (response.ok) {
        onUserUpdate(userId, {
          banned: true,
          banReason,
          banExpires: banExpires ? Math.floor(banExpires / 1000) : null,
        });
        setBanReason("");
      } else {
        alert(t("alerts.banFailed"));
      }
    } catch (error) {
      console.error("Error banning user:", error);
      alert(t("alerts.banError"));
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          banned: false,
          banReason: null,
          banExpires: null,
        }),
      });

      if (response.ok) {
        onUserUpdate(userId, {
          banned: false,
          banReason: null,
          banExpires: null,
        });
      } else {
        alert(t("alerts.unbanFailed"));
      }
    } catch (error) {
      console.error("Error unbanning user:", error);
      alert(t("alerts.unbanError"));
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(t("alerts.deleteConfirm", { email }))) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onUserDelete(userId);
      } else {
        const error = await response.json();
        alert(error.error || t("alerts.deleteFailed"));
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(t("alerts.deleteError"));
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isBanExpired = (banExpires: number | null) => {
    if (!banExpires) return false;
    return Date.now() > banExpires * 1000;
  };

  const getStatusColor = (user: User) => {
    if (user.banned && !isBanExpired(user.banExpires)) {
      return "bg-destructive/10 text-destructive border-destructive/20";
    } else if (user.emailVerified) {
      return "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-400/10 dark:text-green-400 dark:border-green-400/20";
    } else {
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-400/10 dark:text-yellow-400 dark:border-yellow-400/20";
    }
  };

  const getStatusText = (user: User) => {
    if (user.banned && !isBanExpired(user.banExpires)) {
      return user.banExpires
        ? t("status.temporarilyBanned")
        : t("status.permanentlyBanned");
    } else if (user.emailVerified) {
      return t("status.verified");
    } else {
      return t("status.unverified");
    }
  };

  const getRoleColor = (role: string) => {
    const normalized = role?.toLowerCase?.() || "";
    return normalized.includes("admin")
      ? "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-400/10 dark:text-purple-400 dark:border-purple-400/20"
      : "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-400/20";
  };

  const formatRoleLabel = (role: string) => {
    if (!role) return t("roles.user");
    return role
      .split("_")
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  };

  return (
    <div className="overflow-hidden rounded-2xl shadow-lg border-border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted shadow-sm">
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border">
                {t("columns.user")}
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border">
                {t("columns.role")}
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border">
                {t("columns.activities")}
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border">
                {t("columns.status")}
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border">
                {t("columns.joined")}
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-foreground uppercase tracking-wider border-b border-border">
                {t("columns.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-muted hover:bg-opacity-50 transition-all duration-300 group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-md">
                        <UserIcon className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {user.name || t("noName")}
                        </p>
                        {user.role?.toLowerCase?.().includes("admin") && (
                          <Shield className="h-3 w-3 text-purple-600" />
                        )}
                      </div>
                      <div className="flex items-center mt-1 space-x-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center mt-1 space-x-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}
                  >
                    {formatRoleLabel(user.role)}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1 text-foreground">
                      <ShoppingBag className="h-4 w-4" />
                      <span className="font-semibold">
                        {user._count.orders}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("activities.orders")}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <Star className="h-4 w-4" />
                      <span className="font-semibold">
                        {user._count.reviews}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("activities.reviews")}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(user)}`}
                  >
                    {getStatusText(user)}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/admin/operations/users/${user.id}`}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 group/action shadow-sm"
                      title={t("actions.view")}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>

                    {user.banned && !isBanExpired(user.banExpires) ? (
                      <button
                        onClick={() => handleUnbanUser(user.id)}
                        className="inline-flex items-center px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all duration-300 group/action shadow-sm"
                        title={t("actions.unban")}
                      >
                        <ShieldOff className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const modal = document.getElementById(
                            "ban-modal",
                          ) as HTMLDialogElement;
                          if (modal) {
                            modal.showModal();
                            modal.dataset.userId = user.id;
                            modal.dataset.userEmail = user.email;
                          }
                        }}
                        className="inline-flex items-center px-3 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-all duration-300 group/action shadow-sm"
                        title={t("actions.ban")}
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all duration-300 group/action shadow-sm"
                      title={t("actions.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 bg-background">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
            <UserIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t("empty.title")}
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t("empty.description")}
          </p>
        </div>
      )}

      <dialog
        id="ban-modal"
        className="modal modal-bottom sm:modal-middle rounded-xl"
      >
        <div className="modal-box p-6 bg-card border-border">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors">
              ✕
            </button>
          </form>

          <h3 className="text-xl font-bold text-foreground mb-6 flex items-center border-b border-border pb-3">
            <Ban className="h-6 w-6 mr-3 text-destructive" />
            {t("banModal.title")}
          </h3>

          <div className="py-4 space-y-5">
            <div>
              <label className="label">
                <span className="label-text text-foreground font-semibold">
                  {t("banModal.reason")}
                </span>
              </label>
              <textarea
                placeholder={t("banModal.reasonPlaceholder")}
                className="textarea textarea-bordered w-full border-border bg-muted text-foreground focus:border-destructive focus:ring-1 focus:ring-destructive transition-shadow p-2 rounded-lg"
                rows={3}
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text text-foreground font-semibold">
                  {t("banModal.duration")}
                </span>
              </label>
              <select className="select select-bordered w-full border-border bg-muted text-foreground focus:border-destructive focus:ring-1 focus:ring-destructive transition-shadow p-2 rounded-lg">
                <option value="1">{t("banModal.durations.1day")}</option>
                <option value="7">{t("banModal.durations.7days")}</option>
                <option value="30">{t("banModal.durations.30days")}</option>
                <option value="90">{t("banModal.durations.90days")}</option>
                <option value="365">{t("banModal.durations.1year")}</option>
                <option value="permanent">
                  {t("banModal.durations.permanent")}
                </option>
              </select>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-4">
              <div className="flex items-start space-x-3">
                <Ban className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {t("banModal.warningTitle")}
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">
                    {t("banModal.warningText")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action flex items-center justify-end border-t border-border pt-4 gap-2 mt-6">
            <button
              className="btn btn-ghost bg-secondary hover:bg-secondary/80 p-2 rounded-xl text-secondary-foreground hover:text-secondary-foreground transition-colors"
              onClick={() => {
                const modal = document.getElementById(
                  "ban-modal",
                ) as HTMLDialogElement;
                modal.close();
              }}
            >
              {t("banModal.cancel")}
            </button>

            <button
              className="btn flex items-center p-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive hover:border-destructive/90 transition-colors"
              onClick={() => {
                const modal = document.getElementById(
                  "ban-modal",
                ) as HTMLDialogElement;
                modal.close();
              }}
            >
              <Ban className="h-4 w-4 mr-2" />
              {t("banModal.submit")}
            </button>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label={t("banModal.closeModal")}></button>
        </form>
      </dialog>
    </div>
  );
}
