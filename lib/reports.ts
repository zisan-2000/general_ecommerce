import { prisma } from "@/lib/prisma";
import { getInventoryStatus } from "@/lib/stock-status";

type DateRangeInput = {
  from?: string | null;
  to?: string | null;
};

type TaxSnapshotBreakdownRow = {
  className?: string | null;
  classCode?: string | null;
  vatAmount?: number | null;
  taxCharge?: number | null;
  countryCode?: string | null;
  inclusive?: boolean | null;
  rate?: number | null;
};

type TaxSnapshot = {
  totalTaxCharge?: number | null;
  totalInclusiveVAT?: number | null;
  totalExclusiveVAT?: number | null;
  breakdown?: TaxSnapshotBreakdownRow[] | null;
};

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function formatVariantOptions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, optionValue]) =>
      key.trim() &&
      optionValue !== null &&
      optionValue !== undefined &&
      String(optionValue).trim(),
  );
  return entries.map(([key, optionValue]) => `${key}: ${String(optionValue)}`).join(", ");
}

function buildDateRange(input: DateRangeInput) {
  const now = new Date();
  const fallbackFrom = addDays(now, -29);
  const fromDate = startOfDay(parseDateValue(input.from, fallbackFrom));
  const toDate = startOfDay(parseDateValue(input.to, now));
  const toExclusive = addDays(toDate, 1);

  if (toExclusive <= fromDate) {
    return {
      from: fromDate,
      to: addDays(fromDate, 1),
      fromLabel: formatDateKey(fromDate),
      toLabel: formatDateKey(fromDate),
    };
  }

  return {
    from: fromDate,
    to: toExclusive,
    fromLabel: formatDateKey(fromDate),
    toLabel: formatDateKey(addDays(toExclusive, -1)),
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function makeCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

export async function getReportsOverview(input: DateRangeInput = {}) {
  const range = buildDateRange(input);
  const orderDateWhere = {
    gte: range.from,
    lt: range.to,
  };
  const snapshotEndDate = addDays(range.to, -1);
  const logsFromDate = range.from;

  const [
    orders,
    refunds,
    inventoryLogs,
    shipments,
    shipmentStatusLogs,
    inventorySnapshots,
    inventoryWarehouseSnapshots,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { order_date: orderDateWhere },
      orderBy: { order_date: "desc" },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                options: true,
                costPrice: true,
              },
            },
          },
        },
      },
    }),
    prisma.refund.findMany({
      where: {
        status: "COMPLETED",
        payoutStatus: "PAID",
        paidAt: orderDateWhere,
      },
      include: {
        order: {
          select: {
            id: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            quantity: true,
            price: true,
            costPriceSnapshot: true,
            variant: {
              select: {
                costPrice: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryLog.findMany({
      where: { createdAt: orderDateWhere },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
    prisma.shipment.findMany({
      where: {
        createdAt: { lt: range.to },
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
        deliveryProof: {
          select: {
            id: true,
            confirmedAt: true,
          },
        },
      },
    }),
    prisma.shipmentStatusLog.findMany({
      where: {
        createdAt: {
          lt: range.to,
        },
        shipment: {
          createdAt: {
            lt: range.to,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        shipment: {
          select: {
            id: true,
            orderId: true,
            courier: true,
            createdAt: true,
            order: {
              select: {
                name: true,
                phone_number: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryDailySnapshot.findMany({
      where: {
        snapshotDate: {
          lte: snapshotEndDate,
        },
      },
      orderBy: [{ snapshotDate: "desc" }, { id: "desc" }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
          },
        },
      },
    }),
    prisma.inventoryWarehouseDailySnapshot.findMany({
      where: {
        snapshotDate: {
          lte: snapshotEndDate,
        },
      },
      orderBy: [{ snapshotDate: "desc" }, { id: "desc" }],
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  const activeOrders = orders.filter(
    (order) => !["CANCELLED", "FAILED", "RETURNED"].includes(order.status),
  );
  const salesDailyMap = new Map<string, { orders: number; revenue: number; vat: number }>();
  const topProductMap = new Map<
    number,
    { productId: number; name: string; quantity: number; revenue: number }
  >();
  const topVariantProfitMap = new Map<
    number,
    {
      variantId: number;
      sku: string;
      productName: string;
      optionsText: string;
      quantity: number;
      revenue: number;
      estimatedCost: number;
      grossProfit: number;
    }
  >();
  const vatCountryMap = new Map<string, { country: string; vatAmount: number; orders: number }>();
  const vatClassMap = new Map<
    string,
    {
      className: string;
      classCode: string;
      rate: number;
      inclusive: boolean;
      vatAmount: number;
      taxCharge: number;
      orders: number;
    }
  >();

  let subtotal = 0;
  let shippingTotal = 0;
  let vatTotal = 0;
  let grandTotal = 0;
  let paidTotal = 0;
  let unpaidTotal = 0;
  let grossSales = 0;
  let estimatedCost = 0;
  let missingCostItems = 0;
  let inclusiveVatTotal = 0;
  let exclusiveVatTotal = 0;
  let refundTotal = 0;
  let refundedUnits = 0;
  let refundedEstimatedCost = 0;

  for (const order of activeOrders) {
    const orderSubtotal = asNumber(order.total);
    const orderShipping = asNumber(order.shipping_cost);
    const orderVat = asNumber(order.Vat_total);
    const orderGrand = asNumber(order.grand_total);
    const dayKey = formatDateKey(order.order_date);

    subtotal = roundMoney(subtotal + orderSubtotal);
    shippingTotal = roundMoney(shippingTotal + orderShipping);
    vatTotal = roundMoney(vatTotal + orderVat);
    grandTotal = roundMoney(grandTotal + orderGrand);

    if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") {
      paidTotal = roundMoney(paidTotal + orderGrand);
    } else if (order.paymentStatus === "UNPAID") {
      unpaidTotal = roundMoney(unpaidTotal + orderGrand);
    }

    const currentDay = salesDailyMap.get(dayKey) || { orders: 0, revenue: 0, vat: 0 };
    currentDay.orders += 1;
    currentDay.revenue = roundMoney(currentDay.revenue + orderGrand);
    currentDay.vat = roundMoney(currentDay.vat + orderVat);
    salesDailyMap.set(dayKey, currentDay);

    if (orderVat > 0) {
      const countryKey = String(order.country || "Unknown").trim() || "Unknown";
      const currentCountry = vatCountryMap.get(countryKey) || {
        country: countryKey,
        vatAmount: 0,
        orders: 0,
      };
      currentCountry.vatAmount = roundMoney(currentCountry.vatAmount + orderVat);
      currentCountry.orders += 1;
      vatCountryMap.set(countryKey, currentCountry);
    }

    const taxSnapshot = (order.taxSnapshot as TaxSnapshot | null) || null;
    inclusiveVatTotal = roundMoney(
      inclusiveVatTotal + asNumber(taxSnapshot?.totalInclusiveVAT),
    );
    exclusiveVatTotal = roundMoney(
      exclusiveVatTotal + asNumber(taxSnapshot?.totalExclusiveVAT),
    );

    for (const breakdownRow of taxSnapshot?.breakdown || []) {
      const classCode = String(breakdownRow.classCode || "VAT");
      const key = `${classCode}:${breakdownRow.inclusive ? "I" : "E"}:${asNumber(
        breakdownRow.rate,
      )}`;
      const current = vatClassMap.get(key) || {
        className: String(breakdownRow.className || "VAT"),
        classCode,
        rate: asNumber(breakdownRow.rate),
        inclusive: Boolean(breakdownRow.inclusive),
        vatAmount: 0,
        taxCharge: 0,
        orders: 0,
      };
      current.vatAmount = roundMoney(current.vatAmount + asNumber(breakdownRow.vatAmount));
      current.taxCharge = roundMoney(current.taxCharge + asNumber(breakdownRow.taxCharge));
      current.orders += 1;
      vatClassMap.set(key, current);
    }

    for (const item of order.orderItems) {
      const lineRevenue = roundMoney(asNumber(item.price) * item.quantity);
      const unitCost =
        item.costPriceSnapshot !== null && item.costPriceSnapshot !== undefined
          ? asNumber(item.costPriceSnapshot)
          : asNumber(item.variant?.costPrice);
      const lineCost = roundMoney(unitCost * item.quantity);
      grossSales = roundMoney(grossSales + lineRevenue);
      estimatedCost = roundMoney(estimatedCost + lineCost);
      if (item.costPriceSnapshot == null) {
        missingCostItems += 1;
      }

      const productId = item.productId;
      const topProduct = topProductMap.get(productId) || {
        productId,
        name: item.product?.name || `Product #${productId}`,
        quantity: 0,
        revenue: 0,
      };
      topProduct.quantity += item.quantity;
      topProduct.revenue = roundMoney(topProduct.revenue + lineRevenue);
      topProductMap.set(productId, topProduct);

      if (item.variantId) {
        const variantKey = item.variantId;
        const currentVariant = topVariantProfitMap.get(variantKey) || {
          variantId: variantKey,
          sku: item.variant?.sku || `Variant #${variantKey}`,
          productName: item.product?.name || `Product #${item.productId}`,
          optionsText: formatVariantOptions(item.variant?.options),
          quantity: 0,
          revenue: 0,
          estimatedCost: 0,
          grossProfit: 0,
        };
        currentVariant.quantity += item.quantity;
        currentVariant.revenue = roundMoney(currentVariant.revenue + lineRevenue);
        currentVariant.estimatedCost = roundMoney(currentVariant.estimatedCost + lineCost);
        currentVariant.grossProfit = roundMoney(
          currentVariant.grossProfit + (lineRevenue - lineCost),
        );
        topVariantProfitMap.set(variantKey, currentVariant);
      }
    }
  }

  const grossProfit = roundMoney(grossSales - estimatedCost);
  for (const refund of refunds) {
    refundTotal = roundMoney(refundTotal + asNumber(refund.amount));
    refundedUnits += Math.max(0, Number(refund.quantity) || 0);

    const fallbackUnitCost =
      refund.orderItem?.costPriceSnapshot !== null &&
      refund.orderItem?.costPriceSnapshot !== undefined
        ? asNumber(refund.orderItem.costPriceSnapshot)
        : asNumber(refund.orderItem?.variant?.costPrice);
    const refundQty =
      Number(refund.quantity) ||
      Number(refund.orderItem?.quantity) ||
      0;
    refundedEstimatedCost = roundMoney(refundedEstimatedCost + fallbackUnitCost * refundQty);
  }

  const netSales = roundMoney(grandTotal - refundTotal);
  const netProfit = roundMoney(grossProfit - refundTotal + refundedEstimatedCost);
  const marginPct = grossSales > 0 ? roundMoney((grossProfit / grossSales) * 100) : 0;
  const netMarginPct = netSales > 0 ? roundMoney((netProfit / netSales) * 100) : 0;

  const latestVariantSnapshotMap = new Map<number, (typeof inventorySnapshots)[number]>();
  for (const snapshot of inventorySnapshots) {
    if (!latestVariantSnapshotMap.has(snapshot.variantId)) {
      latestVariantSnapshotMap.set(snapshot.variantId, snapshot);
    }
  }

  const latestWarehouseSnapshotMap = new Map<
    string,
    (typeof inventoryWarehouseSnapshots)[number]
  >();
  for (const snapshot of inventoryWarehouseSnapshots) {
    const key = `${snapshot.variantId}:${snapshot.warehouseId}`;
    if (!latestWarehouseSnapshotMap.has(key)) {
      latestWarehouseSnapshotMap.set(key, snapshot);
    }
  }

  const warehouseMap = new Map<
    number,
    { warehouseId: number; name: string; code: string; quantity: number; reserved: number }
  >();
  const lowStockVariants: Array<{
    variantId: number;
    sku: string;
    productName: string;
    stock: number;
    lowStockThreshold: number;
    status: string;
  }> = [];

  let totalUnits = 0;
  let reservedUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const snapshot of latestVariantSnapshotMap.values()) {
    const stock = Math.max(0, asNumber(snapshot.stock));
    const threshold = Math.max(0, asNumber(snapshot.lowStockThreshold));
    const status = String(snapshot.status || getInventoryStatus(stock, threshold));
    totalUnits += stock;

    if (status === "LOW_STOCK") {
      lowStockCount += 1;
    } else if (status === "OUT_OF_STOCK") {
      outOfStockCount += 1;
    }

    if (status !== "IN_STOCK") {
      lowStockVariants.push({
        variantId: snapshot.variantId,
        sku: snapshot.variant?.sku || `Variant #${snapshot.variantId}`,
        productName: snapshot.product?.name || `Product #${snapshot.productId}`,
        stock,
        lowStockThreshold: threshold,
        status,
      });
    }
  }

  for (const snapshot of latestWarehouseSnapshotMap.values()) {
    const currentWarehouse = warehouseMap.get(snapshot.warehouseId) || {
      warehouseId: snapshot.warehouseId,
      name: snapshot.warehouse.name,
      code: snapshot.warehouse.code,
      quantity: 0,
      reserved: 0,
    };
    currentWarehouse.quantity += Math.max(0, asNumber(snapshot.quantity));
    currentWarehouse.reserved += Math.max(0, asNumber(snapshot.reserved));
    warehouseMap.set(snapshot.warehouseId, currentWarehouse);
    reservedUnits += Math.max(0, asNumber(snapshot.reserved));
  }

  let movementIn = 0;
  let movementOut = 0;
  const movementReasonMap = new Map<string, { reason: string; change: number; events: number }>();

  for (const log of inventoryLogs) {
    const change = asNumber(log.change);
    if (change >= 0) {
      movementIn += change;
    } else {
      movementOut += Math.abs(change);
    }

    const reasonKey = String(log.reason || "Manual adjustment");
    const currentReason = movementReasonMap.get(reasonKey) || {
      reason: reasonKey,
      change: 0,
      events: 0,
    };
    currentReason.change += change;
    currentReason.events += 1;
    movementReasonMap.set(reasonKey, currentReason);
  }

  const shipmentStatusMap = new Map<string, number>();
  const courierMap = new Map<string, { courier: string; shipments: number; delivered: number; proofs: number }>();
  const deliveryExceptions: Array<{
    shipmentId: number;
    orderId: number;
    courier: string;
    status: string;
    customer: string;
    phone: string;
    proofStatus: string;
  }> = [];
  let proofConfirmed = 0;
  let proofPending = 0;

  const shipmentsCreatedInRange = shipments.filter(
    (shipment) => shipment.createdAt >= logsFromDate && shipment.createdAt < range.to,
  );
  const statusEventsInRange = shipmentStatusLogs.filter(
    (log) => log.createdAt >= logsFromDate && log.createdAt < range.to,
  );
  const proofsInRange = shipments.filter(
    (shipment) =>
      shipment.deliveryProof?.confirmedAt &&
      shipment.deliveryProof.confirmedAt >= logsFromDate &&
      shipment.deliveryProof.confirmedAt < range.to,
  );

  for (const shipment of shipmentsCreatedInRange) {
    const courierKey = shipment.courier || "Unknown";
    const currentCourier = courierMap.get(courierKey) || {
      courier: courierKey,
      shipments: 0,
      delivered: 0,
      proofs: 0,
    };
    currentCourier.shipments += 1;
    courierMap.set(courierKey, currentCourier);
  }

  for (const event of statusEventsInRange) {
    shipmentStatusMap.set(event.toStatus, (shipmentStatusMap.get(event.toStatus) ?? 0) + 1);
    const courierKey = event.shipment.courier || "Unknown";
    const currentCourier = courierMap.get(courierKey) || {
      courier: courierKey,
      shipments: 0,
      delivered: 0,
      proofs: 0,
    };
    if (event.toStatus === "DELIVERED") {
      currentCourier.delivered += 1;
    }
    courierMap.set(courierKey, currentCourier);
  }

  for (const shipment of proofsInRange) {
    proofConfirmed += 1;
    const courierKey = shipment.courier || "Unknown";
    const currentCourier = courierMap.get(courierKey) || {
      courier: courierKey,
      shipments: 0,
      delivered: 0,
      proofs: 0,
    };
    currentCourier.proofs += 1;
    courierMap.set(courierKey, currentCourier);
  }

  const latestStatusByShipment = new Map<
    number,
    {
      status: string;
      eventAt: Date;
      shipment: (typeof shipments)[number];
    }
  >();

  for (const shipment of shipments) {
    latestStatusByShipment.set(shipment.id, {
      status: shipment.status,
      eventAt: shipment.createdAt,
      shipment,
    });
  }

  for (const event of shipmentStatusLogs) {
    latestStatusByShipment.set(event.shipmentId, {
      status: event.toStatus,
      eventAt: event.createdAt,
      shipment:
        latestStatusByShipment.get(event.shipmentId)?.shipment ||
        shipments.find((shipment) => shipment.id === event.shipmentId)!,
    });
  }

  for (const latest of latestStatusByShipment.values()) {
    const proofConfirmedAt = latest.shipment.deliveryProof?.confirmedAt ?? null;
    const hasProofByEnd = Boolean(proofConfirmedAt && proofConfirmedAt < range.to);
    if (
      (latest.status === "OUT_FOR_DELIVERY" || latest.status === "DELIVERED") &&
      !hasProofByEnd
    ) {
      proofPending += 1;
    }

    if (
      latest.status === "RETURNED" ||
      latest.status === "CANCELLED" ||
      ((latest.status === "OUT_FOR_DELIVERY" || latest.status === "DELIVERED") &&
        !hasProofByEnd)
    ) {
      deliveryExceptions.push({
        shipmentId: latest.shipment.id,
        orderId: latest.shipment.orderId,
        courier: latest.shipment.courier || "Unknown",
        status: latest.status,
        customer: latest.shipment.order?.name || "Customer",
        phone: latest.shipment.order?.phone_number || "",
        proofStatus: hasProofByEnd ? "Confirmed" : "Missing proof",
      });
    }
  }

  return {
    filters: {
      from: range.fromLabel,
      to: range.toLabel,
    },
    sales: {
      summary: {
        totalOrders: orders.length,
        activeOrders: activeOrders.length,
        deliveredOrders: orders.filter((order) => order.status === "DELIVERED").length,
        cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
        paidOrders: orders.filter((order) => order.paymentStatus === "PAID").length,
        unpaidOrders: orders.filter((order) => order.paymentStatus !== "PAID").length,
        subtotal,
        shippingTotal,
        vatTotal,
        grandTotal,
        refundTotal,
        netSales,
        paidTotal,
        unpaidTotal,
        averageOrderValue:
          activeOrders.length > 0 ? roundMoney(grandTotal / activeOrders.length) : 0,
      },
      daily: Array.from(salesDailyMap.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, value]) => ({ date, ...value })),
      topProducts: Array.from(topProductMap.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
    },
    profit: {
      summary: {
        grossSales,
        estimatedCost,
        grossProfit,
        refundedEstimatedCost,
        netProfit,
        marginPct,
        netMarginPct,
        missingCostItems,
        completedRefunds: refunds.length,
        refundedUnits,
      },
      topVariants: Array.from(topVariantProfitMap.values())
        .sort((left, right) => right.grossProfit - left.grossProfit)
        .slice(0, 10),
    },
    vat: {
      summary: {
        totalVatCollected: vatTotal,
        inclusiveVatTotal,
        exclusiveVatTotal,
        taxedOrders: activeOrders.filter((order) => asNumber(order.Vat_total) > 0).length,
      },
      byCountry: Array.from(vatCountryMap.values()).sort(
        (left, right) => right.vatAmount - left.vatAmount,
      ),
      byClass: Array.from(vatClassMap.values()).sort(
        (left, right) => right.vatAmount - left.vatAmount,
      ),
    },
    inventory: {
      summary: {
        totalVariants: latestVariantSnapshotMap.size,
        totalUnits,
        reservedUnits,
        lowStockCount,
        outOfStockCount,
        movementIn,
        movementOut,
      },
      warehouses: Array.from(warehouseMap.values()).sort(
        (left, right) => right.quantity - left.quantity,
      ),
      lowStock: lowStockVariants
        .sort((left, right) => left.stock - right.stock)
        .slice(0, 12),
      movementReasons: Array.from(movementReasonMap.values()).sort(
        (left, right) => Math.abs(right.change) - Math.abs(left.change),
      ),
      recentLogs: inventoryLogs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        reason: log.reason,
        change: asNumber(log.change),
        productName: log.product?.name || `Product #${log.productId}`,
        variantSku: log.variant?.sku || "",
        warehouseName: log.warehouse?.name || "",
      })),
    },
    delivery: {
      summary: {
        totalShipments: shipmentsCreatedInRange.length,
        delivered: shipmentStatusMap.get("DELIVERED") ?? 0,
        outForDelivery: shipmentStatusMap.get("OUT_FOR_DELIVERY") ?? 0,
        inTransit: shipmentStatusMap.get("IN_TRANSIT") ?? 0,
        returned: shipmentStatusMap.get("RETURNED") ?? 0,
        cancelled: shipmentStatusMap.get("CANCELLED") ?? 0,
        proofConfirmed,
        proofPending,
      },
      byCourier: Array.from(courierMap.values()).sort(
        (left, right) => right.shipments - left.shipments,
      ),
      exceptions: deliveryExceptions.slice(0, 12),
    },
  };
}

export async function exportReportCsv(
  section: "sales" | "profit" | "vat" | "inventory" | "delivery",
  input: DateRangeInput = {},
) {
  const overview = await getReportsOverview(input);

  if (section === "sales") {
    return makeCsv(
      ["Date", "Orders", "Revenue", "VAT"],
      overview.sales.daily.map((row) => [row.date, row.orders, row.revenue, row.vat]),
    );
  }

  if (section === "profit") {
    return makeCsv(
      ["Variant ID", "SKU", "Product", "Options", "Qty", "Revenue", "Estimated Cost", "Gross Profit"],
      overview.profit.topVariants.map((row) => [
        row.variantId,
        row.sku,
        row.productName,
        row.optionsText,
        row.quantity,
        row.revenue,
        row.estimatedCost,
        row.grossProfit,
      ]),
    );
  }

  if (section === "vat") {
    return makeCsv(
      ["Class", "Code", "Rate %", "Inclusive", "VAT Amount", "Tax Charge", "Orders"],
      overview.vat.byClass.map((row) => [
        row.className,
        row.classCode,
        row.rate,
        row.inclusive ? "Yes" : "No",
        row.vatAmount,
        row.taxCharge,
        row.orders,
      ]),
    );
  }

  if (section === "inventory") {
    return makeCsv(
      ["Warehouse", "Code", "Quantity", "Reserved"],
      overview.inventory.warehouses.map((row) => [
        row.name,
        row.code,
        row.quantity,
        row.reserved,
      ]),
    );
  }

  return makeCsv(
    ["Shipment ID", "Order ID", "Courier", "Status", "Customer", "Phone", "Proof Status"],
    overview.delivery.exceptions.map((row) => [
      row.shipmentId,
      row.orderId,
      row.courier,
      row.status,
      row.customer,
      row.phone,
      row.proofStatus,
    ]),
  );
}
