"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  CircleDotDashed,
  FolderKanban,
  Landmark,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type InvestorWorkflowSection =
  | "overview"
  | "tasks"
  | "exceptions"
  | "notifications"
  | "registry"
  | "documents"
  | "profile-requests"
  | "portal-access"
  | "ledger"
  | "allocations"
  | "profit-runs"
  | "payouts"
  | "withdrawals"
  | "statements"
  | "statement-schedules";

type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  href: string;
};

type WorkflowStage = {
  id: string;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  steps: WorkflowStep[];
};

const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: "onboard",
    title: "Onboard And Verify",
    description: "Create the investor, verify KYC, review portal changes, then enable access.",
    icon: ShieldCheck,
    steps: [
      { id: "registry", title: "Investor Registry", description: "Create and maintain investor master.", href: "/admin/investors/registry" },
      { id: "documents", title: "Documents", description: "Review KYC completeness and status.", href: "/admin/investors/documents" },
      { id: "profile-requests", title: "Profile Requests", description: "Approve portal-submitted sensitive changes.", href: "/admin/investors/profile-requests" },
      { id: "portal-access", title: "Portal Access", description: "Map investor user to portal access.", href: "/admin/investors/portal-access" },
    ],
  },
  {
    id: "fund",
    title: "Fund And Allocate",
    description: "Post capital movement, then define where investor exposure sits.",
    icon: Landmark,
    steps: [
      { id: "ledger", title: "Capital Ledger", description: "Record commitments, contributions, and adjustments.", href: "/admin/investors/ledger" },
      { id: "allocations", title: "Allocations", description: "Assign investor participation across variants.", href: "/admin/investors/allocations" },
    ],
  },
  {
    id: "profit",
    title: "Calculate And Govern",
    description: "Generate profit runs, review controls, approve, then post.",
    icon: FolderKanban,
    steps: [
      { id: "profit-runs", title: "Profit Runs", description: "Create, approve, reject, and post investor runs.", href: "/admin/investors/profit-runs" },
    ],
  },
  {
    id: "settle",
    title: "Settle And Communicate",
    description: "Create payouts, settle, monitor alerts, and export statements.",
    icon: Wallet,
    steps: [
      { id: "payouts", title: "Payouts", description: "Approve, hold, pay, and void payout drafts.", href: "/admin/investors/payouts" },
      { id: "withdrawals", title: "Withdrawals", description: "Review, approve, and settle capital withdrawal requests.", href: "/admin/investors/withdrawals" },
      { id: "statements", title: "Statements", description: "Preview and export investor statements.", href: "/admin/investors/statements" },
      { id: "statement-schedules", title: "Statement Schedules", description: "Automate recurring statement dispatch.", href: "/admin/investors/statement-schedules" },
      { id: "notifications", title: "Notifications", description: "Watch internal investor workflow alerts.", href: "/admin/investors/notifications" },
    ],
  },
];

const SECTION_META: Record<
  InvestorWorkflowSection,
  {
    title: string;
    description: string;
    stageId: string;
    next: WorkflowStep[];
  }
> = {
  overview: {
    title: "Investor Workspace",
    description: "Start here to understand the lifecycle, then jump into the active queue or the next operational stage.",
    stageId: "onboard",
    next: [
      { id: "registry", title: "Investor Registry", description: "Create or open the target investor master.", href: "/admin/investors/registry" },
      { id: "documents", title: "Documents", description: "Check KYC completeness before funding.", href: "/admin/investors/documents" },
      { id: "tasks", title: "My Tasks", description: "Open current approval and payout queues.", href: "/admin/investors/my-tasks" },
    ],
  },
  tasks: {
    title: "Action Queue",
    description: "Use this when you need to know what demands attention right now.",
    stageId: "profit",
    next: [
      { id: "notifications", title: "Notifications", description: "Review workflow alerts behind the queue.", href: "/admin/investors/notifications" },
      { id: "exceptions", title: "Exceptions", description: "Validate whether a blocker sits behind the task.", href: "/admin/investors/exceptions" },
    ],
  },
  exceptions: {
    title: "Exception Control",
    description: "Use this page to remove blockers before the lifecycle can move forward.",
    stageId: "onboard",
    next: [
      { id: "documents", title: "Documents", description: "Resolve KYC and review issues.", href: "/admin/investors/documents" },
      { id: "payouts", title: "Payouts", description: "Resolve hold, approval, or pay blockers.", href: "/admin/investors/payouts" },
    ],
  },
  notifications: {
    title: "Internal Alerts",
    description: "Use notifications as the event inbox, then open the exact workflow object behind each alert.",
    stageId: "settle",
    next: [
      { id: "tasks", title: "My Tasks", description: "Open the queue after triaging alerts.", href: "/admin/investors/my-tasks" },
      { id: "exceptions", title: "Exceptions", description: "If the alert is a blocker, open exceptions next.", href: "/admin/investors/exceptions" },
    ],
  },
  registry: {
    title: "Investor Master",
    description: "Registry comes first. If the investor master is weak, everything downstream gets noisy.",
    stageId: "onboard",
    next: [
      { id: "documents", title: "Documents", description: "Verify KYC and source documents.", href: "/admin/investors/documents" },
      { id: "portal-access", title: "Portal Access", description: "Enable investor self-service after verification.", href: "/admin/investors/portal-access" },
    ],
  },
  documents: {
    title: "KYC Governance",
    description: "After registry, document review is the clearest next step before funding and payout activity.",
    stageId: "onboard",
    next: [
      { id: "profile-requests", title: "Profile Requests", description: "Review sensitive portal changes that affect KYC.", href: "/admin/investors/profile-requests" },
      { id: "ledger", title: "Capital Ledger", description: "Once verified, move into funding.", href: "/admin/investors/ledger" },
    ],
  },
  "profile-requests": {
    title: "Sensitive Change Review",
    description: "Use this after portal users submit identity or beneficiary changes, then re-check document/KYC alignment.",
    stageId: "onboard",
    next: [
      { id: "documents", title: "Documents", description: "Re-verify affected KYC documents.", href: "/admin/investors/documents" },
      { id: "portal-access", title: "Portal Access", description: "Keep self-service ownership aligned.", href: "/admin/investors/portal-access" },
    ],
  },
  "portal-access": {
    title: "Portal Enablement",
    description: "This is the final onboarding step before the investor starts self-service interactions.",
    stageId: "onboard",
    next: [
      { id: "ledger", title: "Capital Ledger", description: "Move into funding after access is ready.", href: "/admin/investors/ledger" },
      { id: "notifications", title: "Notifications", description: "Watch for incoming portal-driven events.", href: "/admin/investors/notifications" },
    ],
  },
  ledger: {
    title: "Funding Ledger",
    description: "Capital movement should come before allocation and profit distribution.",
    stageId: "fund",
    next: [
      { id: "allocations", title: "Allocations", description: "Assign investor participation after funding.", href: "/admin/investors/allocations" },
      { id: "profit-runs", title: "Profit Runs", description: "Only calculate after ledger and allocation are stable.", href: "/admin/investors/profit-runs" },
    ],
  },
  allocations: {
    title: "Allocation Control",
    description: "This stage defines who owns what before profit can be governed correctly.",
    stageId: "fund",
    next: [
      { id: "profit-runs", title: "Profit Runs", description: "Generate runs once allocation coverage is acceptable.", href: "/admin/investors/profit-runs" },
      { id: "exceptions", title: "Exceptions", description: "Check overlap and inactive allocation issues.", href: "/admin/investors/exceptions" },
    ],
  },
  "profit-runs": {
    title: "Profit Governance",
    description: "This stage is calculation, approval, and posting control. Do not jump to payouts before posting.",
    stageId: "profit",
    next: [
      { id: "payouts", title: "Payouts", description: "Create payout drafts only after posting.", href: "/admin/investors/payouts" },
      { id: "statements", title: "Statements", description: "Use statements after payout and ledger state is stable.", href: "/admin/investors/statements" },
    ],
  },
  payouts: {
    title: "Settlement Control",
    description: "This stage is approval, hold, release, payment, and reversal control.",
    stageId: "settle",
    next: [
      { id: "withdrawals", title: "Withdrawals", description: "Handle capital return requests separately from payout drafts.", href: "/admin/investors/withdrawals" },
      { id: "statements", title: "Statements", description: "Preview final investor-facing output.", href: "/admin/investors/statements" },
      { id: "notifications", title: "Notifications", description: "Track payout-ready and settlement alerts.", href: "/admin/investors/notifications" },
    ],
  },
  withdrawals: {
    title: "Capital Return Control",
    description: "Use this stage to govern requested capital withdrawals before the final ledger debit is posted.",
    stageId: "settle",
    next: [
      { id: "statements", title: "Statements", description: "Confirm the withdrawal impacts final investor-facing reporting.", href: "/admin/investors/statements" },
      { id: "notifications", title: "Notifications", description: "Track reviewer and settlement alerts after withdrawal events.", href: "/admin/investors/notifications" },
    ],
  },
  statements: {
    title: "Investor Reporting",
    description: "Statements come last. Use them after ledger and payout data are in the expected state.",
    stageId: "settle",
    next: [
      { id: "statement-schedules", title: "Statement Schedules", description: "Automate recurring dispatch after output looks right.", href: "/admin/investors/statement-schedules" },
      { id: "notifications", title: "Notifications", description: "Monitor follow-up actions and investor responses.", href: "/admin/investors/notifications" },
    ],
  },
  "statement-schedules": {
    title: "Reporting Automation",
    description: "Use schedules after the statement output is already correct and auditable.",
    stageId: "settle",
    next: [
      { id: "notifications", title: "Notifications", description: "Watch due/overdue delivery alerts.", href: "/admin/investors/notifications" },
      { id: "overview", title: "Investor Workspace", description: "Return to workspace for overall operational monitoring.", href: "/admin/investors" },
    ],
  },
};

export function InvestorWorkflowGuide({
  currentSection,
}: {
  currentSection: InvestorWorkflowSection;
}) {
  const t = useTranslations("AdminInvestors.workflow");
  const currentMeta = SECTION_META[currentSection];
  const currentStage = WORKFLOW_STAGES.find((stage) => stage.id === currentMeta.stageId);
  const currentStageIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stage.id === currentMeta.stageId,
  );

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{t("title")}</CardTitle>
              <Badge variant="outline">{t(`sections.${currentSection}.title`)}</Badge>
            </div>
            <p className="max-w-3xl text-xs text-muted-foreground">
              {t("description")}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/investors/my-tasks">{t("openQueue")}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {WORKFLOW_STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const isCurrent = stage.id === currentMeta.stageId;
            const isComplete = currentStageIndex > index;
            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  isCurrent
                    ? "border-primary/30 bg-primary/10"
                    : isComplete
                      ? "border-border bg-muted/60"
                      : "border-border bg-card"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                    isCurrent
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : isComplete
                        ? "border-border bg-muted text-foreground"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("step", { number: index + 1 })}
                    </span>
                    {isCurrent ? (
                      <Badge className="h-5 px-2 text-[10px]">{t("current")}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-tight">{t(`stages.${stage.id}.title`)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-muted/50 px-3 py-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <CircleDotDashed className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("current")}
                </p>
              </div>
              <p className="mt-1 text-sm font-medium">{t(`sections.${currentSection}.title`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`sections.${currentSection}.description`)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("inThisStage")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentStage?.steps.map((step) => {
                  const isPage = step.id === currentSection;
                  return (
                    <Link
                      key={step.id}
                      href={step.href}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 ${
                        isPage
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-background text-foreground"
                      }`}
                    >
                      {isPage ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : null}
                      <span>{t(`steps.${step.id}.title`)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("next")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentMeta.next.map((step) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
                  >
                    <span>{t(`steps.${step.id}.title`)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
