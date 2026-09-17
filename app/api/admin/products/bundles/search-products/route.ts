import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gateStoreFeature } from '@/lib/store-feature-gates-server';
import { requireProductManager } from '@/lib/product-management-access';
import { computeWarehouseAvailableStock } from '@/lib/warehouse-stock';

export async function GET(request: NextRequest) {
  const auth = await requireProductManager();
  if (auth) return auth;
  const featureGate = await gateStoreFeature('BUNDLES', 403);
  if (featureGate) return featureGate;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const requestedLimit = Number(searchParams.get('limit') || 20);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 20;
    const excludeBundleId = searchParams.get('excludeBundleId'); // Exclude products already in this bundle
    const categoryIds = searchParams.get('categoryIds'); // Filter by selected categories

    // Build where clause
    const where: any = {
      deleted: false,
      available: true,
      type: { not: 'BUNDLE' }, // Exclude other bundles
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { variants: { some: { active: true, sku: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // Filter by categories if provided
    if (categoryIds) {
      const requestedCategoryIds = categoryIds
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (requestedCategoryIds.length > 0) {
        // A merchant often selects a parent category (for example, Components).
        // Include every active child category so its actual catalog is visible.
        const categories = await prisma.category.findMany({
          where: { deleted: false },
          select: { id: true, parentId: true },
        });
        const effectiveCategoryIds = new Set(requestedCategoryIds);
        let changed = true;
        while (changed) {
          changed = false;
          for (const category of categories) {
            if (
              category.parentId !== null &&
              effectiveCategoryIds.has(category.parentId) &&
              !effectiveCategoryIds.has(category.id)
            ) {
              effectiveCategoryIds.add(category.id);
              changed = true;
            }
          }
        }
        where.categoryId = { in: [...effectiveCategoryIds] };
      }
    }

    // Get products with variants and basic info
    const products = await prisma.product.findMany({
      where,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        basePrice: true,
        originalPrice: true,
        currency: true,
        image: true,
        available: true,
        type: true,
        category: {
          select: { id: true, name: true }
        },
        brand: {
          select: { id: true, name: true }
        },
        variants: {
          where: { active: true },
          select: {
            id: true,
            sku: true,
            price: true,
            currency: true,
            stock: true,
            isDefault: true,
            options: true,
            stockLevels: {
              select: { quantity: true, reserved: true },
            },
          },
          orderBy: { isDefault: 'desc' }
        },
        // Exclude products already in the bundle if editing
        bundleItems: excludeBundleId ? {
          where: { bundleId: parseInt(excludeBundleId) },
          select: { productId: true }
        } : false
      },
      orderBy: [
        { featured: 'desc' },
        { name: 'asc' }
      ]
    });

    // Filter out products already in the bundle (if editing)
    const filteredProducts = excludeBundleId 
      ? products.filter(product => !product.bundleItems || product.bundleItems.length === 0)
      : products;

    // Format products for response
    const formattedProducts = filteredProducts.map(product => {
      // Get default variant or first variant
      const variants = product.variants.map((variant) => ({
        ...variant,
        availableStock:
          computeWarehouseAvailableStock(variant) ?? Math.max(0, Number(variant.stock)),
      }));
      const defaultVariant = variants.find(v => v.isDefault) || variants[0];
      
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        basePrice: Number(product.basePrice),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
        currency: product.currency,
        image: product.image,
        available: product.available,
        type: product.type,
        category: product.category,
        brand: product.brand,
        defaultPrice: defaultVariant ? Number(defaultVariant.price) : Number(product.basePrice),
        stock: product.type === 'PHYSICAL'
          ? (defaultVariant?.availableStock ?? 0)
          : 99,
        variants: variants.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          price: Number(variant.price),
          currency: variant.currency,
          stock: product.type === 'PHYSICAL' ? variant.availableStock : 99,
          isDefault: variant.isDefault,
          options: variant.options
        }))
      };
    });

    return NextResponse.json({
      products: formattedProducts,
      count: formattedProducts.length
    });

  } catch (error) {
    console.error('Error searching products for bundles:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}
