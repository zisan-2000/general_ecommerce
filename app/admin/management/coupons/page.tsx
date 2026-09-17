"use client";

import { useState, useEffect, memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Tag } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  isValid: boolean;
  expiresAt?: string;
  createdAt: string;
}

const CouponManagement = memo(function CouponManagement() {
  const t = useTranslations("AdminCouponManagement");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    discountType: "",
    discountValue: "",
    minOrderValue: "",
    maxDiscount: "",
    usageLimit: "",
    isValid: true,
    expiresAt: "",
  });

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await fetch("/api/admin/coupons");
      if (response.ok) {
        const data = await response.json();
        setCoupons(data);
      }
    } catch {
      toast({
        title: t("toasts.errorTitle"),
        description: t("errors.fetchFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCoupon
        ? `/api/admin/coupons/${editingCoupon.id}`
        : "/api/admin/coupons";
      const method = editingCoupon ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: t("toasts.successTitle"),
          description: editingCoupon
            ? t("toasts.updated")
            : t("toasts.created"),
        });
        fetchCoupons();
        setIsCreateDialogOpen(false);
        setIsEditDialogOpen(false);
        setEditingCoupon(null);
        setFormData({
          code: "",
          discountType: "",
          discountValue: "",
          minOrderValue: "",
          maxDiscount: "",
          usageLimit: "",
          isValid: true,
          expiresAt: "",
        });
      } else {
        throw new Error(t("errors.saveFailed"));
      }
    } catch {
      toast({
        title: t("toasts.errorTitle"),
        description: t("errors.saveFailed"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm.delete"))) return;

    try {
      const response = await fetch(`/api/admin/management/coupons/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({
          title: t("toasts.successTitle"),
          description: t("toasts.deleted"),
        });
        fetchCoupons();
      } else {
        throw new Error(t("errors.deleteFailed"));
      }
    } catch {
      toast({
        title: t("toasts.errorTitle"),
        description: t("errors.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minOrderValue: coupon.minOrderValue?.toString() || "",
      maxDiscount: coupon.maxDiscount?.toString() || "",
      usageLimit: coupon.usageLimit?.toString() || "",
      isValid: coupon.isValid,
      expiresAt: coupon.expiresAt
        ? new Date(coupon.expiresAt).toISOString().split("T")[0]
        : "",
    });
    setIsEditDialogOpen(true);
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="space-y-8">
          <div className="bg-muted rounded-2xl shadow-lg p-6 mb-8 animate-pulse">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="h-8 bg-muted rounded w-48 mb-2"></div>
                <div className="h-4 bg-muted rounded w-64"></div>
              </div>
              <div className="h-12 bg-muted rounded-full w-32"></div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden"
              >
                <div className="bg-muted/50 border-b border-border p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 bg-muted rounded animate-pulse"></div>
                        <div className="h-5 bg-muted rounded w-24 animate-pulse"></div>
                      </div>
                      <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded-full w-16 animate-pulse"></div>
                      <div className="h-6 bg-muted rounded-full w-20 animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <div className="h-3 bg-muted rounded w-12 mb-1 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                    </div>
                    <div>
                      <div className="h-3 bg-muted rounded w-12 mb-1 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-14 animate-pulse"></div>
                    </div>
                    <div>
                      <div className="h-3 bg-muted rounded w-12 mb-1 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-12 animate-pulse"></div>
                    </div>
                    <div>
                      <div className="h-3 bg-muted rounded w-12 mb-1 animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 bg-muted rounded animate-pulse"></div>
                      <div className="w-8 h-8 bg-muted rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div>
        {/* Header Section */}
        <div className="bg-card border border-border shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                {t("header.title")}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("header.description")}
              </p>
            </div>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("actions.createCoupon")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-background border border-border rounded-2xl shadow-2xl">
                <DialogHeader className="border-b border-border pb-4">
                  <DialogTitle className="text-xl font-semibold text-foreground">
                    {t("createDialog.title")}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div>
                    <Label
                      htmlFor="code"
                      className="text-foreground font-medium"
                    >
                      {t("form.code")}
                    </Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder={t("placeholders.code")}
                      className="bg-muted border-border focus:border-primary text-foreground placeholder-muted-foreground transition-colors duration-300"
                      required
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="discountType"
                      className="text-foreground font-medium"
                    >
                      {t("form.discountType")}
                    </Label>
                    <Select
                      value={formData.discountType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, discountType: value })
                      }
                    >
                      <SelectTrigger className="bg-muted border-border focus:border-primary text-foreground">
                        <SelectValue
                          placeholder={t("placeholders.discountType")}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        <SelectItem value="percentage">
                          {t("discountTypes.percentage")}
                        </SelectItem>
                        <SelectItem value="fixed">
                          {t("discountTypes.fixed")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="discountValue"
                      className="text-foreground font-medium"
                    >
                      {t("form.discountValue")}
                    </Label>
                    <Input
                      id="discountValue"
                      type="number"
                      step="0.01"
                      value={formData.discountValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountValue: e.target.value,
                        })
                      }
                      placeholder={
                        formData.discountType === "percentage"
                          ? t("placeholders.percentValue")
                          : t("placeholders.amountValue")
                      }
                      className="bg-muted border-border focus:border-primary text-foreground placeholder-muted-foreground transition-colors duration-300"
                      required
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="minOrderValue"
                      className="text-foreground font-medium"
                    >
                      {t("form.minOrderValue")}
                    </Label>
                    <Input
                      id="minOrderValue"
                      type="number"
                      step="0.01"
                      value={formData.minOrderValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minOrderValue: e.target.value,
                        })
                      }
                      placeholder={t("placeholders.minOrderValue")}
                      className="bg-muted border-border focus:border-primary text-foreground placeholder-muted-foreground transition-colors duration-300"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="maxDiscount"
                      className="text-foreground font-medium"
                    >
                      {t("form.maxDiscount")}
                    </Label>
                    <Input
                      id="maxDiscount"
                      type="number"
                      step="0.01"
                      value={formData.maxDiscount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxDiscount: e.target.value,
                        })
                      }
                      placeholder={t("placeholders.maxDiscount")}
                      className="bg-muted border-border focus:border-primary text-foreground placeholder-muted-foreground transition-colors duration-300"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="usageLimit"
                      className="text-foreground font-medium"
                    >
                      {t("form.usageLimit")}
                    </Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, usageLimit: e.target.value })
                      }
                      placeholder={t("placeholders.usageLimit")}
                      className="bg-muted border-border focus:border-primary text-foreground placeholder-muted-foreground transition-colors duration-300"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="expiresAt"
                      className="text-foreground font-medium"
                    >
                      {t("form.expiresAt")}
                    </Label>
                    <Input
                      id="expiresAt"
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) =>
                        setFormData({ ...formData, expiresAt: e.target.value })
                      }
                      className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary"
                  >
                    {t("actions.createCoupon")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Coupon Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 p-6">
          {coupons.map((coupon) => (
            <Card
              key={coupon.id}
              className="bg-card border border-border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden"
            >
              <CardHeader className="bg-muted/50 border-b border-border">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Tag className="h-5 w-5 text-primary" />
                      {coupon.code}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm mt-1">
                      {coupon.discountType === "percentage"
                        ? t("card.percentOff", {
                            value: coupon.discountValue,
                          })
                        : t("card.amountOff", {
                            value: coupon.discountValue,
                          })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        coupon.isValid
                          ? "bg-green-100/20 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800"
                          : "bg-orange-100/20 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                      }`}
                    >
                      {coupon.isValid ? t("card.active") : t("card.inactive")}
                    </div>
                    {isExpired(coupon.expiresAt) && (
                      <div className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100/20 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                        {t("card.expired")}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">
                      {t("card.used")}
                    </span>
                    <p className="font-medium text-foreground">
                      {coupon.usedCount} / {coupon.usageLimit || "∞"}
                    </p>
                  </div>
                  {coupon.minOrderValue && (
                    <div>
                      <span className="text-muted-foreground">
                        {t("card.min")}
                      </span>
                      <p className="font-medium text-foreground">
                        ৳{coupon.minOrderValue}
                      </p>
                    </div>
                  )}
                  {coupon.maxDiscount && (
                    <div>
                      <span className="text-muted-foreground">
                        {t("card.max")}
                      </span>
                      <p className="font-medium text-foreground">
                        ৳{coupon.maxDiscount}
                      </p>
                    </div>
                  )}
                  {coupon.expiresAt && (
                    <div>
                      <span className="text-muted-foreground">
                        {t("card.expiry")}
                      </span>
                      <p className="font-medium text-foreground">
                        {new Date(coupon.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    {t("card.created", {
                      date: new Date(coupon.createdAt).toLocaleDateString(),
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(coupon)}
                      className="border-border text-foreground hover:bg-muted hover:border-primary rounded-lg transition-all duration-300"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(coupon.id)}
                      className="rounded-lg transition-all duration-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {coupons.length === 0 && (
          <div className="bg-card border border-border rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Tag className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t("empty.title")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("empty.description")}
            </p>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("actions.createCoupon")}
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md bg-background border border-border rounded-2xl shadow-2xl">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl font-semibold text-foreground">
                {t("editDialog.title")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <Label
                  htmlFor="edit-code"
                  className="text-foreground font-medium"
                >
                  {t("form.code")}
                </Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                  required
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-discountType"
                  className="text-foreground font-medium"
                >
                  {t("form.discountType")}
                </Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, discountType: value })
                  }
                >
                  <SelectTrigger className="bg-muted border-border focus:border-primary text-foreground">
                    <SelectValue placeholder={t("placeholders.discountType")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border">
                    <SelectItem value="percentage">
                      {t("discountTypes.percentage")}
                    </SelectItem>
                    <SelectItem value="fixed">
                      {t("discountTypes.fixed")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="edit-discountValue"
                  className="text-foreground font-medium"
                >
                  {t("form.discountValue")}
                </Label>
                <Input
                  id="edit-discountValue"
                  type="number"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, discountValue: e.target.value })
                  }
                  className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                  required
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-minOrderValue"
                  className="text-foreground font-medium"
                >
                  {t("form.minOrderValue")}
                </Label>
                <Input
                  id="edit-minOrderValue"
                  type="number"
                  step="0.01"
                  value={formData.minOrderValue}
                  onChange={(e) =>
                    setFormData({ ...formData, minOrderValue: e.target.value })
                  }
                  className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-maxDiscount"
                  className="text-foreground font-medium"
                >
                  {t("form.maxDiscount")}
                </Label>
                <Input
                  id="edit-maxDiscount"
                  type="number"
                  step="0.01"
                  value={formData.maxDiscount}
                  onChange={(e) =>
                    setFormData({ ...formData, maxDiscount: e.target.value })
                  }
                  className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-usageLimit"
                  className="text-foreground font-medium"
                >
                  {t("form.usageLimit")}
                </Label>
                <Input
                  id="edit-usageLimit"
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, usageLimit: e.target.value })
                  }
                  className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-expiresAt"
                  className="text-foreground font-medium"
                >
                  {t("form.expiresAt")}
                </Label>
                <Input
                  id="edit-expiresAt"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                  className="bg-muted border-border focus:border-primary text-foreground transition-colors duration-300"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-isValid"
                  checked={formData.isValid}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isValid: checked as boolean })
                  }
                  className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor="edit-isValid"
                  className="text-foreground font-medium"
                >
                  {t("form.active")}
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary"
              >
                {t("actions.updateCoupon")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
});

export default CouponManagement;
