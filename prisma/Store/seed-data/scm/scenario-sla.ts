import { Prisma } from "../../../generated/prisma";
import { daysAgo, daysFromNow, decimal } from "./helpers";
import type { ScmSeedContext, ScmSeedPrisma } from "./types";

async function requirePolicy(prisma: ScmSeedPrisma, supplierId: number) {
  const policy = await prisma.supplierSlaPolicy.findFirst({
    where: { supplierId, isActive: true },
    select: { id: true },
  });
  if (!policy) throw new Error(`Missing SLA policy for supplier ${supplierId}`);
  return policy;
}

async function upsertFeedback(
  prisma: ScmSeedPrisma,
  input: {
    supplierId: number;
    sourceReference: string;
    rating: number;
    serviceQualityRating: number;
    deliveryRating: number;
    complianceRating: number;
    comment: string;
    createdById?: string | null;
    createdAt: Date;
  },
) {
  const existing = await prisma.supplierFeedback.findFirst({
    where: {
      supplierId: input.supplierId,
      sourceReference: input.sourceReference,
    },
    select: { id: true },
  });

  const data = {
    sourceType: "INTERNAL" as const,
    sourceReference: input.sourceReference,
    rating: input.rating,
    serviceQualityRating: input.serviceQualityRating,
    deliveryRating: input.deliveryRating,
    complianceRating: input.complianceRating,
    comment: input.comment,
    createdById: input.createdById ?? null,
    createdAt: input.createdAt,
  };

  if (existing) {
    await prisma.supplierFeedback.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const created = await prisma.supplierFeedback.create({
    data: {
      supplierId: input.supplierId,
      ...data,
    },
    select: { id: true },
  });
  return created.id;
}

async function upsertSlaBreach(
  prisma: ScmSeedPrisma,
  input: {
    supplierId: number;
    supplierSlaPolicyId: number;
    periodStart: Date;
    periodEnd: Date;
    trackedPoCount: number;
    completedPoCount: number;
    openLatePoCount: number;
    breachCount: number;
    status: "OK" | "WARNING" | "BREACH";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    actionStatus: "NOT_REQUIRED" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
    ownerUserId?: string | null;
    dueDate?: Date | null;
    alertMessage?: string | null;
    issues: unknown;
    evaluatedById?: string | null;
    observedLeadTimeDays?: string | number | null;
    onTimeRatePercent?: string | number | null;
    fillRatePercent?: string | number | null;
  },
) {
  const existing = await prisma.supplierSlaBreach.findFirst({
    where: {
      supplierId: input.supplierId,
      supplierSlaPolicyId: input.supplierSlaPolicyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
    select: { id: true },
  });

  const data = {
    evaluationDate: daysAgo(1),
    trackedPoCount: input.trackedPoCount,
    completedPoCount: input.completedPoCount,
    openLatePoCount: input.openLatePoCount,
    breachCount: input.breachCount,
    status: input.status,
    severity: input.severity,
    observedLeadTimeDays: input.observedLeadTimeDays
      ? decimal(input.observedLeadTimeDays)
      : null,
    onTimeRatePercent: input.onTimeRatePercent ? decimal(input.onTimeRatePercent) : null,
    fillRatePercent: input.fillRatePercent ? decimal(input.fillRatePercent) : null,
    actionStatus: input.actionStatus,
    ownerUserId: input.ownerUserId ?? null,
    dueDate: input.dueDate ?? null,
    startedAt: input.actionStatus === "NOT_REQUIRED" ? null : daysAgo(1),
    resolvedAt: input.actionStatus === "RESOLVED" ? daysAgo(0) : null,
    resolvedById: input.actionStatus === "RESOLVED" ? input.ownerUserId ?? null : null,
    resolutionNote:
      input.actionStatus === "RESOLVED"
        ? "Seeded SLA action resolved after supplier follow-up."
        : null,
    alertTriggeredAt: input.alertMessage ? daysAgo(1) : null,
    alertMessage: input.alertMessage ?? null,
    alertAcknowledgedAt: null,
    disputeStatus: "NONE" as const,
    issues: input.issues as Prisma.InputJsonValue,
    evaluatedById: input.evaluatedById ?? null,
  };

  if (existing) {
    return prisma.supplierSlaBreach.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  }

  return prisma.supplierSlaBreach.create({
    data: {
      supplierId: input.supplierId,
      supplierSlaPolicyId: input.supplierSlaPolicyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      ...data,
    },
    select: { id: true },
  });
}

export async function seedScmSlaScenarios(
  prisma: ScmSeedPrisma,
  ctx: ScmSeedContext,
): Promise<ScmSeedContext> {
  const healthySupplier = ctx.suppliers.alpha_safety;
  const warningSupplier = ctx.suppliers.packmate;
  const breachSupplier = ctx.suppliers.rackworks;

  if (!healthySupplier || !warningSupplier || !breachSupplier) {
    throw new Error("Missing required suppliers for SCM SLA scenarios.");
  }

  await upsertFeedback(prisma, {
    supplierId: healthySupplier.id,
    sourceReference: "SLA-FB-SCM-001",
    rating: 5,
    serviceQualityRating: 5,
    deliveryRating: 5,
    complianceRating: 5,
    comment: "Consistent delivery and documentation quality.",
    createdById: ctx.users.sla_manager?.id ?? ctx.adminUserId,
    createdAt: daysAgo(3),
  });

  await upsertFeedback(prisma, {
    supplierId: warningSupplier.id,
    sourceReference: "SLA-FB-SCM-002",
    rating: 3,
    serviceQualityRating: 4,
    deliveryRating: 3,
    complianceRating: 3,
    comment: "Minor delivery delays observed during recent RFQ cycle.",
    createdById: ctx.users.sla_manager?.id ?? ctx.adminUserId,
    createdAt: daysAgo(2),
  });

  await upsertFeedback(prisma, {
    supplierId: breachSupplier.id,
    sourceReference: "SLA-FB-SCM-003",
    rating: 2,
    serviceQualityRating: 2,
    deliveryRating: 1,
    complianceRating: 2,
    comment: "Repeated late delivery and incomplete shipment documentation.",
    createdById: ctx.users.sla_manager?.id ?? ctx.adminUserId,
    createdAt: daysAgo(1),
  });

  const healthyPolicy = await requirePolicy(prisma, healthySupplier.id);
  const warningPolicy = await requirePolicy(prisma, warningSupplier.id);
  const breachPolicy = await requirePolicy(prisma, breachSupplier.id);

  await upsertSlaBreach(prisma, {
    supplierId: healthySupplier.id,
    supplierSlaPolicyId: healthyPolicy.id,
    periodStart: daysAgo(30),
    periodEnd: daysAgo(1),
    trackedPoCount: 6,
    completedPoCount: 6,
    openLatePoCount: 0,
    breachCount: 0,
    status: "OK",
    severity: "LOW",
    actionStatus: "NOT_REQUIRED",
    observedLeadTimeDays: "5.50",
    onTimeRatePercent: "100.00",
    fillRatePercent: "99.00",
    issues: [{ type: "NONE", message: "Supplier is inside SLA target." }],
    evaluatedById: ctx.users.sla_manager?.id ?? ctx.adminUserId,
  });

  await upsertSlaBreach(prisma, {
    supplierId: warningSupplier.id,
    supplierSlaPolicyId: warningPolicy.id,
    periodStart: daysAgo(30),
    periodEnd: daysAgo(1),
    trackedPoCount: 5,
    completedPoCount: 4,
    openLatePoCount: 1,
    breachCount: 1,
    status: "WARNING",
    severity: "MEDIUM",
    actionStatus: "OPEN",
    ownerUserId: ctx.users.sla_manager?.id ?? ctx.adminUserId,
    dueDate: daysFromNow(5),
    alertMessage: "Supplier warning: one late PO and on-time rate below target.",
    observedLeadTimeDays: "8.25",
    onTimeRatePercent: "82.00",
    fillRatePercent: "93.00",
    issues: [
      { type: "LATE_PO", count: 1 },
      { type: "LOW_ON_TIME_RATE", value: 82 },
    ],
    evaluatedById: ctx.users.sla_manager?.id ?? ctx.adminUserId,
  });

  const criticalBreach = await upsertSlaBreach(prisma, {
    supplierId: breachSupplier.id,
    supplierSlaPolicyId: breachPolicy.id,
    periodStart: daysAgo(30),
    periodEnd: daysAgo(1),
    trackedPoCount: 7,
    completedPoCount: 4,
    openLatePoCount: 3,
    breachCount: 3,
    status: "BREACH",
    severity: "CRITICAL",
    actionStatus: "IN_PROGRESS",
    ownerUserId: ctx.users.sla_manager?.id ?? ctx.adminUserId,
    dueDate: daysFromNow(2),
    alertMessage: "Critical SLA breach: repeated late PO and low fill rate.",
    observedLeadTimeDays: "16.75",
    onTimeRatePercent: "58.00",
    fillRatePercent: "74.00",
    issues: [
      { type: "OPEN_LATE_PO", count: 3 },
      { type: "LOW_FILL_RATE", value: 74 },
      { type: "TERMINATION_REVIEW_RECOMMENDED" },
    ],
    evaluatedById: ctx.users.sla_manager?.id ?? ctx.adminUserId,
  });

  const existingCase = await prisma.supplierSlaTerminationCase.findFirst({
    where: {
      supplierId: breachSupplier.id,
      supplierSlaPolicyId: breachPolicy.id,
      reason: "Seeded critical SLA breach termination review.",
    },
    select: { id: true },
  });

  const terminationCase = existingCase
    ? await prisma.supplierSlaTerminationCase.update({
        where: { id: existingCase.id },
        data: {
          triggerBreachId: criticalBreach.id,
          status: "IN_REVIEW",
          recommendedAction: "REVIEW_CONTRACT",
          openBreachCount: 3,
          criticalBreachCount: 1,
          lookbackDays: 180,
          ownerUserId: ctx.users.sla_manager?.id ?? ctx.adminUserId,
          reviewedAt: daysAgo(1),
          resolvedAt: null,
          resolvedById: null,
          resolutionNote: null,
          createdById: ctx.adminUserId,
        },
        select: { id: true },
      })
    : await prisma.supplierSlaTerminationCase.create({
        data: {
          supplierId: breachSupplier.id,
          supplierSlaPolicyId: breachPolicy.id,
          triggerBreachId: criticalBreach.id,
          status: "IN_REVIEW",
          recommendedAction: "REVIEW_CONTRACT",
          openBreachCount: 3,
          criticalBreachCount: 1,
          lookbackDays: 180,
          reason: "Seeded critical SLA breach termination review.",
          ownerUserId: ctx.users.sla_manager?.id ?? ctx.adminUserId,
          reviewedAt: daysAgo(1),
          createdById: ctx.adminUserId,
        },
        select: { id: true },
      });

  await prisma.supplierSlaBreach.update({
    where: { id: criticalBreach.id },
    data: {
      terminationCaseId: terminationCase.id,
      terminationSuggestedAt: daysAgo(1),
      terminationSuggestionNote: "Seeded termination review recommendation.",
    },
  });

  console.log("✅ SCM SLA scenarios ensured: feedback, warnings, breaches, termination review");
  return ctx;
}
