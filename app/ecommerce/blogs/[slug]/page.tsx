import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import BlogDetails from "@/components/admin/blog/BlogDetails";
import { prisma } from "@/lib/prisma";
import { sanitizeStorefrontHtml } from "@/lib/storefront-html";
import { getSiteSettingsForSeo, getSiteUrl, stripHtml, truncateText, toAbsoluteUrl, serializeJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
// Blog currently has no soft-delete/publish flags; deleted records are absent.
const getBlog = cache(async (slug: string) => {
  const bySlug = await prisma.blog.findUnique({ where: { slug } });
  if (bySlug) return bySlug;
  const id = /^\d+$/.test(slug) ? Number(slug) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? prisma.blog.findUnique({ where: { id } }) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const blog = await getBlog((await params).slug);
  if (!blog) notFound();
  const settings = await getSiteSettingsForSeo();
  const url = toAbsoluteUrl(`/ecommerce/blogs/${encodeURIComponent(blog.slug)}`);
  const description = truncateText(stripHtml(blog.summary || blog.content));
  const image = toAbsoluteUrl(blog.image || settings.ogImage);
  return {
    title: blog.title, description, alternates: { canonical: url },
    openGraph: { type: "article", title: blog.title, description, url,
      images: [{ url: image, alt: blog.title }], publishedTime: blog.date.toISOString(),
      modifiedTime: blog.updatedAt.toISOString(), authors: blog.author ? [blog.author] : undefined },
    twitter: { card: "summary_large_image", title: blog.title, description, images: [image] },
  };
}

export default async function BlogPage({ params }: Props) {
  const { slug } = await params;
  const blog = await getBlog(slug);
  if (!blog) notFound();
  const href = `/ecommerce/blogs/${encodeURIComponent(blog.slug)}`;
  if (slug !== blog.slug) permanentRedirect(href);
  const settings = await getSiteSettingsForSeo();
  const url = toAbsoluteUrl(href);
  const article = {
    "@context": "https://schema.org", "@type": "BlogPosting", "@id": `${url}#article`,
    url, mainEntityOfPage: url, headline: blog.title,
    description: truncateText(stripHtml(blog.summary || blog.content)),
    image: blog.image ? toAbsoluteUrl(blog.image) : undefined,
    datePublished: blog.date.toISOString(), dateModified: blog.updatedAt.toISOString(),
    author: blog.author ? { "@type": "Person", name: blog.author } : undefined,
    publisher: { "@type": "Organization", "@id": `${getSiteUrl()}#organization`, name: settings.siteTitle },
  };
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Home", item: toAbsoluteUrl("/") },
      { name: "Store blog", item: toAbsoluteUrl("/ecommerce/blogs") },
      { name: blog.title, item: url },
    ].map((entry, index) => ({ "@type": "ListItem", position: index + 1, ...entry })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(article) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />
    <BlogDetails key={blog.slug} initialBlog={{ ...blog, content: sanitizeStorefrontHtml(blog.content), date: blog.date.toISOString(), createdAt: blog.createdAt.toISOString(), updatedAt: blog.updatedAt.toISOString(), ads: blog.ads }} />
  </>;
}
