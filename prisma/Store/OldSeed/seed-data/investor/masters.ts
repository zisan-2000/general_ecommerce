import {
  INVESTOR_MASTER_RECORDS,
  INVESTOR_PORTAL_USERS,
  INVESTOR_SEED_PASSWORD,
  INVESTOR_SEED_VARIANT_SKUS,
} from "./constants";
import { daysAgo, daysFromNow, upsertInvestorUserWithRole } from "./helpers";
import type { InvestorSeedContext, InvestorSeedPrisma } from "./types";
import {
  InvestorDocumentType,
  InvestorDocumentVerificationStatus,
  InvestorPortalAccessStatus,
} from "../../../generated/prisma";

const VERIFIED_DOCUMENT_TYPES = [
  InvestorDocumentType.IDENTITY_PROOF,
  InvestorDocumentType.TAX_IDENTIFICATION,
  InvestorDocumentType.BANK_PROOF,
  InvestorDocumentType.ADDRESS_PROOF,
  InvestorDocumentType.INVESTMENT_AGREEMENT,
  InvestorDocumentType.SOURCE_OF_FUNDS,
] as const;

function documentStatusForInvestor(
  kycStatus: string,
  index: number,
): InvestorDocumentVerificationStatus {
  if (kycStatus === "VERIFIED") return InvestorDocumentVerificationStatus.VERIFIED;
  if (kycStatus === "REJECTED") return InvestorDocumentVerificationStatus.REJECTED;
  if (kycStatus === "UNDER_REVIEW") return InvestorDocumentVerificationStatus.UNDER_REVIEW;
  return index <= 2
    ? InvestorDocumentVerificationStatus.PENDING
    : InvestorDocumentVerificationStatus.UNDER_REVIEW;
}

export async function seedInvestorMasters(
  prisma: InvestorSeedPrisma,
  ctx: InvestorSeedContext,
): Promise<InvestorSeedContext> {
  const nextCtx: InvestorSeedContext = {
    ...ctx,
    users: { ...ctx.users },
    investors: { ...ctx.investors },
    variants: { ...ctx.variants },
  };

  for (const sku of INVESTOR_SEED_VARIANT_SKUS) {
    const variant = await prisma.productVariant.findFirst({
      where: { sku },
      select: {
        id: true,
        sku: true,
        productId: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!variant) {
      console.warn(
        `⚠️ Investor seed variant not found, skipping variant context: ${sku}`,
      );
      continue;
    }

    nextCtx.variants[sku] = {
      id: variant.id,
      sku: variant.sku,
      productId: variant.productId,
      productName: variant.product.name,
    };
  }

  for (const record of INVESTOR_MASTER_RECORDS) {
    const verifiedAt = record.kycStatus === "VERIFIED" ? daysAgo(20) : null;
    const beneficiaryVerifiedAt = record.beneficiaryVerified ? daysAgo(18) : null;

    const investor = await prisma.investor.upsert({
      where: { code: record.code },
      update: {
        name: record.name,
        legalName: record.legalName,
        email: record.email,
        phone: record.phone,
        taxNumber: record.taxNumber,
        nationalIdNumber: record.nationalIdNumber,
        passportNumber: null,
        bankName: record.bankName,
        bankAccountName: record.bankAccountName,
        bankAccountNumber: record.bankAccountNumber,
        status: record.status,
        kycStatus: record.kycStatus,
        kycVerifiedAt: verifiedAt,
        kycReference: `${record.code}-KYC`,
        beneficiaryVerifiedAt,
        beneficiaryVerifiedById: record.beneficiaryVerified ? ctx.adminUserId : null,
        beneficiaryVerificationNote: record.beneficiaryVerified
          ? "Seeded verified beneficiary for investor payout testing."
          : "Seeded unverified beneficiary state for exception testing.",
        notes: record.note,
        createdById: ctx.adminUserId ?? undefined,
      },
      create: {
        code: record.code,
        name: record.name,
        legalName: record.legalName,
        email: record.email,
        phone: record.phone,
        taxNumber: record.taxNumber,
        nationalIdNumber: record.nationalIdNumber,
        passportNumber: null,
        bankName: record.bankName,
        bankAccountName: record.bankAccountName,
        bankAccountNumber: record.bankAccountNumber,
        status: record.status,
        kycStatus: record.kycStatus,
        kycVerifiedAt: verifiedAt,
        kycReference: `${record.code}-KYC`,
        beneficiaryVerifiedAt,
        beneficiaryVerifiedById: record.beneficiaryVerified ? ctx.adminUserId : null,
        beneficiaryVerificationNote: record.beneficiaryVerified
          ? "Seeded verified beneficiary for investor payout testing."
          : "Seeded unverified beneficiary state for exception testing.",
        notes: record.note,
        createdById: ctx.adminUserId ?? null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
      },
    });

    nextCtx.investors[record.key] = investor;

    let documentIndex = 0;
    for (const documentType of VERIFIED_DOCUMENT_TYPES) {
      documentIndex += 1;
      const status = documentStatusForInvestor(record.kycStatus, documentIndex);
      const reviewedAt =
        status === InvestorDocumentVerificationStatus.VERIFIED ||
        status === InvestorDocumentVerificationStatus.REJECTED
          ? daysAgo(15)
          : null;

      await prisma.investorDocument.upsert({
        where: {
          investorId_type: {
            investorId: investor.id,
            type: documentType,
          },
        },
        update: {
          fileUrl: `/seed/investor/${record.code.toLowerCase()}/${documentType.toLowerCase()}.pdf`,
          fileName: `${documentType.toLowerCase()}.pdf`,
          mimeType: "application/pdf",
          fileSize: 128000 + documentIndex * 1000,
          documentNumber: `${record.code}-${documentType}`,
          issuedAt: daysAgo(180),
          expiresAt:
            documentType === InvestorDocumentType.INVESTMENT_AGREEMENT
              ? null
              : daysFromNow(365),
          status,
          reviewNote:
            status === InvestorDocumentVerificationStatus.VERIFIED
              ? "Seeded verified investor document."
              : status === InvestorDocumentVerificationStatus.REJECTED
                ? "Seeded rejected document state for KYC testing."
                : "Seeded pending/under-review investor document.",
          uploadedById: ctx.adminUserId,
          reviewedById: reviewedAt ? ctx.adminUserId : null,
          reviewedAt,
        },
        create: {
          investorId: investor.id,
          type: documentType,
          fileUrl: `/seed/investor/${record.code.toLowerCase()}/${documentType.toLowerCase()}.pdf`,
          fileName: `${documentType.toLowerCase()}.pdf`,
          mimeType: "application/pdf",
          fileSize: 128000 + documentIndex * 1000,
          documentNumber: `${record.code}-${documentType}`,
          issuedAt: daysAgo(180),
          expiresAt:
            documentType === InvestorDocumentType.INVESTMENT_AGREEMENT
              ? null
              : daysFromNow(365),
          status,
          reviewNote:
            status === InvestorDocumentVerificationStatus.VERIFIED
              ? "Seeded verified investor document."
              : status === InvestorDocumentVerificationStatus.REJECTED
                ? "Seeded rejected document state for KYC testing."
                : "Seeded pending/under-review investor document.",
          uploadedById: ctx.adminUserId,
          reviewedById: reviewedAt ? ctx.adminUserId : null,
          reviewedAt,
        },
      });
    }

    const existingMonthlySchedule = await prisma.investorStatementSchedule.findFirst({
      where: {
        investorId: investor.id,
        frequency: "MONTHLY",
      },
      select: { id: true },
    });

    const scheduleData = {
      deliveryFormat: "BOTH" as const,
      statementWindowDays: 30,
      status: "ACTIVE" as const,
      nextRunAt: daysFromNow(7),
      lastRunAt: daysAgo(23),
      lastDispatchedAt:
        record.kycStatus === "VERIFIED" && record.status === "ACTIVE"
          ? daysAgo(22)
          : null,
      lastDispatchNote: "Seeded monthly investor statement schedule.",
      createdById: ctx.adminUserId,
      updatedById: ctx.adminUserId,
    };

    if (existingMonthlySchedule) {
      await prisma.investorStatementSchedule.update({
        where: { id: existingMonthlySchedule.id },
        data: scheduleData,
      });
    } else {
      await prisma.investorStatementSchedule.create({
        data: {
          investorId: investor.id,
          frequency: "MONTHLY",
          ...scheduleData,
        },
      });
    }
  }

  for (const record of INVESTOR_PORTAL_USERS) {
    const investor = nextCtx.investors[record.investorKey];
    if (!investor) {
      console.warn(
        `⚠️ Investor portal user skipped, missing investor key: ${record.investorKey}`,
      );
      continue;
    }

    const portalUser = await upsertInvestorUserWithRole(prisma, {
      email: record.email,
      password: INVESTOR_SEED_PASSWORD,
      name: record.name,
      roleName: "investor_portal",
      phone: record.phone,
      note: "Seeded investor portal user",
    });

    nextCtx.users[record.key] = {
      id: portalUser.id,
      email: portalUser.email,
      name: portalUser.name ?? record.name,
      roleName: "investor_portal",
    };

    await prisma.investorPortalAccess.upsert({
      where: { userId: portalUser.id },
      update: {
        investorId: investor.id,
        status: record.status as InvestorPortalAccessStatus,
        note: "Seeded investor portal access.",
        createdById: ctx.adminUserId,
      },
      create: {
        userId: portalUser.id,
        investorId: investor.id,
        status: record.status as InvestorPortalAccessStatus,
        note: "Seeded investor portal access.",
        createdById: ctx.adminUserId,
      },
    });
  }

  console.log(
    `✅ Investor masters ensured: ${Object.keys(nextCtx.investors).length} investors, ${Object.keys(nextCtx.variants).length} variant refs, ${INVESTOR_PORTAL_USERS.length} portal access records`,
  );

  return nextCtx;
}
