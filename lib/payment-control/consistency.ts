import type { DiagnosticCheck } from "./investigation-engine";
export type ConsistencySnapshot = {
  payment: { id: number; status: string; amount: string | null; currency: string; createdAt: string };
  order: { id: number; paymentStatus: string; status: string; amount: string; currency: string };
  settledPayments: number; duplicateBankReferences: number | null; reservations: number;
  stock: Array<{ id: number; kind: string; quantity: number; reserved: number; actualReserved: number }>;
  stockLimited: boolean; verificationRecorded: boolean; settlementRecorded: boolean;
  variantTotals?: Array<{ id: number; storedStock: number; computedStock: number }>;
  commitLedger?: { stockRequired: boolean; observed: boolean; matches: boolean; certainty?: "SNAPSHOT" | "CURRENT_CATALOG" };
  reconciliation: { result: string; createdAt: string } | null;
};
function money(value: string | null): bigint | null {
  if (value === null || !/^\d{1,16}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function checkConsistency(s: ConsistencySnapshot): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];
  const add = (code: string, status: DiagnosticCheck["status"], explanation: string, evidence: string[] = ["database:repeatable-read-snapshot"]) =>
    checks.push({ code, status, explanation, evidence });
  add("PAYMENT_ORDER_CONSISTENCY", s.payment.status === "CAPTURED" && s.order.paymentStatus === "UNPAID" ? "FAIL" :
    s.payment.status === "CAPTURED" && s.order.paymentStatus === "REFUNDED" ? "WARNING" : "PASS",
    "Compared current CAPTURED attempt with the order payment state in one read-only database snapshot.");
  add("DUPLICATE_PAYMENT", s.settledPayments > 1 ? "FAIL" : "PASS", "Counted CAPTURED/REFUNDED attempts on the same order.");
  add("DUPLICATE_TRANSACTION_REFERENCE", s.duplicateBankReferences === null ? "NOT_OBSERVED" : s.duplicateBankReferences > 0 ? "FAIL" : "PASS",
    "Checked stored provider bank references against other attempts; externalId already has a unique constraint.");
  const a = money(s.payment.amount), b = money(s.order.amount);
  add("PAYMENT_AMOUNT_MISMATCH", a === null || b === null ? "UNKNOWN" : a !== b || s.payment.currency !== s.order.currency ? "FAIL" : "PASS",
    "Compared local attempt and authoritative order amount/currency. This does not claim an echoed gateway amount was observed.");
  add("PAYMENT_VERIFICATION_EVIDENCE", s.verificationRecorded ? "PASS" : "NOT_OBSERVED",
    "Provider-specific successful server verification event or durable verification marker; absence is not proof of unverified capture.");
  add("CONFIRMED_ORDER_WITHOUT_VERIFICATION", s.order.status === "CONFIRMED" && !s.verificationRecorded ? "WARNING" : s.verificationRecorded ? "PASS" : "NOT_OBSERVED",
    "Confirmation without retained verification merits review. Existing workflows can confirm unpaid orders; state alone does not prove an unauthorized modification.");
  add("VERIFIED_WITHOUT_SETTLEMENT", s.verificationRecorded && ["INITIATED", "AUTHORIZED"].includes(s.payment.status) ? "WARNING" :
    s.verificationRecorded ? "PASS" : "NOT_OBSERVED", "Server verification evidence exists while current settlement is pending; compare later events and failed transaction guards.");
  add("INVENTORY_COMMIT_RESERVATIONS", s.payment.status === "CAPTURED" && s.reservations > 0 ? "FAIL" : "PASS",
    "Checked for reservations still attached to an already captured order; does not reconstruct historical commit timing.");
  add("INVENTORY_COMMIT_LEDGER", s.payment.status !== "CAPTURED" || !s.commitLedger ? "NOT_OBSERVED" :
    s.commitLedger.stockRequired && !s.commitLedger.observed ? "NOT_OBSERVED" : s.commitLedger.matches ? "PASS" : s.commitLedger.certainty === "SNAPSHOT" ? "FAIL" : "WARNING",
    "Compared provider-specific negative movements with original inventory snapshot where available; otherwise current order/catalog quantities. Catalog changes can explain a mismatch without an original snapshot. Missing historical movement logs remain unobserved.");
  add("NEGATIVE_AVAILABLE_STOCK", s.stock.some(v => v.quantity < 0 || v.reserved < 0 || v.quantity < v.reserved) ? "FAIL" : s.stockLimited ? "UNKNOWN" : "PASS",
    "Checked related variant and preassembled bundle warehouse levels for negative quantities or availability.");
  add("INVENTORY_RESERVATION_INCONSISTENCY", s.stock.some(v => v.reserved !== v.actualReserved) ? "FAIL" : s.stockLimited ? "UNKNOWN" : "PASS",
    "Compared each related warehouse reserved counter with the sum of all current reservations, including other orders and carts.");
  add("MULTI_WAREHOUSE_STOCK_MISMATCH", !s.variantTotals ? "NOT_OBSERVED" : s.variantTotals.some(v => v.storedStock !== v.computedStock) ? "FAIL" : s.stockLimited ? "UNKNOWN" : "PASS",
    "Compared ProductVariant.stock with the sum of non-negative warehouse availability using the existing inventory calculation.");
  add("RECONCILIATION_FAILURE", s.reconciliation && ["CHECK_FAILED", "MISMATCH", "INVALID_REFERENCE", "INVALID_AMOUNT"].includes(s.reconciliation.result) ? "WARNING" :
    s.reconciliation?.result === "MATCH" ? "PASS" : "NOT_OBSERVED", "Latest retained comparison is historical evidence; local state may have changed since it was made.");
  add("UNAUTHORIZED_ADMIN_MODIFICATION", "UNKNOWN", "Current financial state cannot prove who changed it; review existing ActivityLog and database audit records.");
  add("INVALID_STATUS_TRANSITION", "NOT_OBSERVED", "No authoritative before/after transition ledger was supplied; current state alone does not establish an invalid transition.");
  return checks;
}
