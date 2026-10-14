import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { PaymentControlError, idempotencyKey } from "./authorization";

export const sandboxScenarios = ["SUCCESS", "FAILED", "TIMEOUT", "DUPLICATE_CALLBACK", "REFUND", "DISPUTE"] as const;
type Scenario = typeof sandboxScenarios[number];

export function sandboxSimulationAvailability() {
  const enabled = process.env.PAYMENT_CONTROL_SANDBOX_SIMULATIONS === "true" && process.env.NODE_ENV !== "production";
  return { enabled, eps: enabled && process.env.EPS_ENV === "sandbox" };
}

// An isolated diagnostic state machine. It never calls payment settlement, refunds,
// inventory helpers, gateway fetch or any real Order/Payment delegate.
function simulate(scenario: Scenario) {
  const ledger = { capturedCents: 0, refundedCents: 0, captures: 0, inventoryCommits: 0, inventoryReleases: 0, refunds: 0 };
  const timeline: Array<{ sequence: number; operation: string; outcome: string }> = [];
  const record = (operation: string, outcome: string) => timeline.push({ sequence: timeline.length + 1, operation, outcome });
  const capture = () => {
    if (ledger.captures) { record("SETTLEMENT", "DUPLICATE_IGNORED"); return; }
    ledger.captures++;
    ledger.capturedCents = 10000;
    ledger.inventoryCommits++;
    record("SETTLEMENT", "CAPTURED");
  };
  record("INITIALIZE", "SYNTHETIC_ATTEMPT_CREATED");
  let paymentStatus = "INITIATED";
  let disputeStatus: string | null = null;
  if (scenario === "TIMEOUT") {
    record("STATUS_QUERY", "SYNTHETIC_TIMEOUT");
    record("ALERT", "PENDING_CALLBACK_MISSING");
  } else if (scenario === "FAILED") {
    record("VERIFY", "SYNTHETIC_CONFIRMED_FAILURE");
    ledger.inventoryReleases++;
    paymentStatus = "FAILED";
  } else {
    record("CALLBACK", "RECEIVED");
    record("VERIFY", "SYNTHETIC_VERIFIED_SUCCESS");
    capture();
    paymentStatus = "CAPTURED";
    if (scenario === "DUPLICATE_CALLBACK") {
      record("CALLBACK", "RECEIVED_AGAIN");
      capture();
      capture();
    }
    if (scenario === "REFUND") {
      const references = new Set<string>();
      const refund = (key: string, cents: number) => {
        if (references.has(key)) { record("REFUND", "DUPLICATE_IGNORED"); return; }
        if (ledger.refundedCents + cents > ledger.capturedCents) { record("REFUND", "OVER_REFUND_REJECTED"); return; }
        references.add(key);
        ledger.refunds++;
        ledger.refundedCents += cents;
        record("REFUND", "RECORDED");
      };
      refund("synthetic-refund", 5000);
      refund("synthetic-refund", 5000);
      refund("synthetic-over-refund", 6000);
    }
    if (scenario === "DISPUTE") {
      disputeStatus = "OPEN";
      record("DISPUTE", "OPENED");
      record("DISPUTE", "SYNTHETIC_EVIDENCE_ATTACHED");
      disputeStatus = "INVESTIGATING";
      record("DISPUTE", "STAFF_ASSIGNED");
      disputeStatus = "RESOLVED";
      record("DISPUTE", "RESOLVED_WITHOUT_SETTLEMENT_CHANGE");
    }
  }
  return { synthetic: true, actualGatewayRequests: 0, realPaymentUpdates: 0, realInventoryUpdates: 0,
    paymentStatus, disputeStatus, ledger, timeline };
}

export async function createSandboxSimulation(input: unknown, actorUserId: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PaymentControlError("A simulation object is required");
  const body = input as Record<string, unknown>;
  const { enabled, eps } = sandboxSimulationAvailability();
  if (!enabled) throw new PaymentControlError("Simulations require explicit opt-in in a non-production environment", 403);
  const provider = String(body.provider || "");
  const scenario = String(body.scenario || "");
  if (!["EPS", "SSLCOMMERZ"].includes(provider) || !sandboxScenarios.includes(scenario as Scenario)) {
    throw new PaymentControlError("Invalid simulation provider or scenario");
  }
  if (provider === "EPS" && !eps) throw new PaymentControlError("EPS simulation requires EPS_ENV=sandbox", 403);
  if (provider === "SSLCOMMERZ" && !await prisma.payment.findFirst({ where: { orderId: null, AND: [
    { paymentGatewayData: { path: ["type"], equals: "SSLCOMMERZ" } },
    { paymentGatewayData: { path: ["sandbox"], equals: true } },
  ] }, select: { id: true } })) throw new PaymentControlError("Configure a sandbox SSLCommerz gateway first", 403);
  const key = idempotencyKey(body.idempotencyKey);
  const findRetry = async () => {
    const current = await prisma.paymentSandboxRun.findUnique({ where: { idempotencyKey: key } });
    if (current && (current.provider !== provider || current.scenario !== scenario || current.actorUserId !== actorUserId)) {
      throw new PaymentControlError("Simulation key already used for another scenario", 409);
    }
    return current;
  };
  const existing = await findRetry();
  if (existing) return existing;
  try {
    return await prisma.paymentSandboxRun.create({ data: {
      provider, scenario, idempotencyKey: key, actorUserId, result: simulate(scenario as Scenario),
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const current = await findRetry();
      if (current) return current;
    }
    throw error;
  }
}
