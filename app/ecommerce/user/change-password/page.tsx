"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import AccountMenu from "../AccountMenu";
import AccountHeader from "../AccountHeader";
import { Home, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function ChangePasswordPage() {
  const t = useTranslations("CustomerAccount");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentOk, setCurrentOk] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [rePassword, setRePassword] = useState("");

  const [saving, setSaving] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRe, setShowRe] = useState(false);

  const reqIdRef = useRef(0);

  const mismatch = useMemo(() => {
    if (!newPassword || !rePassword) return false;
    return newPassword !== rePassword;
  }, [newPassword, rePassword]);

  const canEditNew = currentOk && !verifying;

  const canSubmit =
    currentOk &&
    !verifying &&
    newPassword.length >= 6 &&
    rePassword.length >= 6 &&
    !mismatch &&
    !saving;

  // ✅ Toast helpers
  const showSuccess = (msg: string) => {
    toast.success(msg, { duration: 3000 });
  };

  const showError = (msg: string) => {
    toast.error(msg, { duration: 4000 });
  };

  // ✅ Auto verify old password
  useEffect(() => {
    setCurrentOk(false);
    setNewPassword("");
    setRePassword("");

    if (!currentPassword) {
      setVerifying(false);
      return;
    }

    const myReqId = ++reqIdRef.current;

    const timeoutId = setTimeout(async () => {
      try {
        setVerifying(true);

        const res = await fetch("/api/user/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword }),
        });

        const data = await res.json().catch(() => ({}));

        if (myReqId !== reqIdRef.current) return;

        if (!res.ok || !data?.ok) {
          setCurrentOk(false);
          showError(t("password.errors.currentIncorrect"));
          return;
        }

        setCurrentOk(true);
      } catch (e: any) {
        if (myReqId !== reqIdRef.current) return;
        setCurrentOk(false);
        showError(t("password.errors.verify"));
      } finally {
        if (myReqId === reqIdRef.current) setVerifying(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentPassword]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentOk) return showError(t("password.errors.currentIncorrect"));
    if (newPassword.length < 6)
      return showError(t("password.errors.minimum"));
    if (mismatch)
      return showError(t("password.errors.mismatch"));

    try {
      setSaving(true);

      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        showError(t("common.unauthorized"));
        return;
      }

      if (!res.ok) {
        setCurrentOk(false);
        setNewPassword("");
        setRePassword("");
        showError(t("password.errors.update"));
        return;
      }

      // ✅ SUCCESS TOAST
      showSuccess(t("password.success"));

      setCurrentPassword("");
      setNewPassword("");
      setRePassword("");
      setCurrentOk(false);
    } catch {
      showError(t("password.errors.update"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Breadcrumb */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 hover:text-foreground">
            <Home className="h-4 w-4" />
            <span>{t("common.home")}</span>
          </Link>
          <span>›</span>
          <Link href="/ecommerce/user" className="hover:text-foreground">
            {t("common.account")}
          </Link>
          <span>›</span>
          <span className="text-foreground">{t("password.title")}</span>
        </div>
      </div>

      <AccountHeader />
      <AccountMenu />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-medium mb-6">{t("password.title")}</h2>

        <Card className="p-6 bg-card text-card-foreground border border-border rounded-2xl">
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Old Password */}
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-1">
                {t("password.current")}
              </p>

              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 pr-12 text-sm focus:ring-2 focus:ring-ring"
                  placeholder={t("password.currentPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showCurrent ? t("password.hide") : t("password.show")}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock size={12} />
                {verifying
                  ? t("password.checking")
                  : currentOk
                  ? t("password.verified")
                  : t("password.unlockHint")}
              </p>
            </div>

            {/* New Password */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  {t("password.new")}
                </p>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={!canEditNew}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 pr-12 text-sm disabled:opacity-60"
                    placeholder={t("password.newPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    disabled={!canEditNew}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    aria-label={showNew ? t("password.hide") : t("password.show")}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  {t("password.confirm")}
                </p>
                <div className="relative">
                  <input
                    type={showRe ? "text" : "password"}
                    value={rePassword}
                    onChange={(e) => setRePassword(e.target.value)}
                    disabled={!canEditNew}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 pr-12 text-sm disabled:opacity-60"
                    placeholder={t("password.confirmPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRe(!showRe)}
                    disabled={!canEditNew}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    aria-label={showRe ? t("password.hide") : t("password.show")}
                  >
                    {showRe ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {mismatch && canEditNew && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("password.errors.mismatch")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-10 px-6 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? t("password.updating") : t("password.update")}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
