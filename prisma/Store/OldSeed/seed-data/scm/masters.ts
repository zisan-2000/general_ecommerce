import {
  SCM_BRANDS,
  SCM_CATEGORY_MASTERS,
  SCM_PRODUCT_VARIANTS,
  SCM_ROLE_USERS,
  SCM_SEED_PASSWORD,
  SCM_SUPPLIERS,
  SCM_WAREHOUSES,
} from "./constants";
import { SupplierDocumentType } from "../../../generated/prisma";
import {
  daysAgo,
  daysFromNow,
  decimal,
  ensureWarehouseMembership,
  slugify,
  upsertUserWithRole,
} from "./helpers";
import type { ScmSeedContext, ScmSeedPrisma } from "./types";

async function ensureWarehouseLocationTree(
  prisma: ScmSeedPrisma,
  warehouseId: number,
) {
  const zoneCodes = ["A", "B", "C"];
  let primaryBinId: number | null = null;

  for (const zoneCode of zoneCodes) {
    const zoneCodeValue = `Z-${zoneCode}`;
    const existingZone = await prisma.warehouseZone.findFirst({
      where: { warehouseId, code: zoneCodeValue },
      select: { id: true },
    });

    const zone = existingZone
      ? await prisma.warehouseZone.update({
          where: { id: existingZone.id },
          data: {
            name: `Zone ${zoneCode}`,
            isActive: true,
          },
        })
      : await prisma.warehouseZone.create({
          data: {
            warehouseId,
            code: zoneCodeValue,
            name: `Zone ${zoneCode}`,
            description: `Seeded storage zone ${zoneCode}.`,
            isActive: true,
          },
        });

    for (const aisleNo of [1, 2]) {
      const aisleCode = `A-${aisleNo.toString().padStart(2, "0")}`;
      const existingAisle = await prisma.warehouseAisle.findFirst({
        where: { warehouseId, zoneId: zone.id, code: aisleCode },
        select: { id: true },
      });

      const aisle = existingAisle
        ? await prisma.warehouseAisle.update({
            where: { id: existingAisle.id },
            data: {
              name: `Aisle ${aisleNo}`,
              isActive: true,
            },
          })
        : await prisma.warehouseAisle.create({
            data: {
              warehouseId,
              zoneId: zone.id,
              code: aisleCode,
              name: `Aisle ${aisleNo}`,
              isActive: true,
            },
          });

      for (const binNo of [1, 2]) {
        const binCode = `B-${binNo.toString().padStart(2, "0")}`;
        const existingBin = await prisma.warehouseBin.findFirst({
          where: { warehouseId, zoneId: zone.id, aisleId: aisle.id, code: binCode },
          select: { id: true },
        });

        const bin = existingBin
          ? await prisma.warehouseBin.update({
              where: { id: existingBin.id },
              data: {
                name: `Bin ${zoneCode}-${aisleNo}-${binNo}`,
                isActive: true,
              },
            })
          : await prisma.warehouseBin.create({
              data: {
                warehouseId,
                zoneId: zone.id,
                aisleId: aisle.id,
                code: binCode,
                name: `Bin ${zoneCode}-${aisleNo}-${binNo}`,
                isActive: true,
              },
            });

        if (!primaryBinId) {
          primaryBinId = bin.id;
        }
      }
    }
  }

  return primaryBinId;
}

export async function seedScmMasters(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const nextCtx: ScmSeedContext = {
    ...ctx,
    warehouses: { ...ctx.warehouses },
    suppliers: { ...ctx.suppliers },
    variants: { ...ctx.variants },
  };

  const categoriesBySlug = new Map<string, { id: number }>();
  for (const record of SCM_CATEGORY_MASTERS) {
    const category = await prisma.category.upsert({
      where: { slug: record.slug },
      update: {
        name: record.name,
        deleted: false,
      },
      create: {
        name: record.name,
        slug: record.slug,
        deleted: false,
      },
      select: { id: true, slug: true },
    });
    categoriesBySlug.set(record.slug, { id: category.id });
  }

  const brandsBySlug = new Map<string, { id: number }>();
  for (const record of SCM_BRANDS) {
    const brand = await prisma.brand.upsert({
      where: { slug: record.slug },
      update: {
        name: record.name,
        deleted: false,
      },
      create: {
        name: record.name,
        slug: record.slug,
        deleted: false,
      },
      select: { id: true, slug: true },
    });
    brandsBySlug.set(record.slug, { id: brand.id });
  }

  for (const record of SCM_WAREHOUSES) {
    const warehouse = await prisma.warehouse.upsert({
      where: { code: record.code },
      update: {
        name: record.name,
        area: record.area,
        country: "BD",
        district: record.district,
        division: record.division,
        latitude: record.latitude,
        longitude: record.longitude,
        isDefault: record.isDefault,
        mapLabel: record.name,
        postCode: "1208",
        locationNote: "Seeded SCM warehouse for demo workflows.",
        address: {
          line1: `${record.area}, ${record.district}`,
          city: record.district,
          division: record.division,
          country: "BD",
        },
      },
      create: {
        code: record.code,
        name: record.name,
        area: record.area,
        country: "BD",
        district: record.district,
        division: record.division,
        latitude: record.latitude,
        longitude: record.longitude,
        isDefault: record.isDefault,
        mapLabel: record.name,
        postCode: "1208",
        locationNote: "Seeded SCM warehouse for demo workflows.",
        address: {
          line1: `${record.area}, ${record.district}`,
          city: record.district,
          division: record.division,
          country: "BD",
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    const primaryBinId = await ensureWarehouseLocationTree(prisma, warehouse.id);

    nextCtx.warehouses[record.key] = {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      primaryBinId,
    };
  }

  for (const record of SCM_ROLE_USERS) {
    const user = nextCtx.users[record.key];
    const warehouse = Object.values(nextCtx.warehouses).find(
      (item) => item.code === record.warehouseCode,
    );

    if (user && warehouse) {
      await ensureWarehouseMembership(prisma, {
        userId: user.id,
        warehouseId: warehouse.id,
        assignedById: ctx.adminUserId,
        isPrimary: true,
      });
    }
  }

  for (const record of SCM_PRODUCT_VARIANTS) {
    const category = categoriesBySlug.get(record.categorySlug);
    if (!category) {
      throw new Error(`Missing SCM product category: ${record.categorySlug}`);
    }

    const brand = brandsBySlug.get(record.brandSlug);
    if (!brand) {
      throw new Error(`Missing SCM brand: ${record.brandSlug}`);
    }

    const productSlug = slugify(`${record.productName}-${record.sku}`);
    const product = await prisma.product.upsert({
      where: { slug: productSlug },
      update: {
        name: record.productName,
        categoryId: category.id,
        brandId: brand.id,
        description: `Seeded SCM catalog item for ${record.productName}.`,
        shortDesc: "SCM seeded catalog item",
        basePrice: decimal(record.price),
        currency: "BDT",
        available: true,
        featured: false,
        deleted: false,
        lowStockThreshold: record.lowStockThreshold,
        inventoryItemClass: record.inventoryItemClass,
        requiresAssetTag: record.requiresAssetTag,
        sku: record.sku,
      },
      create: {
        name: record.productName,
        slug: productSlug,
        categoryId: category.id,
        brandId: brand.id,
        description: `Seeded SCM catalog item for ${record.productName}.`,
        shortDesc: "SCM seeded catalog item",
        basePrice: decimal(record.price),
        currency: "BDT",
        available: true,
        featured: false,
        deleted: false,
        lowStockThreshold: record.lowStockThreshold,
        inventoryItemClass: record.inventoryItemClass,
        requiresAssetTag: record.requiresAssetTag,
        sku: record.sku,
        gallery: [],
      },
      select: {
        id: true,
        name: true,
      },
    });

    const existingVariant = await prisma.productVariant.findFirst({
      where: { sku: record.sku },
      select: { id: true },
    });

    const variant = existingVariant
      ? await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            productId: product.id,
            price: decimal(record.price),
            currency: "BDT",
            options: record.options,
            isDefault: true,
            active: true,
            lowStockThreshold: record.lowStockThreshold,
            costPrice: decimal(record.costPrice),
          },
          select: {
            id: true,
            sku: true,
            productId: true,
          },
        })
      : await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: record.sku,
            price: decimal(record.price),
            currency: "BDT",
            options: record.options,
            isDefault: true,
            active: true,
            lowStockThreshold: record.lowStockThreshold,
            costPrice: decimal(record.costPrice),
          },
          select: {
            id: true,
            sku: true,
            productId: true,
          },
        });

    nextCtx.variants[record.key] = {
      id: variant.id,
      sku: variant.sku,
      productId: variant.productId,
      productName: product.name,
    };
  }

  for (const warehouse of Object.values(nextCtx.warehouses)) {
    let seededVariantIndex = 0;

    for (const [variantKey, variant] of Object.entries(nextCtx.variants)) {
      seededVariantIndex += 1;
      const baseQuantity =
        warehouse.code === "WH-HQ"
          ? 120 - seededVariantIndex * 3
          : warehouse.code === "WH-CTG"
            ? 80 - seededVariantIndex * 2
            : warehouse.code === "WH-SYL"
              ? 36 - seededVariantIndex
              : 22 - Math.floor(seededVariantIndex / 2);
      const quantity = Math.max(baseQuantity, 4);
      const reserved = warehouse.code === "WH-HQ" && seededVariantIndex % 4 === 0 ? 2 : 0;

      const existingStock = await prisma.stockLevel.findFirst({
        where: {
          warehouseId: warehouse.id,
          productVariantId: variant.id,
        },
        select: { id: true },
      });

      if (existingStock) {
        await prisma.stockLevel.update({
          where: { id: existingStock.id },
          data: { quantity, reserved },
        });
      } else {
        await prisma.stockLevel.create({
          data: {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
            quantity,
            reserved,
          },
        });
      }

      if (warehouse.primaryBinId) {
        const existingBinLevel = await prisma.stockBinLevel.findFirst({
          where: {
            binId: warehouse.primaryBinId,
            productVariantId: variant.id,
          },
          select: { id: true },
        });

        if (existingBinLevel) {
          await prisma.stockBinLevel.update({
            where: { id: existingBinLevel.id },
            data: {
              warehouseId: warehouse.id,
              quantity,
              reserved,
            },
          });
        } else {
          await prisma.stockBinLevel.create({
            data: {
              warehouseId: warehouse.id,
              binId: warehouse.primaryBinId,
              productVariantId: variant.id,
              quantity,
              reserved,
            },
          });
        }
      }

      const variantConfig = SCM_PRODUCT_VARIANTS.find((item) => item.key === variantKey);
      if (!variantConfig) continue;

      const existingRule = await prisma.replenishmentRule.findFirst({
        where: {
          warehouseId: warehouse.id,
          productVariantId: variant.id,
        },
        select: { id: true },
      });

      const reorderPoint = variantConfig.lowStockThreshold;
      const targetStockLevel = reorderPoint * 4;

      if (existingRule) {
        await prisma.replenishmentRule.update({
          where: { id: existingRule.id },
          data: {
            strategy: "MIN_MAX",
            reorderPoint,
            targetStockLevel,
            safetyStock: Math.max(1, Math.floor(reorderPoint / 2)),
            minOrderQty: Math.max(1, Math.floor(reorderPoint / 2)),
            orderMultiple: 1,
            leadTimeDays: warehouse.code === "WH-HQ" ? 4 : 7,
            isActive: true,
            note: "Seeded SCM replenishment rule.",
            createdById: ctx.adminUserId,
            updatedById: ctx.adminUserId,
          },
        });
      } else {
        await prisma.replenishmentRule.create({
          data: {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
            strategy: "MIN_MAX",
            reorderPoint,
            targetStockLevel,
            safetyStock: Math.max(1, Math.floor(reorderPoint / 2)),
            minOrderQty: Math.max(1, Math.floor(reorderPoint / 2)),
            orderMultiple: 1,
            leadTimeDays: warehouse.code === "WH-HQ" ? 4 : 7,
            isActive: true,
            note: "Seeded SCM replenishment rule.",
            createdById: ctx.adminUserId,
            updatedById: ctx.adminUserId,
          },
        });
      }
    }
  }

  for (const record of SCM_PRODUCT_VARIANTS) {
    const variant = nextCtx.variants[record.key];
    const stockRows = await prisma.stockLevel.findMany({
      where: { productVariantId: variant.id },
      select: { quantity: true },
    });
    const totalQuantity = stockRows.reduce((sum, row) => sum + row.quantity, 0);

    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stock: totalQuantity },
    });
  }

  const supplierCategories = new Map<string, number>();
  for (const code of new Set(SCM_SUPPLIERS.flatMap((item) => item.categories))) {
    const category = await prisma.supplierCategory.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!category) {
      throw new Error(`Missing supplier category for SCM seed: ${code}`);
    }
    supplierCategories.set(code, category.id);
  }

  for (const record of SCM_SUPPLIERS) {
    const supplier = await prisma.supplier.upsert({
      where: { code: record.code },
      update: {
        name: record.name,
        companyType: record.companyType,
        contactName: record.contactName,
        email: record.email,
        phone: record.phone,
        address: `${record.city}, Bangladesh`,
        city: record.city,
        country: "BD",
        leadTimeDays: record.leadTimeDays,
        paymentTermsDays: record.paymentTermsDays,
        currency: "BDT",
        taxNumber: record.taxNumber,
        notes: "Seeded SCM supplier master.",
        isActive: true,
      },
      create: {
        code: record.code,
        name: record.name,
        companyType: record.companyType,
        contactName: record.contactName,
        email: record.email,
        phone: record.phone,
        address: `${record.city}, Bangladesh`,
        city: record.city,
        country: "BD",
        leadTimeDays: record.leadTimeDays,
        paymentTermsDays: record.paymentTermsDays,
        currency: "BDT",
        taxNumber: record.taxNumber,
        notes: "Seeded SCM supplier master.",
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    nextCtx.suppliers[record.key] = supplier;

    for (const categoryCode of record.categories) {
      const supplierCategoryId = supplierCategories.get(categoryCode);
      if (!supplierCategoryId) continue;

      const existingMapping = await prisma.supplierCategorySupplier.findFirst({
        where: {
          supplierCategoryId,
          supplierId: supplier.id,
        },
        select: { id: true },
      });

      if (!existingMapping) {
        await prisma.supplierCategorySupplier.create({
          data: {
            supplierCategoryId,
            supplierId: supplier.id,
            createdById: ctx.adminUserId,
          },
        });
      }
    }

    const documentTypes: SupplierDocumentType[] =
      record.companyType === "LIMITED_COMPANY"
        ? [
            SupplierDocumentType.CERTIFICATE_OF_INCORPORATION,
            SupplierDocumentType.TRADE_LICENSE,
            SupplierDocumentType.TAX_IDENTIFICATION_NUMBER,
            SupplierDocumentType.BANK_INFORMATION,
          ]
        : [
            SupplierDocumentType.PROPRIETOR_NID,
            SupplierDocumentType.TRADE_LICENSE,
            SupplierDocumentType.TAX_IDENTIFICATION_NUMBER,
            SupplierDocumentType.BANK_INFORMATION,
          ];

    for (const documentType of documentTypes) {
      const existingDocument = await prisma.supplierDocument.findFirst({
        where: {
          supplierId: supplier.id,
          type: documentType,
        },
        select: { id: true },
      });

      const commonData = {
        documentNumber: `${record.code}-${documentType}`,
        fileUrl: `/seed/scm/${record.code.toLowerCase()}/${documentType.toLowerCase()}.pdf`,
        fileName: `${documentType.toLowerCase()}.pdf`,
        verificationStatus: "VERIFIED" as const,
        verifiedAt: daysAgo(5),
        verifiedById: ctx.adminUserId,
        verificationNote: "Seeded and verified for SCM test coverage.",
        issuedAt: daysAgo(45),
        expiresAt: daysFromNow(320),
      };

      if (existingDocument) {
        await prisma.supplierDocument.update({
          where: { id: existingDocument.id },
          data: commonData,
        });
      } else {
        await prisma.supplierDocument.create({
          data: {
            supplierId: supplier.id,
            type: documentType,
            ...commonData,
          },
        });
      }
    }

    const existingPolicy = await prisma.supplierSlaPolicy.findFirst({
      where: { supplierId: supplier.id },
      select: { id: true },
    });

    const policy = existingPolicy
      ? await prisma.supplierSlaPolicy.update({
          where: { id: existingPolicy.id },
          data: {
            isActive: true,
            effectiveFrom: daysAgo(30),
            evaluationWindowDays: 90,
            minTrackedPoCount: 3,
            targetLeadTimeDays: record.leadTimeDays,
            minimumOnTimeRate: decimal(90),
            minimumFillRate: decimal(95),
            maxOpenLatePoCount: 1,
            autoEvaluationEnabled: true,
            warningActionDueDays: 7,
            breachActionDueDays: 3,
            terminationClauseEnabled: true,
            terminationLookbackDays: 180,
            terminationMinBreachCount: 3,
            terminationMinCriticalCount: 1,
            terminationRecommendedAction: "REVIEW_CONTRACT",
            terminationNote: "Seeded SCM SLA policy.",
            note: "Seeded SCM supplier SLA policy.",
            createdById: ctx.adminUserId,
            updatedById: ctx.adminUserId,
          },
          select: { id: true },
        })
      : await prisma.supplierSlaPolicy.create({
          data: {
            supplierId: supplier.id,
            isActive: true,
            effectiveFrom: daysAgo(30),
            evaluationWindowDays: 90,
            minTrackedPoCount: 3,
            targetLeadTimeDays: record.leadTimeDays,
            minimumOnTimeRate: decimal(90),
            minimumFillRate: decimal(95),
            maxOpenLatePoCount: 1,
            autoEvaluationEnabled: true,
            warningActionDueDays: 7,
            breachActionDueDays: 3,
            terminationClauseEnabled: true,
            terminationLookbackDays: 180,
            terminationMinBreachCount: 3,
            terminationMinCriticalCount: 1,
            terminationRecommendedAction: "REVIEW_CONTRACT",
            terminationNote: "Seeded SCM SLA policy.",
            note: "Seeded SCM supplier SLA policy.",
            createdById: ctx.adminUserId,
            updatedById: ctx.adminUserId,
          },
          select: { id: true },
        });

    const existingFinancialRule = await prisma.supplierSlaFinancialRule.findFirst({
      where: { supplierSlaPolicyId: policy.id },
      select: { id: true },
    });

    const financialRuleData = {
      isActive: true,
      holdPaymentsOnThreeWayVariance: true,
      holdPaymentsOnOpenSlaAction: true,
      allowPaymentHoldOverride: true,
      autoCreditRecommendationEnabled: true,
      autoApplyRecommendedCredit: false,
      autoApplyRequireMatchedInvoice: true,
      autoApplyBlockOnOpenDispute: true,
      warningPenaltyRatePercent: decimal(1),
      breachPenaltyRatePercent: decimal(2),
      criticalPenaltyRatePercent: decimal(5),
      minBreachCountForCredit: 1,
      autoApplyMaxAmount: decimal(5000),
      maxCreditCapAmount: decimal(15000),
      note: "Seeded SCM financial control rule.",
      createdById: ctx.adminUserId,
      updatedById: ctx.adminUserId,
    };

    if (existingFinancialRule) {
      await prisma.supplierSlaFinancialRule.update({
        where: { id: existingFinancialRule.id },
        data: financialRuleData,
      });
    } else {
      await prisma.supplierSlaFinancialRule.create({
        data: {
          supplierSlaPolicyId: policy.id,
          ...financialRuleData,
        },
      });
    }

    if (record.portal) {
      const supplierPortalUser = await upsertUserWithRole(prisma, {
        email: `portal.${record.code.toLowerCase()}@z.shoes.com`,
        password: SCM_SEED_PASSWORD,
        name: `${record.name} Portal`,
        roleName: "supplier_portal",
        phone: record.phone,
        note: "Seeded SCM supplier portal user",
      });

      await prisma.supplierPortalAccess.upsert({
        where: { userId: supplierPortalUser.id },
        update: {
          supplierId: supplier.id,
          status: "ACTIVE",
          note: "Seeded SCM supplier portal access.",
          createdById: ctx.adminUserId,
        },
        create: {
          userId: supplierPortalUser.id,
          supplierId: supplier.id,
          status: "ACTIVE",
          note: "Seeded SCM supplier portal access.",
          createdById: ctx.adminUserId,
        },
      });
    }
  }

  console.log(
    `✅ SCM masters ensured: ${Object.keys(nextCtx.warehouses).length} warehouses, ${Object.keys(nextCtx.variants).length} variants, ${Object.keys(nextCtx.suppliers).length} suppliers`,
  );

  return nextCtx;
}
