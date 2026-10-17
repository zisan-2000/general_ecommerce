export type PaymentRow = {
  id: number; orderId: number | null; amount: string | null; currency: string; provider: string | null;
  status: string; externalId: string | null; createdAt: string; updatedAt: string;
  order: { paymentStatus: string; status: string; grand_total: string; currency: string } | null;
};
export type EventRow = {
  requestId: string | null;
  networkAgentId?: string | null; requestStartedAt?: string | null; requestCompletedAt?: string | null;
  id: string; paymentId: number | null; orderId: number | null; transactionId: string | null; provider: string;
  operation: string; outcome: string; httpStatus: number | null; durationMs: number | null;
  gatewayStatus: string | null; detailCode: string | null; createdAt: string;
};
export type StaffOption = { id: string; name: string | null };
export type DisputeRow = {
  id: string; paymentId: number; category: string; complaint: string; status: string; version: number;
  assignedToId: string | null; assignedTo: StaffOption | null; resolution: string | null;
  createdAt: string; updatedAt: string; payment?: PaymentRow;
  evidence?: Array<{ id: string; label: string; note: string; url: string | null; createdAt: string }>;
  activities?: Array<{ id: string; action: string; fromStatus: string | null; toStatus: string; resolution: string | null; actorUserId: string; createdAt: string }>;
};
export type RefundRow = {
  id: number; orderId: number; paymentId: number | null; amount: string; status: string; payoutStatus: string;
  payoutTransactionId: string | null; reviewedAt: string | null; paidAt: string | null; createdAt: string;
  order?: { payment_method: string; paymentStatus: string };
};
export type ReconciliationRow = {
  id: string; databaseStatus: string; orderStatus: string; gatewayStatus: string; result: string;
  amountMatches: boolean | null; referenceMatches: boolean | null; createdAt: string;
};
export type PaymentDetail = {
  aibl?: { bankOrderId: string | null; bankTransactionId: string | null; initializationValidated: boolean; review: string | null } | null;
  payment: PaymentRow; events: EventRow[]; nextBefore: string | null;
  reconciliations: ReconciliationRow[]; disputes: DisputeRow[]; refunds: RefundRow[];
};
export type DashboardData = {
  payments: PaymentRow[]; total: number; page: number; pageSize: number; staff: StaffOption[];
  canRecordRefund: boolean; simulations: { enabled: boolean; eps: boolean };
  alerts: Array<{ kind: string; paymentId: number; orderId: number; provider: string; transactionId: string | null; createdAt: string }>;
  alertCandidateCount: number; alertScanLimit: number;
  range: { start: string; end: string };
  network: { summary: Array<{ provider: string; outcome: string; _count: { _all: number } }>;
    requests: number; averageMs: number | null; maxMs: number | null; p95Ms: number | null; p95SampleSize: number;
    latestEventAt: string | null; recentRequests: EventRow[] };
};
export type SimulationRun = { id: string; provider: string; scenario: string; createdAt: string;
  result: { synthetic: boolean; actualGatewayRequests: number; realPaymentUpdates: number; realInventoryUpdates: number;
    paymentStatus: string; disputeStatus: string | null;
    ledger: { capturedCents: number; refundedCents: number; captures: number; refunds: number; inventoryCommits: number; inventoryReleases: number };
    timeline: Array<{ sequence: number; operation: string; outcome: string }> } };
