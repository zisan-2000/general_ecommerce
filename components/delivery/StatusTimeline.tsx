"use client";

import { useTranslations } from "next-intl";
import { AssignmentStatusBadge } from "@/components/delivery/AssignmentStatusBadge";
import type { DeliveryAssignmentLogEntry } from "@/components/delivery/types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusTimeline({
  logs,
  compact = false,
}: {
  logs: DeliveryAssignmentLogEntry[];
  compact?: boolean;
}) {
  const t = useTranslations("AdminStatusTimeline");

  if (!logs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log, index) => (
        <div
          key={log.id}
          className={`relative rounded-2xl border border-border bg-background ${
            compact ? "px-3 py-3" : "px-4 py-4"
          }`}
        >
          {index < logs.length - 1 ? (
            <span
              className="absolute left-5 top-11 h-6 w-px bg-border"
              aria-hidden="true"
            />
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <AssignmentStatusBadge status={log.toStatus} />
                <span className="text-xs text-muted-foreground">
                  {log.actor?.name || t("system")}
                </span>
              </div>
              {log.note ? (
                <p className="text-sm text-foreground">{log.note}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("statusChanged", {
                    from: log.fromStatus
                      ? t(`statuses.${log.fromStatus}`)
                      : t("none"),
                    to: t(`statuses.${log.toStatus}`),
                  })}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(log.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
