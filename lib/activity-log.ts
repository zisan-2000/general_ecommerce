import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma";
import type { PermissionKey } from "@/lib/rbac-config";
import type { AccessContext } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type ActivityEntityRule = {
  match: string[];
  permissions: PermissionKey[];
};

export const INVESTOR_ACTIVITY_ENTITY_PREFIXES = [
  "investor",
  "investor_capital_transaction",
  "investor_product_allocation",
  "investor_profit_run",
  "investor_profit_payout",
  "investor_withdrawal_request",
  "investor_portal_access",
  "investor_document",
  "investor_profile_update_request",
  "investor_master_change_request",
  "investor_beneficiary_verification",
  "investor_statement_schedule",
] as const;

const ACTIVITY_ENTITY_RULES: ActivityEntityRule[] = [
  {
    match: ["activity_log", "activity-log"],
    permissions: ["settings.activitylog.read", "settings.manage"],
  },
  {
    match: ["rbac_role", "role", "rbac"],
    permissions: ["roles.manage"],
  },
  {
    match: ["user", "user_role", "user_roles"],
    permissions: ["users.read", "users.manage"],
  },
  {
    match: ["product", "product_variant", "book_metadata", "brand", "category", "publisher", "writer"],
    permissions: ["products.manage"],
  },
  {
    match: ["inventory", "inventory_log", "stock", "stock_level"],
    permissions: ["inventory.manage"],
  },
  {
    match: ["order"],
    permissions: ["orders.read_all", "orders.update"],
  },
  {
    match: ["shipment"],
    permissions: ["shipments.manage"],
  },
  {
    match: ["logistics"],
    permissions: ["logistics.manage"],
  },
  {
    match: ["delivery_man", "deliveryman", "delivery_men"],
    permissions: ["delivery-men.manage", "logistics.manage"],
  },
  {
    match: ["blog"],
    permissions: ["blogs.manage"],
  },
  {
    match: ["newsletter"],
    permissions: ["newsletter.manage"],
  },
  {
    match: ["coupon"],
    permissions: ["coupons.manage"],
  },
  {
    match: ["banner"],
    permissions: ["settings.banner.manage", "settings.manage"],
  },
  {
    match: ["payment"],
    permissions: ["settings.payment.manage", "settings.manage"],
  },
  {
    match: ["shipping_rate", "shipping"],
    permissions: ["settings.shipping.manage", "settings.manage"],
  },
  {
    match: ["vat", "vat_class"],
    permissions: ["settings.vat.manage", "settings.manage"],
  },
  {
    match: ["courier"],
    permissions: ["settings.courier.manage", "settings.manage"],
  },
  {
    match: ["warehouse"],
    permissions: ["settings.warehouse.manage", "settings.manage"],
  },
  {
    match: ["supplier"],
    permissions: ["suppliers.read", "suppliers.manage", "scm.access"],
  },
  {
    match: [
      "supplier_sla_policy",
      "supplier_sla_breach",
      "supplier_sla_termination",
      "supplier_sla_notification",
      "supplier_sla_alert",
      "sla_policy",
      "sla_breach",
      "sla",
    ],
    permissions: ["sla.read", "sla.manage", "scm.access"],
  },
  {
    match: ["purchase_requisition", "purchaserequisition"],
    permissions: [
      "purchase_requisitions.read",
      "purchase_requisitions.manage",
      "purchase_requisitions.approve",
      "scm.access",
    ],
  },
  {
    match: ["rfq", "rfq_item", "rfq_supplier_invite", "supplier_quotation", "rfq_award"],
    permissions: ["rfq.read", "rfq.manage", "rfq.approve", "scm.access"],
  },
  {
    match: ["purchase_order", "purchaseorder"],
    permissions: [
      "purchase_orders.read",
      "purchase_orders.manage",
      "purchase_orders.approve",
      "purchase_orders.approve_manager",
      "purchase_orders.approve_committee",
      "purchase_orders.approve_final",
      "scm.access",
    ],
  },
  {
    match: ["purchase_order_landed_cost", "landed_cost", "landed_costs"],
    permissions: ["landed_costs.read", "landed_costs.manage", "scm.access"],
  },
  {
    match: ["goods_receipt", "goodsreceipt"],
    permissions: ["goods_receipts.read", "goods_receipts.manage", "scm.access"],
  },
  {
    match: ["supplier_return", "supplierreturn"],
    permissions: [
      "supplier_returns.read",
      "supplier_returns.manage",
      "supplier_returns.approve",
      "scm.access",
    ],
  },
  {
    match: ["replenishment", "replenishment_rule", "replenishment_plan"],
    permissions: ["replenishment.read", "replenishment.manage", "scm.access"],
  },
  {
    match: ["supplier_invoice", "supplierinvoice"],
    permissions: [
      "supplier_ledger.read",
      "supplier_invoices.read",
      "supplier_invoices.manage",
      "supplier_payments.override_hold",
      "scm.access",
    ],
  },
  {
    match: ["supplier_payment", "supplierpayment"],
    permissions: [
      "supplier_ledger.read",
      "supplier_payments.read",
      "supplier_payments.manage",
      "scm.access",
    ],
  },
  {
    match: ["supplier_ledger", "ledger_entry", "supplier_ledger_entry"],
    permissions: ["supplier_ledger.read", "scm.access"],
  },
  {
    match: ["three_way_match", "threewaymatch"],
    permissions: [
      "three_way_match.read",
      "supplier_invoices.read",
      "supplier_invoices.manage",
      "scm.access",
    ],
  },
  {
    match: ["warehouse_transfer", "warehousetransfer"],
    permissions: [
      "warehouse_transfers.read",
      "warehouse_transfers.manage",
      "warehouse_transfers.approve",
      "scm.access",
    ],
  },
  {
    match: ["chat"],
    permissions: ["chats.manage"],
  },
  {
    match: ["report"],
    permissions: ["reports.read"],
  },
  {
    match: [
      "investor",
      "investor_capital_transaction",
      "investor_product_allocation",
      "investor_withdrawal_request",
    ],
    permissions: [
      "investor.activity_log.read",
      "investors.read",
      "investors.manage",
      "investor_ledger.read",
      "investor_ledger.manage",
      "investor_withdrawals.read",
      "investor_withdrawals.review",
      "investor_withdrawals.settle",
      "investor_allocations.read",
      "investor_allocations.manage",
      "investor_profit.read",
      "investor_profit.manage",
      "investor_profit.approve",
      "investor_profit.post",
      "investor_payout.read",
      "investor_payout.manage",
      "investor_payout.approve",
      "investor_payout.pay",
      "investor_payout.void",
      "investor_statement.read",
    ],
  },
  {
    match: ["investor_portal_access"],
    permissions: ["investor.activity_log.read", "investors.manage", "users.manage"],
  },
  {
    match: ["payroll"],
    permissions: ["payroll.manage"],
  },
  {
    match: ["profile"],
    permissions: ["profile.manage"],
  },
];

function normalizeEntityKey(entity: string): string {
  return entity.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function isInvestorActivityEntity(entity: string): boolean {
  const normalized = normalizeEntityKey(entity);
  return INVESTOR_ACTIVITY_ENTITY_PREFIXES.some((candidate) => {
    const key = normalizeEntityKey(candidate);
    return normalized === key || normalized.startsWith(`${key}_`);
  });
}

function getClientIp(request?: Request | NextRequest | null): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

export function hasFullActivityLogAccess(access: AccessContext): boolean {
  return (
    access.isSuperAdmin ||
    access.roleNames.includes("superadmin") ||
    access.roleNames.includes("admin") ||
    access.has("settings.manage")
  );
}

export function getActivityPermissionsForEntity(entity: string): PermissionKey[] {
  const normalized = normalizeEntityKey(entity);
  for (const rule of ACTIVITY_ENTITY_RULES) {
    if (
      rule.match.some((candidate) => {
        const key = normalizeEntityKey(candidate);
        return normalized === key || normalized.startsWith(`${key}_`);
      })
    ) {
      return rule.permissions;
    }
  }
  return [];
}

export function canAccessActivityEntity(access: AccessContext, entity: string): boolean {
  if (hasFullActivityLogAccess(access)) {
    return true;
  }
  const permissions = getActivityPermissionsForEntity(entity);
  if (permissions.length === 0) {
    return false;
  }
  return permissions.some((permission) => access.has(permission));
}

export function getVisibleActivityEntities(access: AccessContext): string[] {
  if (hasFullActivityLogAccess(access)) {
    return [];
  }

  return ACTIVITY_ENTITY_RULES.flatMap((rule) =>
    rule.permissions.some((permission) => access.has(permission)) ? rule.match : [],
  );
}

type LogActivityInput = {
  action: string;
  entity: string;
  entityId?: string | number | bigint | null;
  metadata?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  access?: AccessContext | null;
  userId?: string | null;
  request?: Request | NextRequest | null;
  permissionKeys?: PermissionKey[];
};

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === "object") {
    if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
      return sanitizeValue((value as { toJSON: () => unknown }).toJSON());
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => typeof nestedValue !== "function")
        .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)]),
    );
  }
  return value;
}

export function buildActivityChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Array<{ field: string; before: unknown; after: unknown }> {
  const beforeObject = before ?? {};
  const afterObject = after ?? {};
  const keys = [...new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])];

  return keys
    .map((key) => {
      const previous = sanitizeValue(beforeObject[key]);
      const next = sanitizeValue(afterObject[key]);
      return {
        field: key,
        before: previous,
        after: next,
      };
    })
    .filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after));
}

export async function logActivity({
  action,
  entity,
  entityId = null,
  metadata = null,
  before = null,
  after = null,
  access = null,
  userId = null,
  request = null,
  permissionKeys,
}: LogActivityInput): Promise<void> {
  try {
    const resolvedUserId = userId ?? access?.userId ?? null;
    const normalizedEntity = normalizeEntityKey(entity);
    const resolvedPermissionKeys =
      permissionKeys && permissionKeys.length > 0
        ? permissionKeys
        : getActivityPermissionsForEntity(normalizedEntity);
    const ip = getClientIp(request);
    const ipHash = ip
      ? crypto.createHash("sha256").update(ip).digest("hex")
      : null;
    const userAgent = request?.headers.get("user-agent")?.trim() || null;
    const normalizedBefore = before ? (sanitizeValue(before) as Record<string, unknown>) : null;
    const normalizedAfter = after ? (sanitizeValue(after) as Record<string, unknown>) : null;
    const changes = buildActivityChanges(normalizedBefore, normalizedAfter);
    const metadataPayload = {
      ...(metadata ?? {}),
      before: normalizedBefore,
      after: normalizedAfter,
      changes,
      permissionKeys: resolvedPermissionKeys,
    } as Prisma.InputJsonValue;

    await prisma.activityLog.create({
      data: {
        userId: resolvedUserId,
        action: action.trim(),
        entity: normalizedEntity,
        entityId: entityId === null || entityId === undefined ? null : String(entityId),
        metadata: metadataPayload,
        ipHash,
        userAgent,
        updatetAt: new Date(),
      },
    });
  } catch (error) {
    console.error("ACTIVITY LOG WRITE ERROR:", error);
  }
}
