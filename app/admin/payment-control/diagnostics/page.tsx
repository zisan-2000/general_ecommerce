import { connection } from "next/server";
import Link from "next/link";
import { requirePaymentControlAccess, PaymentControlError } from "@/lib/payment-control/authorization";
import PaymentDiagnostics from "@/components/admin/payment-control/PaymentDiagnostics";
export default async function PaymentDiagnosticsPage() {
  await connection();
  let access;
  try {
    access = await requirePaymentControlAccess();
  } catch (error) {
    if (error instanceof PaymentControlError) return <main className="p-6"><h1 className="text-xl font-semibold">Payment Diagnostics</h1>
      <p role="alert" className="mt-4">{error.message}</p><Link href="/admin/payment-control">Payment Control Center</Link></main>;
    throw error;
  }
  return <PaymentDiagnostics canCapture={access.hasGlobal("payments.diagnostics.capture")}
    canExport={access.hasGlobal("payments.diagnostics.export")} canDownloadEvidence={access.hasGlobal("payments.diagnostics.evidence")} />;
}
