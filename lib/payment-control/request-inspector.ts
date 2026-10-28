import "server-only";

import { prisma } from "@/lib/prisma";
import { PaymentControlError } from "@/lib/payment-control/authorization";
import { uuidPattern } from "@/lib/network-monitor/policy";
import { readTransportEvidence } from "./transport-storage";
import { readTechnicalRequestInspector } from "./request-inspector-reader";

// HTTP callers must retain the existing admin authorization gate.
export function getTechnicalRequestInspector(requestId: string, params = new URLSearchParams()) {
  return readTechnicalRequestInspector({ prisma, PaymentControlError, uuidPattern, readTransportEvidence }, requestId, params);
}
