"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { processBlogSummary } from "./summaryUtils";

const BlogForm = dynamic(() => import("./BlogForm"), { ssr: false });

interface Blog {
  id: number;
  title: string;
  summary: string;
  author: string;
  date: string | Date;
  image?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const BlogCard = memo(function BlogCard() {
  const t = useTranslations("AdminBlogManagement");

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      });

      const cacheKey = debouncedSearchTerm ? "no-store" : "default";
      const response = await fetch(`/api/blog?${params}`, {
        cache: cacheKey as RequestCache,
        next: { revalidate: debouncedSearchTerm ? 0 : 60 },
      });

      if (!response.ok) {
        throw new Error(t("errors.fetchFailed"));
      }

      const data = await response.json();

      if (data) {
        setBlogs(data.blogs || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching blogs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearchTerm]);

  const handleDelete = async (id: number) => {
    if (!confirm(t("confirm.delete"))) return;

    try {
      const response = await fetch(`/api/blog/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchBlogs();
      } else {
        alert(t("errors.deleteFailed"));
      }
    } catch (error) {
      console.error("Error deleting blog:", error);
      alert(t("errors.deleteFailed"));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header Skeleton */}
        <div className="rounded-2xl border border-border bg-gradient-to-r from-muted to-muted/50 p-4 shadow-lg animate-pulse sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="h-8 bg-muted rounded w-48 mb-2"></div>
              <div className="h-4 bg-muted rounded w-64"></div>
            </div>
            <div className="h-12 w-full rounded-full bg-muted sm:w-40"></div>
          </div>

          <div className="mt-6">
            <div className="relative max-w-full md:max-w-md">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 bg-muted rounded"></div>
              <div className="h-12 bg-muted rounded-xl w-full pl-10"></div>
            </div>
          </div>
        </div>

        {/* Blog Grid Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden"
            >
              <div className="relative h-44 overflow-hidden sm:h-48">
                <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 animate-pulse"></div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="h-6 bg-muted rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
                </div>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-1">
                    <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="h-4 w-full rounded bg-muted animate-pulse sm:w-12"></div>
                  <div className="h-4 w-full rounded bg-muted animate-pulse sm:w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Skeleton */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="h-10 w-full rounded bg-muted animate-pulse sm:w-20"></div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 bg-muted rounded animate-pulse"
                ></div>
              ))}
            </div>
            <div className="h-10 w-full rounded bg-muted animate-pulse sm:w-20"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 sm:space-y-6">
      {/* Header Section */}
      <div className="border border-border rounded-2xl bg-card p-4 shadow-lg sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {t("header.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("header.subtitle")}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex w-full items-center justify-center space-x-2 rounded-full border border-secondary bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition-all duration-300 hover:scale-105 hover:border-secondary/80 hover:bg-secondary/80 hover:shadow-lg sm:w-auto"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>{t("actions.newPost")}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-6">
          <div className="relative max-w-full md:max-w-md">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-foreground placeholder-muted-foreground transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Blog Grid */}
      {blogs.length > 0 ? (
        <>
          {/* Results Summary */}
          <div className="bg-card backdrop-blur-sm border border-border rounded-2xl shadow-lg p-4">
            <p className="text-sm text-muted-foreground">
              {t("resultsSummary", {
                start: (page - 1) * 12 + 1,
                end: Math.min(page * 12, totalCount),
                total: totalCount,
              })}
              {debouncedSearchTerm &&
                ` ${t("resultsFor", { term: debouncedSearchTerm })}`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {blogs.map((blog) => (
              <div
                key={blog.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-all duration-300 hover:shadow-xl sm:hover:scale-[1.02]"
              >
                <Link
                  href={`/admin/management/blogs/edit/${blog.id}`}
                  className="absolute inset-0 z-0"
                  aria-label={t("card.editAria", { title: blog.title })}
                />

                {/* Image */}
                <div className="relative h-44 overflow-hidden sm:h-48">
                  {blog.image ? (
                    <img
                      src={blog.image}
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2m0-1h.01"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5">
                  <h3 className="mb-2 line-clamp-2 text-base font-semibold text-foreground transition-colors duration-300 group-hover:text-primary sm:text-lg">
                    {blog.title}
                  </h3>
                  <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
                    {processBlogSummary(blog.summary, 160)}
                  </p>

                  {/* Meta Information */}
                  <div className="mb-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex min-w-0 items-center space-x-1">
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span className="truncate">{blog.author}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {new Date(blog.date).toLocaleDateString("en-US")}
                      </span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="relative z-10 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      href={`/admin/management/blogs/edit/${blog.id}`}
                      className="flex w-full items-center justify-center space-x-2 text-sm font-medium text-primary transition-colors duration-300 hover:text-primary/80 sm:w-auto sm:justify-start"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      <span>{t("actions.edit")}</span>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(blog.id);
                      }}
                      className="flex w-full items-center justify-center space-x-2 text-sm font-medium text-destructive transition-colors duration-300 hover:text-destructive/80 sm:w-auto sm:justify-start"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>{t("actions.delete")}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg sm:p-12">
          <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {t("empty.title")}
          </h3>
          <p className="text-muted-foreground mb-6">{t("empty.description")}</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full rounded-full border border-secondary bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition-all duration-300 hover:scale-105 hover:border-secondary/80 hover:bg-secondary/80 hover:shadow-lg sm:w-auto"
          >
            {t("empty.createPost")}
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="flex w-full items-center justify-center space-x-2 rounded-xl border border-border px-4 py-2 text-foreground transition-all duration-300 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span>{t("pagination.previous")}</span>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {page > 3 && (
                <>
                  <button
                    onClick={() => setPage(1)}
                    className="w-10 h-10 rounded-xl font-medium transition-all duration-300 text-muted-foreground hover:bg-muted"
                  >
                    1
                  </button>
                  {page > 4 && (
                    <span className="text-muted-foreground/50">...</span>
                  )}
                </>
              )}

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return pageNum <= totalPages ? (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-10 h-10 rounded-xl font-medium transition-all duration-300 ${
                      page === pageNum
                        ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {pageNum}
                  </button>
                ) : null;
              })}

              {page < totalPages - 2 && (
                <>
                  {page < totalPages - 3 && (
                    <span className="text-muted-foreground/50">...</span>
                  )}
                  <button
                    onClick={() => setPage(totalPages)}
                    className="w-10 h-10 rounded-xl font-medium transition-all duration-300 text-muted-foreground hover:bg-muted"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="flex w-full items-center justify-center space-x-2 rounded-xl border border-border px-4 py-2 text-foreground transition-all duration-300 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <span>{t("pagination.next")}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Blog Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="h-[88vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl sm:h-[80vh] sm:rounded-2xl">
            <BlogForm
              onSuccess={() => {
                setIsModalOpen(false);
                fetchBlogs();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default BlogCard;
