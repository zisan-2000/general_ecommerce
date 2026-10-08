// components/admin/blog/RecentBlogs.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, TrendingUp, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { processBlogSummary } from "./summaryUtils";

interface RecentBlog {
  id: number;
  slug: string;
  title: string;
  summary: string;
  date: string | Date;
  image?: string;
}

const RecentBlogSkeleton = () => (
  <div className="flex flex-col gap-3 p-4 rounded-lg border bg-card animate-pulse">
    <Skeleton className="h-32 w-full rounded-md" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);

export default function RecentBlogs() {
  const [recentBlogs, setRecentBlogs] = useState<RecentBlog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentBlogs = async () => {
      try {
        const response = await fetch("/api/blog?limit=4&sort=latest");
        if (!response.ok) throw new Error("Failed to fetch recent blogs");
        
        const data = await response.json();
        setRecentBlogs(data.blogs || data);
      } catch (error) {
        console.error("Error fetching recent blogs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentBlogs();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 shadow-md">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              🔥 Recent Posts
            </h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <RecentBlogSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (recentBlogs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 p-5 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 shadow-md animate-pulse">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            🔥 Recent Posts
          </h3>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-4">
          {recentBlogs.map((blog, index) => (
            <Link
              key={blog.id}
              href={`/ecommerce/blogs/${blog.slug}`}
              className="group block"
            >
              <article className="relative flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-interaction/50 hover:shadow-md transition-all duration-300 overflow-hidden">
                {/* Hover Effect Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Badge for first post */}
                {index === 0 && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                      <Sparkles className="h-3 w-3" />
                      New
                    </span>
                  </div>
                )}

                {/* Image */}
                {blog.image && (
                  <div className="relative w-full h-32 rounded-md overflow-hidden bg-muted">
                    <img
                      src={blog.image}
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                )}

                {/* Content */}
                <div className="relative space-y-2 flex-1">
                  <h4 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {blog.title}
                  </h4>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {processBlogSummary(blog.summary, 120)}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Calendar className="h-3 w-3 text-primary" />
                    <time dateTime={new Date(blog.date).toISOString()}>
                      {format(new Date(blog.date), "d MMM, yyyy", { locale: enUS })}
                    </time>
                  </div>
                </div>

                {/* Read More Indicator */}
                <div className="relative flex items-center text-xs font-medium text-primary group-hover:gap-2 transition-all">
                  <span>Read More</span>
                  <svg
                    className="h-3 w-3 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* View All Link */}
        <Link
          href="/ecommerce/blogs"
          className="mt-4 block text-center py-3 px-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-interaction/10 text-sm font-medium text-primary transition-all hover:border-solid"
        >
          View All Blogs →
        </Link>
      </div>
    </div>
  );
}
