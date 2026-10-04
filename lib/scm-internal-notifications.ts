import { prisma } from "@/lib/prisma";
import { dispatchComparativeStatementEmailNotifications } from "@/lib/comparative-statement-notifications";
import { dispatchPaymentRequestEmailNotifications } from "@/lib/payment-request-notifications";
import { dispatchPurchaseOrderWorkflowEmailNotifications } from "@/lib/purchase-order-notifications";
import { dispatchPurchaseRequisitionEmailNotifications } from "@/lib/purchase-requisition-notifications";
import { dispatchRfqEmailNotifications } from "@/lib/rfq-notifications";
import { dispatchSupplierPortalEmailNotifications } from "@/lib/supplier-portal-notifications";

export const SCM_INTERNAL_NOTIFICATION_TYPES = [
  "ORDER",
  "PURCHASE_REQUISITION",
  "COMPARATIVE_STATEMENT",
  "PURCHASE_ORDER",
  "PAYMENT_REQUEST",
] as const;

export type ScmInternalNotificationType =
  (typeof SCM_INTERNAL_NOTIFICATION_TYPES)[number];

export type ScmInternalNotificationRow = {
  id: number;
  type: ScmInternalNotificationType;
  stage: string;
  status: string;
  title: string;
  message: string;
  entityNumber: string;
  href: string;
  metadata: unknown;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ScmNotificationDeliveryHealth = {
  unreadInternalCount: number;
  modules: Array<{
    key: string;
    label: string;
    systemCount: number;
    emailPending: number;
    emailFailed: number;
    emailSent: number;
  }>;
  recentFailures: Array<{
    key: string;
    label: string;
    id: number;
    recipientEmail: string | null;
    message: string;
    createdAt: string;
    error: string | null;
  }>;
};

type GetScmInternalNotificationsInput = {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
};

function formatStage(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLimit(limit?: number) {
  if (!Number.isInteger(limit) || !limit) return 50;
  return Math.max(1, Math.min(limit, 200));
}

export async function getScmInternalNotifications({
  userId,
  unreadOnly = false,
  limit,
}: GetScmInternalNotificationsInput): Promise<{
  unreadCount: number;
  rows: ScmInternalNotificationRow[];
}> {
  const take = normalizeLimit(limit);
  const whereBase = {
    recipientUserId: userId,
    channel: "SYSTEM" as const,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [requisitionRows, requisitionUnread, csRows, csUnread, poRows, poUnread, prfRows, prfUnread] =
    await Promise.all([
      prisma.purchaseRequisitionNotification.findMany({
        where: whereBase,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          stage: true,
          status: true,
          message: true,
          metadata: true,
          sentAt: true,
          readAt: true,
          createdAt: true,
          purchaseRequisition: {
            select: {
              id: true,
              requisitionNumber: true,
            },
          },
        },
      }),
      prisma.purchaseRequisitionNotification.count({
        where: {
          recipientUserId: userId,
          channel: "SYSTEM",
          readAt: null,
        },
      }),
      prisma.comparativeStatementNotification.findMany({
        where: whereBase,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          stage: true,
          status: true,
          message: true,
          metadata: true,
          sentAt: true,
          readAt: true,
          createdAt: true,
          comparativeStatement: {
            select: {
              csNumber: true,
            },
          },
        },
      }),
      prisma.comparativeStatementNotification.count({
        where: {
          recipientUserId: userId,
          channel: "SYSTEM",
          readAt: null,
        },
      }),
      prisma.purchaseOrderNotification.findMany({
        where: whereBase,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          stage: true,
          status: true,
          message: true,
          metadata: true,
          sentAt: true,
          readAt: true,
          createdAt: true,
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
            },
          },
        },
      }),
      prisma.purchaseOrderNotification.count({
        where: {
          recipientUserId: userId,
          channel: "SYSTEM",
          readAt: null,
        },
      }),
      prisma.paymentRequestNotification.findMany({
        where: whereBase,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        select: {
          id: true,
          stage: true,
          status: true,
          message: true,
          metadata: true,
          sentAt: true,
          readAt: true,
          createdAt: true,
          paymentRequest: {
            select: {
              id: true,
              prfNumber: true,
            },
          },
        },
      }),
      prisma.paymentRequestNotification.count({
        where: {
          recipientUserId: userId,
          channel: "SYSTEM",
          readAt: null,
        },
      }),
    ]);

  const rows: ScmInternalNotificationRow[] = [
    ...requisitionRows.map((row) => ({
      id: row.id,
      type: "PURCHASE_REQUISITION" as const,
      stage: row.stage,
      status: row.status,
      title: `${row.purchaseRequisition.requisitionNumber} • ${formatStage(row.stage)}`,
      message: row.message,
      entityNumber: row.purchaseRequisition.requisitionNumber,
      href: `/admin/scm/purchase-requisitions/${row.purchaseRequisition.id}`,
      metadata: row.metadata ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    ...csRows.map((row) => ({
      id: row.id,
      type: "COMPARATIVE_STATEMENT" as const,
      stage: row.stage,
      status: row.status,
      title: `${row.comparativeStatement.csNumber} • ${formatStage(row.stage)}`,
      message: row.message,
      entityNumber: row.comparativeStatement.csNumber,
      href: "/admin/scm/comparative-statements",
      metadata: row.metadata ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    ...poRows.map((row) => ({
      id: row.id,
      type: "PURCHASE_ORDER" as const,
      stage: row.stage,
      status: row.status,
      title: `${row.purchaseOrder.poNumber} • ${formatStage(row.stage)}`,
      message: row.message,
      entityNumber: row.purchaseOrder.poNumber,
      href: `/admin/scm/purchase-orders/${row.purchaseOrder.id}`,
      metadata: row.metadata ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    ...prfRows.map((row) => ({
      id: row.id,
      type: "PAYMENT_REQUEST" as const,
      stage: row.stage,
      status: row.status,
      title: `${row.paymentRequest.prfNumber} • ${formatStage(row.stage)}`,
      message: row.message,
      entityNumber: row.paymentRequest.prfNumber,
      href: `/admin/scm/payment-requests/${row.paymentRequest.id}`,
      metadata: row.metadata ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => {
      const timeDiff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return timeDiff !== 0 ? timeDiff : b.id - a.id;
    })
    .slice(0, take);

  return {
    unreadCount: requisitionUnread + csUnread + poUnread + prfUnread,
    rows,
  };
}

export async function markScmInternalNotificationRead(input: {
  userId: string;
  type: ScmInternalNotificationType;
  id: number;
}) {
  const where = {
    id: input.id,
    recipientUserId: input.userId,
    channel: "SYSTEM" as const,
  };

  switch (input.type) {
    case "ORDER":
      return prisma.orderAdminNotification.updateMany({
        where: { id: input.id, userId: input.userId, readAt: null },
        data: { readAt: new Date() },
      });
    case "PURCHASE_REQUISITION":
      return prisma.purchaseRequisitionNotification.updateMany({
        where: { ...where, readAt: null },
        data: { readAt: new Date() },
      });
    case "COMPARATIVE_STATEMENT":
      return prisma.comparativeStatementNotification.updateMany({
        where: { ...where, readAt: null },
        data: { readAt: new Date() },
      });
    case "PURCHASE_ORDER":
      return prisma.purchaseOrderNotification.updateMany({
        where: { ...where, readAt: null },
        data: { readAt: new Date() },
      });
    case "PAYMENT_REQUEST":
      return prisma.paymentRequestNotification.updateMany({
        where: { ...where, readAt: null },
        data: { readAt: new Date() },
      });
  }
}

export async function markAllScmInternalNotificationsRead(userId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.purchaseRequisitionNotification.updateMany({
      where: {
        recipientUserId: userId,
        channel: "SYSTEM",
        readAt: null,
      },
      data: { readAt: now },
    }),
    prisma.comparativeStatementNotification.updateMany({
      where: {
        recipientUserId: userId,
        channel: "SYSTEM",
        readAt: null,
      },
      data: { readAt: now },
    }),
    prisma.purchaseOrderNotification.updateMany({
      where: {
        recipientUserId: userId,
        channel: "SYSTEM",
        readAt: null,
      },
      data: { readAt: now },
    }),
    prisma.paymentRequestNotification.updateMany({
      where: {
        recipientUserId: userId,
        channel: "SYSTEM",
        readAt: null,
      },
      data: { readAt: now },
    }),
  ]);
}

export async function getScmNotificationDeliveryHealth(
  userId: string,
): Promise<ScmNotificationDeliveryHealth> {
  const [
    unreadInternalCount,
    requisitionSystem,
    requisitionEmailPending,
    requisitionEmailFailed,
    requisitionEmailSent,
    csSystem,
    csEmailPending,
    csEmailFailed,
    csEmailSent,
    poSystem,
    poEmailPending,
    poEmailFailed,
    poEmailSent,
    prfSystem,
    prfEmailPending,
    prfEmailFailed,
    prfEmailSent,
    rfqSystem,
    rfqEmailPending,
    rfqEmailFailed,
    rfqEmailSent,
    supplierSystem,
    supplierEmailPending,
    supplierEmailFailed,
    supplierEmailSent,
    requisitionFailures,
    csFailures,
    poFailures,
    prfFailures,
    rfqFailures,
    supplierFailures,
  ] = await Promise.all([
    prisma.purchaseRequisitionNotification.count({
      where: { recipientUserId: userId, channel: "SYSTEM", readAt: null },
    }),
    prisma.purchaseRequisitionNotification.count({ where: { channel: "SYSTEM" } }),
    prisma.purchaseRequisitionNotification.count({
      where: { channel: "EMAIL", status: "PENDING" },
    }),
    prisma.purchaseRequisitionNotification.count({
      where: { channel: "EMAIL", status: "FAILED" },
    }),
    prisma.purchaseRequisitionNotification.count({
      where: { channel: "EMAIL", status: "SENT" },
    }),
    prisma.comparativeStatementNotification.count({ where: { channel: "SYSTEM" } }),
    prisma.comparativeStatementNotification.count({
      where: { channel: "EMAIL", status: "PENDING" },
    }),
    prisma.comparativeStatementNotification.count({
      where: { channel: "EMAIL", status: "FAILED" },
    }),
    prisma.comparativeStatementNotification.count({
      where: { channel: "EMAIL", status: "SENT" },
    }),
    prisma.purchaseOrderNotification.count({ where: { channel: "SYSTEM" } }),
    prisma.purchaseOrderNotification.count({
      where: { channel: "EMAIL", status: "PENDING" },
    }),
    prisma.purchaseOrderNotification.count({
      where: { channel: "EMAIL", status: "FAILED" },
    }),
    prisma.purchaseOrderNotification.count({
      where: { channel: "EMAIL", status: "SENT" },
    }),
    prisma.paymentRequestNotification.count({ where: { channel: "SYSTEM" } }),
    prisma.paymentRequestNotification.count({
      where: { channel: "EMAIL", status: "PENDING" },
    }),
    prisma.paymentRequestNotification.count({
      where: { channel: "EMAIL", status: "FAILED" },
    }),
    prisma.paymentRequestNotification.count({
      where: { channel: "EMAIL", status: "SENT" },
    }),
    prisma.rfqNotification.count({ where: { channel: "SYSTEM" } }),
    prisma.rfqNotification.count({ where: { channel: "EMAIL", status: "PENDING" } }),
    prisma.rfqNotification.count({ where: { channel: "EMAIL", status: "FAILED" } }),
    prisma.rfqNotification.count({ where: { channel: "EMAIL", status: "SENT" } }),
    prisma.supplierPortalNotification.count({ where: { channel: "SYSTEM" } }),
    prisma.supplierPortalNotification.count({
      where: { channel: "EMAIL", status: "PENDING" },
    }),
    prisma.supplierPortalNotification.count({
      where: { channel: "EMAIL", status: "FAILED" },
    }),
    prisma.supplierPortalNotification.count({
      where: { channel: "EMAIL", status: "SENT" },
    }),
    prisma.purchaseRequisitionNotification.findMany({
      where: { channel: "EMAIL", status: "FAILED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        recipientEmail: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.comparativeStatementNotification.findMany({
      where: { channel: "EMAIL", status: "FAILED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        recipientEmail: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.purchaseOrderNotification.findMany({
      where: { channel: "EMAIL", status: "FAILED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        recipientEmail: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.paymentRequestNotification.findMany({
      where: { channel: "EMAIL", status: "FAILED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        recipientEmail: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.rfqNotification.findMany({
      where: { channel: "EMAIL", status: "FAILED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        recipientEmail: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.supplierPortalNotification.findMany({
      where: { channel: "EMAIL", status: "FAILED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        recipientEmail: true,
        message: true,
        createdAt: true,
        metadata: true,
      },
    }),
  ]);

  const failureRows = [
    ...requisitionFailures.map((row) => ({
      key: "PURCHASE_REQUISITION",
      label: "Purchase Requisitions",
      id: row.id,
      recipientEmail: row.recipientEmail ?? null,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      error:
        row.metadata && typeof row.metadata === "object" && "error" in row.metadata
          ? String((row.metadata as { error?: unknown }).error ?? "")
          : null,
    })),
    ...csFailures.map((row) => ({
      key: "COMPARATIVE_STATEMENT",
      label: "Comparative Statements",
      id: row.id,
      recipientEmail: row.recipientEmail ?? null,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      error:
        row.metadata && typeof row.metadata === "object" && "error" in row.metadata
          ? String((row.metadata as { error?: unknown }).error ?? "")
          : null,
    })),
    ...poFailures.map((row) => ({
      key: "PURCHASE_ORDER",
      label: "Purchase Orders",
      id: row.id,
      recipientEmail: row.recipientEmail ?? null,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      error:
        row.metadata && typeof row.metadata === "object" && "error" in row.metadata
          ? String((row.metadata as { error?: unknown }).error ?? "")
          : null,
    })),
    ...prfFailures.map((row) => ({
      key: "PAYMENT_REQUEST",
      label: "Payment Requests",
      id: row.id,
      recipientEmail: row.recipientEmail ?? null,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      error:
        row.metadata && typeof row.metadata === "object" && "error" in row.metadata
          ? String((row.metadata as { error?: unknown }).error ?? "")
          : null,
    })),
    ...rfqFailures.map((row) => ({
      key: "RFQ",
      label: "RFQs",
      id: row.id,
      recipientEmail: row.recipientEmail ?? null,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      error:
        row.metadata && typeof row.metadata === "object" && "error" in row.metadata
          ? String((row.metadata as { error?: unknown }).error ?? "")
          : null,
    })),
    ...supplierFailures.map((row) => ({
      key: "SUPPLIER_PORTAL",
      label: "Supplier Portal",
      id: row.id,
      recipientEmail: row.recipientEmail ?? null,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      error:
        row.metadata && typeof row.metadata === "object" && "error" in row.metadata
          ? String((row.metadata as { error?: unknown }).error ?? "")
          : null,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return {
    unreadInternalCount,
    modules: [
      {
        key: "PURCHASE_REQUISITION",
        label: "Purchase Requisitions",
        systemCount: requisitionSystem,
        emailPending: requisitionEmailPending,
        emailFailed: requisitionEmailFailed,
        emailSent: requisitionEmailSent,
      },
      {
        key: "COMPARATIVE_STATEMENT",
        label: "Comparative Statements",
        systemCount: csSystem,
        emailPending: csEmailPending,
        emailFailed: csEmailFailed,
        emailSent: csEmailSent,
      },
      {
        key: "PURCHASE_ORDER",
        label: "Purchase Orders",
        systemCount: poSystem,
        emailPending: poEmailPending,
        emailFailed: poEmailFailed,
        emailSent: poEmailSent,
      },
      {
        key: "PAYMENT_REQUEST",
        label: "Payment Requests",
        systemCount: prfSystem,
        emailPending: prfEmailPending,
        emailFailed: prfEmailFailed,
        emailSent: prfEmailSent,
      },
      {
        key: "RFQ",
        label: "RFQs",
        systemCount: rfqSystem,
        emailPending: rfqEmailPending,
        emailFailed: rfqEmailFailed,
        emailSent: rfqEmailSent,
      },
      {
        key: "SUPPLIER_PORTAL",
        label: "Supplier Portal",
        systemCount: supplierSystem,
        emailPending: supplierEmailPending,
        emailFailed: supplierEmailFailed,
        emailSent: supplierEmailSent,
      },
    ],
    recentFailures: failureRows,
  };
}

export async function processScmNotificationEmailQueue(options?: {
  includeFailed?: boolean;
}) {
  if (options?.includeFailed) {
    await prisma.$transaction([
      prisma.purchaseRequisitionNotification.updateMany({
        where: { channel: "EMAIL", status: "FAILED" },
        data: { status: "PENDING" },
      }),
      prisma.comparativeStatementNotification.updateMany({
        where: { channel: "EMAIL", status: "FAILED" },
        data: { status: "PENDING" },
      }),
      prisma.purchaseOrderNotification.updateMany({
        where: { channel: "EMAIL", status: "FAILED" },
        data: { status: "PENDING" },
      }),
      prisma.paymentRequestNotification.updateMany({
        where: { channel: "EMAIL", status: "FAILED" },
        data: { status: "PENDING" },
      }),
      prisma.rfqNotification.updateMany({
        where: { channel: "EMAIL", status: "FAILED" },
        data: { status: "PENDING" },
      }),
      prisma.supplierPortalNotification.updateMany({
        where: { channel: "EMAIL", status: "FAILED" },
        data: { status: "PENDING" },
      }),
    ]);
  }

  const [requisitionIds, csIds, poIds, prfIds, rfqIds, supplierIds] =
    await Promise.all([
      prisma.purchaseRequisitionNotification.findMany({
        where: { channel: "EMAIL", status: "PENDING" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.comparativeStatementNotification.findMany({
        where: { channel: "EMAIL", status: "PENDING" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.purchaseOrderNotification.findMany({
        where: { channel: "EMAIL", status: "PENDING" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.paymentRequestNotification.findMany({
        where: { channel: "EMAIL", status: "PENDING" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.rfqNotification.findMany({
        where: { channel: "EMAIL", status: "PENDING" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
      prisma.supplierPortalNotification.findMany({
        where: { channel: "EMAIL", status: "PENDING" },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
      }),
    ]);

  const [requisitionResult, csResult, poResult, prfResult, rfqResult, supplierResult] =
    await Promise.all([
      dispatchPurchaseRequisitionEmailNotifications(requisitionIds.map((row) => row.id)),
      dispatchComparativeStatementEmailNotifications(csIds.map((row) => row.id)),
      dispatchPurchaseOrderWorkflowEmailNotifications(poIds.map((row) => row.id)),
      dispatchPaymentRequestEmailNotifications(prfIds.map((row) => row.id)),
      dispatchRfqEmailNotifications(rfqIds.map((row) => row.id)),
      dispatchSupplierPortalEmailNotifications(supplierIds.map((row) => row.id)),
    ]);

  return {
    purchaseRequisitions: requisitionResult,
    comparativeStatements: csResult,
    purchaseOrders: poResult,
    paymentRequests: prfResult,
    rfqs: rfqResult,
    supplierPortal: supplierResult,
  };
}
