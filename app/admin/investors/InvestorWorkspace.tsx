"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvestorTable } from "@/components/investors/InvestorTable";
import {
  InvestorWorkflowGuide,
  type InvestorWorkflowSection,
} from "@/components/investors/InvestorWorkflowGuide";
import { exportInvestorStatementPdf } from "@/lib/export-investor-statement-pdf";

type Investor = {
  id: number;
  code: string;
  name: string;
  status: string;
  kycStatus: string;
  totals: {
    credit: number;
    debit: number;
    balance: number;
  };
};

type Variant = {
  id: number;
  sku: string;
  product: { name: string };
};

type Transaction = {
  id: number;
  transactionNumber: string;
  transactionDate: string;
  type: string;
  direction: string;
  amount: string;
  currency: string;
  investor: {
    id: number;
    code: string;
    name: string;
  };
  productVariant: Variant | null;
};

type Allocation = {
  id: number;
  investor: { id: number; code: string; name: string };
  productVariant: Variant;
  participationPercent: string | null;
  committedAmount: string | null;
  status: string;
};

type TxPayload = {
  variants: Variant[];
  transactions: Transaction[];
};

type ProfitRun = {
  id: number;
  runNumber: string;
  fromDate: string;
  toDate: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "POSTED";
  allocationBasis: "NET_REVENUE" | "NET_UNITS";
  marketingExpense: string;
  adsExpense: string;
  logisticsExpense: string;
  otherExpense: string;
  totalOperatingExpense: string;
  totalNetRevenue: string;
  totalNetCogs: string;
  totalNetProfit: string;
  approvedAt: string | null;
  postedAt: string | null;
  createdAt: string;
  _count?: {
    variantLines: number;
    allocationLines: number;
    payouts: number;
  };
};

type ProfitVariantLine = {
  id: number;
  productVariant: Variant;
  unitsSold: number;
  unitsRefunded: number;
  unitsNet: number;
  netRevenue: string;
  netCogs: string;
  allocatedExpense: string;
  netProfit: string;
  unallocatedSharePct: string;
};

type ProfitAllocationLine = {
  id: number;
  investor: {
    id: number;
    code: string;
    name: string;
  };
  productVariant: Variant;
  participationSharePct: string;
  allocatedRevenue: string;
  allocatedNetProfit: string;
};

type ProfitPayout = {
  id: number;
  payoutNumber: string;
  investor: {
    id: number;
    code: string;
    name: string;
  };
  payoutPercent: string;
  holdbackPercent: string;
  grossProfitAmount: string;
  holdbackAmount: string;
  payoutAmount: string;
  currency: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PAID" | "VOID";
  approvalNote?: string | null;
  rejectionReason?: string | null;
  paymentMethod?: "BANK_TRANSFER" | "MOBILE_BANKING" | "CHEQUE" | "CASH" | null;
  bankReference?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  paidAt: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  voidReversalReference?: string | null;
  transaction: {
    id: number;
    transactionNumber: string;
    transactionDate: string;
    type: string;
    direction: string;
    amount: string;
  } | null;
};

type PayoutRegisterItem = ProfitPayout & {
  heldAt?: string | null;
  releasedAt?: string | null;
  run: {
    id: number;
    runNumber: string;
    status: string;
    fromDate: string;
    toDate: string;
  };
  investor: ProfitPayout["investor"] & {
    beneficiaryVerifiedAt?: string | null;
  };
};

type StatementSummary = {
  investorCount: number;
  transactionCount: number;
  payoutCount: number;
  totalCredit: string;
  totalDebit: string;
  totalNet: string;
};

type StatementInvestorTransaction = {
  id: number;
  investorId: number;
  transactionNumber: string;
  direction: string;
  type: string;
  amount: string;
  currency: string;
  transactionDate: string;
};

type StatementInvestorPayout = {
  id: number;
  investorId: number;
  payoutNumber: string;
  status: string;
  payoutAmount: string;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  paymentMethod: string | null;
  bankReference: string | null;
};

type StatementRow = {
  investor: {
    id: number;
    code: string;
    name: string;
    status: string;
  };
  totals: {
    credit: string;
    debit: string;
    net: string;
  };
  counts: {
    transactionCount: number;
    payoutCount: number;
  };
  transactions: StatementInvestorTransaction[];
  payouts: StatementInvestorPayout[];
};

type StatementPayload = {
  summary: StatementSummary;
  from: string;
  to: string;
  statements: StatementRow[];
};

type ProfitPayload = {
  runs: ProfitRun[];
  selectedRunId: number | null;
  variantLines: ProfitVariantLine[];
  allocationLines: ProfitAllocationLine[];
  payouts: ProfitPayout[];
};

const TRANSACTION_TYPES = [
  "CAPITAL_COMMITMENT",
  "CAPITAL_CONTRIBUTION",
  "PROFIT_ALLOCATION",
  "LOSS_ALLOCATION",
  "DISTRIBUTION",
  "WITHDRAWAL",
  "ADJUSTMENT",
] as const;

export type InvestorSection =
  | "overview"
  | "registry"
  | "ledger"
  | "allocations"
  | "profit-runs"
  | "payouts"
  | "statements";

async function readJson<T>(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallback);
  }
  return payload as T;
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMoney(
  value: string | number,
  currency = "BDT",
  locale = "en",
) {
  const amount = typeof value === "number" ? value : Number(value || 0);
  if (Number.isNaN(amount)) return `0.00 ${currency}`;
  return `${amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDateTime(value?: string | null, locale = "en") {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale);
}

export default function InvestorWorkspace({
  section = "overview",
}: {
  section?: InvestorSection;
}) {
  const t = useTranslations("AdminInvestors.workspace");
  const locale = useLocale();
  const enumLabel = (group: string, value: string) => {
    const key = `enums.${group}.${value}` as any;
    return t.has(key) ? t(key) : value;
  };
  const searchParams = useSearchParams();
  const defaultStatementFrom = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toInputDate(date);
  }, []);
  const defaultStatementTo = useMemo(() => toInputDate(new Date()), []);
  const { data: session } = useSession();
  const globalPermissions = Array.isArray(
    (session?.user as any)?.globalPermissions,
  )
    ? ((session?.user as any).globalPermissions as string[])
    : [];

  const canManageInvestors = globalPermissions.includes("investors.manage");
  const canManageLedger = globalPermissions.includes("investor_ledger.manage");
  const canManageAllocations = globalPermissions.includes(
    "investor_allocations.manage",
  );
  const canReadProfit =
    globalPermissions.includes("investor_profit.read") ||
    globalPermissions.includes("investor_profit.manage") ||
    globalPermissions.includes("investor_profit.approve") ||
    globalPermissions.includes("investor_profit.post") ||
    globalPermissions.includes("investor_payout.read") ||
    globalPermissions.includes("investor_payout.manage") ||
    globalPermissions.includes("investor_payout.approve") ||
    globalPermissions.includes("investor_payout.pay") ||
    globalPermissions.includes("investor_payout.void") ||
    globalPermissions.includes("investor_statement.read");
  const canManageProfit = globalPermissions.includes("investor_profit.manage");
  const canApproveProfit = globalPermissions.includes(
    "investor_profit.approve",
  );
  const canPostProfit = globalPermissions.includes("investor_profit.post");
  const canReadPayout =
    globalPermissions.includes("investor_payout.read") ||
    globalPermissions.includes("investor_payout.manage") ||
    globalPermissions.includes("investor_payout.approve") ||
    globalPermissions.includes("investor_payout.pay") ||
    globalPermissions.includes("investor_payout.void") ||
    globalPermissions.includes("investor_statement.read");
  const canManagePayout = globalPermissions.includes("investor_payout.manage");
  const canApprovePayout = globalPermissions.includes(
    "investor_payout.approve",
  );
  const canPayPayout = globalPermissions.includes("investor_payout.pay");
  const canVoidPayout = globalPermissions.includes("investor_payout.void");
  const canReadStatement = globalPermissions.includes(
    "investor_statement.read",
  );
  const canReadInvestors =
    globalPermissions.includes("investors.read") || canManageInvestors;
  const canReadLedger =
    globalPermissions.includes("investor_ledger.read") || canManageLedger;
  const canReadAllocations =
    globalPermissions.includes("investor_allocations.read") ||
    canManageAllocations;
  const isOverview = section === "overview";
  const showSection = (target: Exclude<InvestorSection, "overview">) =>
    isOverview || section === target;
  const sectionTitleMap: Record<InvestorSection, string> = {
    overview: t("sections.overview"),
    registry: t("sections.registry"),
    ledger: t("sections.ledger"),
    allocations: t("sections.allocations"),
    "profit-runs": t("sections.profitRuns"),
    payouts: t("sections.payouts"),
    statements: t("sections.statements"),
  };
  const canAccessSelectedSection =
    section === "overview"
      ? canReadInvestors ||
        canReadLedger ||
        canReadAllocations ||
        canReadProfit ||
        canReadPayout ||
        canReadStatement
      : section === "registry"
        ? canReadInvestors
        : section === "ledger"
          ? canReadLedger
          : section === "allocations"
            ? canReadAllocations
            : section === "profit-runs"
              ? canReadProfit
              : section === "payouts"
                ? canReadPayout
                : canReadStatement;

  const [loading, setLoading] = useState(true);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [profitRuns, setProfitRuns] = useState<ProfitRun[]>([]);
  const [selectedProfitRunId, setSelectedProfitRunId] = useState("");
  const [payoutRunFilter, setPayoutRunFilter] = useState("");
  const [profitStatusFilter, setProfitStatusFilter] = useState("");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("");
  const [statementFrom, setStatementFrom] = useState(defaultStatementFrom);
  const [statementTo, setStatementTo] = useState(defaultStatementTo);
  const [profitVariantLines, setProfitVariantLines] = useState<
    ProfitVariantLine[]
  >([]);
  const [profitAllocationLines, setProfitAllocationLines] = useState<
    ProfitAllocationLine[]
  >([]);
  const [profitPayouts, setProfitPayouts] = useState<ProfitPayout[]>([]);
  const [payoutRegister, setPayoutRegister] = useState<PayoutRegisterItem[]>(
    [],
  );
  const [statementSummary, setStatementSummary] = useState<StatementSummary>({
    investorCount: 0,
    transactionCount: 0,
    payoutCount: 0,
    totalCredit: "0",
    totalDebit: "0",
    totalNet: "0",
  });
  const [statementRows, setStatementRows] = useState<StatementRow[]>([]);
  const [statementDetailInvestorId, setStatementDetailInvestorId] = useState("");
  const [loadingStatementPreview, setLoadingStatementPreview] = useState(false);
  const [runningProfit, setRunningProfit] = useState(false);
  const [updatingRunStatus, setUpdatingRunStatus] = useState(false);
  const [postingRun, setPostingRun] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [actingPayoutId, setActingPayoutId] = useState<number | null>(null);
  const [exportingStatement, setExportingStatement] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    const investorId = searchParams.get("investorId") || "";
    const runIdParam = searchParams.get("runId");
    const status = searchParams.get("status") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (investorId !== selectedInvestorId) {
      setSelectedInvestorId(investorId);
    }
    if (
      (section === "profit-runs" || section === "payouts") &&
      runIdParam !== null &&
      runIdParam !== selectedProfitRunId
    ) {
      setSelectedProfitRunId(runIdParam);
    }
    if (
      section === "payouts" &&
      runIdParam !== null &&
      runIdParam !== payoutRunFilter
    ) {
      setPayoutRunFilter(runIdParam);
    }
    if (section === "profit-runs" && status !== profitStatusFilter) {
      setProfitStatusFilter(status);
    }
    if (section === "payouts" && status !== payoutStatusFilter) {
      setPayoutStatusFilter(status);
    }
    if (from && from !== statementFrom) {
      setStatementFrom(from);
    }
    if (to && to !== statementTo) {
      setStatementTo(to);
    }
  }, [
    payoutStatusFilter,
    payoutRunFilter,
    profitStatusFilter,
    searchParams,
    section,
    selectedInvestorId,
    selectedProfitRunId,
    statementFrom,
    statementTo,
  ]);

  const [investorName, setInvestorName] = useState("");
  const [investorEmail, setInvestorEmail] = useState("");
  const [investorPhone, setInvestorPhone] = useState("");
  const [investorLegalName, setInvestorLegalName] = useState("");
  const [investorTaxNumber, setInvestorTaxNumber] = useState("");
  const [investorNationalIdNumber, setInvestorNationalIdNumber] = useState("");
  const [investorPassportNumber, setInvestorPassportNumber] = useState("");
  const [investorBankName, setInvestorBankName] = useState("");
  const [investorBankAccountName, setInvestorBankAccountName] = useState("");
  const [investorBankAccountNumber, setInvestorBankAccountNumber] =
    useState("");
  const [investorNotes, setInvestorNotes] = useState("");
  const [transactionForm, setTransactionForm] = useState({
    investorId: "",
    type: "CAPITAL_CONTRIBUTION" as (typeof TRANSACTION_TYPES)[number],
    direction: "CREDIT" as "DEBIT" | "CREDIT",
    amount: "",
    currency: "BDT",
    productVariantId: "",
  });
  const [allocationForm, setAllocationForm] = useState({
    investorId: "",
    productVariantId: "",
    participationPercent: "",
    committedAmount: "",
  });
  const [profitRunForm, setProfitRunForm] = useState({
    fromDate: "",
    toDate: "",
    allocationBasis: "NET_REVENUE" as "NET_REVENUE" | "NET_UNITS",
    marketingExpense: "",
    adsExpense: "",
    logisticsExpense: "",
    otherExpense: "",
    note: "",
  });
  const [runActionNote, setRunActionNote] = useState("");
  const [payoutForm, setPayoutForm] = useState({
    payoutPercent: "100",
    holdbackPercent: "0",
    currency: "BDT",
    note: "",
  });
  const [payoutActionForm, setPayoutActionForm] = useState({
    note: "",
    paymentMethod: "BANK_TRANSFER" as
      | "BANK_TRANSFER"
      | "MOBILE_BANKING"
      | "CHEQUE"
      | "CASH",
    bankReference: "",
    paidAt: "",
    voidReason: "",
  });

  const loadData = async () => {
    try {
      if (!hasLoadedOnce) {
        setLoading(true);
      }
      const investorParam = selectedInvestorId
        ? `?investorId=${selectedInvestorId}`
        : "";
      const profitParams = new URLSearchParams();
      if (selectedInvestorId) {
        profitParams.set("investorId", selectedInvestorId);
      }
      if (selectedProfitRunId) {
        profitParams.set("runId", selectedProfitRunId);
      }
      const profitUrl = `/api/admin/investor-profit-runs${profitParams.size > 0 ? `?${profitParams.toString()}` : ""}`;
      const payoutParams = new URLSearchParams();
      if (selectedInvestorId) {
        payoutParams.set("investorId", selectedInvestorId);
      }
      if (payoutRunFilter) {
        payoutParams.set("runId", payoutRunFilter);
      }
      if (payoutStatusFilter) {
        payoutParams.set("status", payoutStatusFilter);
      }
      const payoutUrl = `/api/admin/investor-payouts${payoutParams.size > 0 ? `?${payoutParams.toString()}` : ""}`;

      const [investorRes, txRes, allocationRes, payoutRes] = await Promise.all([
        fetch("/api/admin/investors", { cache: "no-store" }),
        fetch(`/api/admin/investor-transactions${investorParam}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/investor-allocations${investorParam}`, {
          cache: "no-store",
        }),
        fetch(payoutUrl, { cache: "no-store" }),
      ]);

      const investorData = await readJson<Investor[]>(
        investorRes,
        t("errors.load"),
      );
      const txData = await readJson<TxPayload>(
        txRes,
        t("errors.load"),
      );
      const allocationData = await readJson<Allocation[]>(
        allocationRes,
        t("errors.load"),
      );
      const payoutData = await readJson<{ payouts: PayoutRegisterItem[] }>(
        payoutRes,
        t("errors.load"),
      );
      let profitData: ProfitPayload = {
        runs: [],
        selectedRunId: null,
        variantLines: [],
        allocationLines: [],
        payouts: [],
      };
      if (canReadProfit) {
        const profitRes = await fetch(profitUrl, { cache: "no-store" });
        profitData = await readJson<ProfitPayload>(
          profitRes,
          t("errors.load"),
        );
      }

      const processedInvestors = investorData.map(investor => ({
        ...investor,
        totals: {
          credit: Number(investor.totals.credit),
          debit: Number(investor.totals.debit),
          balance: Number(investor.totals.balance),
        },
      }));
      setInvestors(processedInvestors);
      setVariants(txData.variants || []);
      setTransactions(txData.transactions || []);
      setAllocations(allocationData || []);
      setProfitRuns(profitData.runs || []);
      setProfitVariantLines(profitData.variantLines || []);
      setProfitAllocationLines(profitData.allocationLines || []);
      setProfitPayouts(profitData.payouts || []);
      setPayoutRegister(payoutData.payouts || []);
      const apiRunId =
        profitData.selectedRunId && Number.isInteger(profitData.selectedRunId)
          ? String(profitData.selectedRunId)
          : "";
      if (apiRunId !== selectedProfitRunId) {
        setSelectedProfitRunId(apiRunId);
      }
    } catch {
      toast.error(t("errors.load"));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    void loadData();
  }, [
    canReadProfit,
    payoutRunFilter,
    payoutStatusFilter,
    selectedInvestorId,
    selectedProfitRunId,
  ]);

  useEffect(() => {
    if (!selectedInvestorId) return;
    setTransactionForm((current) => ({
      ...current,
      investorId: selectedInvestorId,
    }));
    setAllocationForm((current) => ({
      ...current,
      investorId: selectedInvestorId,
    }));
  }, [selectedInvestorId]);

  const loadStatementPreview = useCallback(async () => {
    if (!canReadStatement) return;
    try {
      setLoadingStatementPreview(true);
      const params = new URLSearchParams();
      if (selectedInvestorId) {
        params.set("investorId", selectedInvestorId);
      }
      params.set("from", statementFrom || defaultStatementFrom);
      params.set("to", statementTo || defaultStatementTo);
      const response = await fetch(
        `/api/admin/investor-statements?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = await readJson<StatementPayload>(
        response,
        t("errors.loadStatements"),
      );
      setStatementSummary(payload.summary);
      setStatementRows(payload.statements);
      const preferredInvestorId = selectedInvestorId
        ? String(selectedInvestorId)
        : payload.statements[0]
          ? String(payload.statements[0].investor.id)
          : "";
      setStatementDetailInvestorId((current) => {
        if (
          current &&
          payload.statements.some((item) => String(item.investor.id) === current)
        ) {
          return current;
        }
        return preferredInvestorId;
      });
    } catch {
      toast.error(t("errors.loadStatements"));
    } finally {
      setLoadingStatementPreview(false);
    }
  }, [
    canReadStatement,
    defaultStatementFrom,
    defaultStatementTo,
    selectedInvestorId,
    statementFrom,
    statementTo,
    t,
  ]);

  useEffect(() => {
    if (!canReadStatement || section !== "statements") return;
    void loadStatementPreview();
  }, [canReadStatement, loadStatementPreview, section]);

  useEffect(() => {
    if (transactionForm.type === "ADJUSTMENT") return;
    setTransactionForm((current) => ({
      ...current,
      direction:
        current.type === "LOSS_ALLOCATION" ||
        current.type === "DISTRIBUTION" ||
        current.type === "WITHDRAWAL"
          ? "DEBIT"
          : "CREDIT",
    }));
  }, [transactionForm.type]);

  const createInvestor = async () => {
    try {
      const response = await fetch("/api/admin/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: investorName,
          email: investorEmail,
          phone: investorPhone,
          legalName: investorLegalName,
          taxNumber: investorTaxNumber,
          nationalIdNumber: investorNationalIdNumber,
          passportNumber: investorPassportNumber,
          bankName: investorBankName,
          bankAccountName: investorBankAccountName,
          bankAccountNumber: investorBankAccountNumber,
          notes: investorNotes,
        }),
      });
      await readJson(response, t("errors.createInvestor"));
      setInvestorName("");
      setInvestorEmail("");
      setInvestorPhone("");
      setInvestorLegalName("");
      setInvestorTaxNumber("");
      setInvestorNationalIdNumber("");
      setInvestorPassportNumber("");
      setInvestorBankName("");
      setInvestorBankAccountName("");
      setInvestorBankAccountNumber("");
      setInvestorNotes("");
      toast.success(t("success.investorCreated"));
      await loadData();
    } catch {
      toast.error(t("errors.createInvestor"));
    }
  };

  const createTransaction = async () => {
    try {
      const response = await fetch("/api/admin/investor-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...transactionForm,
          investorId: Number(transactionForm.investorId),
          productVariantId: transactionForm.productVariantId
            ? Number(transactionForm.productVariantId)
            : null,
        }),
      });
      await readJson(response, t("errors.createTransaction"));
      setTransactionForm((current) => ({
        ...current,
        amount: "",
        productVariantId: "",
      }));
      toast.success(t("success.transactionPosted"));
      await loadData();
    } catch {
      toast.error(t("errors.createTransaction"));
    }
  };

  const createAllocation = async () => {
    try {
      const response = await fetch("/api/admin/investor-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...allocationForm,
          investorId: Number(allocationForm.investorId),
          productVariantId: Number(allocationForm.productVariantId),
        }),
      });
      await readJson(response, t("errors.createAllocation"));
      setAllocationForm((current) => ({
        ...current,
        participationPercent: "",
        committedAmount: "",
      }));
      toast.success(t("success.allocationCreated"));
      await loadData();
    } catch {
      toast.error(t("errors.createAllocation"));
    }
  };

  const runProfitCalculation = async () => {
    try {
      setRunningProfit(true);
      const response = await fetch("/api/admin/investor-profit-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profitRunForm),
      });
      const data = await readJson<{
        run: ProfitRun;
      }>(response, t("errors.runProfitCalculation"));
      toast.success(
        t("success.profitRunCompleted", { runNumber: data.run.runNumber }),
      );
      setSelectedProfitRunId(String(data.run.id));
      await loadData();
    } catch {
      toast.error(t("errors.runProfitCalculation"));
    } finally {
      setRunningProfit(false);
    }
  };

  const selectedProfitRun = useMemo(() => {
    if (!selectedProfitRunId) {
      return profitRuns[0] ?? null;
    }
    return (
      profitRuns.find((run) => String(run.id) === selectedProfitRunId) ?? null
    );
  }, [profitRuns, selectedProfitRunId]);

  const filteredProfitRuns = useMemo(() => {
    if (!profitStatusFilter) {
      return profitRuns;
    }
    return profitRuns.filter((run) => run.status === profitStatusFilter);
  }, [profitRuns, profitStatusFilter]);

  const filteredPayoutRegister = useMemo(() => {
    return payoutRegister.filter((item) => {
      if (payoutRunFilter && String(item.run.id) !== payoutRunFilter) {
        return false;
      }
      if (payoutStatusFilter && item.status !== payoutStatusFilter) {
        return false;
      }
      return true;
    });
  }, [payoutRegister, payoutRunFilter, payoutStatusFilter]);

  const changeProfitRunStatus = async (action: "approve" | "reject") => {
    if (!selectedProfitRun) {
      toast.error(t("errors.selectProfitRun"));
      return;
    }
    try {
      setUpdatingRunStatus(true);
      const response = await fetch(
        `/api/admin/investor-profit-runs/${selectedProfitRun.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: runActionNote,
          }),
        },
      );
      await readJson(response, t(`errors.profitRunAction.${action}` as any));
      toast.success(
        action === "approve"
          ? t("success.profitRunApproved")
          : t("success.profitRunRejected"),
      );
      await loadData();
    } catch {
      toast.error(t(`errors.profitRunAction.${action}` as any));
    } finally {
      setUpdatingRunStatus(false);
    }
  };

  const postSelectedRun = async () => {
    if (!selectedProfitRun) {
      toast.error(t("errors.selectProfitRun"));
      return;
    }
    try {
      setPostingRun(true);
      const response = await fetch(
        `/api/admin/investor-profit-runs/${selectedProfitRun.id}/post`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: runActionNote,
          }),
        },
      );
      const result = await readJson<{ postedTransactionCount: number }>(
        response,
        t("errors.postProfitRun"),
      );
      toast.success(
        t("success.profitRunPosted", {
          count: result.postedTransactionCount,
        }),
      );
      await loadData();
    } catch {
      toast.error(t("errors.postProfitRun"));
    } finally {
      setPostingRun(false);
    }
  };

  const createPayout = async () => {
    if (!selectedProfitRun) {
      toast.error(t("errors.selectPostedProfitRun"));
      return;
    }
    try {
      setProcessingPayout(true);
      const response = await fetch(
        `/api/admin/investor-profit-runs/${selectedProfitRun.id}/payout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payoutForm),
        },
      );
      const result = await readJson<{ payoutCount: number }>(
        response,
        t("errors.createPayout"),
      );
      toast.success(t("success.payoutDraftsCreated", { count: result.payoutCount }));
      await loadData();
    } catch {
      toast.error(t("errors.createPayout"));
    } finally {
      setProcessingPayout(false);
    }
  };

  const processPayoutAction = async (
    payoutId: number,
    action: "approve" | "reject" | "pay" | "void",
  ) => {
    try {
      setActingPayoutId(payoutId);
      const payload: Record<string, string> = {
        action,
      };
      if (action === "approve" || action === "reject") {
        payload.note = payoutActionForm.note;
      }
      if (action === "pay") {
        payload.note = payoutActionForm.note;
        payload.paymentMethod = payoutActionForm.paymentMethod;
        payload.bankReference = payoutActionForm.bankReference;
        if (payoutActionForm.paidAt) {
          payload.paidAt = payoutActionForm.paidAt;
        }
      }
      if (action === "void") {
        payload.voidReason = payoutActionForm.voidReason;
      }

      const response = await fetch(`/api/admin/investor-payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readJson(response, t(`errors.payoutAction.${action}` as any));
      const messageMap: Record<typeof action, string> = {
        approve: t("success.payoutApproved"),
        reject: t("success.payoutRejected"),
        pay: t("success.payoutSettled"),
        void: t("success.payoutVoided"),
      };
      toast.success(messageMap[action]);
      await loadData();
    } catch {
      toast.error(t(`errors.payoutAction.${action}` as any));
    } finally {
      setActingPayoutId(null);
    }
  };

  const exportStatementCsv = async () => {
    try {
      setExportingStatement(true);
      const params = new URLSearchParams();
      params.set("format", "csv");
      if (selectedInvestorId) {
        params.set("investorId", selectedInvestorId);
      }
      params.set("from", statementFrom || defaultStatementFrom);
      params.set("to", statementTo || defaultStatementTo);
      const response = await fetch(
        `/api/admin/investor-statements?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          (payload as { error?: string }).error || t("errors.exportStatement"),
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "investor-statement.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t("success.statementCsvExported"));
    } catch {
      toast.error(t("errors.exportStatement"));
    } finally {
      setExportingStatement(false);
    }
  };

  const exportStatementPdfFile = async () => {
    try {
      setExportingStatement(true);
      const params = new URLSearchParams();
      if (selectedInvestorId) {
        params.set("investorId", selectedInvestorId);
      }
      params.set("from", statementFrom || defaultStatementFrom);
      params.set("to", statementTo || defaultStatementTo);

      const response = await fetch(
        `/api/admin/investor-statements?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = await readJson<{
        from: string;
        to: string;
        statements: Array<{
          investor: { code: string; name: string; status: string };
          totals: { credit: string; debit: string; net: string };
          transactions: Array<{
            transactionNumber: string;
            transactionDate: string;
            type: string;
            direction: string;
            amount: string;
          }>;
          payouts: Array<{
            payoutNumber: string;
            status: string;
            payoutAmount: string;
            createdAt: string;
            paidAt: string | null;
          }>;
        }>;
      }>(response, t("errors.loadStatementData"));

      await exportInvestorStatementPdf({
        fileName: `investor-statement-${payload.from.slice(0, 10)}-to-${payload.to.slice(0, 10)}.pdf`,
        // jsPDF's bundled font does not support Bengali glyphs yet.
        title: "Investor Statement",
        from: payload.from,
        to: payload.to,
        statements: payload.statements.map((statement) => ({
          investorCode: statement.investor.code,
          investorName: statement.investor.name,
          status: statement.investor.status,
          summary: statement.totals,
          transactions: statement.transactions.map((item) => ({
            ...item,
            currency: "BDT",
          })),
          payouts: statement.payouts.map((item) => ({
            ...item,
            currency: "BDT",
          })),
        })),
      });
      toast.success(t("success.statementPdfExported"));
    } catch {
      toast.error(t("errors.exportStatementPdf"));
    } finally {
      setExportingStatement(false);
    }
  };

  const summary = useMemo(
    () => ({
      totalInvestors: investors.length,
      activeInvestors: investors.filter((item) => item.status === "ACTIVE")
        .length,
      totalBalance: investors.reduce(
        (sum, item) => sum + Number(item.totals.balance || 0),
        0,
      ),
      }),
    [investors],
  );

  const selectedStatementDetail = useMemo(
    () =>
      statementRows.find(
        (item) => String(item.investor.id) === statementDetailInvestorId,
      ) || null,
    [statementDetailInvestorId, statementRows],
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("header.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("header.description")}
          <span className="ml-1 font-medium text-foreground">
            {t("header.activeView", { view: sectionTitleMap[section] })}
          </span>
        </p>
        {loading && !hasLoadedOnce ? (
          <p className="text-xs text-muted-foreground">
            {t("header.refreshing")}
          </p>
        ) : null}
      </div>

      <InvestorWorkflowGuide currentSection={section as InvestorWorkflowSection} />

      {!canAccessSelectedSection ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("access.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("access.description", { view: sectionTitleMap[section] })}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {canAccessSelectedSection ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t("summary.totalInvestors")}</p>
              <p className="text-xl font-semibold">{summary.totalInvestors}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t("summary.activeInvestors")}</p>
              <p className="text-xl font-semibold">{summary.activeInvestors}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t("summary.netBalance")}</p>
              <p className="text-xl font-semibold">
                {summary.totalBalance.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {canAccessSelectedSection && showSection("registry") ? (
        <Tabs defaultValue="forms" className="space-y-4">
          <TabsList className="flex h-9 w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground [&>*]:shrink-0">
            <TabsTrigger
              value="forms"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("registry.tabs.create")}
            </TabsTrigger>
            <TabsTrigger
              value="registry"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("registry.tabs.registry")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="space-y-4">
            {canManageInvestors ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("registry.form.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("registry.form.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="investor-name">{t("registry.form.name")}</Label>
                      <Input
                        id="investor-name"
                        placeholder={t("registry.form.namePlaceholder")}
                        value={investorName}
                        onChange={(event) =>
                          setInvestorName(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-email">{t("registry.form.email")}</Label>
                      <Input
                        id="investor-email"
                        type="email"
                        placeholder={t("registry.form.emailPlaceholder")}
                        value={investorEmail}
                        onChange={(event) =>
                          setInvestorEmail(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-phone">{t("registry.form.phone")}</Label>
                      <Input
                        id="investor-phone"
                        placeholder={t("registry.form.phonePlaceholder")}
                        value={investorPhone}
                        onChange={(event) =>
                          setInvestorPhone(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-legal-name">{t("registry.form.legalName")}</Label>
                      <Input
                        id="investor-legal-name"
                        placeholder={t("registry.form.legalNamePlaceholder")}
                        value={investorLegalName}
                        onChange={(event) =>
                          setInvestorLegalName(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-tax-number">{t("registry.form.taxNumber")}</Label>
                      <Input
                        id="investor-tax-number"
                        placeholder={t("registry.form.taxNumberPlaceholder")}
                        value={investorTaxNumber}
                        onChange={(event) =>
                          setInvestorTaxNumber(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-nid">{t("registry.form.nationalId")}</Label>
                      <Input
                        id="investor-nid"
                        placeholder={t("registry.form.nationalIdPlaceholder")}
                        value={investorNationalIdNumber}
                        onChange={(event) =>
                          setInvestorNationalIdNumber(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-passport">{t("registry.form.passport")}</Label>
                      <Input
                        id="investor-passport"
                        placeholder={t("registry.form.passportPlaceholder")}
                        value={investorPassportNumber}
                        onChange={(event) =>
                          setInvestorPassportNumber(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-bank-name">{t("registry.form.bankName")}</Label>
                      <Input
                        id="investor-bank-name"
                        placeholder={t("registry.form.bankNamePlaceholder")}
                        value={investorBankName}
                        onChange={(event) =>
                          setInvestorBankName(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-bank-account-name">
                        {t("registry.form.bankAccountName")}
                      </Label>
                      <Input
                        id="investor-bank-account-name"
                        placeholder={t("registry.form.bankAccountNamePlaceholder")}
                        value={investorBankAccountName}
                        onChange={(event) =>
                          setInvestorBankAccountName(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investor-bank-account-number">
                        {t("registry.form.bankAccountNumber")}
                      </Label>
                      <Input
                        id="investor-bank-account-number"
                        placeholder={t("registry.form.bankAccountNumberPlaceholder")}
                        value={investorBankAccountNumber}
                        onChange={(event) =>
                          setInvestorBankAccountNumber(event.target.value)
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="investor-notes">{t("registry.form.notes")}</Label>
                    <textarea
                      id="investor-notes"
                      placeholder={t("registry.form.notesPlaceholder")}
                      value={investorNotes}
                      onChange={(event) => setInvestorNotes(event.target.value)}
                      className="w-full h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void createInvestor()}
                      disabled={!investorName.trim()}
                      className="min-w-[120px]"
                    >
                      {t("registry.form.submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("registry.permissions.create")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="registry" className="space-y-4">
            {canReadInvestors ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("registry.list.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("registry.list.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="investor-filter"
                        className="text-sm font-medium"
                      >
                        {t("registry.list.filterLabel")}
                      </Label>
                      <div className="relative">
                        <select
                          id="investor-filter"
                          className="h-11 w-full rounded-lg border border-input bg-background px-4 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[320px] appearance-none"
                          value={selectedInvestorId}
                          onChange={(event) =>
                            setSelectedInvestorId(event.target.value)
                          }
                        >
                          <option value="">{t("registry.list.allInvestors")}</option>
                          {investors.map((investor) => (
                            <option key={investor.id} value={investor.id}>
                              {investor.name} ({investor.code})
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <svg
                            className="h-4 w-4 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      {t("registry.list.total", { count: investors.length })}
                    </div>
                  </div>

                  <InvestorTable investors={investors} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("registry.permissions.view")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {canAccessSelectedSection && showSection("ledger") ? (
        <Tabs defaultValue="form" className="space-y-4">
          <TabsList className="flex h-9 w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground [&>*]:shrink-0">
            <TabsTrigger
              value="form"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("ledger.tabs.post")}
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("ledger.tabs.history")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4">
            {canManageLedger ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("ledger.form.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("ledger.form.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="transaction-investor">
                        {t("ledger.form.investor")}
                      </Label>
                      <select
                        id="transaction-investor"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={transactionForm.investorId}
                        onChange={(event) =>
                          setTransactionForm((current) => ({
                            ...current,
                            investorId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t("common.selectInvestor")}</option>
                        {investors.map((investor) => (
                          <option key={investor.id} value={investor.id}>
                            {investor.name} ({investor.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction-type">
                        {t("ledger.form.transactionType")}
                      </Label>
                      <select
                        id="transaction-type"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={transactionForm.type}
                        onChange={(event) =>
                          setTransactionForm((current) => ({
                            ...current,
                            type: event.target
                              .value as (typeof TRANSACTION_TYPES)[number],
                          }))
                        }
                      >
                        {TRANSACTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {enumLabel("transactionTypes", type)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction-direction">
                        {t("ledger.form.direction")}
                      </Label>
                      <select
                        id="transaction-direction"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        disabled={transactionForm.type !== "ADJUSTMENT"}
                        value={transactionForm.direction}
                        onChange={(event) =>
                          setTransactionForm((current) => ({
                            ...current,
                            direction: event.target.value as "DEBIT" | "CREDIT",
                          }))
                        }
                      >
                        <option value="CREDIT">
                          {enumLabel("directions", "CREDIT")}
                        </option>
                        <option value="DEBIT">
                          {enumLabel("directions", "DEBIT")}
                        </option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction-amount">
                        {t("common.amount")}
                      </Label>
                      <Input
                        id="transaction-amount"
                        placeholder={t("common.enterAmount")}
                        value={transactionForm.amount}
                        onChange={(event) =>
                          setTransactionForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transaction-variant">
                        {t("common.productVariant")}
                      </Label>
                      <select
                        id="transaction-variant"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={transactionForm.productVariantId}
                        onChange={(event) =>
                          setTransactionForm((current) => ({
                            ...current,
                            productVariantId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t("ledger.form.generalPool")}</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.product.name} ({variant.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void createTransaction()}
                      disabled={
                        !transactionForm.investorId || !transactionForm.amount
                      }
                      className="min-w-[120px]"
                    >
                      {t("ledger.form.submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("ledger.permissions.post")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            {canReadLedger ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("ledger.history.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("ledger.history.description")}
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.number")}</TableHead>
                        <TableHead>{t("common.investor")}</TableHead>
                        <TableHead>{t("common.type")}</TableHead>
                        <TableHead>{t("common.direction")}</TableHead>
                        <TableHead>{t("common.amount")}</TableHead>
                        <TableHead>{t("common.product")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/investors/ledger/${item.id}`}
                              className="hover:text-primary"
                            >
                              {item.transactionNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/investors/${item.investor.id}`}
                              className="hover:text-primary"
                            >
                              {item.investor.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                item.direction === "CREDIT"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {enumLabel("transactionTypes", item.type)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                item.direction === "CREDIT"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {enumLabel("directions", item.direction)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(item.amount).toFixed(2)} {item.currency}
                          </TableCell>
                          <TableCell>
                            {item.productVariant
                              ? `${item.productVariant.product.name} (${item.productVariant.sku})`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("ledger.permissions.view")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {canAccessSelectedSection && showSection("profit-runs") ? (
        <Tabs defaultValue="form" className="space-y-4">
          <TabsList className="flex h-9 w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground [&>*]:shrink-0">
            <TabsTrigger
              value="form"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("profitRuns.tabs.calculate")}
            </TabsTrigger>
            <TabsTrigger
              value="runs"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("profitRuns.tabs.runs")}
            </TabsTrigger>
            <TabsTrigger
              value="workflow"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("profitRuns.tabs.workflow")}
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("profitRuns.tabs.analysis")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4">
            {canManageProfit ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("profitRuns.form.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("profitRuns.form.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profit-from">
                        {t("common.fromDate")}
                      </Label>
                      <Input
                        id="profit-from"
                        type="date"
                        value={profitRunForm.fromDate}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            fromDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profit-to">{t("common.toDate")}</Label>
                      <Input
                        id="profit-to"
                        type="date"
                        value={profitRunForm.toDate}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            toDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allocation-basis">
                        {t("profitRuns.form.allocationBasis")}
                      </Label>
                      <select
                        id="allocation-basis"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={profitRunForm.allocationBasis}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            allocationBasis: event.target.value as
                              | "NET_REVENUE"
                              | "NET_UNITS",
                          }))
                        }
                      >
                        <option value="NET_REVENUE">
                          {enumLabel("allocationBases", "NET_REVENUE")}
                        </option>
                        <option value="NET_UNITS">
                          {enumLabel("allocationBases", "NET_UNITS")}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="marketing-expense">
                        {t("profitRuns.form.marketingExpense")}
                      </Label>
                      <Input
                        id="marketing-expense"
                        placeholder={t("common.enterAmount")}
                        value={profitRunForm.marketingExpense}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            marketingExpense: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ads-expense">
                        {t("profitRuns.form.adsExpense")}
                      </Label>
                      <Input
                        id="ads-expense"
                        placeholder={t("common.enterAmount")}
                        value={profitRunForm.adsExpense}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            adsExpense: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="logistics-expense">
                        {t("profitRuns.form.logisticsExpense")}
                      </Label>
                      <Input
                        id="logistics-expense"
                        placeholder={t("common.enterAmount")}
                        value={profitRunForm.logisticsExpense}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            logisticsExpense: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="other-expense">
                        {t("profitRuns.form.otherExpense")}
                      </Label>
                      <Input
                        id="other-expense"
                        placeholder={t("common.enterAmount")}
                        value={profitRunForm.otherExpense}
                        onChange={(event) =>
                          setProfitRunForm((current) => ({
                            ...current,
                            otherExpense: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profit-note">
                      {t("common.noteOptional")}
                    </Label>
                    <Input
                      id="profit-note"
                      placeholder={t("common.additionalNotes")}
                      value={profitRunForm.note}
                      onChange={(event) =>
                        setProfitRunForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void runProfitCalculation()}
                      disabled={runningProfit}
                      className="min-w-[180px]"
                    >
                      {runningProfit
                        ? t("profitRuns.form.running")
                        : t("profitRuns.form.submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("profitRuns.permissions.calculate")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="runs" className="space-y-4">
            {canReadProfit ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("profitRuns.history.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("profitRuns.history.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="profit-run-select">
                      {t("profitRuns.history.selectRun")}
                    </Label>
                    <select
                      id="profit-run-select"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm md:w-[460px]"
                      value={payoutRunFilter}
                      onChange={(event) =>
                        setPayoutRunFilter(event.target.value)
                      }
                    >
                      <option value="">{t("profitRuns.history.latestRun")}</option>
                      {profitRuns.map((run) => (
                        <option key={run.id} value={run.id}>
                          {t("profitRuns.history.runOption", {
                            runNumber: run.runNumber,
                            from: run.fromDate.slice(0, 10),
                            to: run.toDate.slice(0, 10),
                          })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="profit-status-filter">
                      {t("profitRuns.history.runStatus")}
                    </Label>
                    <select
                      id="profit-status-filter"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm md:w-[240px]"
                      value={profitStatusFilter}
                      onChange={(event) =>
                        setProfitStatusFilter(event.target.value)
                      }
                    >
                      <option value="">{t("common.allStatuses")}</option>
                      <option value="PENDING_APPROVAL">
                        {enumLabel("profitStatuses", "PENDING_APPROVAL")}
                      </option>
                      <option value="APPROVED">
                        {enumLabel("profitStatuses", "APPROVED")}
                      </option>
                      <option value="REJECTED">
                        {enumLabel("profitStatuses", "REJECTED")}
                      </option>
                      <option value="POSTED">
                        {enumLabel("profitStatuses", "POSTED")}
                      </option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.run")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead>{t("common.basis")}</TableHead>
                          <TableHead>{t("common.netRevenue")}</TableHead>
                          <TableHead>{t("common.netCogs")}</TableHead>
                          <TableHead>{t("common.operatingExpense")}</TableHead>
                          <TableHead>{t("common.netProfit")}</TableHead>
                          <TableHead>{t("common.approved")}</TableHead>
                          <TableHead>{t("common.posted")}</TableHead>
                          <TableHead>{t("common.lines")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfitRuns.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/admin/investors/profit-runs/${run.id}`}
                                className="hover:text-primary"
                              >
                                {run.runNumber}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  run.status === "POSTED"
                                    ? "bg-green-100 text-green-800"
                                    : run.status === "APPROVED"
                                      ? "bg-blue-100 text-blue-800"
                                      : run.status === "PENDING_APPROVAL"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                }`}
                              >
                                {enumLabel("profitStatuses", run.status)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {enumLabel("allocationBases", run.allocationBasis)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(run.totalNetRevenue).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(run.totalNetCogs).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(run.totalOperatingExpense).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {Number(run.totalNetProfit).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {run.approvedAt
                                ? run.approvedAt.slice(0, 10)
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {run.postedAt ? run.postedAt.slice(0, 10) : "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {t("profitRuns.history.lineCounts", {
                                variants: run._count?.variantLines || 0,
                                allocations: run._count?.allocationLines || 0,
                                payouts: run._count?.payouts || 0,
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredProfitRuns.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={10}
                              className="text-center text-sm text-muted-foreground"
                            >
                              {t("profitRuns.history.empty")}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("profitRuns.permissions.view")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            {canReadProfit && selectedProfitRun ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("profitRuns.workflow.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("profitRuns.workflow.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t("common.run")}
                      </p>
                      <p className="font-medium">
                        {selectedProfitRun.runNumber}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t("common.status")}
                      </p>
                      <p className="font-medium">
                        {enumLabel("profitStatuses", selectedProfitRun.status)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t("common.approved")}
                      </p>
                      <p className="font-medium">
                        {selectedProfitRun.approvedAt
                          ? selectedProfitRun.approvedAt
                              .slice(0, 19)
                              .replace("T", " ")
                          : "-"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {t("common.posted")}
                      </p>
                      <p className="font-medium">
                        {selectedProfitRun.postedAt
                          ? selectedProfitRun.postedAt
                              .slice(0, 19)
                              .replace("T", " ")
                          : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workflow-note">
                      {t("profitRuns.workflow.governanceNote")}
                    </Label>
                    <Input
                      id="workflow-note"
                      placeholder={t("profitRuns.workflow.notePlaceholder")}
                      value={runActionNote}
                      onChange={(event) => setRunActionNote(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canApproveProfit &&
                    selectedProfitRun.status === "PENDING_APPROVAL" ? (
                      <>
                        <Button
                          onClick={() => void changeProfitRunStatus("approve")}
                          disabled={updatingRunStatus}
                        >
                          {updatingRunStatus
                            ? t("common.updating")
                            : t("profitRuns.workflow.approve")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void changeProfitRunStatus("reject")}
                          disabled={updatingRunStatus}
                        >
                          {updatingRunStatus
                            ? t("common.updating")
                            : t("profitRuns.workflow.reject")}
                        </Button>
                      </>
                    ) : null}
                    {canPostProfit &&
                    selectedProfitRun.status === "APPROVED" ? (
                      <Button
                        onClick={() => void postSelectedRun()}
                        disabled={postingRun}
                      >
                        {postingRun
                          ? t("profitRuns.workflow.posting")
                          : t("profitRuns.workflow.postToLedger")}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("profitRuns.workflow.selectRun")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {canReadProfit ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      {t("profitRuns.analysis.variantTitle")}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("profitRuns.analysis.variantDescription")}
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.variant")}</TableHead>
                          <TableHead>{t("profitRuns.analysis.netUnits")}</TableHead>
                          <TableHead>{t("common.netRevenue")}</TableHead>
                          <TableHead>{t("common.netCogs")}</TableHead>
                          <TableHead>
                            {t("profitRuns.analysis.allocatedExpense")}
                          </TableHead>
                          <TableHead>{t("common.netProfit")}</TableHead>
                          <TableHead>
                            {t("profitRuns.analysis.unallocatedPercent")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profitVariantLines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {line.productVariant.product.name} (
                              {line.productVariant.sku})
                            </TableCell>
                            <TableCell className="text-right">
                              {line.unitsNet}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(line.netRevenue).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(line.netCogs).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(line.allocatedExpense).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {Number(line.netProfit).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {(Number(line.unallocatedSharePct) * 100).toFixed(
                                2,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      {t("profitRuns.analysis.investorTitle")}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {t("profitRuns.analysis.investorDescription")}
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.investor")}</TableHead>
                          <TableHead>{t("common.variant")}</TableHead>
                          <TableHead>{t("profitRuns.analysis.sharePercent")}</TableHead>
                          <TableHead>
                            {t("profitRuns.analysis.allocatedRevenue")}
                          </TableHead>
                          <TableHead>
                            {t("profitRuns.analysis.allocatedNetProfit")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profitAllocationLines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {line.investor.name} ({line.investor.code})
                            </TableCell>
                            <TableCell>
                              {line.productVariant.product.name} (
                              {line.productVariant.sku})
                            </TableCell>
                            <TableCell className="text-right">
                              {(
                                Number(line.participationSharePct) * 100
                              ).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(line.allocatedRevenue).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {Number(line.allocatedNetProfit).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("profitRuns.permissions.analysis")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {canAccessSelectedSection && showSection("payouts") ? (
        <Tabs defaultValue="form" className="space-y-4">
          <TabsList className="flex h-9 w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground [&>*]:shrink-0">
            <TabsTrigger
              value="form"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("payouts.tabs.create")}
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("payouts.tabs.register")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4">
            {canManagePayout && selectedProfitRun?.status === "POSTED" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("payouts.form.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("payouts.form.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="payout-percent">
                        {t("payouts.form.payoutPercent")}
                      </Label>
                      <Input
                        id="payout-percent"
                        placeholder={t("common.enterPercentage")}
                        value={payoutForm.payoutPercent}
                        onChange={(event) =>
                          setPayoutForm((current) => ({
                            ...current,
                            payoutPercent: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holdback-percent">
                        {t("payouts.form.holdbackPercent")}
                      </Label>
                      <Input
                        id="holdback-percent"
                        placeholder={t("common.enterPercentage")}
                        value={payoutForm.holdbackPercent}
                        onChange={(event) =>
                          setPayoutForm((current) => ({
                            ...current,
                            holdbackPercent: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payout-currency">
                        {t("common.currency")}
                      </Label>
                      <Input
                        id="payout-currency"
                        placeholder={t("common.enterCurrency")}
                        value={payoutForm.currency}
                        onChange={(event) =>
                          setPayoutForm((current) => ({
                            ...current,
                            currency: event.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout-note">
                      {t("payouts.form.note")}
                    </Label>
                    <Input
                      id="payout-note"
                      placeholder={t("common.additionalNotes")}
                      value={payoutForm.note}
                      onChange={(event) =>
                        setPayoutForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void createPayout()}
                      disabled={processingPayout}
                      className="min-w-[160px]"
                    >
                      {processingPayout
                        ? t("common.processing")
                        : t("payouts.form.submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {!selectedProfitRun
                      ? t("payouts.form.selectPostedRun")
                      : selectedProfitRun?.status !== "POSTED"
                        ? t("payouts.form.postedOnly")
                        : t("payouts.permissions.create")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            {canReadPayout ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("payouts.register.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("payouts.register.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 overflow-x-auto">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="payout-run-filter">
                        {t("payouts.register.profitRun")}
                      </Label>
                      <select
                        id="payout-run-filter"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={selectedProfitRunId}
                        onChange={(event) =>
                          setSelectedProfitRunId(event.target.value)
                        }
                      >
                        <option value="">{t("payouts.register.allRuns")}</option>
                        {profitRuns.map((run) => (
                          <option key={run.id} value={run.id}>
                            {run.runNumber}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payout-status-filter">
                        {t("payouts.register.payoutStatus")}
                      </Label>
                      <select
                        id="payout-status-filter"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={payoutStatusFilter}
                        onChange={(event) =>
                          setPayoutStatusFilter(event.target.value)
                        }
                      >
                        <option value="">{t("common.allStatuses")}</option>
                        <option value="PENDING_APPROVAL">
                          {enumLabel("payoutStatuses", "PENDING_APPROVAL")}
                        </option>
                        <option value="APPROVED">
                          {enumLabel("payoutStatuses", "APPROVED")}
                        </option>
                        <option value="REJECTED">
                          {enumLabel("payoutStatuses", "REJECTED")}
                        </option>
                        <option value="PAID">
                          {enumLabel("payoutStatuses", "PAID")}
                        </option>
                        <option value="VOID">
                          {enumLabel("payoutStatuses", "VOID")}
                        </option>
                      </select>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">
                        {t("payouts.register.visiblePayouts")}
                      </p>
                      <p className="text-2xl font-semibold">
                        {filteredPayoutRegister.length}
                      </p>
                    </div>
                  </div>
                  {canApprovePayout || canPayPayout || canVoidPayout ? (
                    <div className="grid gap-4 md:grid-cols-5">
                      <div className="space-y-2">
                        <Label htmlFor="action-note">
                          {t("payouts.register.actionNote")}
                        </Label>
                        <Input
                          id="action-note"
                          placeholder={t("common.enterNote")}
                          value={payoutActionForm.note}
                          onChange={(event) =>
                            setPayoutActionForm((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment-method">
                          {t("payouts.register.paymentMethod")}
                        </Label>
                        <select
                          id="payment-method"
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={payoutActionForm.paymentMethod}
                          onChange={(event) =>
                            setPayoutActionForm((current) => ({
                              ...current,
                              paymentMethod: event.target.value as
                                | "BANK_TRANSFER"
                                | "MOBILE_BANKING"
                                | "CHEQUE"
                                | "CASH",
                            }))
                          }
                        >
                          <option value="BANK_TRANSFER">
                            {enumLabel("paymentMethods", "BANK_TRANSFER")}
                          </option>
                          <option value="MOBILE_BANKING">
                            {enumLabel("paymentMethods", "MOBILE_BANKING")}
                          </option>
                          <option value="CHEQUE">
                            {enumLabel("paymentMethods", "CHEQUE")}
                          </option>
                          <option value="CASH">
                            {enumLabel("paymentMethods", "CASH")}
                          </option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bank-reference">
                          {t("payouts.register.bankReference")}
                        </Label>
                        <Input
                          id="bank-reference"
                          placeholder={t("payouts.register.referencePlaceholder")}
                          value={payoutActionForm.bankReference}
                          onChange={(event) =>
                            setPayoutActionForm((current) => ({
                              ...current,
                              bankReference: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paid-at">
                          {t("payouts.register.paidAt")}
                        </Label>
                        <Input
                          id="paid-at"
                          type="datetime-local"
                          value={payoutActionForm.paidAt}
                          onChange={(event) =>
                            setPayoutActionForm((current) => ({
                              ...current,
                              paidAt: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="void-reason">
                          {t("payouts.register.voidReason")}
                        </Label>
                        <Input
                          id="void-reason"
                          placeholder={t("payouts.register.reasonPlaceholder")}
                          value={payoutActionForm.voidReason}
                          onChange={(event) =>
                            setPayoutActionForm((current) => ({
                              ...current,
                              voidReason: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.payout")}</TableHead>
                        <TableHead>{t("common.run")}</TableHead>
                        <TableHead>{t("common.investor")}</TableHead>
                        <TableHead>{t("payouts.register.grossProfit")}</TableHead>
                        <TableHead>{t("payouts.register.holdback")}</TableHead>
                        <TableHead>{t("payouts.register.payoutAmount")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead>{t("common.method")}</TableHead>
                        <TableHead>{t("payouts.register.bankRef")}</TableHead>
                        <TableHead>{t("common.timeline")}</TableHead>
                        <TableHead>{t("payouts.register.ledgerTransaction")}</TableHead>
                        {canApprovePayout || canPayPayout || canVoidPayout ? (
                          <TableHead>{t("common.actions")}</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayoutRegister.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/investors/payouts/${item.id}`}
                              className="hover:text-primary"
                            >
                              {item.payoutNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/investors/profit-runs/${item.run.id}`}
                              className="hover:text-primary"
                            >
                              {item.run.runNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div>
                              {item.investor.name} ({item.investor.code})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("payouts.register.beneficiary", {
                                status: item.investor.beneficiaryVerifiedAt
                                  ? t("payouts.register.beneficiaryVerified")
                                  : t("payouts.register.beneficiaryPending"),
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.grossProfitAmount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.holdbackAmount).toFixed(2)} (
                            {Number(item.holdbackPercent).toFixed(2)}%)
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(item.payoutAmount).toFixed(2)}{" "}
                            {item.currency}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                item.status === "PAID"
                                  ? "bg-green-100 text-green-800"
                                  : item.status === "APPROVED"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.status === "PENDING_APPROVAL"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : item.status === "VOID"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {enumLabel("payoutStatuses", item.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.paymentMethod
                              ? enumLabel("paymentMethods", item.paymentMethod)
                              : "-"}
                          </TableCell>
                          <TableCell>{item.bankReference || "-"}</TableCell>
                          <TableCell className="text-xs">
                            <div>
                              {t("payouts.register.timelineApproved")}: {" "}
                              {item.approvedAt
                                ? item.approvedAt.slice(0, 10)
                                : "-"}
                            </div>
                            <div>
                              {t("payouts.register.timelineHeld")}: {" "}
                              {item.heldAt ? item.heldAt.slice(0, 10) : "-"}
                            </div>
                            <div>
                              {t("payouts.register.timelineReleased")}: {" "}
                              {item.releasedAt
                                ? item.releasedAt.slice(0, 10)
                                : "-"}
                            </div>
                            <div>
                              {t("payouts.register.timelinePaid")}: {" "}
                              {item.paidAt ? item.paidAt.slice(0, 10) : "-"}
                            </div>
                            <div>
                              {t("payouts.register.timelineVoided")}: {" "}
                              {item.voidedAt ? item.voidedAt.slice(0, 10) : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.transaction?.transactionNumber ?? "-"}
                          </TableCell>
                          {canApprovePayout || canPayPayout || canVoidPayout ? (
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {canApprovePayout &&
                                item.status === "PENDING_APPROVAL" ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        void processPayoutAction(
                                          item.id,
                                          "approve",
                                        )
                                      }
                                      disabled={actingPayoutId === item.id}
                                    >
                                      {t("common.approve")}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        void processPayoutAction(
                                          item.id,
                                          "reject",
                                        )
                                      }
                                      disabled={actingPayoutId === item.id}
                                    >
                                      {t("common.reject")}
                                    </Button>
                                  </>
                                ) : null}
                                {canPayPayout && item.status === "APPROVED" ? (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void processPayoutAction(item.id, "pay")
                                    }
                                    disabled={actingPayoutId === item.id}
                                  >
                                    {t("common.pay")}
                                  </Button>
                                ) : null}
                                {canVoidPayout &&
                                (item.status === "APPROVED" ||
                                  item.status === "PAID") ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      void processPayoutAction(item.id, "void")
                                    }
                                    disabled={actingPayoutId === item.id}
                                  >
                                    {t("common.void")}
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                      {filteredPayoutRegister.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={
                              canApprovePayout || canPayPayout || canVoidPayout
                                ? 12
                                : 11
                            }
                            className="text-center text-sm text-muted-foreground"
                          >
                            {t("payouts.register.empty")}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("payouts.permissions.view")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {canAccessSelectedSection && showSection("allocations") ? (
        <Tabs defaultValue="form" className="space-y-4">
          <TabsList className="flex h-9 w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground [&>*]:shrink-0">
            <TabsTrigger
              value="form"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("allocations.tabs.create")}
            </TabsTrigger>
            <TabsTrigger
              value="allocations"
              className="inline-flex items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
            >
              {t("allocations.tabs.view")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="space-y-4">
            {canManageAllocations ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("allocations.form.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("allocations.form.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="allocation-investor">
                        {t("common.investor")}
                      </Label>
                      <select
                        id="allocation-investor"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={allocationForm.investorId}
                        onChange={(event) =>
                          setAllocationForm((current) => ({
                            ...current,
                            investorId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t("common.selectInvestor")}</option>
                        {investors.map((investor) => (
                          <option key={investor.id} value={investor.id}>
                            {investor.name} ({investor.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allocation-variant">
                        {t("common.productVariant")}
                      </Label>
                      <select
                        id="allocation-variant"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={allocationForm.productVariantId}
                        onChange={(event) =>
                          setAllocationForm((current) => ({
                            ...current,
                            productVariantId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t("common.selectVariant")}</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.product.name} ({variant.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allocation-participation">
                        {t("allocations.form.participationPercent")}
                      </Label>
                      <Input
                        id="allocation-participation"
                        placeholder={t("common.enterPercentage")}
                        value={allocationForm.participationPercent}
                        onChange={(event) =>
                          setAllocationForm((current) => ({
                            ...current,
                            participationPercent: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allocation-committed">
                        {t("allocations.form.committedAmount")}
                      </Label>
                      <Input
                        id="allocation-committed"
                        placeholder={t("common.enterAmount")}
                        value={allocationForm.committedAmount}
                        onChange={(event) =>
                          setAllocationForm((current) => ({
                            ...current,
                            committedAmount: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void createAllocation()}
                      disabled={
                        !allocationForm.investorId ||
                        !allocationForm.productVariantId
                      }
                      className="min-w-[120px]"
                    >
                      {t("allocations.form.submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("allocations.permissions.create")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="allocations" className="space-y-4">
            {canReadAllocations ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {t("allocations.list.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("allocations.list.description")}
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.allocation")}</TableHead>
                          <TableHead>{t("common.investor")}</TableHead>
                          <TableHead>{t("common.variant")}</TableHead>
                          <TableHead>
                            {t("allocations.form.participationPercent")}
                          </TableHead>
                          <TableHead>{t("allocations.list.committed")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead className="text-right">
                            {t("common.action")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((item) => (
                          <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/investors/allocations/${item.id}`}
                              className="hover:text-primary"
                            >
                              {t("allocations.list.allocationNumber", {
                                id: item.id,
                              })}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {t("allocations.list.openDetailHint")}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link
                              href={`/admin/investors/${item.investor.id}`}
                              className="hover:text-primary"
                            >
                              {item.investor.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {t("allocations.list.investorProfile")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.productVariant.product.name} ({item.productVariant.sku})
                          </TableCell>
                          <TableCell className="text-right">
                            {item.participationPercent || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.committedAmount || "-"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                item.status === "ACTIVE"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {enumLabel("allocationStatuses", item.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/investors/allocations/${item.id}`}>
                                {t("common.openDetail")}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {allocations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                            {t("allocations.list.empty")}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    {t("allocations.permissions.view")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}

      {canAccessSelectedSection &&
      showSection("statements") &&
      canReadStatement ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("statements.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("statements.description")}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="statement-investor">
                    {t("statements.filters.investorScope")}
                  </Label>
                  <div className="relative">
                    <select
                      id="statement-investor"
                      className="h-11 w-full rounded-lg border border-input bg-background px-4 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
                      value={selectedInvestorId}
                      onChange={(event) =>
                        setSelectedInvestorId(event.target.value)
                      }
                    >
                      <option value="">{t("common.allInvestors")}</option>
                      {investors.map((investor) => (
                        <option key={investor.id} value={investor.id}>
                          {investor.name} ({investor.code})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg
                        className="h-4 w-4 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement-from">
                    {t("common.from")}
                  </Label>
                  <Input
                    id="statement-from"
                    type="date"
                    value={statementFrom}
                    onChange={(event) => setStatementFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement-to">{t("common.to")}</Label>
                  <Input
                    id="statement-to"
                    type="date"
                    value={statementTo}
                    onChange={(event) => setStatementTo(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.actions")}</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void loadStatementPreview()}
                      disabled={loadingStatementPreview}
                    >
                      {loadingStatementPreview
                        ? t("common.refreshing")
                        : t("common.apply")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void exportStatementCsv()}
                      disabled={exportingStatement}
                    >
                      {exportingStatement
                        ? t("common.exporting")
                        : t("statements.actions.exportCsv")}
                    </Button>
                    <Button
                      onClick={() => void exportStatementPdfFile()}
                      disabled={exportingStatement}
                    >
                      {exportingStatement
                        ? t("common.exporting")
                        : t("statements.actions.exportPdf")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("statements.summary.investors")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {statementSummary.investorCount}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("statements.summary.transactions")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {statementSummary.transactionCount}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("statements.summary.payouts")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {statementSummary.payoutCount}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("statements.summary.totalCredit")}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatMoney(statementSummary.totalCredit, "BDT", locale)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("statements.summary.totalDebit")}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatMoney(statementSummary.totalDebit, "BDT", locale)}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("statements.summary.netMovement")}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatMoney(statementSummary.totalNet, "BDT", locale)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">
                      {t("statements.period.title")}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDateTime(
                        `${statementFrom || defaultStatementFrom}T00:00:00`,
                        locale,
                      )}{" "}
                      {t("common.toLowercase")} {" "}
                      {formatDateTime(
                        `${statementTo || defaultStatementTo}T23:59:59`,
                        locale,
                      )}
                    </p>
                  </div>
                  <div className="text-muted-foreground">
                    {t("statements.period.scope")}: {" "}
                    <span className="font-medium text-foreground">
                      {selectedInvestorId
                        ? investors.find(
                            (item) => String(item.id) === selectedInvestorId,
                          )?.name || t("statements.period.selectedInvestor")
                        : t("common.allInvestors")}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("statements.register.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("statements.register.description")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.investor")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.credit")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("common.debit")}
                    </TableHead>
                    <TableHead className="text-right">{t("common.net")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.transactions")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("common.payouts")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("common.detail")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementRows.map((row) => {
                    const isSelected =
                      String(row.investor.id) === statementDetailInvestorId;
                    return (
                      <TableRow key={row.investor.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <button
                              type="button"
                              className="text-left font-medium hover:text-primary"
                              onClick={() =>
                                setStatementDetailInvestorId(
                                  String(row.investor.id),
                                )
                              }
                            >
                              {row.investor.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {row.investor.code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {enumLabel("investorStatuses", row.investor.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(row.totals.credit, "BDT", locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(row.totals.debit, "BDT", locale)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(row.totals.net, "BDT", locale)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.counts.transactionCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.counts.payoutCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() =>
                              setStatementDetailInvestorId(
                                String(row.investor.id),
                              )
                            }
                          >
                            {isSelected
                              ? t("common.viewing")
                              : t("common.viewDetail")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {statementRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-sm text-muted-foreground"
                      >
                        {loadingStatementPreview
                          ? t("statements.register.loading")
                          : t("statements.register.empty")}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {selectedStatementDetail ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("statements.detail.title", {
                      investor: selectedStatementDetail.investor.name,
                    })}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("statements.detail.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-5">
                    <div className="rounded-lg border p-3 md:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("common.investor")}
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {selectedStatementDetail.investor.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedStatementDetail.investor.code}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("common.credit")}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatMoney(
                          selectedStatementDetail.totals.credit,
                          "BDT",
                          locale,
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("common.debit")}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatMoney(
                          selectedStatementDetail.totals.debit,
                          "BDT",
                          locale,
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("common.net")}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatMoney(
                          selectedStatementDetail.totals.net,
                          "BDT",
                          locale,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {t("statements.detail.ledgerTransactions")}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {t("common.itemCount", {
                          count:
                            selectedStatementDetail.counts.transactionCount,
                        })}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.number")}</TableHead>
                          <TableHead>{t("common.date")}</TableHead>
                          <TableHead>{t("common.type")}</TableHead>
                          <TableHead>{t("common.direction")}</TableHead>
                          <TableHead className="text-right">
                            {t("common.amount")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStatementDetail.transactions.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.transactionNumber}
                            </TableCell>
                            <TableCell>
                              {formatDateTime(item.transactionDate, locale)}
                            </TableCell>
                            <TableCell>
                              {enumLabel("transactionTypes", item.type)}
                            </TableCell>
                            <TableCell>
                              {enumLabel("directions", item.direction)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(item.amount, item.currency, locale)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {selectedStatementDetail.transactions.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center text-sm text-muted-foreground"
                            >
                              {t("statements.detail.noTransactions")}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("statements.detail.payoutActivity")}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("statements.detail.payoutDescription")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("statements.detail.payoutCount")}
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {selectedStatementDetail.counts.payoutCount}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("statements.detail.investorStatus")}
                      </p>
                      <p className="mt-1 font-medium">
                        {enumLabel(
                          "investorStatuses",
                          selectedStatementDetail.investor.status,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.payout")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead>{t("common.created")}</TableHead>
                        <TableHead>{t("common.paid")}</TableHead>
                        <TableHead className="text-right">
                          {t("common.amount")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedStatementDetail.payouts.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.payoutNumber}
                          </TableCell>
                          <TableCell>
                            {enumLabel("payoutStatuses", item.status)}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(item.createdAt, locale)}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(item.paidAt, locale)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(
                              item.payoutAmount,
                              item.currency,
                              locale,
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {selectedStatementDetail.payouts.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-sm text-muted-foreground"
                          >
                            {t("statements.detail.noPayouts")}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
