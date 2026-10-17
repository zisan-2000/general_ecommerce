import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, Prisma } from "@/generated/prisma";
import { syncCommissionEntriesForOrderStatus } from "@/lib/business-network/commission";
import {
  commitOrderInventoryReservations,
} from "@/lib/inventory";
import { transitionOrderStatusWithInventory } from "@/lib/order-inventory-lifecycle";
import { createOrderAdminNotifications } from "@/lib/order-admin-notifications";
import { paymentFetch, recordPaymentEvent } from "@/lib/payment-control/telemetry";
import { querySslcommerzPayment, paymentAmountMatches } from "@/lib/payment-control/gateway-query";

export type SslcommerzGatewayData = {
  type?: string;
  storeId?: string;
  storePassword?: string;
  sandbox?: boolean;
  isActive?: boolean;
  successUrl?: string;
  failUrl?: string;
  cancelUrl?: string;
  ipnUrl?: string;
};

type CallbackKind = "success" | "fail" | "cancel" | "ipn";

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export function isSslcommerzMethod(value: unknown) {
  return /^SSLCOMMERZ:\d+$/i.test(String(value || ""));
}

export function gatewayIdFromMethod(value: unknown): number | null {
  const match = String(value || "").match(/^SSLCOMMERZ:(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export function sslcommerzEndpoint(sandbox: boolean, kind: "session" | "validation") {
  const host = sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
  return kind === "session"
    ? `${host}/gwprocess/v4/api.php`
    : `${host}/validator/api/validationserverAPI.php`;
}

export async function findSslcommerzGateway(gatewayId?: number | null) {
  const gateway = gatewayId
    ? await prisma.payment.findFirst({ where: { id: gatewayId, orderId: null } })
    : await prisma.payment.findFirst({
        where: {
          orderId: null,
          paymentGatewayData: { path: ["type"], equals: "SSLCOMMERZ" },
        },
        orderBy: { updatedAt: "desc" },
      });

  const data = asObject(gateway?.paymentGatewayData) as SslcommerzGatewayData;
  if (
    !gateway ||
    String(data.type || "").toUpperCase() !== "SSLCOMMERZ" ||
    data.isActive === false
  ) {
    return null;
  }

  return { gateway, data };
}

function validOrigin(value: string | undefined | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function getPublicBaseUrl(request: NextRequest, data?: SslcommerzGatewayData) {
  const configured =
    validOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    validOrigin(process.env.NEXT_PUBLIC_BASE_URL) ||
    validOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    validOrigin(process.env.APP_URL) ||
    validOrigin(process.env.NEXTAUTH_URL);
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    return `${protocol}://${forwardedHost}`;
  }

  const savedOrigin =
    validOrigin(data?.successUrl) ||
    validOrigin(data?.failUrl) ||
    validOrigin(data?.cancelUrl) ||
    validOrigin(data?.ipnUrl);
  return savedOrigin || request.nextUrl.origin;
}

export function callbackUrls(request: NextRequest, data?: SslcommerzGatewayData) {
  const base = getPublicBaseUrl(request, data);
  return {
    successUrl: `${base}/api/sslcommerz/success`,
    failUrl: `${base}/api/sslcommerz/fail`,
    cancelUrl: `${base}/api/sslcommerz/cancel`,
    ipnUrl: `${base}/api/sslcommerz/ipn`,
  };
}

export function createSslcommerzTransactionId(orderId: number) {
  const time = Date.now().toString(36);
  const nonce = randomUUID().replace(/-/g, "").slice(0, 8);
  return `O${orderId}_${time}_${nonce}`.slice(0, 30);
}

function paymentInitSecret() {
  return process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || null;
}

export function isPaymentInitSigningConfigured() {
  return Boolean(paymentInitSecret());
}

export function createPaymentInitToken(orderId: number, ttlMs = 10 * 60 * 1000) {
  const secret = paymentInitSecret();
  if (!secret) return null;
  const expiresAt = Date.now() + ttlMs;
  const payload = `${orderId}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function verifyPaymentInitToken(orderId: number, token: unknown) {
  const secret = paymentInitSecret();
  const raw = typeof token === "string" ? token.trim() : "";
  if (!secret || !raw) return false;

  const [expiresRaw, signature, ...extra] = raw.split(".");
  const expiresAt = Number(expiresRaw);
  if (extra.length > 0 || !signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${orderId}.${expiresAt}`)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function readSslcommerzPayload(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return { ...query, ...asObject(await request.json().catch(() => ({}))) };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return query;
  return {
    ...query,
    ...Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)])),
  };
}

async function processSslcommerzCallbackCore(
  request: NextRequest,
  kind: CallbackKind,
  posted: Record<string, any>,
) {
  const tranId = String(posted.tran_id || "").trim();

  if (!tranId) return { ok: false, orderId: null, message: "Transaction ID is missing" };

  const payment = await prisma.payment.findUnique({
    where: { externalId: tranId },
    include: {
      order: {
        include: {
          orderItems: {
            select: {
              quantity: true,
              product: { select: { type: true, bundleFulfillmentMode: true } },
              bundleComponents: { select: { quantityPerBundle: true, variantId: true,
                product: { select: { type: true } } } },
            },
          },
        },
      },
    },
  });
  if (!payment || payment.provider !== "SSLCOMMERZ" || !payment.orderId || !payment.order) {
    return { ok: false, orderId: null, message: "Payment transaction was not found" };
  }
  const order = payment.order;
  await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: payment.id, orderId: payment.orderId,
    transactionId: tranId, operation: "CALLBACK", outcome: "RECEIVED", detailCode: kind === "success" ? "CALLBACK_SUCCESS"
      : kind === "fail" ? "CALLBACK_FAIL" : kind === "cancel" ? "CALLBACK_CANCEL" : "CALLBACK_IPN" });

  if (payment.status === "CAPTURED" && payment.order.paymentStatus === "PAID") {
    return { ok: true, orderId: payment.orderId, message: "Payment already verified" };
  }

  if (posted.value_a && Number(posted.value_a) !== payment.orderId) {
    await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: payment.id, orderId: payment.orderId,
      transactionId: tranId, operation: "CALLBACK", outcome: "MISMATCH", detailCode: "CALLBACK_REFERENCE_MISMATCH" });
    return { ok: false, orderId: payment.orderId, message: "Order reference does not match" };
  }

  if (kind === "fail" || kind === "cancel") {
    // A browser callback is not proof that a remotely created charge failed.
    // V4 transaction-query confirms FAILED; unconfirmed cancellation stays pending.
    let checked: Awaited<ReturnType<typeof querySslcommerzPayment>>;
    try { checked = await querySslcommerzPayment(payment); }
    catch { return { ok: false, orderId: payment.orderId, message: "Gateway has not confirmed a final payment status; manual review required" }; }
    if (!checked.referenceMatches || !checked.amountMatches || checked.status !== "FAILED") {
      await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: payment.id, orderId: payment.orderId,
        transactionId: tranId, operation: "VERIFY", outcome: "PENDING", gatewayStatus: checked.status });
      return { ok: false, orderId: payment.orderId, message: "Gateway has not confirmed a final unsuccessful payment; verification is pending" };
    }
    const closed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId!} FOR UPDATE`);
      const currentOrder = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId! } });
      if (currentOrder.paymentStatus !== "UNPAID" ||
          currentOrder.payment_method.toUpperCase() !== `SSLCOMMERZ:${asObject(payment.paymentGatewayData).gatewayId}` ||
          currentOrder.currency !== payment.currency || !payment.amount?.equals(currentOrder.grand_total)) return false;
      if (await tx.payment.count({ where: { orderId: payment.orderId!, id: { not: payment.id },
        status: { in: ["INITIATED", "AUTHORIZED"] } } })) return false;
      const changed = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: ["INITIATED", "AUTHORIZED"] },
        },
        data: { status: "FAILED" },
      });
      if (changed.count !== 1) return false;

      await createOrderAdminNotifications({
        tx, orderId: payment.orderId!, title: "Payment failed",
        message: `Payment for order #${payment.orderId} failed after gateway verification.`,
        metadata: { event: "ORDER_PAYMENT_STATUS_CHANGED", to: "FAILED" },
      });

      const nextStatus = OrderStatus.FAILED;
      const transition = await transitionOrderStatusWithInventory({
        tx,
        orderId: payment.orderId!,
        nextStatus,
        reason: `Order #${payment.orderId} ${nextStatus.toLowerCase()} inventory restoration from SSLCommerz`,
      });
      if (transition.changed) {
        await syncCommissionEntriesForOrderStatus({
          tx,
          orderId: payment.orderId!,
          orderStatus: nextStatus,
          request,
        });
      }
      if (order.couponId && Number(order.discount_total || 0) > 0) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
      return true;
    });
    if (!closed) {
      const current = await prisma.payment.findUnique({ where: { id: payment.id }, select: { status: true, order: { select: { paymentStatus: true } } } });
      if (current?.status === "CAPTURED" && current.order?.paymentStatus === "PAID") {
        return { ok: true, orderId: payment.orderId, message: "Payment already verified" };
      }
      return { ok: false, orderId: payment.orderId, message: "Payment attempt already closed or requires manual review" };
    }
    return {
      ok: false,
      orderId: payment.orderId,
      message: "Gateway confirmed payment failure",
    };
  }

  const valId = String(posted.val_id || "").trim();
  if (!valId) return { ok: false, orderId: payment.orderId, message: "Validation ID is missing" };

  const transactionMeta = asObject(payment.paymentGatewayData);
  const gatewayId = Number(transactionMeta.gatewayId);
  // Disabling new checkout sessions must not disable verification of existing attempts.
  const originalGateway = Number.isSafeInteger(gatewayId) && gatewayId > 0
    ? await prisma.payment.findFirst({ where: { id: gatewayId, orderId: null } }) : null;
  const originalData = asObject(originalGateway?.paymentGatewayData);
  const found = originalGateway && originalData.type === "SSLCOMMERZ" ? { gateway: originalGateway, data: originalData } : null;
  if (!found) return { ok: false, orderId: payment.orderId, message: "Gateway is unavailable" };

  const storeId = String(found.data.storeId || "").trim();
  const storePassword = String(found.data.storePassword || "").trim();
  if (!storeId || !storePassword) {
    return { ok: false, orderId: payment.orderId, message: "Gateway credentials are incomplete" };
  }

  const validationUrl = new URL(
    sslcommerzEndpoint(typeof transactionMeta.sandbox === "boolean" ? transactionMeta.sandbox : Boolean(found.data.sandbox), "validation"),
  );
  validationUrl.searchParams.set("val_id", valId);
  validationUrl.searchParams.set("store_id", storeId);
  validationUrl.searchParams.set("store_passwd", storePassword);
  validationUrl.searchParams.set("v", "1");
  validationUrl.searchParams.set("format", "json");

  let response: Response;
  try {
    response = await paymentFetch({ provider: "SSLCOMMERZ", paymentId: payment.id,
      orderId: payment.orderId, transactionId: tranId }, "VERIFY", validationUrl, {
      method: "GET",
      cache: "no-store",
      timeoutMs: 30_000,
    });
  } catch (error) {
    return { ok: false, orderId: payment.orderId, message: "Payment validation service is unavailable" };
  }
  const validation = asObject(await response.json().catch(() => ({})));
  const validationStatus = String(validation.status || "").toUpperCase();
  const valid =
    response.ok &&
    ["VALID", "VALIDATED"].includes(validationStatus) &&
    String(validation.tran_id || "") === tranId &&
    (!validation.value_a || Number(validation.value_a) === payment.orderId) &&
    (!validation.value_b || Number(validation.value_b) === found.gateway.id) &&
    paymentAmountMatches(validation.amount, payment.amount) &&
    String(validation.currency || "").toUpperCase() === payment.currency.toUpperCase();

  if (!valid) {
    await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: payment.id, orderId: payment.orderId,
      transactionId: tranId, operation: "VERIFY", outcome: "MISMATCH", gatewayStatus: validationStatus,
      detailCode: "VERIFICATION_MISMATCH" });
    return { ok: false, orderId: payment.orderId, message: "Payment validation failed" };
  }
  await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: payment.id, orderId: payment.orderId,
    transactionId: tranId, operation: "VERIFY", outcome: "SUCCESS", gatewayStatus: validationStatus });

  const riskLevel = Number(validation.risk_level || 0);
  const safeMeta = {
    type: "SSLCOMMERZ_TRANSACTION",
    gatewayId: found.gateway.id,
    sandbox: typeof transactionMeta.sandbox === "boolean" ? transactionMeta.sandbox : Boolean(found.data.sandbox),
    inventoryMode:
      String(transactionMeta.inventoryMode || "").toUpperCase() === "LEGACY_DEDUCTED"
        ? "LEGACY_DEDUCTED"
        : String(transactionMeta.inventoryMode || "")
          ? "RESERVATION"
          : "LEGACY_DEDUCTED",
    valId,
    bankTransactionId: String(validation.bank_tran_id || "") || null,
    cardType: String(validation.card_type || "") || null,
    cardIssuer: String(validation.card_issuer || "") || null,
    riskLevel,
    validatedAt: new Date().toISOString(),
  };

  if (riskLevel === 1) {
    await recordPaymentEvent({ provider: "SSLCOMMERZ", paymentId: payment.id, orderId: payment.orderId,
      transactionId: tranId, operation: "VERIFY", outcome: "PENDING", detailCode: "RISK_REVIEW" });
    await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ["INITIATED", "AUTHORIZED"] } },
      data: { status: "AUTHORIZED", paymentGatewayData: safeMeta },
    });
    return {
      ok: false,
      orderId: payment.orderId,
      message: "Payment requires manual risk review",
    };
  }

  const expectedPhysicalQuantity = order.orderItems.reduce(
    (sum, item) =>
      sum + (item.product.type === "PHYSICAL" ? item.quantity :
        item.product.type === "BUNDLE" && item.product.bundleFulfillmentMode !== "PREASSEMBLED"
          ? item.bundleComponents.reduce((quantity, component) => quantity +
            (component.product.type === "PHYSICAL" && component.variantId !== null ? component.quantityPerBundle * item.quantity : 0), 0)
          : 0),
    0,
  );
  const expectedPreassembledBundleQuantity = order.orderItems.reduce(
    (sum, item) =>
      item.product.type === "BUNDLE" && item.product.bundleFulfillmentMode === "PREASSEMBLED"
        ? sum + Number(item.quantity)
        : sum,
    0,
  );
  const usesLegacyDeduction = safeMeta.inventoryMode === "LEGACY_DEDUCTED";
  const captureResult = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId!} FOR UPDATE`);
    const currentOrder = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId! } });
    const currentPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const anotherCapture = await tx.payment.findFirst({ where: { orderId: payment.orderId!,
      id: { not: payment.id }, status: { in: ["CAPTURED", "REFUNDED"] } } });
    if (anotherCapture || currentOrder.paymentStatus === "REFUNDED" ||
        currentOrder.paymentStatus === "PAID" && currentPayment.status !== "CAPTURED") {
      throw new Error("Order already settled through another payment or refund");
    }
    if (currentPayment.status !== "CAPTURED" && (
        !["PENDING", "CONFIRMED"].includes(currentOrder.status) ||
        currentOrder.payment_method.toUpperCase() !== `SSLCOMMERZ:${found.gateway.id}` ||
        currentOrder.currency !== payment.currency || !payment.amount?.equals(currentOrder.grand_total))) {
      throw new Error("Order is no longer eligible for payment capture; manual review required");
    }
    const captured = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: { in: ["INITIATED", "AUTHORIZED"] },
      },
      data: { status: "CAPTURED", paymentGatewayData: safeMeta },
    });

    if (captured.count !== 1) {
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      return {
        alreadyCaptured: current?.status === "CAPTURED",
        capturedNow: false,
      };
    }

    if (!usesLegacyDeduction) {
      const committed = await commitOrderInventoryReservations({
        tx,
        orderId: payment.orderId!,
        reason: `Order #${payment.orderId} SSLCommerz payment capture`,
      });
      if (committed.committedQuantity !== expectedPhysicalQuantity) {
        throw new Error("Reserved inventory does not match the paid order");
      }
      if (committed.committedBundleQuantity !== expectedPreassembledBundleQuantity) {
        throw new Error("Reserved preassembled bundle inventory does not match the paid order");
      }
    }

    await tx.order.update({
      where: { id: payment.orderId! },
      data: {
        paymentStatus: "PAID",
        transactionId: String(validation.bank_tran_id || tranId),
      },
    });
    await createOrderAdminNotifications({
      tx, orderId: payment.orderId!, title: "Payment received",
      message: `Payment for order #${payment.orderId} has been verified successfully.`,
      metadata: { event: "ORDER_PAYMENT_STATUS_CHANGED", to: "PAID" },
    });
    return { alreadyCaptured: false, capturedNow: true };
  });

  if (captureResult.alreadyCaptured) {
    return { ok: true, orderId: payment.orderId, message: "Payment already verified" };
  }
  if (!captureResult.capturedNow) {
    return {
      ok: false,
      orderId: payment.orderId,
      message: "This payment attempt is no longer eligible for capture",
    };
  }

  return { ok: true, orderId: payment.orderId, message: "Payment verified successfully" };
}

export async function processSslcommerzCallback(request: NextRequest, kind: CallbackKind) {
  const posted = await readSslcommerzPayload(request);
  const rawId = String(posted.tran_id || "");
  const transactionId = /^[A-Za-z0-9_-]{1,50}$/.test(rawId) ? rawId : undefined;
  try {
    const result = await processSslcommerzCallbackCore(request, kind, posted);
    if (result.orderId) await recordPaymentEvent({ provider: "SSLCOMMERZ", transactionId, operation: "SETTLEMENT",
      outcome: result.ok ? result.message === "Payment already verified" ? "DUPLICATE" : "SUCCESS"
        : result.message === "Gateway confirmed payment failure" ? "FAILED"
          : kind === "fail" || kind === "cancel" ? "PENDING" : "REJECTED" });
    // Customer result pages must distinguish an unconfirmed outcome from failure.
    return { ...result, resultTransactionId: transactionId, status: result.ok ? "success" : result.message === "Gateway confirmed payment failure" ? "failed" : "pending" };
  } catch (error) {
    await recordPaymentEvent({ provider: "SSLCOMMERZ", transactionId, operation: "SETTLEMENT",
      outcome: "ERROR", detailCode: "SETTLEMENT_REJECTED" });
    throw error;
  }
}
