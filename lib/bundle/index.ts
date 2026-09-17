import type { Product, ProductBundleItem, ProductVariant, StockLevel } from '../../types/bundle';

export interface BundleItem {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
}

export interface BundlePricing {
  regularTotal: number;
  discountedPrice: number;
  discountAmount: number;
  discountPercentage: number;
}

export interface BundleStockResult {
  availableStock: number;
  stockLimitingItems: {
    productId: number;
    productName: string;
    availableStock: number;
    quantityNeeded: number;
    maxPossibleBundles: number;
  }[];
}

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'MANUAL';

export interface BundleCalculationInput {
  items: BundleItem[];
  discountType: DiscountType;
  discountValue: number;
  manualPrice?: number;
}

/**
 * Calculate bundle pricing based on items and discount
 */
export function calculateBundlePricing(input: BundleCalculationInput): BundlePricing {
  const { items, discountType, discountValue, manualPrice } = input;
  
  // Calculate regular total (sum of all item prices * quantities)
  const regularTotal = items.reduce((total, item) => {
    const price = item.variant?.price || item.product.basePrice;
    return total + Number(price) * item.quantity;
  }, 0);

  let discountedPrice = regularTotal;
  let discountAmount = 0;

  switch (discountType) {
    case 'PERCENTAGE':
      if (discountValue < 0 || discountValue > 100) {
        throw new Error('Percentage discount must be between 0 and 100');
      }
      discountAmount = regularTotal * (discountValue / 100);
      discountedPrice = regularTotal - discountAmount;
      break;

    case 'FIXED':
      if (discountValue < 0 || discountValue > regularTotal) {
        throw new Error('Fixed discount must be between 0 and regular total');
      }
      discountAmount = discountValue;
      discountedPrice = regularTotal - discountAmount;
      break;

    case 'MANUAL':
      if (!manualPrice || manualPrice < 0 || manualPrice > regularTotal) {
        throw new Error('Manual price must be between 0 and regular total');
      }
      discountedPrice = manualPrice;
      discountAmount = regularTotal - manualPrice;
      break;

    default:
      throw new Error('Invalid discount type');
  }

  const discountPercentage = regularTotal > 0 ? (discountAmount / regularTotal) * 100 : 0;

  return {
    regularTotal: Math.round(regularTotal * 100) / 100, // Round to 2 decimal places
    discountedPrice: Math.round(discountedPrice * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    discountPercentage: Math.round(discountPercentage * 100) / 100,
  };
}

/**
 * Calculate available stock for a bundle based on child product stock
 */
export async function calculateBundleStock(
  prisma: any, // Using any for now until Prisma types are generated
  bundleId: number,
  warehouseId?: number
): Promise<BundleStockResult> {
  // Get bundle items with product and variant information
  const bundleItems = await prisma.productBundleItem.findMany({
    where: { bundleId },
    include: {
      product: {
        include: {
          variants: warehouseId ? {
            include: {
              stockLevels: {
                where: { warehouseId },
                select: { quantity: true, reserved: true }
              }
            }
          } : true
        }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  if (bundleItems.length === 0) {
    return {
      availableStock: 0,
      stockLimitingItems: []
    };
  }

  const stockLimitingItems: BundleStockResult['stockLimitingItems'] = [];
  let maxPossibleBundles = Infinity;

  for (const bundleItem of bundleItems) {
    const { product, quantity } = bundleItem;
    
    // Get the default variant or first available variant
    const variant = product.variants?.find((v: ProductVariant) => v.isDefault) || product.variants?.[0];
    
    let availableStock = 0;
    
    if (warehouseId && variant?.stockLevels && variant.stockLevels.length > 0) {
      // Use warehouse-specific stock
      const stockLevel = variant.stockLevels[0];
      availableStock = stockLevel.quantity - stockLevel.reserved;
    } else if (variant) {
      // Use variant stock
      availableStock = variant.stock;
    } else {
      // For products without variants, use a default stock of 0
      availableStock = 0;
    }

    const maxBundlesForThisItem = Math.floor(availableStock / quantity);
    
    if (maxBundlesForThisItem < maxPossibleBundles) {
      maxPossibleBundles = maxBundlesForThisItem;
    }

    stockLimitingItems.push({
      productId: product.id,
      productName: product.name,
      availableStock,
      quantityNeeded: quantity,
      maxPossibleBundles: maxBundlesForThisItem
    });
  }

  return {
    availableStock: maxPossibleBundles === Infinity ? 0 : maxPossibleBundles,
    stockLimitingItems
  };
}

/**
 * Validate bundle configuration
 */
export function validateBundleConfiguration(
  items: BundleItem[],
  discountType: DiscountType,
  discountValue: number,
  manualPrice?: number | string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate items
  if (items.length < 2) {
    errors.push('Bundle must contain at least 2 items');
  }

  // Check for duplicate products
  const productIds = items.map(item => item.product.id);
  const uniqueProductIds = new Set(productIds);
  if (productIds.length !== uniqueProductIds.size) {
    errors.push('Bundle cannot contain duplicate products');
  }

  // Validate quantities
  for (const item of items) {
    if (item.quantity < 1) {
      errors.push(`Product "${item.product.name}" must have quantity of at least 1`);
    }
  }

  // Check if any product is a bundle itself
  for (const item of items) {
    if (item.product.type === 'BUNDLE') {
      errors.push(`Product "${item.product.name}" is already a bundle. Nested bundles are not supported`);
    }
  }

  // Validate discount
  switch (discountType) {
    case 'PERCENTAGE':
      if (discountValue < 0 || discountValue > 100) {
        errors.push('Percentage discount must be between 0 and 100');
      }
      break;

    case 'FIXED':
      const regularTotal = items.reduce((total, item) => {
        const price = item.variant?.price || item.product.basePrice;
        return total + Number(price) * item.quantity;
      }, 0);
      
      if (discountValue < 0 || discountValue > regularTotal) {
        errors.push('Fixed discount must be between 0 and regular total');
      }
      break;

    case 'MANUAL':
      const manualPriceNum = parseFloat(String(manualPrice || '0'));
      if (!manualPrice || manualPriceNum < 0) {
        errors.push('Manual price must be greater than 0');
      }
      
      const regularTotalForManual = items.reduce((total, item) => {
        const price = item.variant?.price || item.product.basePrice;
        return total + Number(price) * item.quantity;
      }, 0);
      
      if (manualPriceNum > regularTotalForManual) {
        errors.push('Manual price cannot exceed regular total');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format bundle pricing for display
 */
export function formatBundlePricing(pricing: BundlePricing): {
  regularTotal: string;
  discountedPrice: string;
  discountAmount: string;
  discountPercentage: string;
  savingsText: string;
} {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return {
    regularTotal: formatCurrency(pricing.regularTotal),
    discountedPrice: formatCurrency(pricing.discountedPrice),
    discountAmount: formatCurrency(pricing.discountAmount),
    discountPercentage: `${pricing.discountPercentage}%`,
    savingsText: pricing.discountPercentage > 0 
      ? `Save ${formatCurrency(pricing.discountAmount)} (${pricing.discountPercentage}%)`
      : 'No discount'
  };
}

/**
 * Check if a product is available for bundling
 */
export function isProductAvailableForBundling(product: Product): boolean {
  return (
    product.available &&
    !product.deleted &&
    product.type !== 'BUNDLE'
  );
}

/**
 * Merge duplicate products in bundle items (combines quantities)
 */
export function mergeDuplicateBundleItems(items: BundleItem[]): BundleItem[] {
  
  // Filter out any invalid items first
  const validItems = items.filter(item => {
    const isValid = item && item.product && item.product.id;
    if (!isValid) {
      console.warn('Filtering out invalid item:', item);
    }
    return isValid;
  });
  
  
  if (validItems.length === 0) {
    return [];
  }
  
  const merged = new Map<string, BundleItem>();

  for (const item of validItems) {
    // Create a unique key based on product ID and variant ID
    const key = `${item.product.id}-${item.variant?.id || 'default'}`;
    
    const existing = merged.get(key);
    
    if (existing) {
      // Merge quantities
      existing.quantity += item.quantity;
    } else {
      // Add new item with a clean copy
      const cleanItem: BundleItem = {
        product: { ...item.product },
        variant: item.variant ? { ...item.variant } : undefined,
        quantity: item.quantity
      };
      merged.set(key, cleanItem);
    }
  }

  const result = Array.from(merged.values());
  return result;
}
