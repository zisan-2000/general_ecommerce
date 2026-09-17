"use client";

import React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Minus, User, CheckCircle, Clock } from "lucide-react";

interface Investor {
  id: string | number;
  name: string;
  code: string;
  status: string;
  kycStatus: string;
  totals: {
    credit: number;
    debit: number;
    balance: number;
  };
}

interface InvestorTableProps {
  investors: Investor[];
  className?: string;
}

export function InvestorTable({ investors, className = "" }: InvestorTableProps) {
  const t = useTranslations("AdminInvestors.table");
  const locale = useLocale();
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 shadow-sm";
      case "INACTIVE":
        return "bg-gradient-to-r from-gray-500 to-gray-600 text-white border-0 shadow-sm";
      case "SUSPENDED":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-sm";
      default:
        return "bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0 shadow-sm";
    }
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm";
      case "PENDING":
        return "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-sm";
      case "REJECTED":
        return "bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-sm";
      default:
        return "bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0 shadow-sm";
    }
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return <TrendingUp className="h-3 w-3" />;
    if (balance < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br from-white to-gray-50/50 shadow-lg ${className}`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 bg-gradient-to-r from-gray-50 to-gray-100/50">
              <TableHead className="w-[320px] py-4 text-sm font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t("headers.investor")}
                </div>
              </TableHead>
              <TableHead className="w-[110px] text-center text-sm font-semibold text-gray-700">
                {t("headers.status")}
              </TableHead>
              <TableHead className="w-[110px] text-center text-sm font-semibold text-gray-700">
                {t("headers.kycStatus")}
              </TableHead>
              <TableHead className="w-[130px] text-right text-sm font-semibold text-gray-700">
                {t("headers.credit")}
              </TableHead>
              <TableHead className="w-[130px] text-right text-sm font-semibold text-gray-700">
                {t("headers.debit")}
              </TableHead>
              <TableHead className="w-[130px] text-right text-sm font-semibold text-gray-700">
                {t("headers.balance")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {investors.map((investor, index) => (
              <TableRow
                key={investor.id}
                className="group border-b transition-all duration-200 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-transparent"
              >
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-gray-200 shadow-sm transition-all group-hover:border-primary/50 group-hover:shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-semibold">
                        {getInitials(investor.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <Link
                        href={`/admin/investors/${investor.id}`}
                        className="font-semibold text-gray-900 transition-colors hover:text-primary group-hover:text-primary"
                      >
                        {investor.name}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-gray-400">{t("idLabel")}</span>
                        <Link
                          href={`/admin/investors/${investor.id}`}
                          className="text-xs font-mono font-medium text-gray-500 hover:text-primary"
                        >
                          {investor.code}
                        </Link>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex justify-center">
                    <Badge className={`${getStatusColor(investor.status)} px-3 py-1 text-xs font-semibold shadow-sm`}>
                      {t.has(`statuses.${investor.status}` as any) ? t(`statuses.${investor.status}` as any) : investor.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex justify-center">
                    <Badge className={`${getKycStatusColor(investor.kycStatus)} px-3 py-1 text-xs font-semibold shadow-sm`}>
                      <div className="flex items-center gap-1">
                        {investor.kycStatus === "VERIFIED" && <CheckCircle className="h-2.5 w-2.5" />}
                        {investor.kycStatus === "PENDING" && <Clock className="h-2.5 w-2.5" />}
                        {t.has(`kycStatuses.${investor.kycStatus}` as any) ? t(`kycStatuses.${investor.kycStatus}` as any) : investor.kycStatus}
                      </div>
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="py-4 text-right">
                  <div className="space-y-0.5">
                    <div className="font-mono text-sm font-medium text-emerald-600">
                      {Number(investor.totals.credit).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-400">{t("totalCredits")}</div>
                  </div>
                </TableCell>
                <TableCell className="py-4 text-right">
                  <div className="space-y-0.5">
                    <div className="font-mono text-sm font-medium text-red-600">
                      {Number(investor.totals.debit).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-400">{t("totalDebits")}</div>
                  </div>
                </TableCell>
                <TableCell className="py-4 text-right">
                  <div className="space-y-0.5">
                    <div
                      className={`flex items-center justify-end gap-1 font-mono text-sm font-bold ${
                        Number(investor.totals.balance) > 0
                          ? "text-emerald-600"
                          : Number(investor.totals.balance) < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {getBalanceIcon(Number(investor.totals.balance))}
                      {Number(investor.totals.balance).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-400">{t("currentBalance")}</div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {investors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-gray-100 p-4 mb-3">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">{t("empty.title")}</p>
          <p className="text-xs text-gray-400 mt-1">{t("empty.description")}</p>
        </div>
      )}
    </div>
  );
}
