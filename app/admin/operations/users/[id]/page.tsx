"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import UserDetailSkeleton from "@/components/ui/UserDetailSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Mail,
  Phone,
  User as UserIcon,
  Shield,
  ShoppingBag,
  Star,
  Heart,
  ShoppingCart,
  Calendar,
  CheckCircle,
  XCircle,
  Ban,
  Clock,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
  address: {
    addresses?: string[];
    address_1?: string;
    address_2?: string;
    address_3?: string;
    [key: string]: unknown;
  } | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: number | null;
  note: string | null;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  orders: Array<{
    id: number;
    status: string;
    grandTotal: number;
    orderDate: Date;
  }>;
  _count: {
    orders: number;
    reviews: number;
    cart: number;
    wishlist: number;
  };
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"ban" | "unban" | null>(
    null
  );
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [roles, setRoles] = useState<Array<{id: string; name: string; label: string}>>([]);
  const [formData, setFormData] = useState({
    name: "",
    role: "user",
    phone: "",
    note: "",
    addresses: [""],
  });
  const canManageGlobalUserProfile = Array.isArray((session?.user as any)?.globalPermissions)
    ? ((session?.user as any).globalPermissions as string[]).includes("users.manage")
    : false;

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/admin/rbac/roles');
      if (response.ok) {
        const rolesData = await response.json();
        setRoles(rolesData);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  useEffect(() => {
    fetchRoles();
    
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/users/${params.id}`);
        if (response.ok) {
          const userData = await response.json();

          const normalizedUser: UserDetail = {
            ...userData,
            orders: (userData.orders ?? []).map((order: {
              id: number;
              status: string;
              grand_total: number | string;
              order_date: Date;
            }) => ({
              id: order.id,
              status: order.status,
              grandTotal: Number(order.grand_total),
              orderDate: order.order_date,
            })),
          };

          // Normalize addresses array from UserAddress objects
          let addresses: string[] = [];
          if (userData.addresses && Array.isArray(userData.addresses)) {
            addresses = userData.addresses
              .filter((addr: any) => addr && addr.details)
              .map((addr: any) => addr.details);
          } else if (userData.address) {
            // Handle legacy address format
            const rawAddress = userData.address as {
              addresses?: unknown;
              address_1?: string;
              address_2?: string;
              address_3?: string;
            };
            if (Array.isArray(rawAddress.addresses)) {
              addresses = rawAddress.addresses.filter(
                (a): a is string => typeof a === "string" && a.trim().length > 0
              );
            } else {
              if (rawAddress.address_1) addresses.push(rawAddress.address_1);
              if (rawAddress.address_2) addresses.push(rawAddress.address_2);
              if (rawAddress.address_3) addresses.push(rawAddress.address_3);
            }
          }
          if (addresses.length === 0) {
            addresses = [""];
          }

          setUser(normalizedUser);
          setFormData({
            name: userData.name || "",
            role: userData.role,
            phone: userData.phone || "",
            note: userData.note || "",
            addresses,
          });
        } else {
          toast.error("Failed to load user");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        toast.error("Error loading user data");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchUser();
    }
  }, [params.id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadingId = toast.loading("Updating user...");

      const trimmedAddresses = formData.addresses
        .map((a) => a.trim())
        .filter((a) => a.length > 0);

      if (trimmedAddresses.length === 0) {
        toast.error("Please provide at least one address");
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
          phone: formData.phone,
          note: formData.note,
          addresses: trimmedAddresses,
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();

        const normalizedUser: UserDetail = {
          ...updatedUser,
          orders: (updatedUser.orders ?? []).map((order: {
            id: number;
            status: string;
            grand_total: number | string;
            order_date: Date;
          }) => ({
            id: order.id,
            status: order.status,
            grandTotal: Number(order.grand_total),
            orderDate: order.order_date,
          })),
        };

        setUser(normalizedUser);
        setEditing(false);
        toast.dismiss(loadingId);
        toast.success("User updated successfully");
      } else {
        toast.error("Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Error updating user");
    } finally {
      setSaving(false);
    }
  };

  const handleBanUser = async () => {
    try {
      const response = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          banned: true,
          banReason: "Manually banned",
          banExpires: null,
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        toast.success("User banned successfully");
      } else {
        toast.error("Failed to ban user");
      }
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Error banning user");
    }
  };

  const handleUnbanUser = async () => {
    try {
      const response = await fetch(`/api/users/${params.id}`, {
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
        const updatedUser = await response.json();
        setUser(updatedUser);
        toast.success("User ban lifted successfully");
      } else {
        toast.error("Failed to lift ban");
      }
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Error lifting ban");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("Please fill in both password fields");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      setChangingPassword(true);
      const loadingId = toast.loading("Changing password...");

      const response = await fetch(`/api/users/${params.id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: passwordData.newPassword,
        }),
      });

      toast.dismiss(loadingId);

      if (response.ok) {
        toast.success("Password changed successfully");
        setShowPasswordModal(false);
        setPasswordData({ newPassword: "", confirmPassword: "" });
      } else {
        const data = await response.json().catch(() => ({}));
        setPasswordError(data?.error || "Failed to change password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("Error changing password");
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatRoleLabel = (role: string | null | undefined) => {
    const normalized = (role || "").trim();
    if (!normalized) return "User";
    return normalized
      .split("_")
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ");
  };

  const getStatusColor = (status: string) => {
    const colors = {
      DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700",
      CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700",
      PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700",
      CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700",
      PROCESSING: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700",
      SHIPPED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700",
    };
    return (
      colors[status as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
    );
  };

  const getStatusText = (status: string) => {
    const texts = {
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
      PENDING: "Pending",
      CONFIRMED: "Confirmed",
      PROCESSING: "Processing",
      SHIPPED: "Shipped",
    };
    return texts[status as keyof typeof texts] || status;
  };

  if (loading) {
    return <UserDetailSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-3">
              <XCircle className="h-6 w-6 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold text-destructive">
                  User not found
                </h3>
                <p className="text-destructive/80 mt-1">
                  The user you are looking for could not be found.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div>
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-card border text-muted-foreground hover:bg-interaction hover:text-accent-foreground transition-all duration-300 mb-6 shadow-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to User List</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                  <UserIcon className="h-8 w-8 text-primary-foreground" />
                </div>
                {user.banned && (
                  <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1 rounded-full">
                    <Ban className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {user.name || "No Name"}
                </h1>
                <p className="text-muted-foreground mt-1 flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>{user.email}</span>
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                      (user.role || "").toLowerCase().includes("admin")
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-700"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700"
                    }`}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {formatRoleLabel(user.role)}
                  </span>
                  {user.banned && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                      <Ban className="h-3 w-3 mr-1" />
                      Banned
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {canManageGlobalUserProfile && user.banned ? (
                <button
                  onClick={() => setConfirmAction("unban")}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 transition-all duration-300 shadow-sm font-medium"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Unban User</span>
                </button>
              ) : canManageGlobalUserProfile ? (
                <button
                  onClick={() => setConfirmAction("ban")}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-300 shadow-sm font-medium"
                >
                  <Ban className="h-4 w-4" />
                  <span>Ban User</span>
                </button>
              ) : null}

              <Link
                href={`/admin/operations/users/${user.id}/warehouse-access`}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-border bg-card text-foreground hover:bg-interaction transition-all duration-300 shadow-sm font-medium"
              >
                <Shield className="h-4 w-4" />
                <span>Warehouse Access</span>
              </Link>

              {canManageGlobalUserProfile ? (
                <>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-interaction hover:text-interaction-foreground transition-all duration-300 shadow-sm font-medium"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Change Password</span>
                  </button>

                  <button
                    onClick={() => setEditing(!editing)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all duration-300 shadow-sm font-medium ${
                      editing
                        ? "bg-muted text-muted-foreground border-border hover:bg-interaction hover:text-accent-foreground"
                        : "bg-primary text-primary-foreground border-primary hover:bg-interaction hover:text-interaction-foreground"
                    }`}
                  >
                    {editing ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Edit className="h-4 w-4" />
                    )}
                    <span>{editing ? "Cancel" : "Edit"}</span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Profile Information */}
            <div className="bg-card rounded-2xl shadow-lg border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                  <UserIcon className="h-5 w-5" />
                  <span>Profile Information</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border bg-muted text-muted-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    disabled={!editing}
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                    placeholder="User name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Legacy Role
                  </label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, role: value }))
                    }
                    disabled={!editing}
                  >
                    <SelectTrigger className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    disabled={!editing}
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                    placeholder="Phone number"
                  />
                </div>

                {/* Addresses - dynamic list */}
                <div className="md:col-span-2 space-y-3">
                  {formData.addresses.map((addr, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          {index === 0
                            ? "Address (at least one)"
                            : `Additional Address ${index + 1}`}
                        </label>
                        <input
                          type="text"
                          value={addr}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData((prev) => {
                              const copy = [...prev.addresses];
                              copy[index] = value;
                              return { ...prev, addresses: copy };
                            });
                          }}
                          disabled={!editing}
                          className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                          placeholder="House/Street/Area"
                        />
                      </div>
                      {editing && formData.addresses.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              addresses: prev.addresses.filter((_, i) => i !== index),
                            }))
                          }
                          className="mt-7 text-xs px-2 py-1 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}

                  {editing && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          addresses: [...prev.addresses, ""],
                        }))
                      }
                      className="text-xs px-3 py-2 rounded-xl border text-foreground hover:bg-interaction"
                    >
                      + Add Another Address
                    </button>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, note: e.target.value }))
                    }
                    disabled={!editing}
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 resize-none"
                    rows={4}
                    placeholder="Notes about user..."
                  />
                </div>
              </div>

              {editing && (
                <div className="flex justify-end space-x-3 pt-6 mt-6 border-t">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-6 py-2 rounded-xl border text-muted-foreground hover:bg-interaction transition-all duration-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-6 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-interaction hover:text-interaction-foreground transition-all duration-300 font-medium disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>{saving ? "Saving..." : "Save"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div className="bg-card rounded-2xl shadow-lg border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center space-x-2">
                <ShoppingBag className="h-5 w-5" />
                <span>Recent Orders</span>
              </h2>

              {user.orders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No orders found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {user.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-xl hover:bg-interaction/50 transition-all duration-300"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="font-semibold text-foreground">
                            Order #{order.id}
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}
                          >
                            {getStatusText(order.status)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(order.orderDate)}</span>
                          </div>
                          <div className="font-medium text-foreground">
                            {formatCurrency(order.grandTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Statistics */}
            <div className="bg-card rounded-2xl shadow-lg border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center space-x-2">
                <ShoppingBag className="h-5 w-5" />
                <span>User Statistics</span>
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-3">
                    <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-800 dark:text-blue-200">Total Orders</span>
                  </div>
                  <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {user._count.orders}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-3">
                    <Star className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-800 dark:text-green-200">Reviews</span>
                  </div>
                  <span className="text-lg font-bold text-green-900 dark:text-green-100">
                    {user._count.reviews}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center space-x-3">
                    <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <span className="text-purple-800 dark:text-purple-200">Cart Items</span>
                  </div>
                  <span className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {user._count.cart}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-pink-50 dark:bg-pink-950 rounded-lg border border-pink-200 dark:border-pink-800">
                  <div className="flex items-center space-x-3">
                    <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                    <span className="text-pink-800 dark:text-pink-200">Wishlist</span>
                  </div>
                  <span className="text-lg font-bold text-pink-900 dark:text-pink-100">
                    {user._count.wishlist}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Status */}
            <div className="bg-card rounded-2xl shadow-lg border p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Account Status</span>
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email Verified</span>
                  <div
                    className={`flex items-center space-x-1 ${
                      user.emailVerified ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
                    }`}
                  >
                    {user.emailVerified ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Yes</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">No</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Banned</span>
                  <div
                    className={`flex items-center space-x-1 ${
                      user.banned ? "text-destructive" : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {user.banned ? (
                      <>
                        <Ban className="h-4 w-4" />
                        <span className="text-sm font-medium">Yes</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">No</span>
                      </>
                    )}
                  </div>
                </div>

                {user.banned && user.banReason && (
                  <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="flex items-start space-x-2">
                      <Ban className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-destructive">
                          Ban Reason
                        </p>
                        <p className="text-sm text-destructive/80 mt-1">
                          {user.banReason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Member since</span>
                    </span>
                    <span className="text-foreground font-medium">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last updated</span>
                    <span className="text-foreground font-medium">
                      {formatDate(user.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ban/Unban Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-2xl border max-w-md w-full mx-4 p-6">
            <div className="flex items-start space-x-3">
              <div
                className={`p-2 rounded-full ${
                  confirmAction === "ban"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                }`}
              >
                {confirmAction === "ban" ? (
                  <Ban className="h-5 w-5" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {confirmAction === "ban"
                    ? "Ban this user?"
                    : "Lift ban?"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {confirmAction === "ban"
                    ? "This user will not be able to log in to the system or place new orders. Are you sure you want to ban this user?"
                    : "This user will be able to use the system again after lifting the ban. Are you sure?"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl border text-muted-foreground hover:bg-interaction transition-all duration-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  if (action === "ban") {
                    await handleBanUser();
                  } else if (action === "unban") {
                    await handleUnbanUser();
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-all duration-300 ${
                  confirmAction === "ban"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                }`}
              >
                {confirmAction === "ban" ? "Ban User" : "Lift Ban"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl shadow-2xl border max-w-md w-full mx-4 p-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Change Password
                </h3>
                <p className="text-sm text-muted-foreground">
                  Set new password for {user.name || user.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError("");
                  setPasswordData({ newPassword: "", confirmPassword: "" });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-12"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent pr-12"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive">{passwordError}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError("");
                  setPasswordData({ newPassword: "", confirmPassword: "" });
                }}
                className="px-4 py-2 rounded-xl border text-muted-foreground hover:bg-interaction transition-all duration-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-interaction hover:text-interaction-foreground transition-all duration-300 text-sm font-medium disabled:opacity-50 flex items-center space-x-2"
              >
                {changingPassword && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                <span>{changingPassword ? "Changing..." : "Change Password"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
