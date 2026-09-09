import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/seo";
import { getStoreFeatureRegistry } from "@/lib/store-features-server";
import { disabledProductTypes } from "@/lib/store-features";
import { getEffectiveStorefrontCategoryIds } from "@/lib/category-navigation-server";
import { getBookProductVisibilityWhere } from "@/lib/book-product-visibility-server";
import { getStorefrontBooks } from "@/lib/book-catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const registry = await getStoreFeatureRegistry();
  const disabledTypes = disabledProductTypes(registry.features);
  const bookVisibility = await getBookProductVisibilityWhere();
  const staticRouteDefinitions = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/ecommerce/products", changeFrequency: "daily", priority: 0.9 },
    { path: "/ecommerce/categories", changeFrequency: "weekly", priority: 0.8 },
    { path: "/ecommerce/brands", changeFrequency: "weekly", priority: 0.8 },
    { path: "/ecommerce/flash-sale", changeFrequency: "daily", priority: 0.85 },
    ...(registry.features.PC_BUILDER.enabled
      ? [{ path: "/ecommerce/pc-builder", changeFrequency: "daily" as const, priority: 0.85 }]
      : []),
    ...(registry.features.BOOKS.enabled
      ? [
          { path: "/ecommerce/books", changeFrequency: "daily" as const, priority: 0.85 },
          { path: "/ecommerce/publishers", changeFrequency: "weekly" as const, priority: 0.7 },
        ]
      : []),
    ...(registry.features.AUTHORS.enabled
      ? [{ path: "/ecommerce/authors", changeFrequency: "weekly" as const, priority: 0.75 }]
      : []),
    { path: "/ecommerce/bestsellers", changeFrequency: "daily", priority: 0.8 },
    { path: "/ecommerce/blogs", changeFrequency: "weekly", priority: 0.7 },
    { path: "/ecommerce/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/ecommerce/contact", changeFrequency: "monthly", priority: 0.6 },
    { path: "/ecommerce/faq", changeFrequency: "monthly", priority: 0.5 },
    { path: "/ecommerce/shipping", changeFrequency: "monthly", priority: 0.5 },
    { path: "/ecommerce/returns", changeFrequency: "monthly", priority: 0.5 },
    { path: "/ecommerce/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/ecommerce/terms", changeFrequency: "yearly", priority: 0.3 },
  ] as const;
  const staticRoutes: MetadataRoute.Sitemap = staticRouteDefinitions.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const activeCategoryIds = await getEffectiveStorefrontCategoryIds();
    const [products, blogs, brands, categories, books] = await Promise.all([
      prisma.product.findMany({
        where: {
          deleted: false,
          available: true,
          categoryId: { in: activeCategoryIds },
          ...(disabledTypes.length ? { type: { notIn: disabledTypes } } : {}),
          ...bookVisibility,
        },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.blog.findMany({
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.brand.findMany({
        where: { deleted: false },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { id: { in: activeCategoryIds }, deleted: false },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      registry.features.BOOKS.enabled ? getStorefrontBooks() : Promise.resolve([]),
    ]);

    const authors = new Map<number, Date>();
    const publishers = new Map<number, Date>();
    for (const book of books) {
      const updatedAt = new Date(book.product.updatedAt);
      if (book.writer && registry.features.AUTHORS.enabled) authors.set(book.writer.id, updatedAt);
      if (book.publisher) publishers.set(book.publisher.id, updatedAt);
    }

    return [
      ...staticRoutes,
      ...products.map((product) => ({
        url: `${siteUrl}/ecommerce/products/${product.id}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...blogs.map((blog) => ({
        url: `${siteUrl}/ecommerce/blogs/${encodeURIComponent(blog.slug)}`,
        lastModified: blog.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.65,
      })),
      ...brands.map((brand) => ({
        url: `${siteUrl}/ecommerce/brands/${encodeURIComponent(brand.slug)}`,
        lastModified: brand.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...categories.map((category) => ({
        url: `${siteUrl}/ecommerce/products?category=${encodeURIComponent(category.slug)}`,
        lastModified: category.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...Array.from(authors, ([id, lastModified]) => ({
        url: `${siteUrl}/ecommerce/authors/${id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.65,
      })),
      ...Array.from(publishers, ([id, lastModified]) => ({
        url: `${siteUrl}/ecommerce/publishers/${id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.65,
      })),
    ];
  } catch (error) {
    console.error("Sitemap data loading failed", error);
    return staticRoutes;
  }
}
