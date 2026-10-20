import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AiblWalletError, aiblWalletPublicOrigin, reconcileAiblWalletPayment, verifyAiblCallbackState } from "@/lib/aibl-wallet";
import { aiblMoney } from "@/lib/aibl-wallet-settings";
import { AiblBodyParseError, clearAiblPending, readAiblCallbackBody } from "@/lib/aibl-wallet-http";
import { attachPaymentResult } from "@/lib/payment-result";
import { recordPaymentEvent, type PaymentLogContext, type AiblDiagnosticCode, type AiblCallbackDiagnosticCode } from "@/lib/payment-control/telemetry";
import { rateLimitRequest } from "@/lib/request-security";
import { revalidateStorefrontCatalog } from "@/lib/storefront-catalog-cache";
function callbackFieldType(value: unknown): "STRING" | "NUMBER" | "NULL" | "MISSING" | "OTHER" {
  if (value === undefined) return "MISSING";
  if (value === null) return "NULL";
  if (typeof value === "string") return "STRING";
  if (typeof value === "number") return "NUMBER";
  return "OTHER";
}
export async function handleAiblWalletCallback(request: NextRequest) {
  let trustedBill: string | undefined;
  let success = false;
  let validationRejected = false;
  let failureCode: AiblCallbackDiagnosticCode = "AIBL_CB_RATE_LIMIT_FAILED";
  const context: PaymentLogContext & { requestId: string } = { provider: "AIBL_WALLET", requestId: randomUUID() };
  try {
    const limit = await rateLimitRequest(request, { scope: "aibl-wallet-callback", limit: 30, windowMs: 60000 });
    failureCode = "AIBL_CB_RATE_LIMIT_REJECTED";
    if (!limit.allowed) throw new AiblWalletError("Payment callback rate limit exceeded", 429);
    failureCode = "AIBL_CB_STATE_CHECK_FAILED";
    const bill = request.nextUrl.searchParams.get("attempt") || "";
    if (!verifyAiblCallbackState(bill, request.nextUrl.searchParams.get("state") || "")) {
      failureCode = "AIBL_CB_STATE_INVALID";
      throw new AiblWalletError("Invalid signed callback state", 400);
    }
    failureCode = "AIBL_CB_PAYMENT_LOOKUP_FAILED";
    const payment = await prisma.payment.findUnique({ where: { externalId: bill } });
    failureCode = "AIBL_CB_PAYMENT_NOT_FOUND";
    if (!payment?.orderId || payment.provider !== "AIBL_WALLET") throw new AiblWalletError("Unknown payment callback", 400);
    context.paymentId = payment.id;
    context.orderId = payment.orderId;
    const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    const contentCode: AiblDiagnosticCode = contentType === "application/x-www-form-urlencoded" ? "AIBL_CB_CONTENT_FORM_URLENCODED"
      : contentType === "multipart/form-data" ? "AIBL_CB_CONTENT_MULTIPART"
        : contentType === "application/json" ? "AIBL_CB_CONTENT_JSON" : contentType ? "AIBL_CB_CONTENT_OTHER" : "AIBL_CB_CONTENT_MISSING";
    await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC", outcome: "RECEIVED", detailCode: contentCode });
    // Decode the confirmed form data JSON before diagnostics and unchanged validation.
    failureCode = "AIBL_CB_BODY_PARSE_FAILED";
    const body = await readAiblCallbackBody(request, async (detailCode) => {
      await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC", outcome: "RECEIVED", detailCode });
    });
    failureCode = "AIBL_CB_FIELD_VALIDATION_FAILED";
    // Fixed allowlist of field names; never enumerate/log arbitrary bank-supplied names or values.
    const presence: ReadonlyArray<readonly [AiblDiagnosticCode, boolean]> = [
      ["AIBL_CB_BILLNO_PRESENT", Object.hasOwn(body, "BILLNO")], ["AIBL_CB_AMOUNT_PRESENT", Object.hasOwn(body, "AMOUNT")],
      ["AIBL_CB_ALT_BILL_CAMEL", Object.hasOwn(body, "billNo")], ["AIBL_CB_ALT_BILL_LOWER", Object.hasOwn(body, "billno")],
      ["AIBL_CB_ALT_BILL_SNAKE", Object.hasOwn(body, "bill_no")], ["AIBL_CB_ALT_BILL_PASCAL", Object.hasOwn(body, "BillNo")],
      ["AIBL_CB_ALT_AMOUNT_LOWER", Object.hasOwn(body, "amount")], ["AIBL_CB_ALT_AMOUNT_PASCAL", Object.hasOwn(body, "Amount")],
    ];
    for (const [detailCode, present] of presence) await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC",
      outcome: present ? "SUCCESS" : "REJECTED", detailCode });
    await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC", outcome: "RECEIVED", detailCode: `AIBL_CB_BILLNO_TYPE_${callbackFieldType(body.BILLNO)}` });
    await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC", outcome: "RECEIVED", detailCode: `AIBL_CB_AMOUNT_TYPE_${callbackFieldType(body.AMOUNT)}` });
    const reasons: Array<"BILLNO_MISMATCH" | "AMOUNT_MISSING" | "AMOUNT_INVALID" | "AMOUNT_MISMATCH"> = [];
    if (body.BILLNO !== bill) reasons.push("BILLNO_MISMATCH");
    const callbackAmount = aiblMoney(body.AMOUNT);
    if (body.AMOUNT === undefined || body.AMOUNT === null || body.AMOUNT === "") reasons.push("AMOUNT_MISSING");
    else if (!callbackAmount) reasons.push("AMOUNT_INVALID");
    else if (callbackAmount !== aiblMoney(payment.amount?.toString())) reasons.push("AMOUNT_MISMATCH");
    if (reasons.length) {
      // Fixed codes only: no body values, reference fragments, session keys or OTPs.
      for (const detailCode of reasons) await recordPaymentEvent({ ...context, operation: "CALLBACK", outcome: "MISMATCH", detailCode });
      validationRejected = true;
      throw new AiblWalletError("Invalid callback bill or amount", 400);
    }
    const transactionId = body.TRANSNO;
    failureCode = "AIBL_CB_TRANSNO_INVALID";
    if (transactionId !== undefined && transactionId !== "" &&
        (typeof transactionId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(transactionId))) throw new AiblWalletError("Invalid callback transaction reference", 400);
    trustedBill = bill;
    // SESSIONKEY/MESSAGE are neither trusted nor persisted. STATUS/RESCODE never settle an order.
    await recordPaymentEvent({ ...context, operation: "CALLBACK", outcome: "RECEIVED", detailCode:
        request.nextUrl.pathname.endsWith("/approved") ? "CALLBACK_SUCCESS" : request.nextUrl.pathname.endsWith("/decline") ? "CALLBACK_FAIL" : "CALLBACK_CANCEL" });
    failureCode = "AIBL_CB_VERIFY_FAILED";
    const result = await reconcileAiblWalletPayment(bill, request, typeof transactionId === "string" && transactionId ? transactionId : undefined, context.requestId);
    success = result.status === "success";
    failureCode = "AIBL_CB_RESULT_FAILED";
    revalidateStorefrontCatalog();
  } catch (error) {
    // Preserve the specific validation codes instead of appending a generic rejection.
    if (!validationRejected) {
      const outcome = error instanceof AiblWalletError && error.status === 400 ? "REJECTED" as const : "ERROR" as const;
      await recordPaymentEvent({ ...context, operation: "DIAGNOSTIC", outcome,
        detailCode: error instanceof AiblBodyParseError ? error.diagnosticCode : failureCode });
      await recordPaymentEvent({ ...context, operation: "CALLBACK", outcome, detailCode: "INVALID_CALLBACK" });
    }
  }
  let origin: string;
  try { origin = aiblWalletPublicOrigin(); } catch { return NextResponse.json({ error: "Payment result origin is unavailable" }, { status: 503 }); }
  const response = NextResponse.redirect(new URL("/ecommerce/payment-result", origin), 303);
  if (success) clearAiblPending(response);
  return attachPaymentResult(response, trustedBill, "AIBL_WALLET");
}
