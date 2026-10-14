// Non-secret settings only. EPS credentials are read exclusively on the server.
// Confirmed by the EPS Technical Team for Sandbox; this marker is metadata, not an enablement gate.
export const EPS_INITIALIZE_CONTRACT = "POSTMAN_WITH_MERCHANT_ID_V4";

export function epsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function normalizeEpsGatewaySettings(value: unknown) {
  const data = epsObject(value);
  function statuses(input: unknown) {
    if (!Array.isArray(input) || input.length > 10) throw new Error("EPS terminal statuses must be an array of at most 10 confirmed values");
    return [...new Set(input.map((status) => {
      if (typeof status !== "string" || !status.trim() || status.length > 80 ||
          /^(success|pending|initiated|processing|authorized|unknown)$/i.test(status.trim())) {
        throw new Error("Invalid EPS terminal status; use only EPS-confirmed final failure/cancellation values");
      }
      return status.trim();
    }))];
  }
  const failureStatuses = statuses(data.failureStatuses ?? []);
  const cancellationStatuses = statuses(data.cancellationStatuses ?? []);
  if (failureStatuses.some((status) => cancellationStatuses.includes(status))) {
    throw new Error("EPS failure and cancellation statuses must be distinct");
  }
  return {
    type: "EPS",
    isActive: data.isActive === true,
    // Older UNCONFIRMED settings no longer require a manual confirmation step.
    initializeContract: EPS_INITIALIZE_CONTRACT,
    failureStatuses,
    cancellationStatuses,
  };
}
