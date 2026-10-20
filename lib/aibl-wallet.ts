import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma, OrderStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { resolveSeoSiteUrl } from "@/lib/seo-url";
import { commitOrderInventoryReservations } from "@/lib/inventory";
import { transitionOrderStatusWithInventory } from "@/lib/order-inventory-lifecycle";
import { syncCommissionEntriesForOrderStatus } from "@/lib/business-network/commission";
import { createOrderAdminNotifications } from "@/lib/order-admin-notifications";
import { paymentFetch, recordPaymentEvent, type PaymentLogContext, type AiblDiagnosticCode, type AiblDiagnosticStage } from "@/lib/payment-control/telemetry";
import { aiblMoney, aiblProviderOrderId, aiblVerifiedTransaction, aiblWalletGatewayId,
  aiblWalletObject, AIBL_WALLET_CONTRACT } from "@/lib/aibl-wallet-settings";

export class AiblWalletError extends Error {
  constructor(message: string, readonly status = 502, readonly diagnosticStage?: AiblDiagnosticStage) { super(message); }
}
type Context = Omit<PaymentLogContext, "provider">;
async function recordAiblChecks(context: Context, checks: ReadonlyArray<readonly [AiblDiagnosticCode, boolean]>) {
  for (const [detailCode, passed] of checks) {
    await recordPaymentEvent({ ...context, provider: "AIBL_WALLET", operation: "DIAGNOSTIC",
      outcome: passed ? "SUCCESS" : "REJECTED", detailCode });
  }
}
export function aiblWalletConfig() {
  if (process.env.AIBL_WALLET_ENV !== "uat") throw new AiblWalletError("AIBL Wallet supports the configured UAT environment only", 503);
  const apiBaseUrl = process.env.AIBL_WALLET_API_BASE_URL;
  const hostedBaseUrl = process.env.AIBL_WALLET_HOSTED_BASE_URL;
  if (apiBaseUrl !== "https://iwtest.aibl.com.bd/iwPGAPI/" ||
      hostedBaseUrl !== "https://iwtest.aibl.com.bd/iwepayuat/epayment/") {
    throw new AiblWalletError("Configure the issued allowlisted AIBL UAT API and hosted URLs", 503);
  }
  const apiUser = process.env.AIBL_WALLET_API_USER;
  const apiPass = process.env.AIBL_WALLET_API_PASS;
  const merchantId = process.env.AIBL_WALLET_MERCHANT_ID;
  const accessKey = process.env.AIBL_WALLET_ACCESS_KEY;
  if (![apiUser, apiPass, merchantId, accessKey].every((v) => v?.trim())) throw new AiblWalletError("AIBL Wallet server credentials are incomplete", 503);
  return { apiBaseUrl, hostedBaseUrl, apiUser: apiUser!, apiPass: apiPass!, merchantId: merchantId!, accessKey: accessKey!,
    accountFingerprint: createHash("sha256").update(JSON.stringify(["uat", apiBaseUrl, apiUser, merchantId])).digest("hex") };
}
export function aiblWalletPublicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || process.env.NEXTAUTH_URL;
  try { return resolveSeoSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: configured }); }
  catch { throw new AiblWalletError("Configure a public HTTPS application origin for AIBL callbacks", 503); }
}
export function aiblBillNo() { return `AI${Date.now()}${randomBytes(8).toString("hex")}`; }
export function validAiblBill(value: unknown): value is string { return typeof value === "string" && /^AI\d{13}[a-f0-9]{16}$/.test(value); }
function signature(bill: string) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new AiblWalletError("Payment callback signing is not configured", 503);
  return createHmac("sha256", secret).update(`aibl-wallet-callback:${bill}`).digest("base64url");
}
export function verifyAiblCallbackState(bill: string, state: string) {
  if (!validAiblBill(bill) || !/^[A-Za-z0-9_-]{43}$/.test(state)) return false;
  const actual = Buffer.from(state); const expected = Buffer.from(signature(bill));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function aiblWalletCallbackUrls(bill: string) {
  const origin = aiblWalletPublicOrigin(); const state = signature(bill);
  const url = (kind: string) => { const target = new URL(`/api/aibl-wallet/${kind}`, origin);
    target.searchParams.set("attempt", bill); target.searchParams.set("state", state); return target.toString(); };
  return { approved_url: url("approved"), decline_url: url("decline"), cancel_url: url("cancel") };
}
export function aiblHostedUrl(bankOrderId: unknown) {
  const id = aiblProviderOrderId(bankOrderId);
  if (!id) throw new AiblWalletError("AIBL OrderID is invalid; review the pending attempt", 409);
  return aiblWalletConfig().hostedBaseUrl + encodeURIComponent(id);
}
export async function findAiblWalletGateway(id: number | null) {
  if (!id) return null;
  const gateway = await prisma.payment.findFirst({ where: { id, orderId: null } });
  const data = aiblWalletObject(gateway?.paymentGatewayData);
  return gateway && data.type === "AIBL_WALLET" && data.isActive === true ? gateway : null;
}

async function bankRequest(kind: "token" | "orderID" | "verify", fields: Record<string, string>, context: Context) {
  const config = aiblWalletConfig();
  const operation = kind === "token" ? "AUTH" : kind === "orderID" ? "INITIALIZE" : "STATUS_QUERY";
  let response: Response;
  try {
    response = await paymentFetch({ ...context, provider: "AIBL_WALLET" }, operation,
      config.apiBaseUrl + "PGService/" + kind, { method: "POST", cache: "no-store", redirect: "error", timeoutMs: 20000,
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(fields).toString() });
  } catch { throw new AiblWalletError("AIBL request could not be confirmed; keep the payment pending", 502,
    kind === "verify" ? "BANK_VERIFY_REQUEST_FAILED" : undefined); }
  if (!response.ok) throw new AiblWalletError("AIBL returned an unsuccessful HTTP response; keep the payment pending", 502,
    kind === "verify" ? "BANK_VERIFY_RESPONSE_REJECTED" : undefined);
  // Bounded response; never log the token, bank payload or arbitrary error text.
  let value: unknown;
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const decoder = new TextDecoder(); let bytes = 0; let text = "";
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
      if (bytes > 32768) { await reader.cancel(); throw new Error(); } text += decoder.decode(part.value, { stream: true }); }
      text += decoder.decode(); value = JSON.parse(text);
    } finally { reader.releaseLock(); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  } catch (error) {
    const timedOut = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    await recordPaymentEvent({ ...context, provider: "AIBL_WALLET", operation, outcome: timedOut ? "TIMEOUT" : "ERROR",
      ...(timedOut ? {} : { detailCode: "INVALID_RESPONSE" as const }) });
    throw new AiblWalletError(timedOut ? "AIBL response timed out; keep payment pending" : "AIBL returned an unrecognized response; manual review may be required", 502,
      kind === "verify" ? timedOut ? "BANK_VERIFY_REQUEST_FAILED" : "BANK_VERIFY_RESPONSE_REJECTED" : undefined);
  }
  return aiblWalletObject(value);
}
function authenticationFields() { const c = aiblWalletConfig(); return { api_user: c.apiUser, api_pass: c.apiPass, merchantID: c.merchantId }; }
export async function getAiblWalletToken(context: Context) {
  const value = await bankRequest("token", authenticationFields(), context);
  if (typeof value.token !== "string" || !value.token.trim() || value.token.length > 8192 ||
      value.code !== undefined && value.code !== 200 && value.code !== "200") {
    await recordPaymentEvent({ ...context, provider: "AIBL_WALLET", operation: "AUTH", outcome: "REJECTED", detailCode: "AUTHENTICATION_REJECTED" });
    throw new AiblWalletError("AIBL token generation was not confirmed");
  }
  return value.token; // One-time token: consume once for this initialization; never persist/cache/reuse.
}
export async function queryAiblWalletPayment(payment: { id: number; orderId: number | null; externalId: string | null;
  provider?: string | null; currency: string; amount: unknown; paymentGatewayData: unknown }, actorUserId?: string, requestId: string = randomUUID()) {
  const context: Context = { paymentId: payment.id, orderId: payment.orderId ?? undefined, actorUserId, requestId };
  let stage: AiblDiagnosticStage = "PRE_VERIFY_VALIDATION_FAILED";
  try {
    await recordAiblChecks(context, [
      ["AIBL_CONFIG_UAT", process.env.AIBL_WALLET_ENV === "uat"],
      ["AIBL_CONFIG_API_URL", process.env.AIBL_WALLET_API_BASE_URL === "https://iwtest.aibl.com.bd/iwPGAPI/"],
      ["AIBL_CONFIG_HOSTED_URL", process.env.AIBL_WALLET_HOSTED_BASE_URL === "https://iwtest.aibl.com.bd/iwepayuat/epayment/"],
      ["AIBL_CONFIG_CREDENTIALS_PRESENT", [process.env.AIBL_WALLET_API_USER, process.env.AIBL_WALLET_API_PASS,
        process.env.AIBL_WALLET_MERCHANT_ID, process.env.AIBL_WALLET_ACCESS_KEY].every((value) => Boolean(value?.trim()))],
    ]);
    const config = aiblWalletConfig(); const meta = aiblWalletObject(payment.paymentGatewayData);
    const decimalInstance = payment.amount instanceof Prisma.Decimal;
    let decimalRecognized = false;
    let amountStringValid = false;
    // Optional observations must not change the original validation behavior.
    try {
      decimalRecognized = typeof Prisma.Decimal.isDecimal === "function" && Prisma.Decimal.isDecimal(payment.amount);
      amountStringValid = Boolean(aiblMoney(decimalRecognized ? (payment.amount as { toString(): string }).toString() : payment.amount));
    } catch { /* Fixed FAIL observations below; no arbitrary error details. */ }
    await recordAiblChecks(context, [
      ["AIBL_AMOUNT_DECIMAL_INSTANCE", decimalInstance],
      ["AIBL_AMOUNT_DECIMAL_RECOGNIZED", decimalRecognized],
      // Observation only: this candidate NEVER replaces the existing amount conversion.
      ["AIBL_AMOUNT_STRING_VALID", amountStringValid],
    ]);
    const bankOrderId = aiblProviderOrderId(meta.bankOrderId);
    // Decimal instances from another runtime/module can fail instanceof. Keep exact string precision.
    const amount = aiblMoney(Prisma.Decimal.isDecimal(payment.amount) ? payment.amount.toString() : payment.amount);
    await recordAiblChecks(context, [
      ["AIBL_ORDER_ID", Boolean(payment.orderId)], ["AIBL_MERCHANT_BILL_FORMAT", validAiblBill(payment.externalId)],
      ["AIBL_BANK_ORDER_ID", Boolean(bankOrderId)], ["AIBL_AMOUNT_VALID", Boolean(amount)],
      ["AIBL_AMOUNT_NONZERO", Boolean(amount && amount !== "0.00")], ["AIBL_CURRENCY_BDT", payment.currency === "BDT"],
      ["AIBL_ACCOUNT_FINGERPRINT_MATCH", meta.accountFingerprint === config.accountFingerprint],
      ["AIBL_INITIALIZATION_VALIDATED", meta.initializationValidated === true],
    ]);
    if (!payment.orderId || !validAiblBill(payment.externalId) || !bankOrderId || !amount || amount === "0.00" ||
        payment.currency !== "BDT" || meta.accountFingerprint !== config.accountFingerprint || meta.initializationValidated !== true) {
      throw new AiblWalletError("AIBL attempt lacks a validated bank order/account/amount; manual review required", 409);
    }
    const order = await prisma.order.findUnique({ where: { id: payment.orderId }, select: { payment_method: true, grand_total: true, currency: true } });
    await recordAiblChecks(context, [
      ["AIBL_ORDER_EXISTS", Boolean(order)], ["AIBL_ORDER_GATEWAY_MATCH", Boolean(order && order.payment_method === `AIBL_WALLET:${meta.gatewayId}`)],
      ["AIBL_ORDER_CURRENCY_BDT", order?.currency === "BDT"],
      ["AIBL_ORDER_TOTAL_MATCH", Boolean(order && aiblMoney(order.grand_total.toString()) === amount)],
    ]);
    if (!order || order.payment_method !== `AIBL_WALLET:${meta.gatewayId}` || order.currency !== "BDT" ||
        aiblMoney(order.grand_total.toString()) !== amount) throw new AiblWalletError("AIBL order amount, currency or reference changed; manual review required", 409);
    stage = "BANK_VERIFY_REQUEST_FAILED";
    const payload = await bankRequest("verify", { ...authenticationFields(), accessKey: config.accessKey,
      OrderID: bankOrderId, amount, bill_no: payment.externalId },
    { ...context, orderId: payment.orderId, transactionId: payment.externalId });
    stage = "BANK_VERIFY_RESPONSE_REJECTED";
    const transactionId = aiblVerifiedTransaction(payload);
    await recordAiblChecks(context, [["AIBL_BANK_SUCCESS_CONFIRMED", Boolean(transactionId)]]);
    if (!transactionId) await recordPaymentEvent({ ...context, provider: "AIBL_WALLET", operation: "DIAGNOSTIC",
      outcome: "PENDING", detailCode: "BANK_VERIFY_RESPONSE_REJECTED" });
    return { transactionId,
      // The documented verification response has no echoed amount/currency/bill fields.
      // Request parameters are bound to the validated initialization and authoritative DB values.
      code: payload.code === 200 || payload.code === "200" ? "200" : "UNKNOWN" };
  } catch (error) {
    const failureStage = error instanceof AiblWalletError && error.diagnosticStage ? error.diagnosticStage : stage;
    await recordPaymentEvent({ ...context, provider: "AIBL_WALLET", operation: "DIAGNOSTIC", outcome: "ERROR", detailCode: failureStage });
    if (error instanceof AiblWalletError) throw new AiblWalletError(error.message, error.status, failureStage);
    throw error;
  }
}

export async function initializeAiblWalletOrder(orderId: number, requestedGatewayId?: unknown) {
  const original = await prisma.order.findUnique({ where: { id: orderId } });
  const gatewayId = aiblWalletGatewayId(original?.payment_method);
  if (!original || !gatewayId || requestedGatewayId !== undefined && Number(requestedGatewayId) !== gatewayId) {
    throw new AiblWalletError("AIBL gateway does not match the order", 400);
  }
  if (!await findAiblWalletGateway(gatewayId)) throw new AiblWalletError("AIBL gateway is unavailable", 503);
  const config = aiblWalletConfig(); aiblWalletPublicOrigin();
  const previous = await prisma.payment.findFirst({ where: { orderId, status: { in: ["INITIATED", "AUTHORIZED", "CAPTURED"] } }, orderBy: { id: "desc" } });
  function reuse(payment: NonNullable<typeof previous>, order = original!) {
    const meta = aiblWalletObject(payment.paymentGatewayData);
    if (payment.provider === "AIBL_WALLET" && validAiblBill(payment.externalId) && payment.status === "INITIATED" &&
        order.paymentStatus === "UNPAID" && ["PENDING", "CONFIRMED"].includes(order.status) &&
        order.currency === "BDT" && payment.currency === "BDT" &&
        aiblMoney(order.grand_total.toString()) === aiblMoney(payment.amount?.toString()) &&
        meta.accountFingerprint === config.accountFingerprint && meta.initializationValidated === true &&
        Date.now() - payment.createdAt.getTime() < 30 * 60000) {
      return { redirectUrl: aiblHostedUrl(meta.bankOrderId), tranId: payment.externalId, reused: true };
    }
    throw new AiblWalletError("A payment attempt already exists; verify it before further action", 409);
  }
  if (previous) return reuse(previous);
  const bill = aiblBillNo(); const context = { orderId, transactionId: bill };
  const urls = aiblWalletCallbackUrls(bill);
  const token = await getAiblWalletToken(context);
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.payment_method !== `AIBL_WALLET:${gatewayId}` || order.paymentStatus !== "UNPAID" ||
        !["PENDING", "CONFIRMED"].includes(order.status) || order.currency !== "BDT") {
      throw new AiblWalletError("Order is not eligible for AIBL payment", 409);
    }
    const amount = aiblMoney(order.grand_total.toString());
    if (!amount || amount === "0.00") throw new AiblWalletError("Invalid AIBL order amount", 400);
    const active = await tx.payment.findFirst({ where: { orderId, status: { in: ["INITIATED", "AUTHORIZED", "CAPTURED"] } }, orderBy: { id: "desc" } });
    if (active) return { reused: reuse(active, order) };
    const variantHolds = await tx.inventoryReservation.findMany({ where: { orderId }, orderBy: { id: "asc" },
      select: { id: true, stockLevelId: true, quantity: true, stockLevel: {
        select: { productVariantId: true, warehouseId: true, variant: { select: { productId: true } } },
      } } });
    const bundleHolds = await tx.bundleStockReservation.findMany({ where: { orderId }, orderBy: { id: "asc" },
      select: { id: true, bundleStockLevelId: true, quantity: true, bundleStockLevel: { select: { productId: true, warehouseId: true } } } });
    // Durable claim BEFORE sending orderID. Uncertain attempts are never automatically replaced.
    const payment = await tx.payment.create({ data: { orderId, provider: "AIBL_WALLET", externalId: bill,
      currency: "BDT", amount, status: "INITIATED", paymentGatewayData: { type: "AIBL_WALLET_TRANSACTION", gatewayId,
        contract: AIBL_WALLET_CONTRACT, environment: "uat", inventoryMode: "RESERVATION", accountFingerprint: config.accountFingerprint,
        initializationValidated: false, inventorySnapshot: {
          variants: variantHolds.map((h) => [h.id, h.stockLevelId, h.stockLevel.productVariantId, h.stockLevel.variant.productId, h.stockLevel.warehouseId, h.quantity]),
          bundles: bundleHolds.map((h) => [h.id, h.bundleStockLevelId, h.bundleStockLevel.productId, h.bundleStockLevel.warehouseId, h.quantity]),
        },
        initiatedAt: new Date().toISOString() } } });
    return { payment, amount };
  });
  if (claimed.reused) return claimed.reused;
  const payload = await bankRequest("orderID", { ...authenticationFields(), accessKey: config.accessKey, walletNo: "",
    amount: claimed.amount, ...urls, pay_description: `Deshi Plus order ${orderId}`, billNo: bill, token },
  { ...context, paymentId: claimed.payment.id });
  const bankOrderId = aiblProviderOrderId(payload.OrderID);
  const validated = Boolean(bankOrderId && aiblMoney(payload.amount) === claimed.amount &&
    (payload.code === undefined || payload.code === 200 || payload.code === "200"));
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: claimed.payment.id } });
    if (current.status !== "INITIATED") throw new AiblWalletError("AIBL attempt changed during initialization; verify payment", 409);
    if (bankOrderId) {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${"aibl:order:" + bankOrderId}, 0))::text AS "locked"`);
      const duplicate = await tx.payment.findFirst({ where: { provider: "AIBL_WALLET", id: { not: current.id },
        paymentGatewayData: { path: ["bankOrderId"], equals: bankOrderId } }, select: { id: true } });
      if (duplicate) throw new AiblWalletError("AIBL bank OrderID is already linked to another attempt; manual review required", 409);
    }
    await tx.payment.update({ where: { id: current.id }, data: { paymentGatewayData: {
      ...aiblWalletObject(current.paymentGatewayData), ...(bankOrderId ? { bankOrderId } : {}), initializationValidated: validated,
      initializeReview: validated ? null : "INVALID_RESPONSE_OR_AMOUNT", initializedAt: new Date().toISOString(),
    } as Prisma.InputJsonObject } });
  });
  await recordPaymentEvent({ ...context, paymentId: claimed.payment.id, provider: "AIBL_WALLET", operation: "INITIALIZE",
    outcome: validated ? "SUCCESS" : "MISMATCH", ...(!validated ? { detailCode: "INITIALIZE_REJECTED" as const } : {}) });
  if (!validated) throw new AiblWalletError("AIBL OrderID or returned amount was not validated; manual review required", 409);
  return { redirectUrl: aiblHostedUrl(bankOrderId), tranId: bill, reused: false };
}

export type AiblVerificationResult = { status: "success" | "pending"; message: string };
export async function reconcileAiblWalletPayment(bill: string, request?: Request, callbackTransactionId?: string, requestId: string = randomUUID()): Promise<AiblVerificationResult> {
  const payment = validAiblBill(bill) ? await prisma.payment.findUnique({ where: { externalId: bill } }) : null;
  if (!payment?.orderId || payment.provider !== "AIBL_WALLET") throw new AiblWalletError("AIBL payment attempt not found", 404);
  const context = { provider: "AIBL_WALLET" as const, orderId: payment.orderId, paymentId: payment.id, transactionId: bill, requestId };
  let stage: AiblDiagnosticStage = "PRE_VERIFY_VALIDATION_FAILED";
  let settlementCheck: AiblDiagnosticCode = "AIBL_SETTLEMENT_CALLBACK_REFERENCE";
  try {
    const verified = await queryAiblWalletPayment(payment, undefined, requestId);
    stage = "SETTLEMENT_VALIDATION_FAILED";
    if (callbackTransactionId && verified.transactionId && verified.transactionId !== callbackTransactionId) {
      throw new AiblWalletError("AIBL callback transaction differs from verified transaction; manual review required", 409);
    }
    await recordPaymentEvent({ ...context, operation: "VERIFY", outcome: verified.transactionId ? "SUCCESS" : "PENDING" });
    stage = "DATABASE_SETTLEMENT_FAILED";
    settlementCheck = "AIBL_SETTLEMENT_DATABASE_READ";
    const result = await prisma.$transaction(async (tx): Promise<AiblVerificationResult> => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId!} FOR UPDATE`);
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const meta = aiblWalletObject(current.paymentGatewayData);
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId! }, include: {
        orderItems: { include: { product: { select: { type: true, bundleFulfillmentMode: true, bundleWarehouseId: true } },
          bundleComponents: { select: { quantityPerBundle: true, variantId: true, warehouseId: true, product: { select: { type: true } } } } } },
      } });
      settlementCheck = "AIBL_SETTLEMENT_ATTEMPT";
      if (current.provider !== "AIBL_WALLET" || current.orderId !== payment.orderId || current.externalId !== bill || meta.initializationValidated !== true || meta.accountFingerprint !== aiblWalletConfig().accountFingerprint ||
          meta.bankOrderId !== aiblWalletObject(payment.paymentGatewayData).bankOrderId ||
          aiblMoney(current.amount?.toString()) !== aiblMoney(payment.amount?.toString()) || current.currency !== "BDT") {
        throw new AiblWalletError("AIBL attempt changed during verification; manual review required", 409);
      }
      if (current.status === "CAPTURED") {
        settlementCheck = "AIBL_SETTLEMENT_CAPTURE_STATE";
        if (order.paymentStatus !== "PAID" || verified.transactionId && meta.bankTransactionId !== verified.transactionId) {
          throw new AiblWalletError("AIBL capture conflicts with current payment state; manual review required", 409);
        }
        return { status: "success", message: "Payment already verified" };
      }
      settlementCheck = "AIBL_SETTLEMENT_ORDER_STATE";
      if (!["INITIATED", "AUTHORIZED"].includes(current.status) || order.paymentStatus !== "UNPAID" ||
          order.payment_method !== `AIBL_WALLET:${meta.gatewayId}` || !["PENDING", "CONFIRMED"].includes(order.status) ||
          order.currency !== "BDT" || aiblMoney(order.grand_total.toString()) !== aiblMoney(current.amount?.toString())) {
        throw new AiblWalletError("Order is not eligible for AIBL settlement; manual review required", 409);
      }
      const nextMeta = { ...meta, lastCheckedAt: new Date().toISOString(), verification: verified.transactionId ? "VERIFIED" : "PENDING_REVIEW" };
      if (!verified.transactionId) {
        settlementCheck = "AIBL_SETTLEMENT_WRITE";
        await tx.payment.update({ where: { id: current.id }, data: { paymentGatewayData: nextMeta as Prisma.InputJsonObject } });
        return { status: "pending", message: "AIBL has not confirmed payment; inventory remains reserved" };
      }
      settlementCheck = "AIBL_SETTLEMENT_OTHER_PAYMENT";
      if (await tx.payment.findFirst({ where: { orderId: order.id, status: { in: ["CAPTURED", "REFUNDED"] } } })) {
        throw new AiblWalletError("Another payment already settled this order; manual review required", 409);
      }
      settlementCheck = "AIBL_SETTLEMENT_OTHER_TRANSACTION";
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${"aibl:transaction:" + verified.transactionId}, 0))::text AS "locked"`);
      if (await tx.payment.findFirst({ where: { provider: "AIBL_WALLET", id: { not: current.id },
        paymentGatewayData: { path: ["bankTransactionId"], equals: verified.transactionId } }, select: { id: true } })) {
        throw new AiblWalletError("AIBL transaction is already captured by another attempt; manual review required", 409);
      }
      settlementCheck = "AIBL_SETTLEMENT_INVENTORY_SNAPSHOT";
      const expectedVariants = new Map<string, number>(); const expectedBundles = new Map<string, number>();
      const actualVariants = new Map<string, number>(); const actualBundles = new Map<string, number>();
      const expectedComponentsByWarehouse = new Map<string, number>(); const actualVariantsByWarehouse = new Map<string, number>();
      const add = (map: Map<string, number>, key: string, quantity: number) => map.set(key, (map.get(key) ?? 0) + quantity);
      for (const item of order.orderItems) {
        if (item.product.type === "PHYSICAL") {
          if (!item.variantId) throw new AiblWalletError("AIBL physical stock snapshot is missing", 409);
          add(expectedVariants, String(item.variantId), item.quantity);
        }
        if (item.product.type !== "BUNDLE") continue;
        if (item.product.bundleFulfillmentMode === "PREASSEMBLED") {
          if (!item.product.bundleWarehouseId) throw new AiblWalletError("AIBL bundle warehouse is missing", 409);
          add(expectedBundles, `${item.productId}:${item.product.bundleWarehouseId}`, item.quantity);
        } else for (const component of item.bundleComponents) {
          if (component.product.type !== "PHYSICAL") continue;
          if (!component.variantId || !component.warehouseId) throw new AiblWalletError("AIBL bundle component stock snapshot is missing", 409);
          add(expectedVariants, String(component.variantId), component.quantityPerBundle * item.quantity);
          add(expectedComponentsByWarehouse, `${component.variantId}:${component.warehouseId}`, component.quantityPerBundle * item.quantity);
        }
      }
      const variants = await tx.inventoryReservation.findMany({ where: { orderId: order.id }, include: { stockLevel: { include: { variant: { select: { productId: true } } } } }, orderBy: { id: "asc" } });
      const bundles = await tx.bundleStockReservation.findMany({ where: { orderId: order.id }, include: { bundleStockLevel: true }, orderBy: { id: "asc" } });
      const snapshot = { variants: variants.map((h) => [h.id, h.stockLevelId, h.stockLevel.productVariantId, h.stockLevel.variant.productId, h.stockLevel.warehouseId, h.quantity]),
        bundles: bundles.map((h) => [h.id, h.bundleStockLevelId, h.bundleStockLevel.productId, h.bundleStockLevel.warehouseId, h.quantity]) };
      const originalSnapshot = aiblWalletObject(meta.inventorySnapshot);
      if (JSON.stringify(snapshot.variants) !== JSON.stringify(originalSnapshot.variants) ||
          JSON.stringify(snapshot.bundles) !== JSON.stringify(originalSnapshot.bundles) ||
          order.fulfillmentWarehouseId && variants.some((h) => h.stockLevel.warehouseId !== order.fulfillmentWarehouseId)) {
        throw new AiblWalletError("AIBL reservation identity or warehouse changed; manual review required", 409);
      }
      for (const hold of variants) {
        add(actualVariants, String(hold.stockLevel.productVariantId), hold.quantity);
        add(actualVariantsByWarehouse, `${hold.stockLevel.productVariantId}:${hold.stockLevel.warehouseId}`, hold.quantity);
      }
      for (const hold of bundles) add(actualBundles, `${hold.bundleStockLevel.productId}:${hold.bundleStockLevel.warehouseId}`, hold.quantity);
      const matches = (expected: Map<string, number>, actual: Map<string, number>) => expected.size === actual.size && [...expected].every(([key, quantity]) => actual.get(key) === quantity);
      if (!matches(expectedVariants, actualVariants) || !matches(expectedBundles, actualBundles) ||
          [...expectedComponentsByWarehouse].some(([key, quantity]) => (actualVariantsByWarehouse.get(key) ?? 0) < quantity)) {
        throw new AiblWalletError("AIBL inventory reservations differ from the order; settlement rolled back, manual review required", 409);
      }
      settlementCheck = "AIBL_SETTLEMENT_INVENTORY_COMMIT";
      await commitOrderInventoryReservations({ tx, orderId: order.id, reason: `Order #${order.id} AIBL verified payment` });
      settlementCheck = "AIBL_SETTLEMENT_WRITE";
      await tx.payment.update({ where: { id: current.id }, data: { status: "CAPTURED", paymentGatewayData: {
        ...nextMeta, bankTransactionId: verified.transactionId, verifiedAt: new Date().toISOString(),
      } as Prisma.InputJsonObject } });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", transactionId: verified.transactionId } });
      if (order.status === "PENDING") {
        settlementCheck = "AIBL_SETTLEMENT_ORDER_LIFECYCLE";
        await transitionOrderStatusWithInventory({ tx, orderId: order.id, nextStatus: OrderStatus.CONFIRMED, reason: `Order #${order.id} AIBL verified payment` });
        await syncCommissionEntriesForOrderStatus({ tx, orderId: order.id, orderStatus: OrderStatus.CONFIRMED, request });
      }
      settlementCheck = "AIBL_SETTLEMENT_NOTIFICATIONS";
      await createOrderAdminNotifications({ tx, orderId: order.id, title: "Payment received",
        message: `AIBL Wallet payment for order #${order.id} was verified.`, metadata: { event: "ORDER_PAYMENT_STATUS_CHANGED", to: "PAID" } });
      return { status: "success", message: "AIBL Wallet payment verified successfully" };
    });
    await recordPaymentEvent({ ...context, operation: "SETTLEMENT", outcome: result.status === "pending" ? "PENDING" : result.message === "Payment already verified" ? "DUPLICATE" : "SUCCESS" });
    return result;
  } catch (error) {
    const failureStage = error instanceof AiblWalletError && error.diagnosticStage ? error.diagnosticStage
      : stage === "DATABASE_SETTLEMENT_FAILED" && error instanceof AiblWalletError ? "SETTLEMENT_VALIDATION_FAILED" : stage;
    // Log after rollback, never through a separate connection while holding transaction locks.
    if (stage !== "PRE_VERIFY_VALIDATION_FAILED") await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC",
      outcome: "ERROR", detailCode: settlementCheck });
    await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC", outcome: "ERROR", detailCode: failureStage });
    await recordPaymentEvent({ ...context, operation: "SETTLEMENT", outcome: error instanceof AiblWalletError && error.status === 409 ? "MISMATCH" : "ERROR", detailCode: "SETTLEMENT_REJECTED" });
    if (error instanceof AiblWalletError) throw error;
    throw new AiblWalletError("AIBL settlement could not complete; keep payment pending for manual review", 409);
  }
}
