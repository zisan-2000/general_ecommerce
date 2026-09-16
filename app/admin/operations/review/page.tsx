"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Home,
  MessageSquareQuote,
  Sparkles,
  SquareDashed,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReviewSkeleton from "@/components/ui/ReviewSkeleton";

interface Review {
  id: number;
  rating: number;
  comment?: string;
  feature: boolean | null;
  user: {
    name: string;
    email: string;
  };
  product: {
    name: string;
    image?: string;
  };
}

export default function ReviewPage() {
  const t = useTranslations("AdminReviewPage");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  const fetchReviews = async (page: number = 1) => {
    setLoading(true);
    const response = await fetch(
      `/api/reviews/feature?page=${page}&limit=${itemsPerPage}`,
    );
    const data = await response.json();
    setReviews(data.data || []);
    setTotalPages(Math.ceil((data.total || 0) / itemsPerPage));
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews(currentPage);
  }, [currentPage]);

  const featuredCount = useMemo(
    () => reviews.filter((review) => Boolean(review.feature)).length,
    [reviews],
  );

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / reviews.length;
  }, [reviews]);

  const toggleFeature = async (id: number, current: boolean | null) => {
    await fetch("/api/reviews/feature", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        feature: !current,
      }),
    });

    fetchReviews(currentPage);
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold">{t("loadingTitle")}</h1>
        <ReviewSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/40 shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <MessageSquareQuote className="h-3.5 w-3.5" />
              {t("hero.badge")}
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
              {t("hero.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("hero.description")}
            </p>
          </div>

          <div className="grid gap-3 grid-cols-3">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("stats.placement")}
              </div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                <SquareDashed className="h-4 w-4 text-primary" />
                {t("stats.marquee")}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("stats.featuredNow")}
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {featuredCount}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("stats.avgRating")}
              </div>
              <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                {averageRating.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {review.product?.name}
                </h3>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    review.feature
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {review.feature ? t("card.featured") : t("card.standard")}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={`h-4 w-4 ${
                      index < review.rating
                        ? "fill-current"
                        : "fill-transparent text-muted"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm font-medium text-foreground">
                  {t("card.ratingOutOf", { rating: review.rating.toFixed(1) })}
                </span>
              </div>

              <p className="mt-4 min-h-[72px] text-sm leading-6 text-muted-foreground">
                {review.comment?.trim() || t("card.noComment")}
              </p>

              <div className="mt-4 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {review.user?.name}
                </span>
                {review.user?.email ? ` • ${review.user.email}` : ""}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {review.feature
                  ? t("card.visibleForHome")
                  : t("card.canBePromoted")}
              </div>

              <Button
                size="sm"
                variant={review.feature ? "destructive" : "default"}
                onClick={() => toggleFeature(review.id, review.feature)}
              >
                {review.feature ? t("actions.remove") : t("actions.feature")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            {t("pagination.previous")}
          </Button>

          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, index) => {
              const page = index + 1;
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="h-8 w-8 p-0"
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            {t("pagination.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
