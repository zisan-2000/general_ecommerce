import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { epsConfig, verifyEpsPayment } from "@/lib/eps";
import { epsObject } from "@/lib/eps-settings";
import { PaymentControlError } from "./authorization";
import { recordPaymentEvent, safeGatewayStatus, type PaymentProvider } from "./telemetry";

import { querySslcommerzPayment, paymentAmountMatches } from "./gateway-query";
import { queryAiblWalletPayment } from "@/lib/aibl-wallet";

export async function compareGatewayPayment(paymentId: number, actorUserId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: {
    order: { select: { paymentStatus: true } },
  } });
  if (!payment?.orderId || !payment.externalId || !["EPS", "SSLCOMMERZ", "AIBL_WALLET"].includes(payment.provider || "")) {
    throw new PaymentControlError("Online payment attempt not found", 404);
  }
  const provider = payment.provider as PaymentProvider;
  const context = { provider, paymentId, orderId: payment.orderId, transactionId: payment.externalId, actorUserId };
  let gatewayStatus = "UNKNOWN";
  let referenceMatches: boolean | null = null;
  let amountMatches: boolean | null = null;
  let result = "UNKNOWN";
  let remoteFinal: "SUCCESS" | "FAILED" | "CANCELLED" | "PENDING" | "UNKNOWN" = "UNKNOWN";
  try {
    const meta = epsObject(payment.paymentGatewayData);
    if (provider === "EPS") {
      if (meta.accountFingerprint !== epsConfig().accountFingerprint) {
        throw new PaymentControlError("EPS account differs from the original attempt", 409);
      }
      const response = await verifyEpsPayment(payment.externalId, undefined, context);
      gatewayStatus = safeGatewayStatus(response.Status);
      referenceMatches = response.MerchantTransactionId === payment.externalId;
      amountMatches = paymentAmountMatches(response.TotalAmount, payment.amount);
      const gateway = await prisma.payment.findFirst({ where: { id: Number(meta.gatewayId), orderId: null },
        select: { paymentGatewayData: true } });
      const settings = epsObject(gateway?.paymentGatewayData);
      remoteFinal = response.Status === "Success" && !response.ErrorCode && !response.ErrorMessage ? "SUCCESS"
        : Array.isArray(settings.failureStatuses) && settings.failureStatuses.includes(response.Status) ? "FAILED"
          : Array.isArray(settings.cancellationStatuses) && settings.cancellationStatuses.includes(response.Status) ? "CANCELLED" : "UNKNOWN";
      if (response.Status === "Success" && (response.ErrorCode || response.ErrorMessage)) result = "MISMATCH";
    } else if (provider === "AIBL_WALLET") {
      const response = await queryAiblWalletPayment(payment, actorUserId);
      gatewayStatus = response.transactionId ? "ORDER_VERIFIED" : "UNKNOWN";
      remoteFinal = response.transactionId ? "SUCCESS" : "UNKNOWN";
      // AIBL documents no echoed bill/amount/currency in verify. Do not fabricate matches.
      referenceMatches = null; amountMatches = null;
    } else {
      const response = await querySslcommerzPayment(payment, actorUserId);
      gatewayStatus = safeGatewayStatus(response.status);
      referenceMatches = response.referenceMatches;
      amountMatches = response.amountMatches;
      remoteFinal = ["VALID", "VALIDATED"].includes(response.status) ? "SUCCESS"
        : response.status === "FAILED" ? "FAILED" : response.status === "PENDING" ? "PENDING" : "UNKNOWN";
    }
    if (referenceMatches === false) result = "INVALID_REFERENCE";
    else if (amountMatches === false) result = "INVALID_AMOUNT";
    else if (result !== "MISMATCH") {
      const localFinal = payment.status === "CAPTURED" || payment.status === "REFUNDED" ? "SUCCESS"
        : payment.status === "FAILED" ? "FAILED" : payment.status === "VOIDED" ? "CANCELLED" : "PENDING";
      result = remoteFinal === "UNKNOWN" ? "UNKNOWN"
        : localFinal === remoteFinal ? "MATCH" : remoteFinal === "PENDING" && localFinal === "PENDING" ? "MATCH" : "MISMATCH";
      if (payment.status === "CAPTURED" && payment.order?.paymentStatus === "UNPAID") result = "MISMATCH";
      // A successful charge query is not evidence that a later refund was completed.
      if (payment.status === "REFUNDED" || payment.order?.paymentStatus === "REFUNDED") result = "REFUND_REVIEW";
    }
  } catch {
    result = "CHECK_FAILED";
    await recordPaymentEvent({ ...context, operation: "VERIFY", outcome: "ERROR", detailCode: "STATUS_CHECK_FAILED" });
  }
  // The compare operation intentionally never changes Payment, Order or inventory.
  // Detect a concurrent settlement instead of saving a stale comparison as authoritative.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId!} FOR UPDATE`);
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: {
      order: { select: { paymentStatus: true } },
    } });
    if (current.status !== payment.status || current.updatedAt.getTime() !== payment.updatedAt.getTime() ||
        current.order?.paymentStatus !== payment.order?.paymentStatus || current.externalId !== payment.externalId ||
        current.currency !== payment.currency || current.orderId !== payment.orderId ||
        (current.amount?.toString() ?? null) !== (payment.amount?.toString() ?? null)) {
      result = "LOCAL_STATE_CHANGED"; amountMatches = null; referenceMatches = null;
    }
    return tx.paymentReconciliation.create({ data: { paymentId, databaseStatus: current.status,
      orderStatus: current.order?.paymentStatus ?? "UNKNOWN", gatewayStatus, result, amountMatches, referenceMatches, actorUserId } });
  });
}
