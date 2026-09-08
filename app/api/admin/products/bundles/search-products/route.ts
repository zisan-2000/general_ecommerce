import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gateStoreFeature } from '@/lib/store-feature-gates-server';

export async function GET(request: NextRequest) {
  const featureGate = await gateStoreFeature('BUNDLES', 403);
  if (featureGate) return featureGate;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
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
      ];
    }

    // Filter by categories if provided
    if (categoryIds) {
      const categoryIdArray = categoryIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (categoryIdArray.length > 0) {
        where.categoryId = { in: categoryIdArray };
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
            options: true
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
      const defaultVariant = product.variants.find(v => v.isDefault) || product.variants[0];
      
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
        stock: defaultVariant?.stock || 0,
        variants: product.variants.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          price: Number(variant.price),
          currency: variant.currency,
          stock: variant.stock,
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
