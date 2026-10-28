import { connection } from "next/server";
import {
  PaymentControlError,
  requirePaymentControlAccess,
} from "@/lib/payment-control/authorization";
import TechnicalInspector from "@/components/admin/payment-control/TechnicalInspector";

export default async function PaymentRequestInspectorPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  await connection();
  try {
    await requirePaymentControlAccess();
  } catch (error) {
    if (error instanceof PaymentControlError) {
      return <main className="p-6"><h1 className="text-xl font-semibold">Payment &amp; Network Technical Inspector</h1><p role="alert" className="mt-4">{error.message}</p></main>;
    }
    throw error;
  }
  const { requestId } = await params;
  return <TechnicalInspector requestId={requestId} />;
}
