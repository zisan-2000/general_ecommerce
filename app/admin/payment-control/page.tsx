import { connection } from "next/server";
import { requirePaymentControlAccess, PaymentControlError } from "@/lib/payment-control/authorization";
import PaymentControlCenter from "@/components/admin/payment-control/PaymentControlCenter";

export default async function PaymentControlPage() {
  await connection();
  try {
    await requirePaymentControlAccess();
  } catch (error) {
    if (error instanceof PaymentControlError) return <main className="p-6"><h1 className="text-xl font-semibold">Payment Control Center</h1><p role="alert" className="mt-4">{error.message}</p></main>;
    throw error;
  }
  return <PaymentControlCenter />;
}
