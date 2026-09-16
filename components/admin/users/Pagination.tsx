"use client";

import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const t = useTranslations("AdminPagination");

  const pages = [];
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 px-2 py-4 bg-muted rounded-xl border border-border shadow-sm">
      <div className="text-sm text-muted-foreground font-medium">
        {t("pageInfo", { current: currentPage, total: totalPages })}
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground transition-all duration-300 shadow-sm"
          title={t("firstPage")}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground transition-all duration-300 shadow-sm"
          title={t("previousPage")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {startPage > 1 && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-sm text-sm font-medium"
            >
              1
            </button>
            {startPage > 2 && (
              <span className="px-2 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            )}
          </div>
        )}

        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-300 shadow-sm ${
              page === currentPage
                ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-primary shadow-md transform scale-105"
                : "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <div className="flex items-center space-x-1">
            {endPage < totalPages - 1 && (
              <span className="px-2 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-sm text-sm font-medium"
            >
              {totalPages}
            </button>
          </div>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground transition-all duration-300 shadow-sm"
          title={t("nextPage")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground transition-all duration-300 shadow-sm"
          title={t("lastPage")}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
