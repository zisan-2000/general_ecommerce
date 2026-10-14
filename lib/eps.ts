import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, OrderStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { commitOrderInventoryReservations } from "@/lib/inventory";
import { transitionOrderStatusWithInventory } from "@/lib/order-inventory-lifecycle";
import { createOrderAdminNotifications } from "@/lib/order-admin-notifications";
import { syncCommissionEntriesForOrderStatus } from "@/lib/business-network/commission";
import { epsObject } from "@/lib/eps-settings";
import { resolveSeoSiteUrl } from "@/lib/seo-url";
import { paymentFetch, recordPaymentEvent, type PaymentLogContext } from "@/lib/payment-control/telemetry";

export class EpsError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

export function epsConfig() {
  // Only the supplied Sandbox endpoint is documented. Never infer a live URL.
  if (process.env.EPS_ENV !== "sandbox") throw new EpsError("EPS_ENV must be sandbox; live EPS is not configured", 503);
  const username = process.env.EPS_USERNAME;
  const password = process.env.EPS_PASSWORD;
  const hashKey = process.env.EPS_HASH_KEY;
  const merchantId = process.env.EPS_MERCHANT_ID;
  const storeId = process.env.EPS_STORE_ID;
  if (![username, password, hashKey, merchantId, storeId].every((value) => value?.trim())) {
    throw new EpsError("EPS environment credentials are incomplete", 503);
  }
  return { username: username!, password: password!, hashKey: hashKey!, merchantId: merchantId!, storeId: storeId!,
    baseUrl: "https://sandboxpgapi.eps.com.bd/v1",
    accountFingerprint: createHash("sha256").update(JSON.stringify(["sandbox", username, merchantId, storeId])).digest("hex") };
}

export function epsGatewayId(value: unknown) {
  const match = /^EPS:(\d+)$/.exec(String(value ?? ""));
  const id = Number(match?.[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function findEpsGateway(id: number | null) {
  if (!id) return null;
  const gateway = await prisma.payment.findFirst({ where: { id, orderId: null } });
  const data = epsObject(gateway?.paymentGatewayData);
  return gateway && data.type === "EPS" && data.isActive === true ? { gateway, data } : null;
}

export function createEpsTransactionId() {
  // 13 time digits + 10 random decimal digits, kept as a string (never Number).
  return `${Date.now()}${(BigInt(`0x${randomBytes(8).toString("hex")}`) % 10000000000n).toString().padStart(10, "0")}`;
}

export function epsPublicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
  try {
    // Apply the existing public-origin validator even for local Sandbox testing.
    // This rejects HTTP, loopback/private hosts, and URLs with paths or credentials.
    return resolveSeoSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: configured });
  } catch { throw new EpsError("Configure a public HTTPS application URL for EPS callbacks", 503); }
}

function callbackSignature(transactionId: string) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new EpsError("Payment callback signing is not configured", 503);
  return createHmac("sha256", secret).update(`eps-callback:${transactionId}`).digest("base64url");
}

export function epsCallbackUrls(transactionId: string) {
  const state = callbackSignature(transactionId);
  const origin = epsPublicOrigin();
  const url = (kind: string) => {
    const target = new URL(`/api/eps/${kind}`, origin);
    target.searchParams.set("attempt", transactionId);
    target.searchParams.set("state", state);
    return target.toString();
  };
  return { successUrl: url("success"), failUrl: url("fail"), cancelUrl: url("cancel") };
}

export function verifyEpsCallbackState(transactionId: string, state: string) {
  if (!/^\d{10,30}$/.test(transactionId) || state.length > 100) return false;
  const expected = Buffer.from(callbackSignature(transactionId));
  const actual = Buffer.from(state);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function epsRequest(path: string, hashInput: string, token?: string, body?: unknown,
  context?: Omit<PaymentLogContext, "provider">) {
  const config = epsConfig();
  let response: Response;
  try {
    response = await paymentFetch({ ...context, provider: "EPS" }, path === "/Auth/GetToken" ? "AUTH"
      : path === "/EPSEngine/InitializeEPS" ? "INITIALIZE" : "STATUS_QUERY", `${config.baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hash": createHmac("sha512", Buffer.from(config.hashKey, "utf8")).update(hashInput, "utf8").digest("base64"),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store", redirect: "error", timeoutMs: 20_000,
    });
  } catch { throw new EpsError("EPS request could not be confirmed; payment remains pending"); }
  if (!response.ok) throw new EpsError("EPS returned an unsuccessful HTTP response; payment remains pending");
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    await recordPaymentEvent({ ...context, provider: "EPS", operation: path === "/Auth/GetToken" ? "AUTH"
      : path === "/EPSEngine/InitializeEPS" ? "INITIALIZE" : "STATUS_QUERY", outcome: "ERROR", detailCode: "INVALID_RESPONSE" });
    throw new EpsError("EPS returned an invalid response; payment remains pending");
  }
  return epsObject(payload);
}

export async function getEpsToken(context?: Omit<PaymentLogContext, "provider">) {
  const config = epsConfig();
  const payload = await epsRequest("/Auth/GetToken", config.username, undefined, { userName: config.username, password: config.password }, context);
  if (typeof payload.token !== "string" || !payload.token || payload.errorCode || payload.errorMessage) {
    await recordPaymentEvent({ ...context, provider: "EPS", operation: "AUTH", outcome: "REJECTED", detailCode: "AUTHENTICATION_REJECTED" });
    throw new EpsError("EPS authentication failed");
  }
  return payload.token;
}

export function epsMoney(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value);
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
}

export function epsRedirectUrl(value: unknown) {
  try {
    const url = new URL(typeof value === "string" ? value : "");
    if (url.protocol !== "https:" || url.username || url.password ||
        !(url.hostname === "eps.com.bd" || url.hostname.endsWith(".eps.com.bd"))) throw new Error();
    return url.toString();
  } catch { throw new EpsError("EPS RedirectURL is missing or invalid; payment remains pending"); }
}

type EpsCustomerOrder = {
  id: number; name: string; email: string | null; address_details: string;
  district: string; country: string; phone_number: string; commercialContext: unknown;
};

export function buildEpsInitializeBody(order: EpsCustomerOrder, transactionId: string, amount: string,
  productName: string, urls: ReturnType<typeof epsCallbackUrls>) {
  const config = epsConfig();
  const postcode = epsObject(order.commercialContext).epsPostcode;
  if (typeof postcode !== "string" || !postcode.trim() || !order.email?.trim()) {
    throw new EpsError("EPS requires the customer's email and postcode", 400);
  }
  // EPS Technical Team-confirmed Sandbox contract: merchantId is mandatory,
  // CustomerOrderId retains its casing; all other customer/product keys follow Postman.
  // Web payments use transactionTypeId = 1 and merchantTransactionId (no aliases).
  return {
    merchantId: config.merchantId, storeId: config.storeId,
    CustomerOrderId: `O${order.id}-${transactionId}`, merchantTransactionId: transactionId,
    transactionTypeId: 1, totalAmount: Number(amount), ...urls,
    customerName: order.name, customerEmail: order.email, customerAddress: order.address_details,
    customerCity: order.district, customerState: order.district, customerPostcode: postcode,
    customerCountry: order.country, customerPhone: order.phone_number, productName,
  };
}

export async function initializeEpsPayment(body: ReturnType<typeof buildEpsInitializeBody>, token: string,
  context?: Omit<PaymentLogContext, "provider">) {
  const payload = await epsRequest("/EPSEngine/InitializeEPS", body.merchantTransactionId, token, body,
    { ...context, transactionId: body.merchantTransactionId });
  if (payload.ErrorCode || payload.ErrorMessage) {
    await recordPaymentEvent({ ...context, provider: "EPS", transactionId: body.merchantTransactionId,
      operation: "INITIALIZE", outcome: "REJECTED", detailCode: "INITIALIZE_REJECTED" });
    throw new EpsError("EPS initialization was not confirmed; verify the attempt before retrying");
  }
  return { redirectUrl: epsRedirectUrl(payload.RedirectURL),
    epsTransactionId: typeof payload.TransactionId === "string" ? payload.TransactionId : null };
}

export async function verifyEpsPayment(transactionId: string, token?: string,
  context?: Omit<PaymentLogContext, "provider">) {
  if (!/^\d{10,30}$/.test(transactionId)) throw new EpsError("Invalid EPS transaction ID", 400);
  return epsRequest(`/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${encodeURIComponent(transactionId)}`,
    transactionId, token ?? await getEpsToken({ ...context, transactionId }), undefined, { ...context, transactionId });
}

export type EpsVerificationResult = { status: "success" | "failed" | "cancelled" | "pending"; message: string };

async function reconcileEpsPaymentCore(transactionId: string, request?: Request): Promise<EpsVerificationResult> {
  const payment = await prisma.payment.findUnique({ where: { externalId: transactionId } });
  if (!payment?.orderId || payment.provider !== "EPS") throw new EpsError("EPS payment was not found", 404);
  const originalMeta = epsObject(payment.paymentGatewayData);
  if (originalMeta.accountFingerprint !== epsConfig().accountFingerprint) throw new EpsError("EPS account configuration differs from this payment attempt", 409);
  // Verification remains available if the gateway has been disabled.
  const gateway = await prisma.payment.findFirst({ where: { id: Number(originalMeta.gatewayId), orderId: null } });
  const settings = epsObject(gateway?.paymentGatewayData);
  const logContext = { provider: "EPS" as const, transactionId, paymentId: payment.id, orderId: payment.orderId };
  const verification = await verifyEpsPayment(transactionId, undefined, logContext);
  const valid = verification.MerchantTransactionId === transactionId &&
    epsMoney(verification.TotalAmount) !== null && epsMoney(verification.TotalAmount) === epsMoney(payment.amount) &&
    typeof verification.Status === "string";
  const verificationOutcome = !valid || verification.Status === "Success" && (verification.ErrorCode || verification.ErrorMessage) ? "MISMATCH"
    : verification.Status === "Success" ? "SUCCESS"
      : Array.isArray(settings.failureStatuses) && settings.failureStatuses.includes(verification.Status) ? "FAILED"
        : Array.isArray(settings.cancellationStatuses) && settings.cancellationStatuses.includes(verification.Status) ? "CANCELLED" : "PENDING";
  await recordPaymentEvent({ ...logContext, operation: "VERIFY", outcome: verificationOutcome,
    gatewayStatus: verification.Status, ...(!valid ? { detailCode: "VERIFICATION_MISMATCH" as const } : {}) });
  if (!valid) throw new EpsError("EPS status, transaction ID or amount verification failed; payment remains pending", 409);
  const status = verification.Status as string;
  const failure = Array.isArray(settings.failureStatuses) && settings.failureStatuses.includes(status);
  const cancelled = Array.isArray(settings.cancellationStatuses) && settings.cancellationStatuses.includes(status);
  const success = status === "Success"; // The sole success value documented in V4.
  if (success && (verification.ErrorCode || verification.ErrorMessage)) {
    throw new EpsError("EPS returned conflicting success and error fields; payment remains pending", 409);
  }
  return prisma.$transaction(async (tx): Promise<EpsVerificationResult> => {
    // All EPS attempts and order lifecycle mutations lock Order before Payment.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId!} FOR UPDATE`);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId! }, include: {
      orderItems: { include: { product: { select: { type: true, bundleFulfillmentMode: true } },
        // Snapshot quantities come from OrderItem and OrderBundleComponent.
        bundleComponents: { select: { quantityPerBundle: true, variantId: true, product: { select: { type: true } } } } } },
    } });
    if (current.status === "CAPTURED") {
      if (order.paymentStatus !== "PAID") throw new EpsError("EPS capture needs manual review of the order payment status", 409);
      return { status: "success", message: "Payment already verified" };
    }
    if (current.status === "FAILED" || current.status === "VOIDED") {
      if (success) throw new EpsError("EPS reports a late success after a terminal attempt; manual review required", 409);
      return { status: current.status === "VOIDED" ? "cancelled" : "failed", message: "Payment attempt is closed" };
    }
    if (!["INITIATED", "AUTHORIZED"].includes(current.status) || current.externalId !== transactionId ||
        current.provider !== "EPS" || epsMoney(verification.TotalAmount) !== epsMoney(current.amount)) {
      throw new EpsError("EPS attempt is no longer eligible for settlement", 409);
    }
    if (order.paymentStatus !== "UNPAID" || order.payment_method !== `EPS:${originalMeta.gatewayId}` ||
        !["PENDING", "CONFIRMED"].includes(order.status) || order.currency !== "BDT" ||
        epsMoney(order.grand_total) !== epsMoney(current.amount)) {
      throw new EpsError("Order is no longer eligible for EPS settlement; manual review required", 409);
    }
    const meta = { ...epsObject(current.paymentGatewayData), verifiedStatus: status, lastCheckedAt: new Date().toISOString() } as Prisma.InputJsonObject;
    if (!success && !failure && !cancelled) {
      await tx.payment.update({ where: { id: current.id }, data: { paymentGatewayData: meta } });
      return { status: "pending", message: "EPS payment is awaiting a confirmed final status" };
    }
    const captured = await tx.payment.findFirst({ where: { orderId: order.id, status: "CAPTURED" } });
    if (captured) throw new EpsError("Another payment already captured this order; manual review required", 409);
    await tx.payment.update({ where: { id: current.id }, data: {
      status: success ? "CAPTURED" : cancelled ? "VOIDED" : "FAILED", paymentGatewayData: meta,
    } });
    if (success) {
      // Check each variant/bundle, not only the summed quantity, before committing.
      const expectedVariants = new Map<number, number>();
      const expectedBundles = new Map<number, number>();
      const add = (map: Map<number, number>, id: number, quantity: number) => map.set(id, (map.get(id) ?? 0) + quantity);
      for (const item of order.orderItems) {
        if (item.product.type === "PHYSICAL" && item.variantId !== null) add(expectedVariants, item.variantId, item.quantity);
        if (item.product.type !== "BUNDLE") continue;
        if (item.product.bundleFulfillmentMode === "PREASSEMBLED") add(expectedBundles, item.productId, item.quantity);
        else for (const component of item.bundleComponents) {
          if (component.product.type === "PHYSICAL" && component.variantId !== null) {
            add(expectedVariants, component.variantId, component.quantityPerBundle * item.quantity);
          }
        }
      }
      const reservedVariants = new Map<number, number>();
      const reservedBundles = new Map<number, number>();
      const variantHolds = await tx.inventoryReservation.findMany({ where: { orderId: order.id },
        select: { quantity: true, stockLevel: { select: { productVariantId: true } } } });
      const bundleHolds = await tx.bundleStockReservation.findMany({ where: { orderId: order.id },
        select: { quantity: true, bundleStockLevel: { select: { productId: true } } } });
      for (const hold of variantHolds) add(reservedVariants, hold.stockLevel.productVariantId, hold.quantity);
      for (const hold of bundleHolds) add(reservedBundles, hold.bundleStockLevel.productId, hold.quantity);
      const matches = (expected: Map<number, number>, actual: Map<number, number>) =>
        expected.size === actual.size && [...expected].every(([id, quantity]) => actual.get(id) === quantity);
      if (!matches(expectedVariants, reservedVariants) || !matches(expectedBundles, reservedBundles)) {
        throw new EpsError("EPS inventory reservations differ from the order; manual review required", 409);
      }
      const physicalQuantity = order.orderItems.reduce((sum, item) => sum + (
        item.product.type === "PHYSICAL" ? item.quantity : item.product.type === "BUNDLE" && item.product.bundleFulfillmentMode !== "PREASSEMBLED"
          ? item.bundleComponents.reduce((n, component) => n + (component.product.type === "PHYSICAL" && component.variantId !== null
            ? component.quantityPerBundle * item.quantity : 0), 0) : 0), 0);
      const bundleQuantity = order.orderItems.reduce((sum, item) => sum + (
        item.product.type === "BUNDLE" && item.product.bundleFulfillmentMode === "PREASSEMBLED" ? item.quantity : 0), 0);
      const committed = await commitOrderInventoryReservations({ tx, orderId: order.id, reason: `Order #${order.id} EPS verified capture` });
      if (committed.committedQuantity !== physicalQuantity || committed.committedBundleQuantity !== bundleQuantity) {
        throw new EpsError("EPS inventory reservations differ from the order; manual review required", 409);
      }
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", transactionId } });
    } else {
      // A second live attempt must never lose its inventory.
      const active = await tx.payment.count({ where: { orderId: order.id, status: { in: ["INITIATED", "AUTHORIZED"] } } });
      if (active) throw new EpsError("Another payment attempt is pending; manual review required", 409);
      const nextStatus = cancelled ? OrderStatus.CANCELLED : OrderStatus.FAILED;
      const transition = await transitionOrderStatusWithInventory({ tx, orderId: order.id, nextStatus,
        reason: `Order #${order.id} EPS verified terminal status` });
      if (transition.changed) {
        await syncCommissionEntriesForOrderStatus({ tx, orderId: order.id, orderStatus: nextStatus, request });
        if (order.couponId && Number(order.discount_total ?? 0) > 0) await tx.coupon.updateMany({
          where: { id: order.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } },
        });
      }
    }
    await createOrderAdminNotifications({ tx, orderId: order.id, title: success ? "Payment received" : "EPS payment closed",
      message: `EPS payment for order #${order.id} was verified: ${status}.`,
      metadata: { event: "ORDER_PAYMENT_STATUS_CHANGED", to: success ? "PAID" : cancelled ? "VOIDED" : "FAILED" } });
    return { status: success ? "success" : cancelled ? "cancelled" : "failed", message: success ? "EPS payment verified successfully" : "EPS confirmed a final unsuccessful payment status" };
  });
}

export async function reconcileEpsPayment(transactionId: string, request?: Request): Promise<EpsVerificationResult> {
  try {
    const result = await reconcileEpsPaymentCore(transactionId, request);
    await recordPaymentEvent({ provider: "EPS", transactionId, operation: "SETTLEMENT",
      outcome: result.message === "Payment already verified" ? "DUPLICATE"
        : result.status === "success" ? "SUCCESS" : result.status === "failed" ? "FAILED"
          : result.status === "cancelled" ? "CANCELLED" : "PENDING" });
    return result;
  } catch (error) {
    await recordPaymentEvent({ provider: "EPS", transactionId, operation: "SETTLEMENT",
      outcome: error instanceof EpsError && error.status === 409 ? "MISMATCH" : "ERROR",
      detailCode: "SETTLEMENT_REJECTED" });
    throw error;
  }
}
