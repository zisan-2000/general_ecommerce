import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BlogForm from "@/components/admin/blog/BlogForm";

interface EditBlogPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface BlogData {
  id: number;
  title: string;
  summary: string;
  content: string;
  date: Date;
  author: string;
  image: string;
  ads?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default async function EditBlogPage({ params }: EditBlogPageProps) {
  const awaited = await params;
  const blog = (await prisma.blog.findUnique({
    where: { id: parseInt(awaited.id) },
  })) as unknown as BlogData | null;

  if (!blog) {
    notFound();
  }

  return (
    <div className="min-h-screen gradient-soft p-4 sm:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur-sm">
          <div className="gradient-primary absolute inset-x-0 top-0 h-1" />
          <div className="flex items-center space-x-4">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
              <svg
                className="h-6 w-6 text-primary"
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
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                Edit Blog Post
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Update your blog post content and details
              </p>
            </div>
          </div>

          {/* Breadcrumb */}
          <nav className="mt-4 flex space-x-2 text-sm text-muted-foreground">
            <Link
              href="/admin"
              className="transition-colors duration-300 hover:text-interaction"
            >
              Dashboard
            </Link>
            <span>/</span>
            <Link
              href="/admin/management/blogs"
              className="transition-colors duration-300 hover:text-interaction"
            >
              Blogs
            </Link>
            <span>/</span>
            <span className="font-medium text-foreground">Edit</span>
          </nav>
        </div>

        {/* Blog Form */}
        <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-lg backdrop-blur-sm">
          <BlogForm blog={blog} />
        </div>
      </div>
    </div>
  );
}
