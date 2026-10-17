import Link from "next/link";
import PaymentResultClient from "./PaymentResultClient";
import { getTranslations } from "next-intl/server";
import { readPaymentResult } from "@/lib/payment-result";

export default async function PaymentResultPage() {
  // Query strings and gateway browser notifications are never payment evidence.
  const result = await readPaymentResult();
  const success = result.success;
  const pending = result.status === "pending";
  const t = await getTranslations("StorefrontCommerce.paymentResult");

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-16">
      <div className="w-full rounded-2xl border bg-background p-8 text-center shadow-sm">
        <div className={`text-5xl ${success ? "text-green-600" : "text-red-600"}`}>
          {success ? "✓" : "!"}
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {success ? t("success") : pending ? t("pending") : result.status === "cancelled" ? t("cancelled") : t("unsuccessful")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {success ? t("verified") : t("unpaid")}
        </p>
        {result.orderId && <p className="mt-2 text-sm">{t("orderNumber", { id: result.orderId })}</p>}
        <PaymentResultClient success={success} paymentId={result.paymentId} orderId={result.orderId} provider={result.provider} purchase={result.purchase} />
        <div className="mt-6 flex justify-center gap-3">
          {!success && <Link className="rounded-md border px-4 py-2" href="/ecommerce/checkout">Resume checkout</Link>}
          <Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href="/ecommerce/user/orders">
            {t("viewOrders")}
          </Link>
          <Link className="rounded-md border px-4 py-2" href="/ecommerce">
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    </main>
  );
}
