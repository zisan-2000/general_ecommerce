import { WAREHOUSE_PRODUCTS } from "./constants";
import { daysAgo, daysFromNow, money } from "./helpers";
import type { TxClient, WarehouseSeedContext } from "./types";

export async function seedWarehouseLogistics(
  prisma: TxClient,
  ctx: WarehouseSeedContext,
): Promise<WarehouseSeedContext> {
  const rows = [
    {
      key: "dhaka",
      productKey: "shoe",
      courierKey: "steadfast",
      status: "PENDING",
      orderStatus: "CONFIRMED",
      payment: "PAID",
      qty: 1,
      customer: "Dhaka Customer",
      phone: "01823000001",
    },
    {
      key: "ctg",
      productKey: "bag",
      courierKey: "redx",
      status: "ASSIGNED",
      orderStatus: "PROCESSING",
      payment: "PAID",
      qty: 2,
      customer: "Chattogram Customer",
      phone: "01823000002",
    },
    {
      key: "sylhet",
      productKey: "shirt",
      courierKey: "pathao",
      status: "IN_TRANSIT",
      orderStatus: "SHIPPED",
      payment: "PAID",
      qty: 3,
      customer: "Sylhet Customer",
      phone: "01823000003",
    },
    {
      key: "khulna",
      productKey: "watch",
      courierKey: "custom",
      status: "OUT_FOR_DELIVERY",
      orderStatus: "SHIPPED",
      payment: "PAID",
      qty: 1,
      customer: "Khulna Customer",
      phone: "01823000004",
    },
    {
      key: "rajshahi",
      productKey: "lamp",
      courierKey: "express",
      status: "DELIVERED",
      orderStatus: "DELIVERED",
      payment: "PAID",
      qty: 2,
      customer: "Rajshahi Customer",
      phone: "01823000005",
    },
  ];

  for (const [index, row] of rows.entries()) {
    const product = WAREHOUSE_PRODUCTS.find(
      (item) => item.key === row.productKey,
    )!;
    const total = product.price * row.qty;
    const vat = Math.round(total * 0.05);
    const shipping = 80 + index * 20;
    const grand = total + vat + shipping;
    const transactionId = `WH-ORDER-${String(index + 1).padStart(3, "0")}`;

    const existingOrder = await prisma.order.findFirst({
      where: { transactionId },
      select: { id: true },
    });

    const orderData = {
      userId: ctx.users.customer,
      name: row.customer,
      email: `warehouse.customer${index + 1}@boe.demo`,
      phone_number: row.phone,
      alt_phone_number: null,
      country: "BD",
      district:
        row.key === "ctg"
          ? "Chattogram"
          : row.key === "sylhet"
            ? "Sylhet"
            : row.key === "khulna"
              ? "Khulna"
              : row.key === "rajshahi"
                ? "Rajshahi"
                : "Dhaka",
      area: row.key,
      address_details: `Seeded warehouse logistics address ${index + 1}`,
      payment_method: index === 0 ? "COD" : "BKASH",
      order_date: daysAgo(5 - index),
      total: money(total),
      shipping_cost: money(shipping),
      Vat_total: money(vat),
      discount_total: money(0),
      grand_total: money(grand),
      currency: "BDT",
      status: row.orderStatus as any,
      paymentStatus: row.payment as any,
      transactionId,
      taxSnapshot: { vatRate: 0.05, source: "warehouse-seed" },
    };

    const order = existingOrder
      ? await prisma.order.update({
          where: { id: existingOrder.id },
          data: orderData,
          select: { id: true },
        })
      : await prisma.order.create({ data: orderData, select: { id: true } });

    ctx.orders[row.key] = order.id;

    await prisma.shipmentItem.deleteMany({
      where: {
        orderItem: {
          orderId: order.id,
        },
      },
    });
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: ctx.products[row.productKey],
        variantId: ctx.variants[row.productKey],
        quantity: row.qty,
        price: money(product.price),
        currency: "BDT",
        VatAmount: money(vat),
        discountAmount: money(0),
        costPriceSnapshot: money(product.cost),
      },
      select: { id: true },
    });
    ctx.orderItems[row.key] = orderItem.id;

    await prisma.payment.upsert({
      where: { externalId: `WH-PAY-${String(index + 1).padStart(3, "0")}` },
      update: {
        orderId: order.id,
        amount: money(grand),
        currency: "BDT",
        provider: index === 0 ? "COD" : "BKASH",
        status: row.payment === "PAID" ? "CAPTURED" : ("INITIATED" as any),
        paymentGatewayData: { seeded: true, source: "warehouse-seed" },
      },
      create: {
        orderId: order.id,
        amount: money(grand),
        currency: "BDT",
        provider: index === 0 ? "COD" : "BKASH",
        status: row.payment === "PAID" ? "CAPTURED" : ("INITIATED" as any),
        externalId: `WH-PAY-${String(index + 1).padStart(3, "0")}`,
        paymentGatewayData: { seeded: true, source: "warehouse-seed" },
      },
    });

    const existingShipment = await prisma.shipment.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    });

    const shipmentData = {
      orderId: order.id,
      warehouseId: ctx.warehouses[row.key],
      courier: row.courierKey,
      courierId: ctx.couriers[row.courierKey],
      shippingRateId: ctx.shippingRates[row.key],
      trackingNumber: `WH-TRK-${String(index + 1).padStart(4, "0")}`,
      externalId: `WH-SHIP-EXT-${String(index + 1).padStart(3, "0")}`,
      trackingUrl: `https://tracking.example.com/WH-TRK-${String(index + 1).padStart(4, "0")}`,
      status: row.status as any,
      courierStatus: row.status,
      lastSyncedAt: new Date(),
      shippedAt: index >= 2 ? daysAgo(3 - index) : null,
      pickedAt: index >= 1 ? daysAgo(4 - index) : null,
      outForDeliveryAt: index >= 3 ? daysAgo(1) : null,
      deliveredAt: row.status === "DELIVERED" ? daysAgo(0) : null,
      expectedDate: daysFromNow(index + 1),
      estimatedCost: money(80 + index * 20),
      actualCost: row.status === "DELIVERED" ? money(110) : null,
      packagingCost: money(20 + index * 3),
      handlingCost: money(15 + index * 2),
      fuelCost: money(10 + index * 4),
      priority: index,
      assignedToUserId: ctx.users.logistics,
      assignedAt: daysAgo(2),
      dispatchNote: `Warehouse logistics seed shipment ${index + 1}`,
    };

    const shipment = existingShipment
      ? await prisma.shipment.update({
          where: { id: existingShipment.id },
          data: shipmentData,
          select: { id: true },
        })
      : await prisma.shipment.create({
          data: shipmentData,
          select: { id: true },
        });

    ctx.shipments[row.key] = shipment.id;

    await prisma.shipmentItem.deleteMany({
      where: { shipmentId: shipment.id },
    });
    await prisma.shipmentItem.create({
      data: {
        shipmentId: shipment.id,
        orderItemId: orderItem.id,
        quantity: row.qty,
      },
    });

    await prisma.shipmentStatusLog.create({
      data: {
        shipmentId: shipment.id,
        fromStatus: index === 0 ? null : ("PENDING" as any),
        toStatus: row.status as any,
        source: "WAREHOUSE_SEED",
        note: `Seeded shipment status ${row.status}`,
      },
    });

    await prisma.shipmentCostLog.create({
      data: {
        shipmentId: shipment.id,
        costType: "DELIVERY",
        amount: money(80 + index * 20),
        note: "Seeded delivery cost",
        createdById: ctx.adminUserId ?? ctx.users.manager,
      },
    });

    await prisma.shipmentAssignment.create({
      data: {
        shipmentId: shipment.id,
        assignedToId: ctx.users.logistics,
        assignedById: ctx.adminUserId ?? ctx.users.manager,
        warehouseId: ctx.warehouses[row.key],
        role: "LOGISTICS_OWNER",
        note: "Seeded shipment assignment",
        assignedAt: daysAgo(2),
        completedAt: row.status === "DELIVERED" ? new Date() : null,
      },
    });
  }

  return ctx;
}
