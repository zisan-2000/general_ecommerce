// components/blog/BlogList.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

interface Blog {
  id: number;
  slug?: string;
  title: string;
  summary: string;
  author: string;
  date: string | Date;
  image?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// Helper function to format the time since creation in Bengali (e.g., "১৫ মিনিট আগে")
const formatFacebookTime = (date: string | Date, now: Date): string => {
  const past = new Date(date);

  const diffMs = now.getTime() - past.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // ---- Facebook Short Rules ----
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;

  // ---- Yesterday ----
  if (days === 1) {
    return `Yesterday at ${past.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  // ---- Same Year → March 12 at 3:45 PM ----
  if (past.getFullYear() === now.getFullYear()) {
    return past.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    }) + 
    " at " +
    past.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // ---- Previous Years → March 12, 2022 at 3:45 PM ----
  return past.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + 
  " at " +
  past.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function AllBlogs({ initialBlogs, initialTotalPages = 1 }: { initialBlogs?: Blog[]; initialTotalPages?: number }) {
  const [blogs, setBlogs] = useState<Blog[]>(initialBlogs ?? []);
  const [loading, setLoading] = useState(!initialBlogs);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [cache, setCache] = useState<Map<string, Blog[]>>(new Map());
  const [paginationCache, setPaginationCache] = useState<Map<number, { blogs: Blog[], totalPages: number }>>(new Map());

  // Memoize the fetch function to prevent unnecessary re-creations
  const fetchBlogs = useCallback(async (pageNum: number) => {
    const cacheKey = `page-${pageNum}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedData = paginationCache.get(pageNum);
      if (cachedData) {
        setBlogs(cachedData.blogs);
        setTotalPages(cachedData.totalPages);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10", // Showing 10 blogs per page
      });

      // API call to fetch all blogs
      const response = await fetch(`/api/blog?${params}`);
      const isJson = response.headers
        .get("content-type")
        ?.includes("application/json");
      const data = isJson ? await response.json() : null;

      if (response.ok && data?.blogs) {
        // Update cache
        setCache(prev => new Map(prev).set(cacheKey, data.blogs));
        setPaginationCache(prev => new Map(prev).set(pageNum, { blogs: data.blogs, totalPages: data.pagination?.pages || 1 }));
        
        setBlogs(data.blogs);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error("Error fetching blogs:", error);
      // Optionally show a user-friendly error message
    } finally {
      setLoading(false);
    }
  }, [cache, paginationCache]);

  // Keep the server and first browser render identical; localize after hydration.
  const [displayNow, setDisplayNow] = useState<Date | null>(null);
  useEffect(() => {
    setDisplayNow(new Date());
  }, []);

  // Memoize blog items to prevent unnecessary re-renders
  const blogItems = useMemo(() => {
    return blogs.map((blog) => ({
      ...blog,
      href: `/ecommerce/blogs/${encodeURIComponent(blog.slug || String(blog.id))}`,
      formattedDate: displayNow
        ? formatFacebookTime(blog.createdAt, displayNow)
        : new Date(blog.createdAt).toISOString().slice(0, 10),
    }));
  }, [blogs, displayNow]);

  // Memoize pagination buttons
  const paginationButtons = useMemo(() => {
    if (totalPages <= 1) return null;
    
    return Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => ({
      pageNum,
      isActive: page === pageNum,
    }));
  }, [totalPages, page]);

  useEffect(() => {
    if (page === 1 && initialBlogs) {
      setBlogs(initialBlogs);
      setTotalPages(initialTotalPages);
      setLoading(false);
      return;
    }
    fetchBlogs(page);
  }, [page, fetchBlogs, initialBlogs, initialTotalPages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className=" mx-auto">
          {/* Header Skeleton */}
          <div className="text-center mb-12">
            <div className="h-12 bg-muted rounded-lg w-96 mx-auto mb-4 animate-pulse"></div>
            <div className="h-1 bg-muted rounded-full w-32 mx-auto animate-pulse"></div>
          </div>

          {/* Blog Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border">
                {/* Image Skeleton */}
                <div className="relative h-48 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 animate-pulse"></div>
                  <div className="absolute top-4 right-4">
                    <div className="bg-muted text-muted text-xs font-bold px-3 py-1.5 rounded-full animate-pulse w-12 h-6"></div>
                  </div>
                </div>

                {/* Content Skeleton */}
                <div className="p-6">
                  <div className="h-6 bg-muted rounded-lg mb-3 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded mb-2 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded mb-2 animate-pulse w-5/6"></div>
                  <div className="h-4 bg-muted rounded mb-4 animate-pulse w-4/6"></div>

                  {/* Meta Info Skeleton */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-muted rounded-full animate-pulse"></div>
                      <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                    </div>
                    <div className="w-5 h-5 bg-muted rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (blogs.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-96 bg-background">
        <div className="text-center p-12 bg-card backdrop-blur-sm rounded-3xl shadow-2xl border border-border max-w-md">
          <div className="w-20 h-20 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">📝</span>
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-3">
            No blog posts found
          </h3>
          <p className="text-muted-foreground leading-relaxed">Waiting for new posts to be published.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className=" mx-auto">
        {/* Enhanced Header */}
        <header className="text-center mb-12 relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-gradient-to-r from-primary/10 to-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute top-0 right-1/4 w-40 h-40 bg-gradient-to-r from-primary/5 to-primary/10 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-3 h-12 bg-gradient-to-b from-primary to-primary/80 rounded-full shadow-lg"></div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Recent Blog Posts
              </h1>
              <div className="w-3 h-12 bg-gradient-to-b from-primary/80 to-primary rounded-full shadow-lg"></div>
            </div>
            <div className="h-1 w-32 bg-gradient-to-r from-primary to-primary/80 rounded-full mx-auto"></div>
          </div>
        </header>

        {/* Enhanced Blog Grid */}
        <section aria-label="Blog Posts Collection">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogItems.map((blog) => (
              <article
                key={blog.id}
                className="group block"
              >
                <Link
                  href={blog.href}
                  aria-label={`Read: ${blog.title}`}
                >
                  <div className="bg-card backdrop-blur-sm rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border border-border hover:border-interaction/50 transform hover:scale-105 hover:-translate-y-2">
                    {/* Image Section */}
                    <div className="relative h-48 overflow-hidden">
                      {blog.image ? (
                        <>
                          <img
                            src={blog.image}
                            alt={blog.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <span className="text-2xl">📝</span>
                            </div>
                            <span className="text-muted-foreground font-medium">No Image</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Blog Badge */}
                      <div className="absolute top-4 right-4">
                        <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                          Blog
                        </span>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6">
                      <header>
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 hover:text-interaction transition-colors duration-300 line-clamp-2 group-hover:translate-x-1 transform">
                          {blog.title}
                        </h2>
                      </header>
                      <p className="text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                        {blog.summary}
                      </p>

                      {/* Enhanced Meta Info */}
                      <footer className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full"></div>
                          <time dateTime={new Date(blog.createdAt).toISOString()} className="text-sm font-medium text-primary">
                            {blog.formattedDate}
                          </time>
                        </div>
                        <div className="text-primary group-hover:translate-x-1 transition-transform duration-300">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </footer>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Enhanced Pagination */}
        {paginationButtons && (
          <nav aria-label="Blog Pages" className="flex justify-center items-center mt-16 gap-4">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous Page"
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium rounded-2xl hover:from-primary/90 hover:to-primary/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-2" role="list">
              {paginationButtons.map(({ pageNum, isActive }) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={isActive ? "page" : undefined}
                  role="listitem"
                  className={`w-10 h-10 rounded-full font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                      : "bg-card text-muted-foreground hover:bg-muted border border-border"
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              aria-label="Next Page"
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium rounded-2xl hover:from-primary/90 hover:to-primary/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
