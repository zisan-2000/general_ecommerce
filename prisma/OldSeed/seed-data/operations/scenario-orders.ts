import { daysAgo, money, orderTransactionId, paymentExternalId } from "./helpers";
import type { OperationsSeedContext, TxClient } from "./types";

const ORDERS = [
  {
    key: "pendingCod",
    userKey: "customerA",
    productKey: "runningShoe",
    quantity: 1,
    unitPrice: 3200,
    shipping: 80,
    status: "PENDING",
    paymentStatus: "UNPAID",
    paymentMethod: "COD",
    paymentState: "INITIATED",
    createdDaysAgo: 1,
    district: "Dhaka",
    area: "Mirpur",
  },
  {
    key: "confirmedPaid",
    userKey: "customerB",
    productKey: "leatherBag",
    quantity: 2,
    unitPrice: 2500,
    shipping: 120,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    paymentMethod: "BKASH",
    paymentState: "CAPTURED",
    createdDaysAgo: 3,
    district: "Dhaka",
    area: "Dhanmondi",
  },
  {
    key: "processingCard",
    userKey: "customerC",
    productKey: "denimJacket",
    quantity: 1,
    unitPrice: 4200,
    shipping: 100,
    status: "PROCESSING",
    paymentStatus: "PAID",
    paymentMethod: "CARD",
    paymentState: "CAPTURED",
    createdDaysAgo: 4,
    district: "Chattogram",
    area: "Agrabad",
  },
  {
    key: "shippedPaid",
    userKey: "customerA",
    productKey: "smartWatch",
    quantity: 1,
    unitPrice: 5200,
    shipping: 150,
    status: "SHIPPED",
    paymentStatus: "PAID",
    paymentMethod: "NAGAD",
    paymentState: "CAPTURED",
    createdDaysAgo: 6,
    district: "Sylhet",
    area: "Zindabazar",
  },
  {
    key: "deliveredPaid",
    userKey: "customerB",
    productKey: "deskLamp",
    quantity: 2,
    unitPrice: 1800,
    shipping: 100,
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "CARD",
    paymentState: "CAPTURED",
    createdDaysAgo: 10,
    district: "Khulna",
    area: "Sonadanga",
  },
] as const;

const CUSTOMER_PROFILE: Record<string, { name: string; email: string; phone: string }> = {
  customerA: { name: "Ayesha Rahman", email: "ops.customer.a@boe.demo", phone: "01711000001" },
  customerB: { name: "Tanvir Hasan", email: "ops.customer.b@boe.demo", phone: "01711000002" },
  customerC: { name: "Nusrat Jahan", email: "ops.customer.c@boe.demo", phone: "01711000003" },
};

export async function seedOperationsOrders(
  prisma: TxClient,
  ctx: OperationsSeedContext,
): Promise<OperationsSeedContext> {
  for (const item of ORDERS) {
    const customer = CUSTOMER_PROFILE[item.userKey];
    const total = item.quantity * item.unitPrice;
    const vat = Math.round(total * 0.05);
    const discount = item.status === "DELIVERED" ? 100 : 0;
    const grandTotal = total + item.shipping + vat - discount;
    const transactionId = orderTransactionId(item.key);

    const existingOrder = await prisma.order.findFirst({
      where: { transactionId },
      select: { id: true },
    });

    const orderData = {
      userId: ctx.users[item.userKey],
      name: customer.name,
      email: customer.email,
      phone_number: customer.phone,
      alt_phone_number: null,
      country: "BD",
      district: item.district,
      area: item.area,
      address_details: `House ${item.quantity + 10}, Road ${item.quantity + 2}, ${item.area}`,
      image: null,
      payment_method: item.paymentMethod,
      order_date: daysAgo(item.createdDaysAgo),
      total: money(total),
      shipping_cost: money(item.shipping),
      Vat_total: money(vat),
      discount_total: money(discount),
      grand_total: money(grandTotal),
      currency: "BDT",
      status: item.status as any,
      paymentStatus: item.paymentStatus as any,
      transactionId,
      taxSnapshot: {
        vatRate: 0.05,
        source: "operations-seed",
        scenario: item.key,
      },
    };

    const order = existingOrder
      ? await prisma.order.update({ where: { id: existingOrder.id }, data: orderData, select: { id: true } })
      : await prisma.order.create({ data: orderData, select: { id: true } });

    ctx.orders[item.key] = order.id;

    const existingOrderItems = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      select: { id: true },
    });

    if (existingOrderItems.length > 0) {
      const orderItemIds = existingOrderItems.map((record) => record.id);

      await prisma.shipmentItem.deleteMany({
        where: {
          orderItemId: { in: orderItemIds },
        },
      });
    }

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: ctx.products[item.productKey],
        variantId: ctx.variants[item.productKey],
        quantity: item.quantity,
        price: money(item.unitPrice),
        currency: "BDT",
        VatAmount: money(vat),
        discountAmount: money(discount),
        costPriceSnapshot: money(item.unitPrice * 0.65),
      },
      select: { id: true },
    });

    await prisma.payment.upsert({
      where: { externalId: paymentExternalId(item.key) },
      update: {
        orderId: order.id,
        amount: money(grandTotal),
        currency: "BDT",
        provider: item.paymentMethod,
        status: item.paymentState as any,
        paymentGatewayData: { seeded: true, transactionId, orderItemId: orderItem.id },
      },
      create: {
        orderId: order.id,
        amount: money(grandTotal),
        currency: "BDT",
        provider: item.paymentMethod,
        status: item.paymentState as any,
        externalId: paymentExternalId(item.key),
        paymentGatewayData: { seeded: true, transactionId, orderItemId: orderItem.id },
      },
    });
  }

  return ctx;
}
