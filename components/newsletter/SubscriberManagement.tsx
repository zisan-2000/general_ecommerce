"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Mail, Trash2, Download } from "lucide-react";

interface Subscriber {
  email: string;
  status: string;
}

interface SubscribersResponse {
  success: boolean;
  data: Subscriber[];
  count: number;
}

const API_BASE = "/api/newsletter/subscribers";

export default function SubscriberManagement() {
  const t = useTranslations("AdminSubscriberManagement");

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const showToast = useCallback(
    (title: string, description: string, variant: string = "default") => {
      toast({
        title,
        description,
        variant: variant as "default" | "destructive",
      });
    },
    [],
  );

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE);
      if (response.ok) {
        const data: SubscribersResponse = await response.json();
        if (data.success) {
          setSubscribers(data.data);
        } else {
          throw new Error(t("errors.fetchFailed"));
        }
      } else {
        throw new Error(t("errors.fetchFailed"));
      }
    } catch (error) {
      console.error("Failed to fetch subscribers:", error);
      showToast(t("toasts.errorTitle"), t("errors.fetchFailed"), "destructive");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast(t("toasts.successTitle"), t("toasts.added"));
        setNewEmail("");
        setIsAddDialogOpen(false);
        fetchSubscribers();
      } else {
        throw new Error(result.error || t("errors.addFailed"));
      }
    } catch (error) {
      showToast(
        t("toasts.errorTitle"),
        error instanceof Error ? error.message : t("errors.addFailed"),
        "destructive",
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEmail) return;

    try {
      const response = await fetch(`${API_BASE}?email=${deletingEmail}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast(t("toasts.successTitle"), t("toasts.deleted"));
        fetchSubscribers();
      } else {
        throw new Error(result.error || t("errors.deleteFailed"));
      }
    } catch (error) {
      showToast(
        t("toasts.errorTitle"),
        error instanceof Error ? error.message : t("errors.deleteFailed"),
        "destructive",
      );
    } finally {
      setDeletingEmail(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const openDeleteDialog = useCallback((email: string) => {
    setDeletingEmail(email);
    setIsDeleteDialogOpen(true);
  }, []);

  const exportSubscribers = useCallback(() => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        t("export.headers"),
        ...subscribers.map((sub) => `${sub.email},${sub.status}`),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "subscribers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(t("toasts.successTitle"), t("toasts.exported"));
  }, [subscribers, showToast, t]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">
            {t("header.title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("header.total", { count: subscribers.length })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={exportSubscribers}
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-all duration-300 w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="sm:hidden">{t("actions.exportShort")}</span>
            <span className="hidden sm:inline">{t("actions.exportCsv")}</span>
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("actions.addSubscriber")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4 bg-background border border-border rounded-2xl shadow-2xl">
              <DialogHeader className="border-b border-border pb-4">
                <DialogTitle className="text-lg sm:text-xl font-semibold text-foreground">
                  {t("addDialog.title")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubscriber} className="space-y-6 pt-4">
                <div>
                  <Label
                    htmlFor="email"
                    className="text-foreground font-medium"
                  >
                    {t("addDialog.emailLabel")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={t("addDialog.emailPlaceholder")}
                    className="bg-muted border-border focus:border-primary text-foreground placeholder-muted-foreground transition-colors duration-300"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary"
                >
                  {t("actions.addSubscriber")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Subscribers List */}
      <div className="grid gap-4">
        {subscribers.map((subscriber, index) => (
          <Card
            key={index}
            className="bg-card border border-border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm sm:text-base break-words">
                      {subscriber.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          subscriber.status === "subscribed"
                            ? "bg-green-500"
                            : "bg-orange-500"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          subscriber.status === "subscribed"
                            ? "text-green-700 dark:text-green-400"
                            : "text-orange-700 dark:text-orange-400"
                        }`}
                      >
                        {subscriber.status === "subscribed"
                          ? t("status.subscribed")
                          : t("status.unsubscribed")}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openDeleteDialog(subscriber.email)}
                  className="rounded-lg transition-all duration-300 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {subscribers.length === 0 && (
        <div className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
            {t("empty.title")}
          </h3>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            {t("empty.description")}
          </p>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105 border border-primary w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("actions.addSubscriber")}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm mx-4 bg-background border border-border rounded-2xl shadow-2xl p-4 sm:p-6">
          <DialogHeader className="border-b border-border pb-3 mb-4">
            <DialogTitle className="text-lg sm:text-xl font-semibold text-destructive">
              {t("deleteDialog.title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-foreground mb-6 text-sm sm:text-base">
            {t("deleteDialog.description", {
              email: deletingEmail ?? "",
            })}
          </p>
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              onClick={() => setIsDeleteDialogOpen(false)}
              className="bg-muted text-foreground hover:bg-muted/80 rounded-lg transition-all w-full sm:w-auto"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-lg transition-all w-full sm:w-auto"
            >
              {t("actions.removeSubscriber")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
