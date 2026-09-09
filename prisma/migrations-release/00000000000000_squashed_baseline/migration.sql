-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StoreFeatureKey" AS ENUM ('PC_BUILDER', 'BOOKS', 'AUTHORS', 'COMPARE', 'DIGITAL_PRODUCTS', 'SERVICE_PRODUCTS', 'BUNDLES');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL', 'SERVICE', 'BUNDLE');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'COLOR');

-- CreateEnum
CREATE TYPE "InventoryItemClass" AS ENUM ('CONSUMABLE', 'PERMANENT');

-- CreateEnum
CREATE TYPE "ProductCodeKind" AS ENUM ('BARCODE', 'QRCODE');

-- CreateEnum
CREATE TYPE "ProductCodeSymbology" AS ENUM ('CODE128', 'EAN13', 'QR');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SUPERVISOR_ENDORSED', 'PROJECT_MANAGER_ENDORSED', 'ADMIN_APPROVED', 'PARTIALLY_RELEASED', 'RELEASED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialRequestApprovalStage" AS ENUM ('SUBMISSION', 'SUPERVISOR_ENDORSEMENT', 'PROJECT_MANAGER_ENDORSEMENT', 'ADMIN_APPROVAL', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "MaterialRequestApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialReleaseStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetRegisterStatus" AS ENUM ('ACTIVE', 'RETIRED', 'LOST', 'DISPOSED');

-- CreateEnum
CREATE TYPE "InventoryVerificationFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InventoryVerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COMMITTEE_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InventoryVerificationApprovalStage" AS ENUM ('SUBMISSION', 'COMMITTEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "InventoryVerificationApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReorderAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_APPROVED', 'TREASURY_PROCESSING', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentRequestApprovalStage" AS ENUM ('DRAFT', 'SUBMISSION', 'MANAGER_REVIEW', 'FINANCE_REVIEW', 'TREASURY', 'PAID', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PaymentRequestApprovalDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAID');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourierType" AS ENUM ('PATHAO', 'REDX', 'STEADFAST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BannerType" AS ENUM ('HERO', 'BANNER1', 'BANNER2', 'PROMOTION', 'POPUP');

-- CreateEnum
CREATE TYPE "AnalyticsEventName" AS ENUM ('session_start', 'page_view', 'heartbeat');

-- CreateEnum
CREATE TYPE "SearchEventType" AS ENUM ('SEARCH_SUBMITTED', 'SUGGESTION_CLICKED', 'RESULTS_VIEWED', 'RESULT_CLICKED', 'ZERO_RESULTS', 'FILTER_APPLIED', 'ADD_TO_CART', 'PURCHASE_COMPLETED');

-- CreateEnum
CREATE TYPE "SearchRuleMatchType" AS ENUM ('EXACT', 'PREFIX', 'CONTAINS');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "AccessScopeType" AS ENUM ('GLOBAL', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('NID', 'PASSPORT');

-- CreateEnum
CREATE TYPE "DeliveryManStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "DeliveryApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryManDocumentType" AS ENUM ('PROFILE_PHOTO', 'IDENTITY_FRONT', 'IDENTITY_BACK', 'FATHER_IDENTITY_FRONT', 'FATHER_IDENTITY_BACK', 'MOTHER_IDENTITY_FRONT', 'MOTHER_IDENTITY_BACK', 'REFERENCE_IDENTITY_FRONT', 'REFERENCE_IDENTITY_BACK', 'BANK_CHEQUE', 'BOND', 'CONTRACT_PAPER', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'REJECTED', 'PICKUP_CONFIRMED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PickupProofStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfqInvitationStatus" AS ENUM ('INVITED', 'RESUBMISSION_REQUESTED', 'RESPONDED', 'DECLINED', 'AWARDED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RfqAwardStatus" AS ENUM ('AWARDED', 'CONVERTED_TO_PO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComparativeStatementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'COMMITTEE_APPROVED', 'FINAL_APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComparativeStatementApprovalStage" AS ENUM ('DRAFT', 'SUBMISSION', 'MANAGER_REVIEW', 'COMMITTEE_REVIEW', 'FINAL_APPROVAL', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "ComparativeStatementApprovalDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderApprovalStage" AS ENUM ('DRAFT', 'SUBMISSION', 'MANAGER_REVIEW', 'COMMITTEE_REVIEW', 'FINAL_APPROVAL', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PurchaseOrderApprovalDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'BUDGET_CLEARED', 'ENDORSED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseRequisitionApprovalStage" AS ENUM ('PLANNING', 'SUBMISSION', 'BUDGET_CLEARANCE', 'ENDORSEMENT', 'FINAL_APPROVAL', 'ROUTED_TO_PROCUREMENT', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PurchaseRequisitionApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkflowNotificationChannel" AS ENUM ('SYSTEM', 'EMAIL');

-- CreateEnum
CREATE TYPE "WorkflowNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'COMMITTEE_APPROVED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderLandedCostComponent" AS ENUM ('FREIGHT', 'CUSTOMS', 'HANDLING', 'INSURANCE', 'CLEARING', 'OTHER');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoodsReceiptAttachmentType" AS ENUM ('CHALLAN', 'BILL', 'OTHER');

-- CreateEnum
CREATE TYPE "GoodsReceiptEvaluatorRole" AS ENUM ('REQUESTER', 'PROCUREMENT', 'ADMINISTRATION');

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierSlaEvaluationStatus" AS ENUM ('OK', 'WARNING', 'BREACH');

-- CreateEnum
CREATE TYPE "SupplierPortalAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SupplierDocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupplierProfileUpdateRequestType" AS ENUM ('PROFILE_UPDATE', 'DOCUMENT_UPDATE', 'ANNUAL_RENEWAL');

-- CreateEnum
CREATE TYPE "SupplierProfileUpdateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplierFeedbackSourceType" AS ENUM ('INTERNAL', 'CLIENT', 'VENDOR_SELF');

-- CreateEnum
CREATE TYPE "SupplierPortalNotificationType" AS ENUM ('GENERAL', 'DOCUMENT_EXPIRY', 'APPROVAL', 'RFQ', 'WORK_ORDER', 'PAYMENT');

-- CreateEnum
CREATE TYPE "SupplierProposalAttachmentType" AS ENUM ('TECHNICAL', 'FINANCIAL', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "InvestorPortalAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SupplierSlaSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SupplierSlaActionStatus" AS ENUM ('NOT_REQUIRED', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SupplierSlaDisputeStatus" AS ENUM ('NONE', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplierSlaTerminationCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "SupplierSlaTerminationAction" AS ENUM ('WATCHLIST', 'SUSPEND_NEW_PO', 'REVIEW_CONTRACT', 'TERMINATE_RELATIONSHIP');

-- CreateEnum
CREATE TYPE "SupplierCompanyType" AS ENUM ('PROPRIETOR', 'LIMITED_COMPANY');

-- CreateEnum
CREATE TYPE "SupplierDocumentType" AS ENUM ('PROPRIETOR_NID', 'TRADE_LICENSE', 'PROPRIETOR_DETAILS', 'PROPRIETOR_VISITING_CARD', 'DECLARATION', 'SEAL', 'SIGNATURE', 'DIRECTORS_NID_DETAILS', 'CERTIFICATE_OF_INCORPORATION', 'TAX_IDENTIFICATION_NUMBER', 'BOARD_RESOLUTION', 'VAT_REGISTRATION', 'TAX_COMPLIANCE_CERTIFICATE', 'BANK_INFORMATION');

-- CreateEnum
CREATE TYPE "ReplenishmentStrategy" AS ENUM ('MIN_MAX', 'REORDER_POINT');

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierInvoicePaymentHoldStatus" AS ENUM ('CLEAR', 'HELD', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "SupplierInvoiceSlaCreditStatus" AS ENUM ('NONE', 'RECOMMENDED', 'APPLIED', 'WAIVED');

-- CreateEnum
CREATE TYPE "SupplierPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'CHEQUE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('INVOICE', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SupplierLedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "InvestorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InvestorKycStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvestorDocumentType" AS ENUM ('IDENTITY_PROOF', 'TAX_IDENTIFICATION', 'BANK_PROOF', 'ADDRESS_PROOF', 'INVESTMENT_AGREEMENT', 'SOURCE_OF_FUNDS');

-- CreateEnum
CREATE TYPE "InvestorDocumentVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvestorMasterChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvestorProfileUpdateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvestorWithdrawalRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvestorPortalNotificationType" AS ENUM ('PROFILE_UPDATE_REQUEST', 'PROFILE_UPDATE_APPROVED', 'PROFILE_UPDATE_REJECTED', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_STATUS', 'DOCUMENT_REVIEW', 'PAYOUT_STATUS', 'STATEMENT_READY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InvestorPortalNotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "InvestorInternalNotificationType" AS ENUM ('PROFILE_REQUEST', 'DOCUMENT_REVIEW', 'PROFIT_RUN', 'PAYOUT', 'WITHDRAWAL', 'STATEMENT_SCHEDULE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InvestorInternalNotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "CustomerNotificationType" AS ENUM ('PRICE_DROP', 'CART_REMINDER');

-- CreateEnum
CREATE TYPE "CustomerNotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "InvestorStatementScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "InvestorStatementScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "InvestorStatementDeliveryFormat" AS ENUM ('CSV', 'PDF', 'BOTH');

-- CreateEnum
CREATE TYPE "InvestorTransactionType" AS ENUM ('CAPITAL_COMMITMENT', 'CAPITAL_CONTRIBUTION', 'PROFIT_ALLOCATION', 'LOSS_ALLOCATION', 'DISTRIBUTION', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvestorLedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "InvestorProfitRunStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED');

-- CreateEnum
CREATE TYPE "InvestorProfitExpenseAllocationBasis" AS ENUM ('NET_REVENUE', 'NET_UNITS');

-- CreateEnum
CREATE TYPE "InvestorProfitPayoutStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvestorPayoutPaymentMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_BANKING', 'CHEQUE', 'CASH');

-- CreateEnum
CREATE TYPE "ThreeWayMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'VARIANCE');

-- CreateEnum
CREATE TYPE "WarehouseTransferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrganizationCompanyType" AS ENUM ('PROPRIETORSHIP', 'PARTNERSHIP', 'LIMITED_COMPANY', 'PUBLIC_LIMITED', 'NGO', 'GOVERNMENT', 'EDUCATIONAL_INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrganizationCapabilityType" AS ENUM ('CORPORATE_BUYER', 'AFFILIATE', 'RESELLER', 'DEALER', 'MARKETING_PARTNER', 'SERVICE_PARTNER');

-- CreateEnum
CREATE TYPE "OrganizationCapabilityStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrganizationPortalRole" AS ENUM ('OWNER', 'ADMIN', 'BUYER', 'APPROVER', 'FINANCE', 'PARTNER_MANAGER', 'PARTNER_MARKETER', 'PARTNER_FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrganizationAddressType" AS ENUM ('REGISTERED', 'BILLING', 'SHIPPING', 'BRANCH');

-- CreateEnum
CREATE TYPE "OrganizationDocumentType" AS ENUM ('TRADE_LICENSE', 'TIN', 'BIN', 'CERTIFICATE_OF_INCORPORATION', 'BOARD_RESOLUTION', 'OWNER_NID', 'DIRECTOR_NID', 'BANK_DOCUMENT', 'TAX_COMPLIANCE_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BusinessAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BusinessPriceScopeType" AS ENUM ('GLOBAL', 'PRODUCT', 'VARIANT', 'CATEGORY', 'BRAND');

-- CreateEnum
CREATE TYPE "BusinessPriceAdjustmentType" AS ENUM ('FIXED_PRICE', 'PERCENT_DISCOUNT', 'AMOUNT_DISCOUNT');

-- CreateEnum
CREATE TYPE "BusinessPriceSource" AS ENUM ('PUBLIC', 'TIER', 'CONTRACT', 'QUOTATION');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('RETAIL', 'CORPORATE', 'RESELLER', 'DEALER');

-- CreateEnum
CREATE TYPE "CustomerPurchaseOrderStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PartnerAgreementStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PartnerAgreementVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerAttributionModel" AS ENUM ('FIRST_CLICK', 'LAST_CLICK', 'LEAD_OWNER');

-- CreateEnum
CREATE TYPE "PartnerAssetType" AS ENUM ('REFERRAL_LINK', 'REFERRAL_CODE', 'PROMO_CODE');

-- CreateEnum
CREATE TYPE "PartnerAssetStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PartnerAttributionSource" AS ENUM ('REFERRAL_LINK', 'REFERRAL_CODE', 'PROMO_CODE', 'REGISTERED_LEAD', 'MANUAL');

-- CreateEnum
CREATE TYPE "PartnerAttributionStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerLeadStatus" AS ENUM ('SUBMITTED', 'VALIDATING', 'ACCEPTED', 'DUPLICATE', 'ASSIGNED', 'IN_PROGRESS', 'WON', 'LOST', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommissionPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommissionScopeType" AS ENUM ('GLOBAL', 'PRODUCT', 'VARIANT', 'CATEGORY', 'BRAND', 'PRODUCT_TYPE', 'LEAD');

-- CreateEnum
CREATE TYPE "CommissionCalculationType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('GROSS_ITEM', 'NET_ITEM', 'ORDER_NET', 'LEAD_VALUE');

-- CreateEnum
CREATE TYPE "CommissionEntryType" AS ENUM ('EARNING', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'HOLD', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PartnerSettlementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerPayoutAccountType" AS ENUM ('BANK', 'MOBILE_WALLET');

-- CreateEnum
CREATE TYPE "PartnerPayoutAccountStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CreditLedgerEntryType" AS ENUM ('CREDIT_DRAW', 'REPAYMENT', 'CREDIT_NOTE', 'DEBIT_ADJUSTMENT', 'CREDIT_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditLedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "SalesRfqStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesQuotationStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesQuotationVersionStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'SUPERSEDED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BusinessFraudRuleType" AS ENUM ('SELF_REFERRAL', 'DUPLICATE_LEAD', 'REPEATED_CANCELLED_REFERRALS', 'REPEATED_REFUND_REFERRALS', 'SAME_ORGANIZATION', 'SAME_USER', 'SAME_PHONE', 'SAME_EMAIL', 'SUSPICIOUS_IP', 'SUSPICIOUS_DEVICE', 'UNUSUAL_CONVERSION_RATE', 'COMMISSION_SPIKE');

-- CreateEnum
CREATE TYPE "BusinessRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BusinessRiskCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BusinessNotificationCategory" AS ENUM ('ORGANIZATION', 'SALES', 'FINANCE', 'PARTNERSHIP', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BusinessNotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BusinessNotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "BusinessNotificationDeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "phone" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" INTEGER,
    "note" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "scopeType" "AccessScopeType" NOT NULL DEFAULT 'GLOBAL',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "warehouseId" INTEGER,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Writer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Writer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "parentId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "showInHeader" BOOLEAN NOT NULL DEFAULT true,
    "showInFooter" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "sku" TEXT,
    "categoryId" INTEGER NOT NULL,
    "brandId" INTEGER,
    "writerId" INTEGER,
    "publisherId" INTEGER,
    "description" TEXT NOT NULL,
    "shortDesc" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "originalPrice" DECIMAL(10,2),
    "flashSaleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "flashSalePrice" DECIMAL(10,2),
    "flashSaleStartsAt" TIMESTAMP(3),
    "flashSaleEndsAt" TIMESTAMP(3),
    "flashSaleSortOrder" INTEGER NOT NULL DEFAULT 0,
    "cartReminderMinutes" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "weight" DOUBLE PRECISION,
    "dimensions" JSONB,
    "VatClassId" INTEGER,
    "digitalAssetId" INTEGER,
    "serviceDurationMinutes" INTEGER,
    "serviceLocation" TEXT,
    "serviceOnlineLink" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "gallery" TEXT[],
    "videoUrl" TEXT,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "inventoryItemClass" "InventoryItemClass" NOT NULL DEFAULT 'CONSUMABLE',
    "requiresAssetTag" BOOLEAN NOT NULL DEFAULT false,
    "bundleStockLimit" INTEGER,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookMetadata" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "writerId" INTEGER,
    "publisherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBundleItem" (
    "id" SERIAL NOT NULL,
    "bundleId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "digitalAssetId" INTEGER,
    "options" JSONB NOT NULL,
    "colorImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "costPrice" DECIMAL(10,2),

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantOption" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariantOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantOptionValue" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCode" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "kind" "ProductCodeKind" NOT NULL,
    "symbology" "ProductCodeSymbology" NOT NULL,
    "value" TEXT NOT NULL,
    "token" TEXT,
    "imageUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAsset" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageProvider" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "mimeType" TEXT,
    "maxDownloads" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalDelivery" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "digitalAssetId" INTEGER NOT NULL,
    "downloadLimit" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadLog" (
    "id" SERIAL NOT NULL,
    "digitalDeliveryId" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL DEFAULT 'SELECT',
    "unit" TEXT,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeValue" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "attributeId" INTEGER NOT NULL,

    CONSTRAINT "AttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAttribute" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isVariant" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,6),
    "valueBoolean" BOOLEAN,
    "attributeValueId" INTEGER,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatClass" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatRate" (
    "id" SERIAL NOT NULL,
    "VatClassId" INTEGER NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "regionCode" VARCHAR(10),
    "rate" DECIMAL(6,4) NOT NULL,
    "inclusive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone_number" TEXT NOT NULL,
    "alt_phone_number" TEXT,
    "country" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "address_details" TEXT NOT NULL,
    "image" TEXT,
    "payment_method" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(14,2) NOT NULL,
    "shipping_cost" DECIMAL(14,2) NOT NULL,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "Vat_total" DECIMAL(14,2),
    "discount_total" DECIMAL(14,2),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "couponId" TEXT,
    "taxSnapshot" JSONB,
    "organizationId" TEXT,
    "salesChannel" "SalesChannel" NOT NULL DEFAULT 'RETAIL',
    "salesQuotationVersionId" TEXT,
    "commercialContext" JSONB,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "amount" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "provider" TEXT,
    "status" "PaymentState" NOT NULL DEFAULT 'INITIATED',
    "externalId" TEXT,
    "paymentGatewayData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "VatAmount" DECIMAL(14,2),
    "discountAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "costPriceSnapshot" DECIMAL(14,2),
    "priceSource" "BusinessPriceSource",
    "publicUnitPriceSnapshot" DECIMAL(14,2),
    "businessDiscountSnapshot" DECIMAL(14,2),

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSlot" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBooking" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "orderItemId" INTEGER,
    "userId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "productId" INTEGER NOT NULL,
    "feature" BOOLEAN DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "productId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "answeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "variantId" INTEGER,
    "lineKey" VARCHAR(80) NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastReminderAt" TIMESTAMP(3),

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceDropAlert" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "baselinePrice" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceDropAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNotification" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CustomerNotificationType" NOT NULL,
    "status" "CustomerNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetUrl" TEXT,
    "productId" INTEGER,
    "variantId" INTEGER,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blog" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "author" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "ads" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "courier" TEXT NOT NULL,
    "courierId" INTEGER,
    "trackingNumber" TEXT,
    "externalId" TEXT,
    "trackingUrl" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "courierStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveryConfirmationPin" TEXT,
    "deliveryConfirmationRequestedAt" TIMESTAMP(3),
    "deliveryConfirmationToken" TEXT,
    "actualCost" DECIMAL(10,2),
    "assignedAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "dispatchNote" TEXT,
    "estimatedCost" DECIMAL(10,2),
    "fuelCost" DECIMAL(10,2),
    "handlingCost" DECIMAL(10,2),
    "outForDeliveryAt" TIMESTAMP(3),
    "packagingCost" DECIMAL(10,2),
    "pickedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "shippingRateId" INTEGER,
    "thirdPartyCost" DECIMAL(10,2),

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryProof" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "userId" TEXT,
    "tickReceived" BOOLEAN NOT NULL,
    "tickCorrectItems" BOOLEAN NOT NULL,
    "tickGoodCondition" BOOLEAN NOT NULL,
    "photoUrl" TEXT,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CourierType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "secretKey" TEXT,
    "clientId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "area" TEXT,
    "country" TEXT DEFAULT 'BD',
    "coverageRadiusKm" DOUBLE PRECISION,
    "district" TEXT,
    "division" TEXT,
    "geoFence" JSONB,
    "isMapEnabled" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "locationNote" TEXT,
    "longitude" DOUBLE PRECISION,
    "mapLabel" TEXT,
    "postCode" TEXT,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" SERIAL NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BD',
    "area" TEXT NOT NULL,
    "baseCost" DECIMAL(10,2) NOT NULL,
    "weightSlabs" JSONB,
    "freeMinOrder" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "district" TEXT,
    "courierId" INTEGER,
    "deliveryType" TEXT,
    "estimatedDays" INTEGER,
    "warehouseId" INTEGER,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" SERIAL NOT NULL,
    "stockLevelId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "userId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDailySnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "status" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "warehouseId" INTEGER,

    CONSTRAINT "InventoryDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryWarehouseDailySnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryWarehouseDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStatusLog" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "fromStatus" "ShipmentStatus",
    "toStatus" "ShipmentStatus" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentCostLog" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "costType" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentAssignment" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT,
    "warehouseId" INTEGER,
    "role" TEXT,
    "note" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ShipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollProfile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "warehouseId" INTEGER,
    "employeeCode" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "baseSalary" DECIMAL(10,2) NOT NULL,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "accountHolder" TEXT,
    "mobileBankingNo" TEXT,
    "paymentMethod" TEXT,
    "joiningDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" SERIAL NOT NULL,
    "payrollPeriodId" INTEGER NOT NULL,
    "payrollProfileId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "warehouseId" INTEGER,
    "basicAmount" DECIMAL(10,2) NOT NULL,
    "overtimeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" SERIAL NOT NULL,
    "payrollEntryId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" TEXT,
    "paymentId" INTEGER,
    "orderItemId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amount" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "warehouseId" INTEGER,
    "change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyType" "SupplierCompanyType" NOT NULL DEFAULT 'PROPRIETOR',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'BD',
    "leadTimeDays" INTEGER,
    "paymentTermsDays" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "taxNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "type" "SupplierDocumentType" NOT NULL,
    "documentNumber" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verificationStatus" "SupplierDocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verificationNote" TEXT,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" SERIAL NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "PurchaseRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "purpose" TEXT,
    "budgetCode" TEXT,
    "boqReference" TEXT,
    "specification" TEXT,
    "planningNote" TEXT,
    "estimatedAmount" DECIMAL(14,2),
    "endorsementRequiredCount" INTEGER NOT NULL DEFAULT 1,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "neededBy" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "budgetClearedAt" TIMESTAMP(3),
    "endorsedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "routedToProcurementAt" TIMESTAMP(3),
    "createdById" TEXT,
    "budgetClearedById" TEXT,
    "endorsedById" TEXT,
    "approvedById" TEXT,
    "convertedById" TEXT,
    "assignedProcurementOfficerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionItem" (
    "id" SERIAL NOT NULL,
    "purchaseRequisitionId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityApproved" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequisitionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionAttachment" (
    "id" SERIAL NOT NULL,
    "purchaseRequisitionId" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequisitionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionApprovalEvent" (
    "id" SERIAL NOT NULL,
    "purchaseRequisitionId" INTEGER NOT NULL,
    "stage" "PurchaseRequisitionApprovalStage" NOT NULL,
    "decision" "PurchaseRequisitionApprovalDecision" NOT NULL,
    "note" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequisitionApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionVersion" (
    "id" SERIAL NOT NULL,
    "purchaseRequisitionId" INTEGER NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "stage" "PurchaseRequisitionApprovalStage" NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequisitionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionNotification" (
    "id" SERIAL NOT NULL,
    "purchaseRequisitionId" INTEGER NOT NULL,
    "stage" "PurchaseRequisitionApprovalStage" NOT NULL,
    "channel" "WorkflowNotificationChannel" NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "PurchaseRequisitionNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseZone" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseAisle" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseAisle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseBin" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "aisleId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseBin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBinLevel" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "binId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBinLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryVerification" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "frequency" "InventoryVerificationFrequency" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "InventoryVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryVerificationCommitteeMember" (
    "id" SERIAL NOT NULL,
    "verificationId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryVerificationCommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryVerificationLine" (
    "id" SERIAL NOT NULL,
    "verificationId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "binId" INTEGER,
    "systemQty" INTEGER NOT NULL,
    "countedQty" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "InventoryVerificationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryVerificationApprovalEvent" (
    "id" SERIAL NOT NULL,
    "verificationId" INTEGER NOT NULL,
    "stage" "InventoryVerificationApprovalStage" NOT NULL,
    "decision" "InventoryVerificationApprovalDecision" NOT NULL,
    "note" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryVerificationApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReorderAlert" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "stockOnHand" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "suggestedQty" INTEGER NOT NULL,
    "status" "ReorderAlertStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReorderAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequest" (
    "id" SERIAL NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "purpose" TEXT,
    "budgetCode" TEXT,
    "boqReference" TEXT,
    "specification" TEXT,
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "supervisorEndorsedAt" TIMESTAMP(3),
    "supervisorEndorsedById" TEXT,
    "projectManagerEndorsedAt" TIMESTAMP(3),
    "projectManagerEndorsedById" TEXT,
    "adminApprovedAt" TIMESTAMP(3),
    "adminApprovedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestItem" (
    "id" SERIAL NOT NULL,
    "materialRequestId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityReleased" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestAttachment" (
    "id" SERIAL NOT NULL,
    "materialRequestId" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequestApprovalEvent" (
    "id" SERIAL NOT NULL,
    "materialRequestId" INTEGER NOT NULL,
    "stage" "MaterialRequestApprovalStage" NOT NULL,
    "decision" "MaterialRequestApprovalDecision" NOT NULL,
    "note" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequestApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReleaseNote" (
    "id" SERIAL NOT NULL,
    "releaseNumber" TEXT NOT NULL,
    "challanNumber" TEXT,
    "waybillNumber" TEXT,
    "materialRequestId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "MaterialReleaseStatus" NOT NULL DEFAULT 'ISSUED',
    "note" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialReleaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReleaseNoteItem" (
    "id" SERIAL NOT NULL,
    "materialReleaseNoteId" INTEGER NOT NULL,
    "materialRequestItemId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "quantityReleased" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReleaseNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRegister" (
    "id" SERIAL NOT NULL,
    "assetTag" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "materialRequestId" INTEGER,
    "materialReleaseNoteId" INTEGER,
    "materialReleaseItemId" INTEGER,
    "status" "AssetRegisterStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedTo" TEXT,
    "note" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPortalAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "status" "SupplierPortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" TEXT,
    "twoFactorLastVerifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "SupplierPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierProfileUpdateRequest" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestType" "SupplierProfileUpdateRequestType" NOT NULL DEFAULT 'PROFILE_UPDATE',
    "status" "SupplierProfileUpdateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "note" TEXT,
    "reviewNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProfileUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierFeedback" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "sourceType" "SupplierFeedbackSourceType" NOT NULL DEFAULT 'INTERNAL',
    "sourceReference" TEXT,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "rating" INTEGER NOT NULL,
    "serviceQualityRating" INTEGER,
    "deliveryRating" INTEGER,
    "complianceRating" INTEGER,
    "comment" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPortalNotification" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "userId" TEXT,
    "channel" "WorkflowNotificationChannel" NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "type" "SupplierPortalNotificationType" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPortalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorPortalAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "investorId" INTEGER NOT NULL,
    "status" "InvestorPortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "InvestorPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxNumber" TEXT,
    "nationalIdNumber" TEXT,
    "passportNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "beneficiaryVerifiedAt" TIMESTAMP(3),
    "beneficiaryVerifiedById" TEXT,
    "beneficiaryVerificationNote" TEXT,
    "status" "InvestorStatus" NOT NULL DEFAULT 'ACTIVE',
    "kycStatus" "InvestorKycStatus" NOT NULL DEFAULT 'PENDING',
    "kycVerifiedAt" TIMESTAMP(3),
    "kycReference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorCapitalTransaction" (
    "id" SERIAL NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "investorId" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "InvestorTransactionType" NOT NULL,
    "direction" "InvestorLedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "note" TEXT,
    "referenceType" TEXT,
    "referenceNumber" TEXT,
    "productVariantId" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorCapitalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProductAllocation" (
    "id" SERIAL NOT NULL,
    "investorId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "participationPercent" DECIMAL(5,2),
    "committedAmount" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProductAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfitRun" (
    "id" SERIAL NOT NULL,
    "runNumber" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" "InvestorProfitRunStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "allocationBasis" "InvestorProfitExpenseAllocationBasis" NOT NULL,
    "marketingExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adsExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "logisticsExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOperatingExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNetRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNetCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNetProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "postingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfitRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfitRunVariant" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "unitsRefunded" INTEGER NOT NULL DEFAULT 0,
    "unitsNet" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netCogs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allocatedExpense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unallocatedSharePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfitRunVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfitRunAllocation" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "variantLineId" INTEGER NOT NULL,
    "investorId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "sourceAllocationId" INTEGER,
    "participationSharePct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "allocatedRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allocatedNetProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfitRunAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfitPayout" (
    "id" SERIAL NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "runId" INTEGER NOT NULL,
    "investorId" INTEGER NOT NULL,
    "transactionId" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "payoutPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "holdbackPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "grossProfitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "holdbackAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payoutAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "beneficiaryNameSnapshot" TEXT,
    "beneficiaryBankNameSnapshot" TEXT,
    "beneficiaryAccountNumberSnapshot" TEXT,
    "beneficiaryVerifiedAt" TIMESTAMP(3),
    "beneficiaryVerificationNote" TEXT,
    "status" "InvestorProfitPayoutStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvalNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paymentMethod" "InvestorPayoutPaymentMethod",
    "bankReference" TEXT,
    "paidById" TEXT,
    "note" TEXT,
    "holdReason" TEXT,
    "heldAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseNote" TEXT,
    "paymentProofUrl" TEXT,
    "paymentProofUploadedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidReversalReference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfitPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorWithdrawalRequest" (
    "id" SERIAL NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "investorId" INTEGER NOT NULL,
    "transactionId" INTEGER,
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "approvedAmount" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "availableBalanceSnapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activeCommittedAmountSnapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingPayoutAmountSnapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "withdrawableBalanceSnapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "beneficiaryNameSnapshot" TEXT,
    "beneficiaryBankNameSnapshot" TEXT,
    "beneficiaryAccountNumberSnapshot" TEXT,
    "beneficiaryVerifiedAt" TIMESTAMP(3),
    "status" "InvestorWithdrawalRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedSettlementDate" TIMESTAMP(3),
    "requestNote" TEXT,
    "reviewNote" TEXT,
    "rejectionReason" TEXT,
    "settlementNote" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "settledById" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" SERIAL NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "purchaseRequisitionId" INTEGER,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionDeadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "scopeOfWork" TEXT,
    "termsAndConditions" TEXT,
    "boqDetails" TEXT,
    "technicalSpecifications" TEXT,
    "evaluationCriteria" TEXT,
    "resubmissionAllowed" BOOLEAN NOT NULL DEFAULT true,
    "resubmissionRound" INTEGER NOT NULL DEFAULT 0,
    "lastResubmissionRequestedAt" TIMESTAMP(3),
    "lastResubmissionReason" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "note" TEXT,
    "sourceRequisitionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqItem" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "targetUnitCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqSupplierInvite" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "status" "RfqInvitationStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "resubmissionRequestedAt" TIMESTAMP(3),
    "resubmissionReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqSupplierInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotation" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "rfqSupplierInviteId" INTEGER,
    "status" "QuotationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "revisionNo" INTEGER NOT NULL DEFAULT 1,
    "resubmissionRound" INTEGER NOT NULL DEFAULT 0,
    "resubmissionNote" TEXT,
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "submittedById" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "technicalProposal" TEXT,
    "financialProposal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationItem" (
    "id" SERIAL NOT NULL,
    "supplierQuotationId" INTEGER NOT NULL,
    "rfqItemId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityQuoted" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationAttachment" (
    "id" SERIAL NOT NULL,
    "supplierQuotationId" INTEGER NOT NULL,
    "proposalType" "SupplierProposalAttachmentType" NOT NULL DEFAULT 'SUPPORTING',
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierQuotationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqAward" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplierQuotationId" INTEGER NOT NULL,
    "status" "RfqAwardStatus" NOT NULL DEFAULT 'AWARDED',
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedById" TEXT,
    "purchaseOrderId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCategory" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCategorySupplier" (
    "id" SERIAL NOT NULL,
    "supplierCategoryId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCategorySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqCategoryTarget" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "supplierCategoryId" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqCategoryTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqAttachment" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqNotification" (
    "id" SERIAL NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "inviteId" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "channel" "WorkflowNotificationChannel" NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeStatement" (
    "id" SERIAL NOT NULL,
    "csNumber" TEXT NOT NULL,
    "rfqId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "versionNo" INTEGER NOT NULL DEFAULT 1,
    "status" "ComparativeStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStage" "ComparativeStatementApprovalStage" NOT NULL DEFAULT 'DRAFT',
    "technicalWeight" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "financialWeight" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "managerApprovedAt" TIMESTAMP(3),
    "committeeApprovedAt" TIMESTAMP(3),
    "finalApprovedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "managerApprovedById" TEXT,
    "committeeApprovedById" TEXT,
    "finalApprovedById" TEXT,
    "rejectedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "note" TEXT,
    "rejectionNote" TEXT,
    "sourceQuotationSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparativeStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeStatementLine" (
    "id" SERIAL NOT NULL,
    "comparativeStatementId" INTEGER NOT NULL,
    "supplierQuotationId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "financialSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "financialTaxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "financialGrandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "technicalScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "financialScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "combinedScore" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "isResponsive" BOOLEAN NOT NULL DEFAULT true,
    "technicalNote" TEXT,
    "financialNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparativeStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeStatementApprovalEvent" (
    "id" SERIAL NOT NULL,
    "comparativeStatementId" INTEGER NOT NULL,
    "stage" "ComparativeStatementApprovalStage" NOT NULL,
    "decision" "ComparativeStatementApprovalDecision" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparativeStatementApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparativeStatementNotification" (
    "id" SERIAL NOT NULL,
    "comparativeStatementId" INTEGER NOT NULL,
    "stage" "ComparativeStatementApprovalStage" NOT NULL,
    "channel" "WorkflowNotificationChannel" NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparativeStatementNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseRequisitionId" INTEGER,
    "sourceComparativeStatementId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStage" "PurchaseOrderApprovalStage" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "managerApprovedAt" TIMESTAMP(3),
    "committeeApprovedAt" TIMESTAMP(3),
    "finalApprovedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "managerApprovedById" TEXT,
    "committeeApprovedById" TEXT,
    "finalApprovedById" TEXT,
    "rejectedById" TEXT,
    "termsTemplateId" INTEGER,
    "termsTemplateCode" TEXT,
    "termsTemplateName" TEXT,
    "termsAndConditions" TEXT,
    "rejectionNote" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderTermsTemplate" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderTermsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderApprovalEvent" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "stage" "PurchaseOrderApprovalStage" NOT NULL,
    "decision" "PurchaseOrderApprovalDecision" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderNotification" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "stage" "PurchaseOrderApprovalStage" NOT NULL,
    "channel" "WorkflowNotificationChannel" NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLandedCost" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "component" "PurchaseOrderLandedCostComponent" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "note" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLandedCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" SERIAL NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT,
    "requesterConfirmedAt" TIMESTAMP(3),
    "requesterConfirmedById" TEXT,
    "requesterConfirmationNote" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" SERIAL NOT NULL,
    "goodsReceiptId" INTEGER NOT NULL,
    "purchaseOrderItemId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptAttachment" (
    "id" SERIAL NOT NULL,
    "goodsReceiptId" INTEGER NOT NULL,
    "type" "GoodsReceiptAttachmentType" NOT NULL DEFAULT 'OTHER',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "note" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptVendorEvaluation" (
    "id" SERIAL NOT NULL,
    "goodsReceiptId" INTEGER NOT NULL,
    "evaluatorRole" "GoodsReceiptEvaluatorRole" NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "serviceQualityRating" INTEGER,
    "deliveryRating" INTEGER,
    "complianceRating" INTEGER,
    "comment" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceiptVendorEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'POSTED',
    "matchStatus" "ThreeWayMatchStatus" NOT NULL DEFAULT 'PENDING',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedById" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "paymentHoldStatus" "SupplierInvoicePaymentHoldStatus" NOT NULL DEFAULT 'CLEAR',
    "paymentHoldReason" TEXT,
    "paymentHoldAt" TIMESTAMP(3),
    "paymentHoldReleasedAt" TIMESTAMP(3),
    "paymentHoldReleasedById" TEXT,
    "paymentHoldOverrideNote" TEXT,
    "slaRecommendedCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "slaCreditStatus" "SupplierInvoiceSlaCreditStatus" NOT NULL DEFAULT 'NONE',
    "slaCreditReason" TEXT,
    "slaCreditUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceItem" (
    "id" SERIAL NOT NULL,
    "supplierInvoiceId" INTEGER NOT NULL,
    "purchaseOrderItemId" INTEGER,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityInvoiced" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" SERIAL NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplierInvoiceId" INTEGER,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "method" "SupplierPaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorMasterChangeRequest" (
    "id" SERIAL NOT NULL,
    "investorId" INTEGER NOT NULL,
    "status" "InvestorMasterChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedChanges" JSONB NOT NULL,
    "currentSnapshot" JSONB,
    "changeSummary" TEXT,
    "reviewNote" TEXT,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorMasterChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProfileUpdateRequest" (
    "id" SERIAL NOT NULL,
    "investorId" INTEGER NOT NULL,
    "status" "InvestorProfileUpdateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedChanges" JSONB NOT NULL,
    "currentSnapshot" JSONB,
    "requestNote" TEXT,
    "reviewNote" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorProfileUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorPortalNotification" (
    "id" SERIAL NOT NULL,
    "investorId" INTEGER NOT NULL,
    "type" "InvestorPortalNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InvestorPortalNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "targetUrl" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorPortalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorInternalNotification" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "InvestorInternalNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "InvestorInternalNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "targetUrl" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorInternalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorStatementSchedule" (
    "id" SERIAL NOT NULL,
    "investorId" INTEGER NOT NULL,
    "frequency" "InvestorStatementScheduleFrequency" NOT NULL,
    "deliveryFormat" "InvestorStatementDeliveryFormat" NOT NULL DEFAULT 'PDF',
    "statementWindowDays" INTEGER NOT NULL DEFAULT 30,
    "status" "InvestorStatementScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastDispatchedAt" TIMESTAMP(3),
    "lastDispatchNote" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorStatementSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorDocument" (
    "id" SERIAL NOT NULL,
    "investorId" INTEGER NOT NULL,
    "type" "InvestorDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "documentNumber" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "InvestorDocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "uploadedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" SERIAL NOT NULL,
    "prfNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "purchaseOrderId" INTEGER,
    "comparativeStatementId" INTEGER,
    "goodsReceiptId" INTEGER,
    "supplierInvoiceId" INTEGER,
    "supplierPaymentId" INTEGER,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStage" "PaymentRequestApprovalStage" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "managerApprovedAt" TIMESTAMP(3),
    "financeApprovedAt" TIMESTAMP(3),
    "treasuryProcessedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "managerApprovedById" TEXT,
    "financeApprovedById" TEXT,
    "treasuryProcessedById" TEXT,
    "rejectedById" TEXT,
    "cancelledById" TEXT,
    "note" TEXT,
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequestApprovalEvent" (
    "id" SERIAL NOT NULL,
    "paymentRequestId" INTEGER NOT NULL,
    "stage" "PaymentRequestApprovalStage" NOT NULL,
    "decision" "PaymentRequestApprovalDecision" NOT NULL,
    "note" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequestApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequestNotification" (
    "id" SERIAL NOT NULL,
    "paymentRequestId" INTEGER NOT NULL,
    "stage" "PaymentRequestApprovalStage" NOT NULL,
    "channel" "WorkflowNotificationChannel" NOT NULL,
    "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PaymentRequestNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLedgerEntry" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryType" "SupplierLedgerEntryType" NOT NULL,
    "direction" "SupplierLedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "note" TEXT,
    "referenceType" TEXT,
    "referenceNumber" TEXT,
    "purchaseOrderId" INTEGER,
    "supplierInvoiceId" INTEGER,
    "supplierPaymentId" INTEGER,
    "supplierReturnId" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" SERIAL NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER,
    "goodsReceiptId" INTEGER NOT NULL,
    "supplierInvoiceId" INTEGER,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "ledgerPostedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "dispatchedById" TEXT,
    "closedById" TEXT,
    "reasonCode" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnItem" (
    "id" SERIAL NOT NULL,
    "supplierReturnId" INTEGER NOT NULL,
    "goodsReceiptItemId" INTEGER,
    "purchaseOrderItemId" INTEGER,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityDispatched" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentRule" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "strategy" "ReplenishmentStrategy" NOT NULL DEFAULT 'MIN_MAX',
    "reorderPoint" INTEGER NOT NULL,
    "targetStockLevel" INTEGER NOT NULL,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "orderMultiple" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSlaPolicy" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "evaluationWindowDays" INTEGER NOT NULL DEFAULT 90,
    "minTrackedPoCount" INTEGER NOT NULL DEFAULT 3,
    "targetLeadTimeDays" INTEGER NOT NULL,
    "minimumOnTimeRate" DECIMAL(5,2) NOT NULL DEFAULT 90,
    "minimumFillRate" DECIMAL(5,2) NOT NULL DEFAULT 95,
    "maxOpenLatePoCount" INTEGER NOT NULL DEFAULT 0,
    "autoEvaluationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warningActionDueDays" INTEGER NOT NULL DEFAULT 7,
    "breachActionDueDays" INTEGER NOT NULL DEFAULT 3,
    "terminationClauseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "terminationLookbackDays" INTEGER NOT NULL DEFAULT 180,
    "terminationMinBreachCount" INTEGER NOT NULL DEFAULT 3,
    "terminationMinCriticalCount" INTEGER NOT NULL DEFAULT 1,
    "terminationRecommendedAction" "SupplierSlaTerminationAction" NOT NULL DEFAULT 'REVIEW_CONTRACT',
    "terminationNote" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSlaFinancialRule" (
    "id" SERIAL NOT NULL,
    "supplierSlaPolicyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "holdPaymentsOnThreeWayVariance" BOOLEAN NOT NULL DEFAULT true,
    "holdPaymentsOnOpenSlaAction" BOOLEAN NOT NULL DEFAULT true,
    "allowPaymentHoldOverride" BOOLEAN NOT NULL DEFAULT true,
    "autoCreditRecommendationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoApplyRecommendedCredit" BOOLEAN NOT NULL DEFAULT false,
    "autoApplyRequireMatchedInvoice" BOOLEAN NOT NULL DEFAULT true,
    "autoApplyBlockOnOpenDispute" BOOLEAN NOT NULL DEFAULT true,
    "warningPenaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "breachPenaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "criticalPenaltyRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "minBreachCountForCredit" INTEGER NOT NULL DEFAULT 1,
    "autoApplyMaxAmount" DECIMAL(12,2),
    "maxCreditCapAmount" DECIMAL(12,2),
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaFinancialRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSlaBreach" (
    "id" SERIAL NOT NULL,
    "supplierSlaPolicyId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "evaluationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "trackedPoCount" INTEGER NOT NULL DEFAULT 0,
    "completedPoCount" INTEGER NOT NULL DEFAULT 0,
    "openLatePoCount" INTEGER NOT NULL DEFAULT 0,
    "breachCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SupplierSlaEvaluationStatus" NOT NULL DEFAULT 'OK',
    "severity" "SupplierSlaSeverity" NOT NULL DEFAULT 'LOW',
    "observedLeadTimeDays" DECIMAL(8,2),
    "onTimeRatePercent" DECIMAL(5,2),
    "fillRatePercent" DECIMAL(5,2),
    "actionStatus" "SupplierSlaActionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "alertTriggeredAt" TIMESTAMP(3),
    "alertMessage" TEXT,
    "alertAcknowledgedAt" TIMESTAMP(3),
    "disputeStatus" "SupplierSlaDisputeStatus" NOT NULL DEFAULT 'NONE',
    "disputeReason" TEXT,
    "disputeRaisedAt" TIMESTAMP(3),
    "disputeRaisedById" TEXT,
    "disputeResolutionNote" TEXT,
    "disputeResolvedAt" TIMESTAMP(3),
    "disputeResolvedById" TEXT,
    "terminationCaseId" INTEGER,
    "terminationSuggestedAt" TIMESTAMP(3),
    "terminationSuggestionNote" TEXT,
    "issues" JSONB,
    "evaluatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaBreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSlaTerminationCase" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplierSlaPolicyId" INTEGER NOT NULL,
    "triggerBreachId" INTEGER,
    "status" "SupplierSlaTerminationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "recommendedAction" "SupplierSlaTerminationAction" NOT NULL DEFAULT 'REVIEW_CONTRACT',
    "openBreachCount" INTEGER NOT NULL DEFAULT 0,
    "criticalBreachCount" INTEGER NOT NULL DEFAULT 0,
    "lookbackDays" INTEGER NOT NULL DEFAULT 180,
    "reason" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSlaTerminationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransfer" (
    "id" SERIAL NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "sourceWarehouseId" INTEGER NOT NULL,
    "destinationWarehouseId" INTEGER NOT NULL,
    "status" "WarehouseTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "dispatchedById" TEXT,
    "receivedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransferItem" (
    "id" SERIAL NOT NULL,
    "warehouseTransferId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "description" TEXT,
    "quantityRequested" INTEGER NOT NULL,
    "quantityDispatched" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'subscribed',
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "minOrderValue" DECIMAL(10,2),
    "maxDiscount" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sitesettings" (
    "id" SERIAL NOT NULL,
    "logo" TEXT,
    "siteTitle" TEXT,
    "storeName" TEXT,
    "storeTagline" TEXT,
    "defaultSeoTitle" TEXT,
    "defaultSeoDescription" TEXT,
    "defaultSeoKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultOgImage" TEXT,
    "favicon" TEXT,
    "currency" VARCHAR(3),
    "currencyPosition" VARCHAR(8),
    "timezone" VARCHAR(64),
    "locale" VARCHAR(35),
    "storeType" VARCHAR(32),
    "footerDescription" TEXT,
    "contactNumber" TEXT,
    "contactEmail" TEXT,
    "address" TEXT,
    "facebookLink" TEXT,
    "instagramLink" TEXT,
    "twitterLink" TEXT,
    "tiktokLink" TEXT,
    "youtubeLink" TEXT,

    CONSTRAINT "sitesettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFeature" (
    "id" SERIAL NOT NULL,
    "key" "StoreFeatureKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "image" TEXT NOT NULL,
    "mobileImage" TEXT,
    "buttonText" TEXT,
    "buttonLink" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "type" "BannerType" NOT NULL DEFAULT 'HERO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryManProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "employeeCode" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "presentAddress" TEXT NOT NULL,
    "permanentAddress" TEXT NOT NULL,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "identityType" "IdentityType" NOT NULL,
    "identityNumber" TEXT NOT NULL,
    "passportExpiryDate" TIMESTAMP(3),
    "fatherName" TEXT NOT NULL,
    "fatherIdentityType" "IdentityType",
    "fatherIdentityNumber" TEXT,
    "motherName" TEXT NOT NULL,
    "motherIdentityType" "IdentityType",
    "motherIdentityNumber" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankChequeNumber" TEXT,
    "bondAmount" DECIMAL(10,2),
    "bondSignedAt" TIMESTAMP(3),
    "bondExpiryDate" TIMESTAMP(3),
    "contractSignedAt" TIMESTAMP(3),
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "contractStatus" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "status" "DeliveryManStatus" NOT NULL DEFAULT 'PENDING',
    "applicationStatus" "DeliveryApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "note" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryManProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryManReference" (
    "id" TEXT NOT NULL,
    "deliveryManProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relation" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "identityType" "IdentityType" NOT NULL DEFAULT 'NID',
    "identityNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryManReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryManDocument" (
    "id" TEXT NOT NULL,
    "deliveryManProfileId" TEXT NOT NULL,
    "referenceId" TEXT,
    "type" "DeliveryManDocumentType" NOT NULL,
    "title" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "note" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryManDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "deliveryManProfileId" TEXT NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "assignedById" TEXT,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "pickupProofStatus" "PickupProofStatus" NOT NULL DEFAULT 'PENDING',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "rejectionReason" TEXT,
    "note" TEXT,
    "latestNote" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "pickupConfirmedAt" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveredLatitude" DOUBLE PRECISION,
    "deliveredLongitude" DOUBLE PRECISION,
    "deliveredAccuracy" DOUBLE PRECISION,
    "failedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAssignmentLog" (
    "id" TEXT NOT NULL,
    "deliveryAssignmentId" TEXT NOT NULL,
    "fromStatus" "DeliveryAssignmentStatus",
    "toStatus" "DeliveryAssignmentStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAssignmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehousePickupProof" (
    "id" TEXT NOT NULL,
    "deliveryAssignmentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "status" "PickupProofStatus" NOT NULL DEFAULT 'PENDING',
    "productReceived" BOOLEAN NOT NULL,
    "packagingOk" BOOLEAN NOT NULL,
    "productInGoodCondition" BOOLEAN NOT NULL,
    "imageUrl" TEXT,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehousePickupProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" "AnalyticsEventName" NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "path" TEXT NOT NULL DEFAULT '/',
    "title" TEXT,
    "referrer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "screen" TEXT,
    "lang" TEXT,
    "country" TEXT,
    "city" TEXT,
    "active_seconds" INTEGER NOT NULL DEFAULT 0,
    "ip_hash" TEXT,
    "day_key" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchEvent" (
    "id" BIGSERIAL NOT NULL,
    "event" "SearchEventType" NOT NULL,
    "queryId" VARCHAR(64),
    "query" VARCHAR(100) NOT NULL,
    "normalizedQuery" VARCHAR(100) NOT NULL,
    "resultCount" INTEGER,
    "productId" INTEGER,
    "position" INTEGER,
    "visitorId" VARCHAR(100),
    "sessionId" VARCHAR(100),
    "userId" VARCHAR(100),
    "filters" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchSynonym" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "terms" TEXT[],
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en-BD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQueryRule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "query" VARCHAR(100) NOT NULL,
    "matchType" "SearchRuleMatchType" NOT NULL DEFAULT 'CONTAINS',
    "action" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchQueryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchIndexOutbox" (
    "id" BIGSERIAL NOT NULL,
    "dedupeKey" VARCHAR(160) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(80) NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndexOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_ip_cache" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "region" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "isp" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geo_ip_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestEmail" TEXT,
    "guestName" TEXT,
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ChatPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT,
    "companyType" "OrganizationCompanyType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'DRAFT',
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "tradeLicenseNo" TEXT,
    "tin" TEXT,
    "bin" TEXT,
    "registrationNo" TEXT,
    "country" VARCHAR(2) NOT NULL DEFAULT 'BD',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationCapability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "OrganizationCapabilityType" NOT NULL,
    "status" "OrganizationCapabilityStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMemberRoleGrant" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "OrganizationPortalRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "OrganizationMemberRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationPortalRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "OrganizationAddressType" NOT NULL,
    "label" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BD',
    "division" TEXT,
    "district" TEXT,
    "area" TEXT,
    "postCode" TEXT,
    "addressLine" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBranch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BD',
    "division" TEXT,
    "district" TEXT,
    "area" TEXT,
    "addressLine" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "OrganizationDocumentType" NOT NULL,
    "status" "OrganizationDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "documentNumber" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountNumber" VARCHAR(32) NOT NULL,
    "status" "BusinessAccountStatus" NOT NULL DEFAULT 'PENDING',
    "pricingTierId" TEXT,
    "accountManagerId" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 0,
    "allowCredit" BOOLEAN NOT NULL DEFAULT false,
    "allowCoupons" BOOLEAN NOT NULL DEFAULT false,
    "requirePo" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPricingTier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPricingRule" (
    "id" TEXT NOT NULL,
    "pricingTierId" TEXT NOT NULL,
    "scopeType" "BusinessPriceScopeType" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "adjustmentType" "BusinessPriceAdjustmentType" NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractPrice" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "scopeType" "BusinessPriceScopeType" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationCreditAccount" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "type" "CreditLedgerEntryType" NOT NULL,
    "direction" "CreditLedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "orderId" INTEGER,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRfq" (
    "id" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedByMemberId" TEXT NOT NULL,
    "status" "SalesRfqStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "requestedDelivery" TIMESTAMP(3),
    "quotationDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "assignedToUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesRfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRfqItem" (
    "id" TEXT NOT NULL,
    "salesRfqId" TEXT NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "productName" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "targetUnitPrice" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesRfqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRfqAttachment" (
    "id" TEXT NOT NULL,
    "salesRfqId" TEXT NOT NULL,
    "title" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRfqAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesRfqId" TEXT,
    "status" "SalesQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuotationVersion" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "SalesQuotationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shippingTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "warrantyTerms" TEXT,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "createdById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQuotationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuotationItem" (
    "id" TEXT NOT NULL,
    "quotationVersionId" TEXT NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "productName" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "quantity" INTEGER NOT NULL,
    "publicUnitPrice" DECIMAL(14,2),
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationId" TEXT,
    "customerPoNumber" TEXT NOT NULL,
    "status" "CustomerPurchaseOrderStatus" NOT NULL DEFAULT 'SUBMITTED',
    "fileUrl" TEXT NOT NULL,
    "poDate" TIMESTAMP(3),
    "expectedDeliveryAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "submittedByMemberId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "orderId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerCode" VARCHAR(32) NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'APPLIED',
    "accountManagerId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "status" "PartnerAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAgreementVersion" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PartnerAgreementVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "commissionPlanId" TEXT,
    "attributionModel" "PartnerAttributionModel" NOT NULL DEFAULT 'LAST_CLICK',
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
    "allowSelfReferral" BOOLEAN NOT NULL DEFAULT false,
    "minimumSettlement" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "territoryRules" JSONB,
    "categoryRules" JSONB,
    "commercialTerms" JSONB,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAgreementVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAsset" (
    "id" TEXT NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "type" "PartnerAssetType" NOT NULL,
    "status" "PartnerAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "code" VARCHAR(64) NOT NULL,
    "destinationPath" TEXT,
    "campaignName" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAttribution" (
    "id" TEXT NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "agreementVersionId" TEXT,
    "assetId" TEXT,
    "source" "PartnerAttributionSource" NOT NULL,
    "status" "PartnerAttributionStatus" NOT NULL DEFAULT 'ACTIVE',
    "visitorId" TEXT,
    "sessionId" TEXT,
    "customerUserId" TEXT,
    "orderId" INTEGER,
    "ipHash" TEXT,
    "deviceHash" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "PartnerAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerLead" (
    "id" TEXT NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "status" "PartnerLeadStatus" NOT NULL DEFAULT 'SUBMITTED',
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "requirement" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "assignedToUserId" TEXT,
    "ownershipExpiresAt" TIMESTAMP(3),
    "wonOrderId" INTEGER,
    "duplicateOfId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CommissionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "commissionPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "CommissionScopeType" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "productType" "ProductType",
    "calculationType" "CommissionCalculationType" NOT NULL,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'NET_ITEM',
    "rate" DECIMAL(8,4),
    "fixedAmount" DECIMAL(14,2),
    "minOrderAmount" DECIMAL(14,2),
    "minQuantity" INTEGER,
    "maxCommission" DECIMAL(14,2),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "agreementVersionId" TEXT,
    "commissionRuleId" TEXT,
    "type" "CommissionEntryType" NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" INTEGER,
    "orderItemId" INTEGER,
    "partnerLeadId" TEXT,
    "grossBasisAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netBasisAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rate" DECIMAL(8,4),
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "sourceEntryId" TEXT,
    "holdUntil" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "payableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSettlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" VARCHAR(32) NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "status" "PartnerSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossCommission" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "payoutAccountId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "processingAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "commissionEntryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayoutAccount" (
    "id" TEXT NOT NULL,
    "partnerProfileId" TEXT NOT NULL,
    "type" "PartnerPayoutAccountType" NOT NULL,
    "status" "PartnerPayoutAccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "accountName" TEXT NOT NULL,
    "bankName" TEXT,
    "branchName" TEXT,
    "routingNumber" TEXT,
    "providerName" TEXT,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberLast4" VARCHAR(4),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessAuditLog" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" TEXT,
    "memberId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "integrityNonce" VARCHAR(80) NOT NULL,
    "integrityHash" VARCHAR(64) NOT NULL,
    "integrityVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessFraudRule" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "type" "BusinessFraudRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "severity" "BusinessRiskSeverity" NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 50,
    "configuration" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessFraudRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRiskCase" (
    "id" TEXT NOT NULL,
    "caseNumber" VARCHAR(32) NOT NULL,
    "ruleId" TEXT NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "organizationId" TEXT,
    "partnerProfileId" TEXT,
    "attributionId" TEXT,
    "partnerLeadId" TEXT,
    "commissionEntryId" TEXT,
    "orderId" INTEGER,
    "severity" "BusinessRiskSeverity" NOT NULL,
    "status" "BusinessRiskCaseStatus" NOT NULL DEFAULT 'OPEN',
    "riskScore" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "assignedToUserId" TEXT,
    "reviewedByUserId" TEXT,
    "resolutionNote" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRiskCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "category" "BusinessNotificationCategory" NOT NULL,
    "priority" "BusinessNotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" VARCHAR(190) NOT NULL,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessNotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "BusinessNotificationChannel" NOT NULL,
    "status" "BusinessNotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "recipientAddress" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessNotificationPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "organizationEmail" BOOLEAN NOT NULL DEFAULT true,
    "salesEmail" BOOLEAN NOT NULL DEFAULT true,
    "financeEmail" BOOLEAN NOT NULL DEFAULT true,
    "partnershipEmail" BOOLEAN NOT NULL DEFAULT true,
    "securityEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_deletedAt_idx" ON "Role"("deletedAt");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "UserRole_warehouseId_idx" ON "UserRole"("warehouseId");

-- CreateIndex
CREATE INDEX "UserRole_assignedById_idx" ON "UserRole"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_scopeType_warehouseId_key" ON "UserRole"("userId", "roleId", "scopeType", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Writer_name_key" ON "Writer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_name_key" ON "Publisher"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_isActive_showInHeader_sortOrder_idx" ON "Category"("isActive", "showInHeader", "sortOrder");

-- CreateIndex
CREATE INDEX "Category_isActive_showInFooter_sortOrder_idx" ON "Category"("isActive", "showInFooter", "sortOrder");

-- CreateIndex
CREATE INDEX "Category_isActive_featured_sortOrder_idx" ON "Category"("isActive", "featured", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_deleted_available_createdAt_idx" ON "Product"("deleted", "available", "createdAt");

-- CreateIndex
CREATE INDEX "Product_deleted_available_soldCount_idx" ON "Product"("deleted", "available", "soldCount");

-- CreateIndex
CREATE INDEX "Product_deleted_available_basePrice_idx" ON "Product"("deleted", "available", "basePrice");

-- CreateIndex
CREATE INDEX "Product_deleted_available_featured_idx" ON "Product"("deleted", "available", "featured");

-- CreateIndex
CREATE INDEX "Product_deleted_available_flashSaleEnabled_flashSaleStartsA_idx" ON "Product"("deleted", "available", "flashSaleEnabled", "flashSaleStartsAt", "flashSaleEndsAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_deleted_available_idx" ON "Product"("categoryId", "deleted", "available");

-- CreateIndex
CREATE INDEX "Product_brandId_deleted_available_idx" ON "Product"("brandId", "deleted", "available");

-- CreateIndex
CREATE INDEX "Product_writerId_deleted_available_idx" ON "Product"("writerId", "deleted", "available");

-- CreateIndex
CREATE INDEX "Product_publisherId_deleted_available_idx" ON "Product"("publisherId", "deleted", "available");

-- CreateIndex
CREATE UNIQUE INDEX "BookMetadata_productId_key" ON "BookMetadata"("productId");

-- CreateIndex
CREATE INDEX "BookMetadata_writerId_idx" ON "BookMetadata"("writerId");

-- CreateIndex
CREATE INDEX "BookMetadata_publisherId_idx" ON "BookMetadata"("publisherId");

-- CreateIndex
CREATE INDEX "ProductBundleItem_bundleId_idx" ON "ProductBundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "ProductBundleItem_productId_idx" ON "ProductBundleItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBundleItem_bundleId_productId_key" ON "ProductBundleItem"("bundleId", "productId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_active_stock_idx" ON "ProductVariant"("productId", "active", "stock");

-- CreateIndex
CREATE INDEX "ProductVariantOption_productId_position_idx" ON "ProductVariantOption"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantOption_productId_name_key" ON "ProductVariantOption"("productId", "name");

-- CreateIndex
CREATE INDEX "ProductVariantOptionValue_optionId_position_idx" ON "ProductVariantOptionValue"("optionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantOptionValue_optionId_value_key" ON "ProductVariantOptionValue"("optionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCode_token_key" ON "ProductCode"("token");

-- CreateIndex
CREATE INDEX "ProductCode_productId_idx" ON "ProductCode"("productId");

-- CreateIndex
CREATE INDEX "ProductCode_variantId_idx" ON "ProductCode"("variantId");

-- CreateIndex
CREATE INDEX "ProductCode_kind_status_idx" ON "ProductCode"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCode_symbology_value_key" ON "ProductCode"("symbology", "value");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalDelivery_orderItemId_digitalAssetId_key" ON "DigitalDelivery"("orderItemId", "digitalAssetId");

-- CreateIndex
CREATE INDEX "CategoryAttribute_categoryId_sortOrder_idx" ON "CategoryAttribute"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "CategoryAttribute_attributeId_idx" ON "CategoryAttribute"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_attributeId_key" ON "CategoryAttribute"("categoryId", "attributeId");

-- CreateIndex
CREATE INDEX "Catalog_ProductAttribute_attribute_value_idx" ON "ProductAttribute"("attributeId", "value");

-- CreateIndex
CREATE INDEX "Catalog_ProductAttribute_product_attribute_idx" ON "ProductAttribute"("productId", "attributeId");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeId_valueNumber_idx" ON "ProductAttribute"("attributeId", "valueNumber");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeId_valueBoolean_idx" ON "ProductAttribute"("attributeId", "valueBoolean");

-- CreateIndex
CREATE INDEX "ProductAttribute_attributeValueId_idx" ON "ProductAttribute"("attributeValueId");

-- CreateIndex
CREATE UNIQUE INDEX "VatClass_code_key" ON "VatClass"("code");

-- CreateIndex
CREATE INDEX "VatRate_countryCode_regionCode_idx" ON "VatRate"("countryCode", "regionCode");

-- CreateIndex
CREATE INDEX "Order_organizationId_order_date_idx" ON "Order"("organizationId", "order_date");

-- CreateIndex
CREATE INDEX "Order_salesChannel_order_date_idx" ON "Order"("salesChannel", "order_date");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalId_key" ON "Payment"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBooking_orderItemId_key" ON "ServiceBooking"("orderItemId");

-- CreateIndex
CREATE INDEX "ServiceBooking_userId_idx" ON "ServiceBooking"("userId");

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_createdAt_idx" ON "ProductQuestion"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_userId_idx" ON "ProductQuestion"("userId");

-- CreateIndex
CREATE INDEX "ProductQuestion_answeredById_idx" ON "ProductQuestion"("answeredById");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE INDEX "CartItem_userId_lineKey_idx" ON "CartItem"("userId", "lineKey");

-- CreateIndex
CREATE INDEX "CartItem_updatedAt_lastReminderAt_idx" ON "CartItem"("updatedAt", "lastReminderAt");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_variantId_lineKey_key" ON "CartItem"("userId", "productId", "variantId", "lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE INDEX "PriceDropAlert_productId_active_idx" ON "PriceDropAlert"("productId", "active");

-- CreateIndex
CREATE INDEX "PriceDropAlert_variantId_active_idx" ON "PriceDropAlert"("variantId", "active");

-- CreateIndex
CREATE INDEX "PriceDropAlert_userId_active_updatedAt_idx" ON "PriceDropAlert"("userId", "active", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerNotification_userId_status_createdAt_idx" ON "CustomerNotification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerNotification_productId_createdAt_idx" ON "CustomerNotification"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Blog_slug_key" ON "Blog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_deliveryConfirmationToken_key" ON "Shipment"("deliveryConfirmationToken");

-- CreateIndex
CREATE INDEX "Shipment_courierId_idx" ON "Shipment"("courierId");

-- CreateIndex
CREATE INDEX "Shipment_shippingRateId_idx" ON "Shipment"("shippingRateId");

-- CreateIndex
CREATE INDEX "Shipment_assignedToUserId_idx" ON "Shipment"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Shipment_deliveryConfirmationRequestedAt_idx" ON "Shipment"("deliveryConfirmationRequestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryProof_shipmentId_key" ON "DeliveryProof"("shipmentId");

-- CreateIndex
CREATE INDEX "DeliveryProof_orderId_idx" ON "DeliveryProof"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryProof_userId_idx" ON "DeliveryProof"("userId");

-- CreateIndex
CREATE INDEX "DeliveryProof_confirmedAt_idx" ON "DeliveryProof"("confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_name_key" ON "Courier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "Warehouse_country_division_district_area_idx" ON "Warehouse"("country", "division", "district", "area");

-- CreateIndex
CREATE INDEX "Warehouse_latitude_longitude_idx" ON "Warehouse"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "WarehouseMembership_warehouseId_idx" ON "WarehouseMembership"("warehouseId");

-- CreateIndex
CREATE INDEX "WarehouseMembership_assignedById_idx" ON "WarehouseMembership"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseMembership_userId_warehouseId_key" ON "WarehouseMembership"("userId", "warehouseId");

-- CreateIndex
CREATE INDEX "ShippingRate_country_area_idx" ON "ShippingRate"("country", "area");

-- CreateIndex
CREATE INDEX "ShippingRate_isActive_priority_idx" ON "ShippingRate"("isActive", "priority");

-- CreateIndex
CREATE INDEX "ShippingRate_warehouseId_idx" ON "ShippingRate"("warehouseId");

-- CreateIndex
CREATE INDEX "ShippingRate_courierId_idx" ON "ShippingRate"("courierId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_warehouseId_productVariantId_key" ON "StockLevel"("warehouseId", "productVariantId");

-- CreateIndex
CREATE INDEX "InventoryDailySnapshot_snapshotDate_idx" ON "InventoryDailySnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryDailySnapshot_snapshotDate_variantId_key" ON "InventoryDailySnapshot"("snapshotDate", "variantId");

-- CreateIndex
CREATE INDEX "InventoryWarehouseDailySnapshot_snapshotDate_warehouseId_idx" ON "InventoryWarehouseDailySnapshot"("snapshotDate", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryWarehouseDailySnapshot_snapshotDate_variantId_ware_key" ON "InventoryWarehouseDailySnapshot"("snapshotDate", "variantId", "warehouseId");

-- CreateIndex
CREATE INDEX "ShipmentStatusLog_shipmentId_createdAt_idx" ON "ShipmentStatusLog"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentStatusLog_toStatus_createdAt_idx" ON "ShipmentStatusLog"("toStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentCostLog_shipmentId_createdAt_idx" ON "ShipmentCostLog"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentCostLog_createdById_idx" ON "ShipmentCostLog"("createdById");

-- CreateIndex
CREATE INDEX "ShipmentAssignment_shipmentId_idx" ON "ShipmentAssignment"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentAssignment_assignedToId_idx" ON "ShipmentAssignment"("assignedToId");

-- CreateIndex
CREATE INDEX "ShipmentAssignment_warehouseId_idx" ON "ShipmentAssignment"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProfile_userId_key" ON "PayrollProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProfile_employeeCode_key" ON "PayrollProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "PayrollProfile_warehouseId_idx" ON "PayrollProfile"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_startDate_endDate_key" ON "PayrollPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "PayrollEntry_payrollPeriodId_idx" ON "PayrollEntry"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollEntry_userId_idx" ON "PayrollEntry"("userId");

-- CreateIndex
CREATE INDEX "PayrollEntry_warehouseId_idx" ON "PayrollEntry"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_payrollPeriodId_payrollProfileId_key" ON "PayrollEntry"("payrollPeriodId", "payrollProfileId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_payrollEntryId_idx" ON "PayrollAdjustment"("payrollEntryId");

-- CreateIndex
CREATE INDEX "Refund_userId_idx" ON "Refund"("userId");

-- CreateIndex
CREATE INDEX "InventoryLog_orderId_variantId_warehouseId_idx" ON "InventoryLog"("orderId", "variantId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_companyType_idx" ON "Supplier"("companyType");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE INDEX "SupplierDocument_supplierId_idx" ON "SupplierDocument"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierDocument_type_idx" ON "SupplierDocument"("type");

-- CreateIndex
CREATE INDEX "SupplierDocument_expiresAt_idx" ON "SupplierDocument"("expiresAt");

-- CreateIndex
CREATE INDEX "SupplierDocument_verificationStatus_idx" ON "SupplierDocument"("verificationStatus");

-- CreateIndex
CREATE INDEX "SupplierDocument_verifiedById_idx" ON "SupplierDocument"("verifiedById");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDocument_supplierId_type_key" ON "SupplierDocument"("supplierId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_requisitionNumber_key" ON "PurchaseRequisition"("requisitionNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_warehouseId_status_idx" ON "PurchaseRequisition"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_createdById_idx" ON "PurchaseRequisition"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_approvedById_idx" ON "PurchaseRequisition"("approvedById");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_budgetClearedById_idx" ON "PurchaseRequisition"("budgetClearedById");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_endorsedById_idx" ON "PurchaseRequisition"("endorsedById");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_assignedProcurementOfficerId_idx" ON "PurchaseRequisition"("assignedProcurementOfficerId");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_requestedAt_idx" ON "PurchaseRequisition"("requestedAt");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionItem_purchaseRequisitionId_idx" ON "PurchaseRequisitionItem"("purchaseRequisitionId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionItem_productVariantId_idx" ON "PurchaseRequisitionItem"("productVariantId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionAttachment_purchaseRequisitionId_idx" ON "PurchaseRequisitionAttachment"("purchaseRequisitionId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionAttachment_uploadedById_idx" ON "PurchaseRequisitionAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionApprovalEvent_purchaseRequisitionId_stag_idx" ON "PurchaseRequisitionApprovalEvent"("purchaseRequisitionId", "stage");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionApprovalEvent_actedById_idx" ON "PurchaseRequisitionApprovalEvent"("actedById");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisitionApprovalEvent_purchaseRequisitionId_stag_key" ON "PurchaseRequisitionApprovalEvent"("purchaseRequisitionId", "stage", "actedById");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionVersion_purchaseRequisitionId_createdAt_idx" ON "PurchaseRequisitionVersion"("purchaseRequisitionId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionVersion_createdById_idx" ON "PurchaseRequisitionVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisitionVersion_purchaseRequisitionId_versionNo_key" ON "PurchaseRequisitionVersion"("purchaseRequisitionId", "versionNo");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionNotification_purchaseRequisitionId_stage_idx" ON "PurchaseRequisitionNotification"("purchaseRequisitionId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionNotification_recipientUserId_idx" ON "PurchaseRequisitionNotification"("recipientUserId");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionNotification_recipientUserId_readAt_idx" ON "PurchaseRequisitionNotification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionNotification_status_channel_idx" ON "PurchaseRequisitionNotification"("status", "channel");

-- CreateIndex
CREATE INDEX "WarehouseZone_warehouseId_isActive_idx" ON "WarehouseZone"("warehouseId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseZone_warehouseId_code_key" ON "WarehouseZone"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "WarehouseAisle_warehouseId_zoneId_idx" ON "WarehouseAisle"("warehouseId", "zoneId");

-- CreateIndex
CREATE INDEX "WarehouseAisle_isActive_idx" ON "WarehouseAisle"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseAisle_zoneId_code_key" ON "WarehouseAisle"("zoneId", "code");

-- CreateIndex
CREATE INDEX "WarehouseBin_warehouseId_zoneId_aisleId_idx" ON "WarehouseBin"("warehouseId", "zoneId", "aisleId");

-- CreateIndex
CREATE INDEX "WarehouseBin_isActive_idx" ON "WarehouseBin"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseBin_aisleId_code_key" ON "WarehouseBin"("aisleId", "code");

-- CreateIndex
CREATE INDEX "StockBinLevel_warehouseId_productVariantId_idx" ON "StockBinLevel"("warehouseId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBinLevel_binId_productVariantId_key" ON "StockBinLevel"("binId", "productVariantId");

-- CreateIndex
CREATE INDEX "InventoryVerification_warehouseId_periodStart_periodEnd_idx" ON "InventoryVerification"("warehouseId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "InventoryVerification_status_idx" ON "InventoryVerification"("status");

-- CreateIndex
CREATE INDEX "InventoryVerification_createdById_idx" ON "InventoryVerification"("createdById");

-- CreateIndex
CREATE INDEX "InventoryVerificationCommitteeMember_userId_idx" ON "InventoryVerificationCommitteeMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryVerificationCommitteeMember_verificationId_userId_key" ON "InventoryVerificationCommitteeMember"("verificationId", "userId");

-- CreateIndex
CREATE INDEX "InventoryVerificationLine_verificationId_idx" ON "InventoryVerificationLine"("verificationId");

-- CreateIndex
CREATE INDEX "InventoryVerificationLine_productVariantId_idx" ON "InventoryVerificationLine"("productVariantId");

-- CreateIndex
CREATE INDEX "InventoryVerificationLine_binId_idx" ON "InventoryVerificationLine"("binId");

-- CreateIndex
CREATE INDEX "InventoryVerificationApprovalEvent_verificationId_stage_idx" ON "InventoryVerificationApprovalEvent"("verificationId", "stage");

-- CreateIndex
CREATE INDEX "InventoryVerificationApprovalEvent_actedById_idx" ON "InventoryVerificationApprovalEvent"("actedById");

-- CreateIndex
CREATE INDEX "ReorderAlert_warehouseId_status_idx" ON "ReorderAlert"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "ReorderAlert_productVariantId_status_idx" ON "ReorderAlert"("productVariantId", "status");

-- CreateIndex
CREATE INDEX "ReorderAlert_createdAt_idx" ON "ReorderAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRequest_requestNumber_key" ON "MaterialRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "MaterialRequest_warehouseId_status_idx" ON "MaterialRequest"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "MaterialRequest_createdById_requestedAt_idx" ON "MaterialRequest"("createdById", "requestedAt");

-- CreateIndex
CREATE INDEX "MaterialRequest_adminApprovedById_idx" ON "MaterialRequest"("adminApprovedById");

-- CreateIndex
CREATE INDEX "MaterialRequest_requestedAt_idx" ON "MaterialRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_materialRequestId_idx" ON "MaterialRequestItem"("materialRequestId");

-- CreateIndex
CREATE INDEX "MaterialRequestItem_productVariantId_idx" ON "MaterialRequestItem"("productVariantId");

-- CreateIndex
CREATE INDEX "MaterialRequestAttachment_materialRequestId_createdAt_idx" ON "MaterialRequestAttachment"("materialRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialRequestAttachment_uploadedById_idx" ON "MaterialRequestAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "MaterialRequestApprovalEvent_materialRequestId_stage_actedA_idx" ON "MaterialRequestApprovalEvent"("materialRequestId", "stage", "actedAt");

-- CreateIndex
CREATE INDEX "MaterialRequestApprovalEvent_actedById_actedAt_idx" ON "MaterialRequestApprovalEvent"("actedById", "actedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReleaseNote_releaseNumber_key" ON "MaterialReleaseNote"("releaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReleaseNote_challanNumber_key" ON "MaterialReleaseNote"("challanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialReleaseNote_waybillNumber_key" ON "MaterialReleaseNote"("waybillNumber");

-- CreateIndex
CREATE INDEX "MaterialReleaseNote_warehouseId_releasedAt_idx" ON "MaterialReleaseNote"("warehouseId", "releasedAt");

-- CreateIndex
CREATE INDEX "MaterialReleaseNote_materialRequestId_idx" ON "MaterialReleaseNote"("materialRequestId");

-- CreateIndex
CREATE INDEX "MaterialReleaseNote_releasedById_idx" ON "MaterialReleaseNote"("releasedById");

-- CreateIndex
CREATE INDEX "MaterialReleaseNoteItem_materialReleaseNoteId_idx" ON "MaterialReleaseNoteItem"("materialReleaseNoteId");

-- CreateIndex
CREATE INDEX "MaterialReleaseNoteItem_materialRequestItemId_idx" ON "MaterialReleaseNoteItem"("materialRequestItemId");

-- CreateIndex
CREATE INDEX "MaterialReleaseNoteItem_productVariantId_idx" ON "MaterialReleaseNoteItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRegister_assetTag_key" ON "AssetRegister"("assetTag");

-- CreateIndex
CREATE INDEX "AssetRegister_warehouseId_status_idx" ON "AssetRegister"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "AssetRegister_productVariantId_status_idx" ON "AssetRegister"("productVariantId", "status");

-- CreateIndex
CREATE INDEX "AssetRegister_materialRequestId_idx" ON "AssetRegister"("materialRequestId");

-- CreateIndex
CREATE INDEX "AssetRegister_materialReleaseNoteId_idx" ON "AssetRegister"("materialReleaseNoteId");

-- CreateIndex
CREATE INDEX "AssetRegister_materialReleaseItemId_idx" ON "AssetRegister"("materialReleaseItemId");

-- CreateIndex
CREATE INDEX "AssetRegister_createdById_idx" ON "AssetRegister"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPortalAccess_userId_key" ON "SupplierPortalAccess"("userId");

-- CreateIndex
CREATE INDEX "SupplierPortalAccess_supplierId_status_idx" ON "SupplierPortalAccess"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierPortalAccess_createdById_idx" ON "SupplierPortalAccess"("createdById");

-- CreateIndex
CREATE INDEX "SupplierProfileUpdateRequest_supplierId_status_idx" ON "SupplierProfileUpdateRequest"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierProfileUpdateRequest_requestedByUserId_createdAt_idx" ON "SupplierProfileUpdateRequest"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierProfileUpdateRequest_reviewedById_idx" ON "SupplierProfileUpdateRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "SupplierFeedback_supplierId_createdAt_idx" ON "SupplierFeedback"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierFeedback_sourceType_createdAt_idx" ON "SupplierFeedback"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierFeedback_createdById_idx" ON "SupplierFeedback"("createdById");

-- CreateIndex
CREATE INDEX "SupplierPortalNotification_supplierId_createdAt_idx" ON "SupplierPortalNotification"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierPortalNotification_userId_createdAt_idx" ON "SupplierPortalNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierPortalNotification_status_channel_idx" ON "SupplierPortalNotification"("status", "channel");

-- CreateIndex
CREATE INDEX "SupplierPortalNotification_type_createdAt_idx" ON "SupplierPortalNotification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierPortalNotification_createdById_idx" ON "SupplierPortalNotification"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorPortalAccess_userId_key" ON "InvestorPortalAccess"("userId");

-- CreateIndex
CREATE INDEX "InvestorPortalAccess_investorId_status_idx" ON "InvestorPortalAccess"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorPortalAccess_createdById_idx" ON "InvestorPortalAccess"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_code_key" ON "Investor"("code");

-- CreateIndex
CREATE INDEX "Investor_name_idx" ON "Investor"("name");

-- CreateIndex
CREATE INDEX "Investor_status_idx" ON "Investor"("status");

-- CreateIndex
CREATE INDEX "Investor_kycStatus_idx" ON "Investor"("kycStatus");

-- CreateIndex
CREATE INDEX "Investor_createdById_idx" ON "Investor"("createdById");

-- CreateIndex
CREATE INDEX "Investor_beneficiaryVerifiedById_idx" ON "Investor"("beneficiaryVerifiedById");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorCapitalTransaction_transactionNumber_key" ON "InvestorCapitalTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "InvestorCapitalTransaction_investorId_transactionDate_idx" ON "InvestorCapitalTransaction"("investorId", "transactionDate");

-- CreateIndex
CREATE INDEX "InvestorCapitalTransaction_type_idx" ON "InvestorCapitalTransaction"("type");

-- CreateIndex
CREATE INDEX "InvestorCapitalTransaction_direction_idx" ON "InvestorCapitalTransaction"("direction");

-- CreateIndex
CREATE INDEX "InvestorCapitalTransaction_productVariantId_idx" ON "InvestorCapitalTransaction"("productVariantId");

-- CreateIndex
CREATE INDEX "InvestorCapitalTransaction_createdById_idx" ON "InvestorCapitalTransaction"("createdById");

-- CreateIndex
CREATE INDEX "InvestorProductAllocation_investorId_status_idx" ON "InvestorProductAllocation"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorProductAllocation_productVariantId_status_idx" ON "InvestorProductAllocation"("productVariantId", "status");

-- CreateIndex
CREATE INDEX "InvestorProductAllocation_createdById_idx" ON "InvestorProductAllocation"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfitRun_runNumber_key" ON "InvestorProfitRun"("runNumber");

-- CreateIndex
CREATE INDEX "InvestorProfitRun_fromDate_toDate_idx" ON "InvestorProfitRun"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "InvestorProfitRun_createdAt_idx" ON "InvestorProfitRun"("createdAt");

-- CreateIndex
CREATE INDEX "InvestorProfitRun_createdById_idx" ON "InvestorProfitRun"("createdById");

-- CreateIndex
CREATE INDEX "InvestorProfitRun_status_idx" ON "InvestorProfitRun"("status");

-- CreateIndex
CREATE INDEX "InvestorProfitRun_approvedById_idx" ON "InvestorProfitRun"("approvedById");

-- CreateIndex
CREATE INDEX "InvestorProfitRun_postedById_idx" ON "InvestorProfitRun"("postedById");

-- CreateIndex
CREATE INDEX "InvestorProfitRunVariant_runId_netProfit_idx" ON "InvestorProfitRunVariant"("runId", "netProfit");

-- CreateIndex
CREATE INDEX "InvestorProfitRunVariant_productVariantId_idx" ON "InvestorProfitRunVariant"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfitRunVariant_runId_productVariantId_key" ON "InvestorProfitRunVariant"("runId", "productVariantId");

-- CreateIndex
CREATE INDEX "InvestorProfitRunAllocation_runId_investorId_idx" ON "InvestorProfitRunAllocation"("runId", "investorId");

-- CreateIndex
CREATE INDEX "InvestorProfitRunAllocation_runId_productVariantId_idx" ON "InvestorProfitRunAllocation"("runId", "productVariantId");

-- CreateIndex
CREATE INDEX "InvestorProfitRunAllocation_sourceAllocationId_idx" ON "InvestorProfitRunAllocation"("sourceAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfitPayout_payoutNumber_key" ON "InvestorProfitPayout"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorProfitPayout_transactionId_key" ON "InvestorProfitPayout"("transactionId");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_runId_investorId_idx" ON "InvestorProfitPayout"("runId", "investorId");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_status_paidAt_idx" ON "InvestorProfitPayout"("status", "paidAt");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_createdById_idx" ON "InvestorProfitPayout"("createdById");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_approvedById_idx" ON "InvestorProfitPayout"("approvedById");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_rejectedById_idx" ON "InvestorProfitPayout"("rejectedById");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_paidById_idx" ON "InvestorProfitPayout"("paidById");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_releasedById_idx" ON "InvestorProfitPayout"("releasedById");

-- CreateIndex
CREATE INDEX "InvestorProfitPayout_voidedById_idx" ON "InvestorProfitPayout"("voidedById");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorWithdrawalRequest_requestNumber_key" ON "InvestorWithdrawalRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorWithdrawalRequest_transactionId_key" ON "InvestorWithdrawalRequest"("transactionId");

-- CreateIndex
CREATE INDEX "InvestorWithdrawalRequest_investorId_status_idx" ON "InvestorWithdrawalRequest"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorWithdrawalRequest_status_submittedAt_idx" ON "InvestorWithdrawalRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "InvestorWithdrawalRequest_submittedById_idx" ON "InvestorWithdrawalRequest"("submittedById");

-- CreateIndex
CREATE INDEX "InvestorWithdrawalRequest_reviewedById_idx" ON "InvestorWithdrawalRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "InvestorWithdrawalRequest_settledById_idx" ON "InvestorWithdrawalRequest"("settledById");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_rfqNumber_key" ON "Rfq"("rfqNumber");

-- CreateIndex
CREATE INDEX "Rfq_warehouseId_status_idx" ON "Rfq"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "Rfq_purchaseRequisitionId_idx" ON "Rfq"("purchaseRequisitionId");

-- CreateIndex
CREATE INDEX "Rfq_createdById_idx" ON "Rfq"("createdById");

-- CreateIndex
CREATE INDEX "Rfq_approvedById_idx" ON "Rfq"("approvedById");

-- CreateIndex
CREATE INDEX "Rfq_requestedAt_idx" ON "Rfq"("requestedAt");

-- CreateIndex
CREATE INDEX "Rfq_submissionDeadline_idx" ON "Rfq"("submissionDeadline");

-- CreateIndex
CREATE INDEX "Rfq_resubmissionRound_idx" ON "Rfq"("resubmissionRound");

-- CreateIndex
CREATE INDEX "RfqItem_rfqId_idx" ON "RfqItem"("rfqId");

-- CreateIndex
CREATE INDEX "RfqItem_productVariantId_idx" ON "RfqItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqItem_rfqId_productVariantId_key" ON "RfqItem"("rfqId", "productVariantId");

-- CreateIndex
CREATE INDEX "RfqSupplierInvite_rfqId_status_idx" ON "RfqSupplierInvite"("rfqId", "status");

-- CreateIndex
CREATE INDEX "RfqSupplierInvite_supplierId_status_idx" ON "RfqSupplierInvite"("supplierId", "status");

-- CreateIndex
CREATE INDEX "RfqSupplierInvite_createdById_idx" ON "RfqSupplierInvite"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "RfqSupplierInvite_rfqId_supplierId_key" ON "RfqSupplierInvite"("rfqId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotation_rfqSupplierInviteId_key" ON "SupplierQuotation"("rfqSupplierInviteId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_rfqId_status_idx" ON "SupplierQuotation"("rfqId", "status");

-- CreateIndex
CREATE INDEX "SupplierQuotation_supplierId_status_idx" ON "SupplierQuotation"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierQuotation_submittedById_idx" ON "SupplierQuotation"("submittedById");

-- CreateIndex
CREATE INDEX "SupplierQuotation_quotedAt_idx" ON "SupplierQuotation"("quotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotation_rfqId_supplierId_key" ON "SupplierQuotation"("rfqId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierQuotationItem_supplierQuotationId_idx" ON "SupplierQuotationItem"("supplierQuotationId");

-- CreateIndex
CREATE INDEX "SupplierQuotationItem_rfqItemId_idx" ON "SupplierQuotationItem"("rfqItemId");

-- CreateIndex
CREATE INDEX "SupplierQuotationItem_productVariantId_idx" ON "SupplierQuotationItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuotationItem_supplierQuotationId_rfqItemId_key" ON "SupplierQuotationItem"("supplierQuotationId", "rfqItemId");

-- CreateIndex
CREATE INDEX "SupplierQuotationAttachment_supplierQuotationId_idx" ON "SupplierQuotationAttachment"("supplierQuotationId");

-- CreateIndex
CREATE INDEX "SupplierQuotationAttachment_proposalType_idx" ON "SupplierQuotationAttachment"("proposalType");

-- CreateIndex
CREATE INDEX "SupplierQuotationAttachment_uploadedById_idx" ON "SupplierQuotationAttachment"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "RfqAward_rfqId_key" ON "RfqAward"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqAward_supplierQuotationId_key" ON "RfqAward"("supplierQuotationId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqAward_purchaseOrderId_key" ON "RfqAward"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "RfqAward_supplierId_status_idx" ON "RfqAward"("supplierId", "status");

-- CreateIndex
CREATE INDEX "RfqAward_awardedById_idx" ON "RfqAward"("awardedById");

-- CreateIndex
CREATE INDEX "RfqAward_awardedAt_idx" ON "RfqAward"("awardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategory_code_key" ON "SupplierCategory"("code");

-- CreateIndex
CREATE INDEX "SupplierCategory_isActive_name_idx" ON "SupplierCategory"("isActive", "name");

-- CreateIndex
CREATE INDEX "SupplierCategory_createdById_idx" ON "SupplierCategory"("createdById");

-- CreateIndex
CREATE INDEX "SupplierCategorySupplier_supplierId_idx" ON "SupplierCategorySupplier"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierCategorySupplier_createdById_idx" ON "SupplierCategorySupplier"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategorySupplier_supplierCategoryId_supplierId_key" ON "SupplierCategorySupplier"("supplierCategoryId", "supplierId");

-- CreateIndex
CREATE INDEX "RfqCategoryTarget_supplierCategoryId_idx" ON "RfqCategoryTarget"("supplierCategoryId");

-- CreateIndex
CREATE INDEX "RfqCategoryTarget_createdById_idx" ON "RfqCategoryTarget"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "RfqCategoryTarget_rfqId_supplierCategoryId_key" ON "RfqCategoryTarget"("rfqId", "supplierCategoryId");

-- CreateIndex
CREATE INDEX "RfqAttachment_rfqId_idx" ON "RfqAttachment"("rfqId");

-- CreateIndex
CREATE INDEX "RfqAttachment_uploadedById_idx" ON "RfqAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "RfqNotification_rfqId_createdAt_idx" ON "RfqNotification"("rfqId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqNotification_inviteId_idx" ON "RfqNotification"("inviteId");

-- CreateIndex
CREATE INDEX "RfqNotification_supplierId_createdAt_idx" ON "RfqNotification"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "RfqNotification_status_channel_idx" ON "RfqNotification"("status", "channel");

-- CreateIndex
CREATE INDEX "RfqNotification_createdById_idx" ON "RfqNotification"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ComparativeStatement_csNumber_key" ON "ComparativeStatement"("csNumber");

-- CreateIndex
CREATE INDEX "ComparativeStatement_rfqId_status_idx" ON "ComparativeStatement"("rfqId", "status");

-- CreateIndex
CREATE INDEX "ComparativeStatement_warehouseId_status_idx" ON "ComparativeStatement"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "ComparativeStatement_createdById_idx" ON "ComparativeStatement"("createdById");

-- CreateIndex
CREATE INDEX "ComparativeStatement_managerApprovedById_idx" ON "ComparativeStatement"("managerApprovedById");

-- CreateIndex
CREATE INDEX "ComparativeStatement_committeeApprovedById_idx" ON "ComparativeStatement"("committeeApprovedById");

-- CreateIndex
CREATE INDEX "ComparativeStatement_finalApprovedById_idx" ON "ComparativeStatement"("finalApprovedById");

-- CreateIndex
CREATE UNIQUE INDEX "ComparativeStatement_rfqId_versionNo_key" ON "ComparativeStatement"("rfqId", "versionNo");

-- CreateIndex
CREATE INDEX "ComparativeStatementLine_comparativeStatementId_rank_idx" ON "ComparativeStatementLine"("comparativeStatementId", "rank");

-- CreateIndex
CREATE INDEX "ComparativeStatementLine_supplierId_idx" ON "ComparativeStatementLine"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparativeStatementLine_comparativeStatementId_supplierQuo_key" ON "ComparativeStatementLine"("comparativeStatementId", "supplierQuotationId");

-- CreateIndex
CREATE INDEX "ComparativeStatementApprovalEvent_comparativeStatementId_st_idx" ON "ComparativeStatementApprovalEvent"("comparativeStatementId", "stage");

-- CreateIndex
CREATE INDEX "ComparativeStatementApprovalEvent_actedById_idx" ON "ComparativeStatementApprovalEvent"("actedById");

-- CreateIndex
CREATE INDEX "ComparativeStatementNotification_comparativeStatementId_sta_idx" ON "ComparativeStatementNotification"("comparativeStatementId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "ComparativeStatementNotification_recipientUserId_idx" ON "ComparativeStatementNotification"("recipientUserId");

-- CreateIndex
CREATE INDEX "ComparativeStatementNotification_recipientUserId_readAt_idx" ON "ComparativeStatementNotification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "ComparativeStatementNotification_status_channel_idx" ON "ComparativeStatementNotification"("status", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_sourceComparativeStatementId_key" ON "PurchaseOrder"("sourceComparativeStatementId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_status_idx" ON "PurchaseOrder"("supplierId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_purchaseRequisitionId_idx" ON "PurchaseOrder"("purchaseRequisitionId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_sourceComparativeStatementId_idx" ON "PurchaseOrder"("sourceComparativeStatementId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_warehouseId_status_idx" ON "PurchaseOrder"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdById_idx" ON "PurchaseOrder"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_approvedById_idx" ON "PurchaseOrder"("approvedById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_managerApprovedById_idx" ON "PurchaseOrder"("managerApprovedById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_committeeApprovedById_idx" ON "PurchaseOrder"("committeeApprovedById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_finalApprovedById_idx" ON "PurchaseOrder"("finalApprovedById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_rejectedById_idx" ON "PurchaseOrder"("rejectedById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_termsTemplateId_idx" ON "PurchaseOrder"("termsTemplateId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderTermsTemplate_code_key" ON "PurchaseOrderTermsTemplate"("code");

-- CreateIndex
CREATE INDEX "PurchaseOrderTermsTemplate_isActive_isDefault_idx" ON "PurchaseOrderTermsTemplate"("isActive", "isDefault");

-- CreateIndex
CREATE INDEX "PurchaseOrderTermsTemplate_createdById_idx" ON "PurchaseOrderTermsTemplate"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseOrderTermsTemplate_updatedById_idx" ON "PurchaseOrderTermsTemplate"("updatedById");

-- CreateIndex
CREATE INDEX "PurchaseOrderApprovalEvent_purchaseOrderId_stage_idx" ON "PurchaseOrderApprovalEvent"("purchaseOrderId", "stage");

-- CreateIndex
CREATE INDEX "PurchaseOrderApprovalEvent_actedById_idx" ON "PurchaseOrderApprovalEvent"("actedById");

-- CreateIndex
CREATE INDEX "PurchaseOrderNotification_purchaseOrderId_stage_createdAt_idx" ON "PurchaseOrderNotification"("purchaseOrderId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderNotification_recipientUserId_idx" ON "PurchaseOrderNotification"("recipientUserId");

-- CreateIndex
CREATE INDEX "PurchaseOrderNotification_recipientUserId_readAt_idx" ON "PurchaseOrderNotification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderNotification_status_channel_idx" ON "PurchaseOrderNotification"("status", "channel");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productVariantId_idx" ON "PurchaseOrderItem"("productVariantId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLandedCost_purchaseOrderId_incurredAt_idx" ON "PurchaseOrderLandedCost"("purchaseOrderId", "incurredAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderLandedCost_createdById_idx" ON "PurchaseOrderLandedCost"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_warehouseId_receivedAt_idx" ON "GoodsReceipt"("warehouseId", "receivedAt");

-- CreateIndex
CREATE INDEX "GoodsReceipt_receivedById_idx" ON "GoodsReceipt"("receivedById");

-- CreateIndex
CREATE INDEX "GoodsReceipt_requesterConfirmedById_idx" ON "GoodsReceipt"("requesterConfirmedById");

-- CreateIndex
CREATE INDEX "GoodsReceipt_requesterConfirmedAt_idx" ON "GoodsReceipt"("requesterConfirmedAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "GoodsReceiptItem_productVariantId_idx" ON "GoodsReceiptItem"("productVariantId");

-- CreateIndex
CREATE INDEX "GoodsReceiptAttachment_goodsReceiptId_createdAt_idx" ON "GoodsReceiptAttachment"("goodsReceiptId", "createdAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptAttachment_uploadedById_idx" ON "GoodsReceiptAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX "GoodsReceiptAttachment_type_createdAt_idx" ON "GoodsReceiptAttachment"("type", "createdAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptVendorEvaluation_goodsReceiptId_createdAt_idx" ON "GoodsReceiptVendorEvaluation"("goodsReceiptId", "createdAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptVendorEvaluation_createdById_createdAt_idx" ON "GoodsReceiptVendorEvaluation"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "GoodsReceiptVendorEvaluation_evaluatorRole_createdAt_idx" ON "GoodsReceiptVendorEvaluation"("evaluatorRole", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptVendorEvaluation_goodsReceiptId_evaluatorRole_key" ON "GoodsReceiptVendorEvaluation"("goodsReceiptId", "evaluatorRole");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_invoiceNumber_key" ON "SupplierInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_status_idx" ON "SupplierInvoice"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierInvoice_purchaseOrderId_idx" ON "SupplierInvoice"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_createdById_idx" ON "SupplierInvoice"("createdById");

-- CreateIndex
CREATE INDEX "SupplierInvoice_matchedById_idx" ON "SupplierInvoice"("matchedById");

-- CreateIndex
CREATE INDEX "SupplierInvoice_matchStatus_idx" ON "SupplierInvoice"("matchStatus");

-- CreateIndex
CREATE INDEX "SupplierInvoice_paymentHoldStatus_idx" ON "SupplierInvoice"("paymentHoldStatus");

-- CreateIndex
CREATE INDEX "SupplierInvoice_slaCreditStatus_idx" ON "SupplierInvoice"("slaCreditStatus");

-- CreateIndex
CREATE INDEX "SupplierInvoice_issueDate_idx" ON "SupplierInvoice"("issueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_dueDate_idx" ON "SupplierInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_paymentHoldReleasedById_idx" ON "SupplierInvoice"("paymentHoldReleasedById");

-- CreateIndex
CREATE INDEX "SupplierInvoiceItem_supplierInvoiceId_idx" ON "SupplierInvoiceItem"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceItem_purchaseOrderItemId_idx" ON "SupplierInvoiceItem"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceItem_productVariantId_idx" ON "SupplierInvoiceItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_paymentNumber_key" ON "SupplierPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_paymentDate_idx" ON "SupplierPayment"("supplierId", "paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierInvoiceId_idx" ON "SupplierPayment"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierPayment_createdById_idx" ON "SupplierPayment"("createdById");

-- CreateIndex
CREATE INDEX "InvestorMasterChangeRequest_investorId_status_idx" ON "InvestorMasterChangeRequest"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorMasterChangeRequest_requestedById_idx" ON "InvestorMasterChangeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "InvestorMasterChangeRequest_reviewedById_idx" ON "InvestorMasterChangeRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "InvestorProfileUpdateRequest_investorId_status_idx" ON "InvestorProfileUpdateRequest"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorProfileUpdateRequest_submittedById_idx" ON "InvestorProfileUpdateRequest"("submittedById");

-- CreateIndex
CREATE INDEX "InvestorProfileUpdateRequest_reviewedById_idx" ON "InvestorProfileUpdateRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "InvestorPortalNotification_investorId_status_idx" ON "InvestorPortalNotification"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorPortalNotification_createdById_idx" ON "InvestorPortalNotification"("createdById");

-- CreateIndex
CREATE INDEX "InvestorPortalNotification_type_createdAt_idx" ON "InvestorPortalNotification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InvestorInternalNotification_userId_status_idx" ON "InvestorInternalNotification"("userId", "status");

-- CreateIndex
CREATE INDEX "InvestorInternalNotification_createdById_idx" ON "InvestorInternalNotification"("createdById");

-- CreateIndex
CREATE INDEX "InvestorInternalNotification_type_createdAt_idx" ON "InvestorInternalNotification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InvestorInternalNotification_entity_entityId_idx" ON "InvestorInternalNotification"("entity", "entityId");

-- CreateIndex
CREATE INDEX "InvestorStatementSchedule_investorId_status_idx" ON "InvestorStatementSchedule"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorStatementSchedule_status_nextRunAt_idx" ON "InvestorStatementSchedule"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "InvestorStatementSchedule_createdById_idx" ON "InvestorStatementSchedule"("createdById");

-- CreateIndex
CREATE INDEX "InvestorStatementSchedule_updatedById_idx" ON "InvestorStatementSchedule"("updatedById");

-- CreateIndex
CREATE INDEX "InvestorDocument_investorId_status_idx" ON "InvestorDocument"("investorId", "status");

-- CreateIndex
CREATE INDEX "InvestorDocument_type_idx" ON "InvestorDocument"("type");

-- CreateIndex
CREATE INDEX "InvestorDocument_uploadedById_idx" ON "InvestorDocument"("uploadedById");

-- CreateIndex
CREATE INDEX "InvestorDocument_reviewedById_idx" ON "InvestorDocument"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorDocument_investorId_type_key" ON "InvestorDocument"("investorId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_prfNumber_key" ON "PaymentRequest"("prfNumber");

-- CreateIndex
CREATE INDEX "PaymentRequest_supplierId_status_idx" ON "PaymentRequest"("supplierId", "status");

-- CreateIndex
CREATE INDEX "PaymentRequest_warehouseId_idx" ON "PaymentRequest"("warehouseId");

-- CreateIndex
CREATE INDEX "PaymentRequest_purchaseOrderId_idx" ON "PaymentRequest"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PaymentRequest_comparativeStatementId_idx" ON "PaymentRequest"("comparativeStatementId");

-- CreateIndex
CREATE INDEX "PaymentRequest_goodsReceiptId_idx" ON "PaymentRequest"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "PaymentRequest_supplierInvoiceId_idx" ON "PaymentRequest"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "PaymentRequest_supplierPaymentId_idx" ON "PaymentRequest"("supplierPaymentId");

-- CreateIndex
CREATE INDEX "PaymentRequest_createdById_idx" ON "PaymentRequest"("createdById");

-- CreateIndex
CREATE INDEX "PaymentRequest_managerApprovedById_idx" ON "PaymentRequest"("managerApprovedById");

-- CreateIndex
CREATE INDEX "PaymentRequest_financeApprovedById_idx" ON "PaymentRequest"("financeApprovedById");

-- CreateIndex
CREATE INDEX "PaymentRequest_treasuryProcessedById_idx" ON "PaymentRequest"("treasuryProcessedById");

-- CreateIndex
CREATE INDEX "PaymentRequest_requestedAt_idx" ON "PaymentRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_approvalStage_idx" ON "PaymentRequest"("approvalStage");

-- CreateIndex
CREATE INDEX "PaymentRequestApprovalEvent_paymentRequestId_stage_idx" ON "PaymentRequestApprovalEvent"("paymentRequestId", "stage");

-- CreateIndex
CREATE INDEX "PaymentRequestApprovalEvent_actedById_idx" ON "PaymentRequestApprovalEvent"("actedById");

-- CreateIndex
CREATE INDEX "PaymentRequestNotification_paymentRequestId_stage_createdAt_idx" ON "PaymentRequestNotification"("paymentRequestId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequestNotification_recipientUserId_idx" ON "PaymentRequestNotification"("recipientUserId");

-- CreateIndex
CREATE INDEX "PaymentRequestNotification_recipientUserId_readAt_idx" ON "PaymentRequestNotification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "PaymentRequestNotification_status_channel_idx" ON "PaymentRequestNotification"("status", "channel");

-- CreateIndex
CREATE INDEX "PaymentRequestNotification_createdById_idx" ON "PaymentRequestNotification"("createdById");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierId_entryDate_idx" ON "SupplierLedgerEntry"("supplierId", "entryDate");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierInvoiceId_idx" ON "SupplierLedgerEntry"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierPaymentId_idx" ON "SupplierLedgerEntry"("supplierPaymentId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierReturnId_idx" ON "SupplierLedgerEntry"("supplierReturnId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_purchaseOrderId_idx" ON "SupplierLedgerEntry"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_createdById_idx" ON "SupplierLedgerEntry"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturn_returnNumber_key" ON "SupplierReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "SupplierReturn_supplierId_status_idx" ON "SupplierReturn"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierReturn_warehouseId_status_idx" ON "SupplierReturn"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "SupplierReturn_goodsReceiptId_idx" ON "SupplierReturn"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "SupplierReturn_purchaseOrderId_idx" ON "SupplierReturn"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "SupplierReturn_supplierInvoiceId_idx" ON "SupplierReturn"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "SupplierReturn_createdById_idx" ON "SupplierReturn"("createdById");

-- CreateIndex
CREATE INDEX "SupplierReturn_approvedById_idx" ON "SupplierReturn"("approvedById");

-- CreateIndex
CREATE INDEX "SupplierReturn_requestedAt_idx" ON "SupplierReturn"("requestedAt");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_supplierReturnId_idx" ON "SupplierReturnItem"("supplierReturnId");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_goodsReceiptItemId_idx" ON "SupplierReturnItem"("goodsReceiptItemId");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_purchaseOrderItemId_idx" ON "SupplierReturnItem"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_productVariantId_idx" ON "SupplierReturnItem"("productVariantId");

-- CreateIndex
CREATE INDEX "ReplenishmentRule_warehouseId_isActive_idx" ON "ReplenishmentRule"("warehouseId", "isActive");

-- CreateIndex
CREATE INDEX "ReplenishmentRule_productVariantId_isActive_idx" ON "ReplenishmentRule"("productVariantId", "isActive");

-- CreateIndex
CREATE INDEX "ReplenishmentRule_createdById_idx" ON "ReplenishmentRule"("createdById");

-- CreateIndex
CREATE INDEX "ReplenishmentRule_updatedById_idx" ON "ReplenishmentRule"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentRule_warehouseId_productVariantId_key" ON "ReplenishmentRule"("warehouseId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSlaPolicy_supplierId_key" ON "SupplierSlaPolicy"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_isActive_idx" ON "SupplierSlaPolicy"("isActive");

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_createdById_idx" ON "SupplierSlaPolicy"("createdById");

-- CreateIndex
CREATE INDEX "SupplierSlaPolicy_updatedById_idx" ON "SupplierSlaPolicy"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSlaFinancialRule_supplierSlaPolicyId_key" ON "SupplierSlaFinancialRule"("supplierSlaPolicyId");

-- CreateIndex
CREATE INDEX "SupplierSlaFinancialRule_isActive_idx" ON "SupplierSlaFinancialRule"("isActive");

-- CreateIndex
CREATE INDEX "SupplierSlaFinancialRule_createdById_idx" ON "SupplierSlaFinancialRule"("createdById");

-- CreateIndex
CREATE INDEX "SupplierSlaFinancialRule_updatedById_idx" ON "SupplierSlaFinancialRule"("updatedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_supplierId_evaluationDate_idx" ON "SupplierSlaBreach"("supplierId", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_supplierSlaPolicyId_evaluationDate_idx" ON "SupplierSlaBreach"("supplierSlaPolicyId", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_status_evaluationDate_idx" ON "SupplierSlaBreach"("status", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_actionStatus_dueDate_idx" ON "SupplierSlaBreach"("actionStatus", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_disputeStatus_evaluationDate_idx" ON "SupplierSlaBreach"("disputeStatus", "evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_ownerUserId_actionStatus_idx" ON "SupplierSlaBreach"("ownerUserId", "actionStatus");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_disputeRaisedById_idx" ON "SupplierSlaBreach"("disputeRaisedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_disputeResolvedById_idx" ON "SupplierSlaBreach"("disputeResolvedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_terminationCaseId_idx" ON "SupplierSlaBreach"("terminationCaseId");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_resolvedById_idx" ON "SupplierSlaBreach"("resolvedById");

-- CreateIndex
CREATE INDEX "SupplierSlaBreach_evaluatedById_idx" ON "SupplierSlaBreach"("evaluatedById");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_supplierId_status_idx" ON "SupplierSlaTerminationCase"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_supplierSlaPolicyId_status_idx" ON "SupplierSlaTerminationCase"("supplierSlaPolicyId", "status");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_ownerUserId_status_idx" ON "SupplierSlaTerminationCase"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_resolvedById_idx" ON "SupplierSlaTerminationCase"("resolvedById");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_createdById_idx" ON "SupplierSlaTerminationCase"("createdById");

-- CreateIndex
CREATE INDEX "SupplierSlaTerminationCase_createdAt_idx" ON "SupplierSlaTerminationCase"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseTransfer_transferNumber_key" ON "WarehouseTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_sourceWarehouseId_status_idx" ON "WarehouseTransfer"("sourceWarehouseId", "status");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_destinationWarehouseId_status_idx" ON "WarehouseTransfer"("destinationWarehouseId", "status");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_createdById_idx" ON "WarehouseTransfer"("createdById");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_approvedById_idx" ON "WarehouseTransfer"("approvedById");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_requestedAt_idx" ON "WarehouseTransfer"("requestedAt");

-- CreateIndex
CREATE INDEX "WarehouseTransferItem_warehouseTransferId_idx" ON "WarehouseTransferItem"("warehouseTransferId");

-- CreateIndex
CREATE INDEX "WarehouseTransferItem_productVariantId_idx" ON "WarehouseTransferItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFeature_key_key" ON "StoreFeature"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryManProfile_userId_key" ON "DeliveryManProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryManProfile_employeeCode_key" ON "DeliveryManProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "DeliveryManProfile_warehouseId_idx" ON "DeliveryManProfile"("warehouseId");

-- CreateIndex
CREATE INDEX "DeliveryManProfile_status_idx" ON "DeliveryManProfile"("status");

-- CreateIndex
CREATE INDEX "DeliveryManProfile_applicationStatus_idx" ON "DeliveryManProfile"("applicationStatus");

-- CreateIndex
CREATE INDEX "DeliveryManProfile_verifiedById_idx" ON "DeliveryManProfile"("verifiedById");

-- CreateIndex
CREATE INDEX "DeliveryManProfile_assignedById_idx" ON "DeliveryManProfile"("assignedById");

-- CreateIndex
CREATE INDEX "DeliveryManReference_deliveryManProfileId_idx" ON "DeliveryManReference"("deliveryManProfileId");

-- CreateIndex
CREATE INDEX "DeliveryManDocument_deliveryManProfileId_idx" ON "DeliveryManDocument"("deliveryManProfileId");

-- CreateIndex
CREATE INDEX "DeliveryManDocument_referenceId_idx" ON "DeliveryManDocument"("referenceId");

-- CreateIndex
CREATE INDEX "DeliveryManDocument_type_idx" ON "DeliveryManDocument"("type");

-- CreateIndex
CREATE INDEX "DeliveryManDocument_verifiedById_idx" ON "DeliveryManDocument"("verifiedById");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_orderId_idx" ON "DeliveryAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_shipmentId_idx" ON "DeliveryAssignment"("shipmentId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_deliveryManProfileId_status_idx" ON "DeliveryAssignment"("deliveryManProfileId", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_deliveryManProfileId_isCurrent_idx" ON "DeliveryAssignment"("deliveryManProfileId", "isCurrent");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_warehouseId_status_idx" ON "DeliveryAssignment"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_assignedById_idx" ON "DeliveryAssignment"("assignedById");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_shipmentId_isCurrent_idx" ON "DeliveryAssignment"("shipmentId", "isCurrent");

-- CreateIndex
CREATE INDEX "DeliveryAssignmentLog_deliveryAssignmentId_createdAt_idx" ON "DeliveryAssignmentLog"("deliveryAssignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryAssignmentLog_actorUserId_idx" ON "DeliveryAssignmentLog"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehousePickupProof_deliveryAssignmentId_key" ON "WarehousePickupProof"("deliveryAssignmentId");

-- CreateIndex
CREATE INDEX "WarehousePickupProof_actorUserId_idx" ON "WarehousePickupProof"("actorUserId");

-- CreateIndex
CREATE INDEX "WarehousePickupProof_confirmedAt_idx" ON "WarehousePickupProof"("confirmedAt");

-- CreateIndex
CREATE INDEX "analytics_events_day_key_idx" ON "analytics_events"("day_key");

-- CreateIndex
CREATE INDEX "analytics_events_ip_hash_day_key_idx" ON "analytics_events"("ip_hash", "day_key");

-- CreateIndex
CREATE INDEX "analytics_events_ts_idx" ON "analytics_events"("ts");

-- CreateIndex
CREATE INDEX "analytics_events_event_ts_idx" ON "analytics_events"("event", "ts");

-- CreateIndex
CREATE INDEX "analytics_events_visitor_id_ts_idx" ON "analytics_events"("visitor_id", "ts");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_ts_idx" ON "analytics_events"("session_id", "ts");

-- CreateIndex
CREATE INDEX "analytics_events_path_ts_idx" ON "analytics_events"("path", "ts");

-- CreateIndex
CREATE INDEX "analytics_events_utm_source_ts_idx" ON "analytics_events"("utm_source", "ts");

-- CreateIndex
CREATE INDEX "analytics_events_device_type_ts_idx" ON "analytics_events"("device_type", "ts");

-- CreateIndex
CREATE INDEX "SearchEvent_event_createdAt_idx" ON "SearchEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "SearchEvent_normalizedQuery_createdAt_idx" ON "SearchEvent"("normalizedQuery", "createdAt");

-- CreateIndex
CREATE INDEX "SearchEvent_queryId_idx" ON "SearchEvent"("queryId");

-- CreateIndex
CREATE INDEX "SearchEvent_productId_createdAt_idx" ON "SearchEvent"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchEvent_sessionId_createdAt_idx" ON "SearchEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchSynonym_active_updatedAt_idx" ON "SearchSynonym"("active", "updatedAt");

-- CreateIndex
CREATE INDEX "SearchQueryRule_active_priority_idx" ON "SearchQueryRule"("active", "priority");

-- CreateIndex
CREATE INDEX "SearchQueryRule_query_active_idx" ON "SearchQueryRule"("query", "active");

-- CreateIndex
CREATE INDEX "SearchQueryRule_startsAt_endsAt_idx" ON "SearchQueryRule"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndexOutbox_dedupeKey_key" ON "SearchIndexOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "SearchIndexOutbox_status_nextAttemptAt_idx" ON "SearchIndexOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SearchIndexOutbox_entityType_entityId_idx" ON "SearchIndexOutbox"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "geo_ip_cache_ip_key" ON "geo_ip_cache"("ip");

-- CreateIndex
CREATE INDEX "geo_ip_cache_updatedAt_idx" ON "geo_ip_cache"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatConversation_status_idx" ON "ChatConversation"("status");

-- CreateIndex
CREATE INDEX "ChatConversation_assignedToId_idx" ON "ChatConversation"("assignedToId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ActivityLog_entity_entityId_idx" ON "ActivityLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_legalName_idx" ON "Organization"("legalName");

-- CreateIndex
CREATE INDEX "Organization_tradeLicenseNo_idx" ON "Organization"("tradeLicenseNo");

-- CreateIndex
CREATE INDEX "Organization_tin_idx" ON "Organization"("tin");

-- CreateIndex
CREATE INDEX "Organization_bin_idx" ON "Organization"("bin");

-- CreateIndex
CREATE INDEX "OrganizationCapability_type_status_idx" ON "OrganizationCapability"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationCapability_organizationId_type_key" ON "OrganizationCapability"("organizationId", "type");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_status_idx" ON "OrganizationMember"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationMemberRoleGrant_role_idx" ON "OrganizationMemberRoleGrant"("role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMemberRoleGrant_memberId_role_key" ON "OrganizationMemberRoleGrant"("memberId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_organizationId_email_idx" ON "OrganizationInvitation"("organizationId", "email");

-- CreateIndex
CREATE INDEX "OrganizationInvitation_expiresAt_idx" ON "OrganizationInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "OrganizationAddress_organizationId_type_idx" ON "OrganizationAddress"("organizationId", "type");

-- CreateIndex
CREATE INDEX "OrganizationBranch_organizationId_isActive_idx" ON "OrganizationBranch"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBranch_organizationId_name_key" ON "OrganizationBranch"("organizationId", "name");

-- CreateIndex
CREATE INDEX "OrganizationDocument_organizationId_type_idx" ON "OrganizationDocument"("organizationId", "type");

-- CreateIndex
CREATE INDEX "OrganizationDocument_status_idx" ON "OrganizationDocument"("status");

-- CreateIndex
CREATE INDEX "OrganizationDocument_expiresAt_idx" ON "OrganizationDocument"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccount_organizationId_key" ON "BusinessAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccount_accountNumber_key" ON "BusinessAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "BusinessAccount_status_idx" ON "BusinessAccount"("status");

-- CreateIndex
CREATE INDEX "BusinessAccount_pricingTierId_idx" ON "BusinessAccount"("pricingTierId");

-- CreateIndex
CREATE INDEX "BusinessAccount_accountManagerId_idx" ON "BusinessAccount"("accountManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPricingTier_code_key" ON "BusinessPricingTier"("code");

-- CreateIndex
CREATE INDEX "BusinessPricingTier_isActive_priority_idx" ON "BusinessPricingTier"("isActive", "priority");

-- CreateIndex
CREATE INDEX "BusinessPricingRule_pricingTierId_isActive_priority_idx" ON "BusinessPricingRule"("pricingTierId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "BusinessPricingRule_productId_idx" ON "BusinessPricingRule"("productId");

-- CreateIndex
CREATE INDEX "BusinessPricingRule_variantId_idx" ON "BusinessPricingRule"("variantId");

-- CreateIndex
CREATE INDEX "BusinessPricingRule_categoryId_idx" ON "BusinessPricingRule"("categoryId");

-- CreateIndex
CREATE INDEX "BusinessPricingRule_brandId_idx" ON "BusinessPricingRule"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPricingRule_pricingTierId_targetKey_minQuantity_key" ON "BusinessPricingRule"("pricingTierId", "targetKey", "minQuantity");

-- CreateIndex
CREATE INDEX "ContractPrice_businessAccountId_isActive_idx" ON "ContractPrice"("businessAccountId", "isActive");

-- CreateIndex
CREATE INDEX "ContractPrice_productId_idx" ON "ContractPrice"("productId");

-- CreateIndex
CREATE INDEX "ContractPrice_variantId_idx" ON "ContractPrice"("variantId");

-- CreateIndex
CREATE INDEX "ContractPrice_startsAt_endsAt_idx" ON "ContractPrice"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationCreditAccount_businessAccountId_key" ON "OrganizationCreditAccount"("businessAccountId");

-- CreateIndex
CREATE INDEX "OrganizationCreditAccount_isActive_reviewDate_idx" ON "OrganizationCreditAccount"("isActive", "reviewDate");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_creditAccountId_createdAt_idx" ON "CreditLedgerEntry"("creditAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_orderId_idx" ON "CreditLedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_sourceType_sourceId_idx" ON "CreditLedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesRfq_rfqNumber_key" ON "SalesRfq"("rfqNumber");

-- CreateIndex
CREATE INDEX "SalesRfq_organizationId_status_idx" ON "SalesRfq"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SalesRfq_assignedToUserId_status_idx" ON "SalesRfq"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "SalesRfqItem_salesRfqId_idx" ON "SalesRfqItem"("salesRfqId");

-- CreateIndex
CREATE INDEX "SalesRfqItem_productId_idx" ON "SalesRfqItem"("productId");

-- CreateIndex
CREATE INDEX "SalesRfqItem_variantId_idx" ON "SalesRfqItem"("variantId");

-- CreateIndex
CREATE INDEX "SalesRfqAttachment_salesRfqId_idx" ON "SalesRfqAttachment"("salesRfqId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuotation_quotationNumber_key" ON "SalesQuotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "SalesQuotation_organizationId_status_idx" ON "SalesQuotation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SalesQuotation_salesRfqId_idx" ON "SalesQuotation"("salesRfqId");

-- CreateIndex
CREATE INDEX "SalesQuotationVersion_quotationId_isCurrent_idx" ON "SalesQuotationVersion"("quotationId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuotationVersion_quotationId_versionNumber_key" ON "SalesQuotationVersion"("quotationId", "versionNumber");

-- CreateIndex
CREATE INDEX "SalesQuotationItem_quotationVersionId_idx" ON "SalesQuotationItem"("quotationVersionId");

-- CreateIndex
CREATE INDEX "SalesQuotationItem_productId_idx" ON "SalesQuotationItem"("productId");

-- CreateIndex
CREATE INDEX "SalesQuotationItem_variantId_idx" ON "SalesQuotationItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPurchaseOrder_orderId_key" ON "CustomerPurchaseOrder"("orderId");

-- CreateIndex
CREATE INDEX "CustomerPurchaseOrder_organizationId_status_idx" ON "CustomerPurchaseOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CustomerPurchaseOrder_quotationId_idx" ON "CustomerPurchaseOrder"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPurchaseOrder_organizationId_customerPoNumber_key" ON "CustomerPurchaseOrder"("organizationId", "customerPoNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_organizationId_key" ON "PartnerProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_partnerCode_key" ON "PartnerProfile"("partnerCode");

-- CreateIndex
CREATE INDEX "PartnerProfile_status_idx" ON "PartnerProfile"("status");

-- CreateIndex
CREATE INDEX "PartnerProfile_accountManagerId_idx" ON "PartnerProfile"("accountManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAgreement_agreementNumber_key" ON "PartnerAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "PartnerAgreement_partnerProfileId_status_idx" ON "PartnerAgreement"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "PartnerAgreement_startsAt_endsAt_idx" ON "PartnerAgreement"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PartnerAgreementVersion_agreementId_status_idx" ON "PartnerAgreementVersion"("agreementId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAgreementVersion_agreementId_versionNumber_key" ON "PartnerAgreementVersion"("agreementId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAsset_code_key" ON "PartnerAsset"("code");

-- CreateIndex
CREATE INDEX "PartnerAsset_partnerProfileId_status_idx" ON "PartnerAsset"("partnerProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAttribution_orderId_key" ON "PartnerAttribution"("orderId");

-- CreateIndex
CREATE INDEX "PartnerAttribution_partnerProfileId_status_idx" ON "PartnerAttribution"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "PartnerAttribution_visitorId_capturedAt_idx" ON "PartnerAttribution"("visitorId", "capturedAt");

-- CreateIndex
CREATE INDEX "PartnerAttribution_customerUserId_idx" ON "PartnerAttribution"("customerUserId");

-- CreateIndex
CREATE INDEX "PartnerAttribution_expiresAt_idx" ON "PartnerAttribution"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLead_leadNumber_key" ON "PartnerLead"("leadNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerLead_wonOrderId_key" ON "PartnerLead"("wonOrderId");

-- CreateIndex
CREATE INDEX "PartnerLead_partnerProfileId_status_idx" ON "PartnerLead"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "PartnerLead_contactEmail_idx" ON "PartnerLead"("contactEmail");

-- CreateIndex
CREATE INDEX "PartnerLead_contactPhone_idx" ON "PartnerLead"("contactPhone");

-- CreateIndex
CREATE INDEX "PartnerLead_companyName_idx" ON "PartnerLead"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPlan_code_key" ON "CommissionPlan"("code");

-- CreateIndex
CREATE INDEX "CommissionPlan_status_startsAt_endsAt_idx" ON "CommissionPlan"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CommissionRule_commissionPlanId_isActive_priority_idx" ON "CommissionRule"("commissionPlanId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "CommissionRule_commissionPlanId_targetKey_minQuantity_idx" ON "CommissionRule"("commissionPlanId", "targetKey", "minQuantity");

-- CreateIndex
CREATE INDEX "CommissionRule_targetKey_idx" ON "CommissionRule"("targetKey");

-- CreateIndex
CREATE INDEX "CommissionRule_productId_idx" ON "CommissionRule"("productId");

-- CreateIndex
CREATE INDEX "CommissionRule_variantId_idx" ON "CommissionRule"("variantId");

-- CreateIndex
CREATE INDEX "CommissionRule_categoryId_idx" ON "CommissionRule"("categoryId");

-- CreateIndex
CREATE INDEX "CommissionRule_brandId_idx" ON "CommissionRule"("brandId");

-- CreateIndex
CREATE INDEX "CommissionEntry_partnerProfileId_status_idx" ON "CommissionEntry"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "CommissionEntry_orderId_idx" ON "CommissionEntry"("orderId");

-- CreateIndex
CREATE INDEX "CommissionEntry_orderItemId_idx" ON "CommissionEntry"("orderItemId");

-- CreateIndex
CREATE INDEX "CommissionEntry_partnerLeadId_idx" ON "CommissionEntry"("partnerLeadId");

-- CreateIndex
CREATE INDEX "CommissionEntry_sourceEntryId_idx" ON "CommissionEntry"("sourceEntryId");

-- CreateIndex
CREATE INDEX "CommissionEntry_createdAt_idx" ON "CommissionEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSettlement_settlementNumber_key" ON "PartnerSettlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "PartnerSettlement_partnerProfileId_status_idx" ON "PartnerSettlement"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "PartnerSettlement_periodStart_periodEnd_idx" ON "PartnerSettlement"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PartnerSettlement_payoutAccountId_status_idx" ON "PartnerSettlement"("payoutAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSettlementLine_commissionEntryId_key" ON "PartnerSettlementLine"("commissionEntryId");

-- CreateIndex
CREATE INDEX "PartnerSettlementLine_settlementId_idx" ON "PartnerSettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "PartnerPayoutAccount_partnerProfileId_status_idx" ON "PartnerPayoutAccount"("partnerProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAuditLog_integrityNonce_key" ON "BusinessAuditLog"("integrityNonce");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAuditLog_integrityHash_key" ON "BusinessAuditLog"("integrityHash");

-- CreateIndex
CREATE INDEX "BusinessAuditLog_organizationId_createdAt_idx" ON "BusinessAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessAuditLog_entityType_entityId_idx" ON "BusinessAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BusinessAuditLog_actorUserId_createdAt_idx" ON "BusinessAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFraudRule_code_key" ON "BusinessFraudRule"("code");

-- CreateIndex
CREATE INDEX "BusinessFraudRule_type_isActive_idx" ON "BusinessFraudRule"("type", "isActive");

-- CreateIndex
CREATE INDEX "BusinessFraudRule_severity_isActive_idx" ON "BusinessFraudRule"("severity", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRiskCase_caseNumber_key" ON "BusinessRiskCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRiskCase_fingerprint_key" ON "BusinessRiskCase"("fingerprint");

-- CreateIndex
CREATE INDEX "BusinessRiskCase_status_severity_detectedAt_idx" ON "BusinessRiskCase"("status", "severity", "detectedAt");

-- CreateIndex
CREATE INDEX "BusinessRiskCase_organizationId_status_idx" ON "BusinessRiskCase"("organizationId", "status");

-- CreateIndex
CREATE INDEX "BusinessRiskCase_partnerProfileId_status_idx" ON "BusinessRiskCase"("partnerProfileId", "status");

-- CreateIndex
CREATE INDEX "BusinessRiskCase_assignedToUserId_status_idx" ON "BusinessRiskCase"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "BusinessRiskCase_orderId_idx" ON "BusinessRiskCase"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessNotification_dedupeKey_key" ON "BusinessNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "BusinessNotification_memberId_archivedAt_createdAt_idx" ON "BusinessNotification"("memberId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessNotification_recipientUserId_readAt_createdAt_idx" ON "BusinessNotification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessNotification_organizationId_category_createdAt_idx" ON "BusinessNotification"("organizationId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessNotificationDelivery_status_nextAttemptAt_idx" ON "BusinessNotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessNotificationDelivery_notificationId_channel_key" ON "BusinessNotificationDelivery"("notificationId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessNotificationPreference_memberId_key" ON "BusinessNotificationPreference"("memberId");

-- CreateIndex
CREATE INDEX "BusinessNotificationPreference_organizationId_idx" ON "BusinessNotificationPreference"("organizationId");

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_VatClassId_fkey" FOREIGN KEY ("VatClassId") REFERENCES "VatClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "Writer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_digitalAssetId_fkey" FOREIGN KEY ("digitalAssetId") REFERENCES "DigitalAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookMetadata" ADD CONSTRAINT "BookMetadata_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookMetadata" ADD CONSTRAINT "BookMetadata_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "Writer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookMetadata" ADD CONSTRAINT "BookMetadata_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_digitalAssetId_fkey" FOREIGN KEY ("digitalAssetId") REFERENCES "DigitalAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOption" ADD CONSTRAINT "ProductVariantOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantOptionValue" ADD CONSTRAINT "ProductVariantOptionValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductVariantOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCode" ADD CONSTRAINT "ProductCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCode" ADD CONSTRAINT "ProductCode_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalDelivery" ADD CONSTRAINT "DigitalDelivery_digitalAssetId_fkey" FOREIGN KEY ("digitalAssetId") REFERENCES "DigitalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalDelivery" ADD CONSTRAINT "DigitalDelivery_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_digitalDeliveryId_fkey" FOREIGN KEY ("digitalDeliveryId") REFERENCES "DigitalDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VatRate" ADD CONSTRAINT "VatRate_VatClassId_fkey" FOREIGN KEY ("VatClassId") REFERENCES "VatClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_salesQuotationVersionId_fkey" FOREIGN KEY ("salesQuotationVersionId") REFERENCES "SalesQuotationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSlot" ADD CONSTRAINT "ServiceSlot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ServiceSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceDropAlert" ADD CONSTRAINT "PriceDropAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceDropAlert" ADD CONSTRAINT "PriceDropAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceDropAlert" ADD CONSTRAINT "PriceDropAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "ShippingRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMembership" ADD CONSTRAINT "WarehouseMembership_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMembership" ADD CONSTRAINT "WarehouseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMembership" ADD CONSTRAINT "WarehouseMembership_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "Courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_stockLevelId_fkey" FOREIGN KEY ("stockLevelId") REFERENCES "StockLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDailySnapshot" ADD CONSTRAINT "InventoryDailySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDailySnapshot" ADD CONSTRAINT "InventoryDailySnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDailySnapshot" ADD CONSTRAINT "InventoryDailySnapshot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWarehouseDailySnapshot" ADD CONSTRAINT "InventoryWarehouseDailySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWarehouseDailySnapshot" ADD CONSTRAINT "InventoryWarehouseDailySnapshot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryWarehouseDailySnapshot" ADD CONSTRAINT "InventoryWarehouseDailySnapshot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusLog" ADD CONSTRAINT "ShipmentStatusLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentCostLog" ADD CONSTRAINT "ShipmentCostLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentCostLog" ADD CONSTRAINT "ShipmentCostLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAssignment" ADD CONSTRAINT "ShipmentAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAssignment" ADD CONSTRAINT "ShipmentAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAssignment" ADD CONSTRAINT "ShipmentAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAssignment" ADD CONSTRAINT "ShipmentAssignment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollProfile" ADD CONSTRAINT "PayrollProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollProfile" ADD CONSTRAINT "PayrollProfile_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollProfileId_fkey" FOREIGN KEY ("payrollProfileId") REFERENCES "PayrollProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollEntryId_fkey" FOREIGN KEY ("payrollEntryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_budgetClearedById_fkey" FOREIGN KEY ("budgetClearedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_endorsedById_fkey" FOREIGN KEY ("endorsedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_assignedProcurementOfficerId_fkey" FOREIGN KEY ("assignedProcurementOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionItem" ADD CONSTRAINT "PurchaseRequisitionItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionItem" ADD CONSTRAINT "PurchaseRequisitionItem_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionAttachment" ADD CONSTRAINT "PurchaseRequisitionAttachment_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionAttachment" ADD CONSTRAINT "PurchaseRequisitionAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionApprovalEvent" ADD CONSTRAINT "PurchaseRequisitionApprovalEvent_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionApprovalEvent" ADD CONSTRAINT "PurchaseRequisitionApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionVersion" ADD CONSTRAINT "PurchaseRequisitionVersion_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionVersion" ADD CONSTRAINT "PurchaseRequisitionVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionNotification" ADD CONSTRAINT "PurchaseRequisitionNotification_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionNotification" ADD CONSTRAINT "PurchaseRequisitionNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAisle" ADD CONSTRAINT "WarehouseAisle_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "WarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseBin" ADD CONSTRAINT "WarehouseBin_aisleId_fkey" FOREIGN KEY ("aisleId") REFERENCES "WarehouseAisle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBinLevel" ADD CONSTRAINT "StockBinLevel_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBinLevel" ADD CONSTRAINT "StockBinLevel_binId_fkey" FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBinLevel" ADD CONSTRAINT "StockBinLevel_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerification" ADD CONSTRAINT "InventoryVerification_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerification" ADD CONSTRAINT "InventoryVerification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerification" ADD CONSTRAINT "InventoryVerification_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationCommitteeMember" ADD CONSTRAINT "InventoryVerificationCommitteeMember_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "InventoryVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationCommitteeMember" ADD CONSTRAINT "InventoryVerificationCommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationLine" ADD CONSTRAINT "InventoryVerificationLine_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "InventoryVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationLine" ADD CONSTRAINT "InventoryVerificationLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationLine" ADD CONSTRAINT "InventoryVerificationLine_binId_fkey" FOREIGN KEY ("binId") REFERENCES "WarehouseBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationApprovalEvent" ADD CONSTRAINT "InventoryVerificationApprovalEvent_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "InventoryVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVerificationApprovalEvent" ADD CONSTRAINT "InventoryVerificationApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderAlert" ADD CONSTRAINT "ReorderAlert_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderAlert" ADD CONSTRAINT "ReorderAlert_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderAlert" ADD CONSTRAINT "ReorderAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_supervisorEndorsedById_fkey" FOREIGN KEY ("supervisorEndorsedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_projectManagerEndorsedById_fkey" FOREIGN KEY ("projectManagerEndorsedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_adminApprovedById_fkey" FOREIGN KEY ("adminApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestAttachment" ADD CONSTRAINT "MaterialRequestAttachment_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestAttachment" ADD CONSTRAINT "MaterialRequestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestApprovalEvent" ADD CONSTRAINT "MaterialRequestApprovalEvent_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequestApprovalEvent" ADD CONSTRAINT "MaterialRequestApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReleaseNote" ADD CONSTRAINT "MaterialReleaseNote_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReleaseNote" ADD CONSTRAINT "MaterialReleaseNote_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReleaseNote" ADD CONSTRAINT "MaterialReleaseNote_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReleaseNoteItem" ADD CONSTRAINT "MaterialReleaseNoteItem_materialReleaseNoteId_fkey" FOREIGN KEY ("materialReleaseNoteId") REFERENCES "MaterialReleaseNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReleaseNoteItem" ADD CONSTRAINT "MaterialReleaseNoteItem_materialRequestItemId_fkey" FOREIGN KEY ("materialRequestItemId") REFERENCES "MaterialRequestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReleaseNoteItem" ADD CONSTRAINT "MaterialReleaseNoteItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegister" ADD CONSTRAINT "AssetRegister_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegister" ADD CONSTRAINT "AssetRegister_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegister" ADD CONSTRAINT "AssetRegister_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "MaterialRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegister" ADD CONSTRAINT "AssetRegister_materialReleaseNoteId_fkey" FOREIGN KEY ("materialReleaseNoteId") REFERENCES "MaterialReleaseNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegister" ADD CONSTRAINT "AssetRegister_materialReleaseItemId_fkey" FOREIGN KEY ("materialReleaseItemId") REFERENCES "MaterialReleaseNoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegister" ADD CONSTRAINT "AssetRegister_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPortalAccess" ADD CONSTRAINT "SupplierPortalAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPortalAccess" ADD CONSTRAINT "SupplierPortalAccess_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPortalAccess" ADD CONSTRAINT "SupplierPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProfileUpdateRequest" ADD CONSTRAINT "SupplierProfileUpdateRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProfileUpdateRequest" ADD CONSTRAINT "SupplierProfileUpdateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProfileUpdateRequest" ADD CONSTRAINT "SupplierProfileUpdateRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFeedback" ADD CONSTRAINT "SupplierFeedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFeedback" ADD CONSTRAINT "SupplierFeedback_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPortalNotification" ADD CONSTRAINT "SupplierPortalNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPortalNotification" ADD CONSTRAINT "SupplierPortalNotification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPortalNotification" ADD CONSTRAINT "SupplierPortalNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPortalAccess" ADD CONSTRAINT "InvestorPortalAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPortalAccess" ADD CONSTRAINT "InvestorPortalAccess_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPortalAccess" ADD CONSTRAINT "InvestorPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_beneficiaryVerifiedById_fkey" FOREIGN KEY ("beneficiaryVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorCapitalTransaction" ADD CONSTRAINT "InvestorCapitalTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorCapitalTransaction" ADD CONSTRAINT "InvestorCapitalTransaction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorCapitalTransaction" ADD CONSTRAINT "InvestorCapitalTransaction_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProductAllocation" ADD CONSTRAINT "InvestorProductAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProductAllocation" ADD CONSTRAINT "InvestorProductAllocation_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProductAllocation" ADD CONSTRAINT "InvestorProductAllocation_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRun" ADD CONSTRAINT "InvestorProfitRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRun" ADD CONSTRAINT "InvestorProfitRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRun" ADD CONSTRAINT "InvestorProfitRun_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunVariant" ADD CONSTRAINT "InvestorProfitRunVariant_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunVariant" ADD CONSTRAINT "InvestorProfitRunVariant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestorProfitRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunAllocation" ADD CONSTRAINT "InvestorProfitRunAllocation_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunAllocation" ADD CONSTRAINT "InvestorProfitRunAllocation_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunAllocation" ADD CONSTRAINT "InvestorProfitRunAllocation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestorProfitRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunAllocation" ADD CONSTRAINT "InvestorProfitRunAllocation_sourceAllocationId_fkey" FOREIGN KEY ("sourceAllocationId") REFERENCES "InvestorProductAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitRunAllocation" ADD CONSTRAINT "InvestorProfitRunAllocation_variantLineId_fkey" FOREIGN KEY ("variantLineId") REFERENCES "InvestorProfitRunVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestorProfitRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfitPayout" ADD CONSTRAINT "InvestorProfitPayout_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InvestorCapitalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWithdrawalRequest" ADD CONSTRAINT "InvestorWithdrawalRequest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWithdrawalRequest" ADD CONSTRAINT "InvestorWithdrawalRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWithdrawalRequest" ADD CONSTRAINT "InvestorWithdrawalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWithdrawalRequest" ADD CONSTRAINT "InvestorWithdrawalRequest_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWithdrawalRequest" ADD CONSTRAINT "InvestorWithdrawalRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InvestorCapitalTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplierInvite" ADD CONSTRAINT "RfqSupplierInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplierInvite" ADD CONSTRAINT "RfqSupplierInvite_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqSupplierInvite" ADD CONSTRAINT "RfqSupplierInvite_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_rfqSupplierInviteId_fkey" FOREIGN KEY ("rfqSupplierInviteId") REFERENCES "RfqSupplierInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "RfqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationItem" ADD CONSTRAINT "SupplierQuotationItem_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationAttachment" ADD CONSTRAINT "SupplierQuotationAttachment_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationAttachment" ADD CONSTRAINT "SupplierQuotationAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAward" ADD CONSTRAINT "RfqAward_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategorySupplier" ADD CONSTRAINT "SupplierCategorySupplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategorySupplier" ADD CONSTRAINT "SupplierCategorySupplier_supplierCategoryId_fkey" FOREIGN KEY ("supplierCategoryId") REFERENCES "SupplierCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCategorySupplier" ADD CONSTRAINT "SupplierCategorySupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqCategoryTarget" ADD CONSTRAINT "RfqCategoryTarget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqCategoryTarget" ADD CONSTRAINT "RfqCategoryTarget_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqCategoryTarget" ADD CONSTRAINT "RfqCategoryTarget_supplierCategoryId_fkey" FOREIGN KEY ("supplierCategoryId") REFERENCES "SupplierCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAttachment" ADD CONSTRAINT "RfqAttachment_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqAttachment" ADD CONSTRAINT "RfqAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqNotification" ADD CONSTRAINT "RfqNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqNotification" ADD CONSTRAINT "RfqNotification_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "RfqSupplierInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqNotification" ADD CONSTRAINT "RfqNotification_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqNotification" ADD CONSTRAINT "RfqNotification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_committeeApprovedById_fkey" FOREIGN KEY ("committeeApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_finalApprovedById_fkey" FOREIGN KEY ("finalApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatement" ADD CONSTRAINT "ComparativeStatement_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementLine" ADD CONSTRAINT "ComparativeStatementLine_comparativeStatementId_fkey" FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementLine" ADD CONSTRAINT "ComparativeStatementLine_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementLine" ADD CONSTRAINT "ComparativeStatementLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementApprovalEvent" ADD CONSTRAINT "ComparativeStatementApprovalEvent_comparativeStatementId_fkey" FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementApprovalEvent" ADD CONSTRAINT "ComparativeStatementApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementNotification" ADD CONSTRAINT "ComparativeStatementNotification_comparativeStatementId_fkey" FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparativeStatementNotification" ADD CONSTRAINT "ComparativeStatementNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_committeeApprovedById_fkey" FOREIGN KEY ("committeeApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_finalApprovedById_fkey" FOREIGN KEY ("finalApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_sourceComparativeStatementId_fkey" FOREIGN KEY ("sourceComparativeStatementId") REFERENCES "ComparativeStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_termsTemplateId_fkey" FOREIGN KEY ("termsTemplateId") REFERENCES "PurchaseOrderTermsTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderTermsTemplate" ADD CONSTRAINT "PurchaseOrderTermsTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderTermsTemplate" ADD CONSTRAINT "PurchaseOrderTermsTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderApprovalEvent" ADD CONSTRAINT "PurchaseOrderApprovalEvent_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderApprovalEvent" ADD CONSTRAINT "PurchaseOrderApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderNotification" ADD CONSTRAINT "PurchaseOrderNotification_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderNotification" ADD CONSTRAINT "PurchaseOrderNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLandedCost" ADD CONSTRAINT "PurchaseOrderLandedCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLandedCost" ADD CONSTRAINT "PurchaseOrderLandedCost_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_requesterConfirmedById_fkey" FOREIGN KEY ("requesterConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptAttachment" ADD CONSTRAINT "GoodsReceiptAttachment_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptAttachment" ADD CONSTRAINT "GoodsReceiptAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptVendorEvaluation" ADD CONSTRAINT "GoodsReceiptVendorEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptVendorEvaluation" ADD CONSTRAINT "GoodsReceiptVendorEvaluation_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_matchedById_fkey" FOREIGN KEY ("matchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_paymentHoldReleasedById_fkey" FOREIGN KEY ("paymentHoldReleasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorMasterChangeRequest" ADD CONSTRAINT "InvestorMasterChangeRequest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorMasterChangeRequest" ADD CONSTRAINT "InvestorMasterChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorMasterChangeRequest" ADD CONSTRAINT "InvestorMasterChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfileUpdateRequest" ADD CONSTRAINT "InvestorProfileUpdateRequest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfileUpdateRequest" ADD CONSTRAINT "InvestorProfileUpdateRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProfileUpdateRequest" ADD CONSTRAINT "InvestorProfileUpdateRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPortalNotification" ADD CONSTRAINT "InvestorPortalNotification_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorPortalNotification" ADD CONSTRAINT "InvestorPortalNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorInternalNotification" ADD CONSTRAINT "InvestorInternalNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorInternalNotification" ADD CONSTRAINT "InvestorInternalNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorStatementSchedule" ADD CONSTRAINT "InvestorStatementSchedule_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorStatementSchedule" ADD CONSTRAINT "InvestorStatementSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorStatementSchedule" ADD CONSTRAINT "InvestorStatementSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorDocument" ADD CONSTRAINT "InvestorDocument_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorDocument" ADD CONSTRAINT "InvestorDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorDocument" ADD CONSTRAINT "InvestorDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_comparativeStatementId_fkey" FOREIGN KEY ("comparativeStatementId") REFERENCES "ComparativeStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_managerApprovedById_fkey" FOREIGN KEY ("managerApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_financeApprovedById_fkey" FOREIGN KEY ("financeApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_treasuryProcessedById_fkey" FOREIGN KEY ("treasuryProcessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestApprovalEvent" ADD CONSTRAINT "PaymentRequestApprovalEvent_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestApprovalEvent" ADD CONSTRAINT "PaymentRequestApprovalEvent_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestNotification" ADD CONSTRAINT "PaymentRequestNotification_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestNotification" ADD CONSTRAINT "PaymentRequestNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestNotification" ADD CONSTRAINT "PaymentRequestNotification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierReturnId_fkey" FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_supplierReturnId_fkey" FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaPolicy" ADD CONSTRAINT "SupplierSlaPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaPolicy" ADD CONSTRAINT "SupplierSlaPolicy_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaPolicy" ADD CONSTRAINT "SupplierSlaPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaFinancialRule" ADD CONSTRAINT "SupplierSlaFinancialRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaFinancialRule" ADD CONSTRAINT "SupplierSlaFinancialRule_supplierSlaPolicyId_fkey" FOREIGN KEY ("supplierSlaPolicyId") REFERENCES "SupplierSlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaFinancialRule" ADD CONSTRAINT "SupplierSlaFinancialRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_disputeRaisedById_fkey" FOREIGN KEY ("disputeRaisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_disputeResolvedById_fkey" FOREIGN KEY ("disputeResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_supplierSlaPolicyId_fkey" FOREIGN KEY ("supplierSlaPolicyId") REFERENCES "SupplierSlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaBreach" ADD CONSTRAINT "SupplierSlaBreach_terminationCaseId_fkey" FOREIGN KEY ("terminationCaseId") REFERENCES "SupplierSlaTerminationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase" ADD CONSTRAINT "SupplierSlaTerminationCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase" ADD CONSTRAINT "SupplierSlaTerminationCase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase" ADD CONSTRAINT "SupplierSlaTerminationCase_supplierSlaPolicyId_fkey" FOREIGN KEY ("supplierSlaPolicyId") REFERENCES "SupplierSlaPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase" ADD CONSTRAINT "SupplierSlaTerminationCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase" ADD CONSTRAINT "SupplierSlaTerminationCase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSlaTerminationCase" ADD CONSTRAINT "SupplierSlaTerminationCase_triggerBreachId_fkey" FOREIGN KEY ("triggerBreachId") REFERENCES "SupplierSlaBreach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferItem" ADD CONSTRAINT "WarehouseTransferItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferItem" ADD CONSTRAINT "WarehouseTransferItem_warehouseTransferId_fkey" FOREIGN KEY ("warehouseTransferId") REFERENCES "WarehouseTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManProfile" ADD CONSTRAINT "DeliveryManProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManProfile" ADD CONSTRAINT "DeliveryManProfile_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManProfile" ADD CONSTRAINT "DeliveryManProfile_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManProfile" ADD CONSTRAINT "DeliveryManProfile_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManReference" ADD CONSTRAINT "DeliveryManReference_deliveryManProfileId_fkey" FOREIGN KEY ("deliveryManProfileId") REFERENCES "DeliveryManProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManDocument" ADD CONSTRAINT "DeliveryManDocument_deliveryManProfileId_fkey" FOREIGN KEY ("deliveryManProfileId") REFERENCES "DeliveryManProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManDocument" ADD CONSTRAINT "DeliveryManDocument_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "DeliveryManReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryManDocument" ADD CONSTRAINT "DeliveryManDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_deliveryManProfileId_fkey" FOREIGN KEY ("deliveryManProfileId") REFERENCES "DeliveryManProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignmentLog" ADD CONSTRAINT "DeliveryAssignmentLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAssignmentLog" ADD CONSTRAINT "DeliveryAssignmentLog_deliveryAssignmentId_fkey" FOREIGN KEY ("deliveryAssignmentId") REFERENCES "DeliveryAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehousePickupProof" ADD CONSTRAINT "WarehousePickupProof_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehousePickupProof" ADD CONSTRAINT "WarehousePickupProof_deliveryAssignmentId_fkey" FOREIGN KEY ("deliveryAssignmentId") REFERENCES "DeliveryAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCapability" ADD CONSTRAINT "OrganizationCapability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMemberRoleGrant" ADD CONSTRAINT "OrganizationMemberRoleGrant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAddress" ADD CONSTRAINT "OrganizationAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationBranch" ADD CONSTRAINT "OrganizationBranch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAccount" ADD CONSTRAINT "BusinessAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAccount" ADD CONSTRAINT "BusinessAccount_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "BusinessPricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPricingRule" ADD CONSTRAINT "BusinessPricingRule_pricingTierId_fkey" FOREIGN KEY ("pricingTierId") REFERENCES "BusinessPricingTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPrice" ADD CONSTRAINT "ContractPrice_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCreditAccount" ADD CONSTRAINT "OrganizationCreditAccount_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "OrganizationCreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRfq" ADD CONSTRAINT "SalesRfq_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRfq" ADD CONSTRAINT "SalesRfq_requestedByMemberId_fkey" FOREIGN KEY ("requestedByMemberId") REFERENCES "OrganizationMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRfqItem" ADD CONSTRAINT "SalesRfqItem_salesRfqId_fkey" FOREIGN KEY ("salesRfqId") REFERENCES "SalesRfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRfqAttachment" ADD CONSTRAINT "SalesRfqAttachment_salesRfqId_fkey" FOREIGN KEY ("salesRfqId") REFERENCES "SalesRfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_salesRfqId_fkey" FOREIGN KEY ("salesRfqId") REFERENCES "SalesRfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotationVersion" ADD CONSTRAINT "SalesQuotationVersion_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SalesQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuotationItem" ADD CONSTRAINT "SalesQuotationItem_quotationVersionId_fkey" FOREIGN KEY ("quotationVersionId") REFERENCES "SalesQuotationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPurchaseOrder" ADD CONSTRAINT "CustomerPurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPurchaseOrder" ADD CONSTRAINT "CustomerPurchaseOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SalesQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPurchaseOrder" ADD CONSTRAINT "CustomerPurchaseOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAgreement" ADD CONSTRAINT "PartnerAgreement_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAgreementVersion" ADD CONSTRAINT "PartnerAgreementVersion_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "PartnerAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAgreementVersion" ADD CONSTRAINT "PartnerAgreementVersion_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAsset" ADD CONSTRAINT "PartnerAsset_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_agreementVersionId_fkey" FOREIGN KEY ("agreementVersionId") REFERENCES "PartnerAgreementVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PartnerAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAttribution" ADD CONSTRAINT "PartnerAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_wonOrderId_fkey" FOREIGN KEY ("wonOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLead" ADD CONSTRAINT "PartnerLead_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "PartnerLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_agreementVersionId_fkey" FOREIGN KEY ("agreementVersionId") REFERENCES "PartnerAgreementVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "CommissionRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_partnerLeadId_fkey" FOREIGN KEY ("partnerLeadId") REFERENCES "PartnerLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "CommissionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlement" ADD CONSTRAINT "PartnerSettlement_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlement" ADD CONSTRAINT "PartnerSettlement_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "PartnerPayoutAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlement" ADD CONSTRAINT "PartnerSettlement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlementLine" ADD CONSTRAINT "PartnerSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "PartnerSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlementLine" ADD CONSTRAINT "PartnerSettlementLine_commissionEntryId_fkey" FOREIGN KEY ("commissionEntryId") REFERENCES "CommissionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutAccount" ADD CONSTRAINT "PartnerPayoutAccount_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayoutAccount" ADD CONSTRAINT "PartnerPayoutAccount_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAuditLog" ADD CONSTRAINT "BusinessAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAuditLog" ADD CONSTRAINT "BusinessAuditLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "BusinessFraudRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "PartnerAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_partnerLeadId_fkey" FOREIGN KEY ("partnerLeadId") REFERENCES "PartnerLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_commissionEntryId_fkey" FOREIGN KEY ("commissionEntryId") REFERENCES "CommissionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRiskCase" ADD CONSTRAINT "BusinessRiskCase_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNotification" ADD CONSTRAINT "BusinessNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNotification" ADD CONSTRAINT "BusinessNotification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNotification" ADD CONSTRAINT "BusinessNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNotificationDelivery" ADD CONSTRAINT "BusinessNotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "BusinessNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNotificationPreference" ADD CONSTRAINT "BusinessNotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessNotificationPreference" ADD CONSTRAINT "BusinessNotificationPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- External PC Builder tables are migration-owned and intentionally excluded
-- from schema.prisma. They remain part of the reusable installation baseline.
CREATE TABLE "PcBuildCartItem" (
  "cartItemId" INTEGER NOT NULL,
  "buildId" VARCHAR(64) NOT NULL,
  "slot" VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PcBuildCartItem_pkey" PRIMARY KEY ("cartItemId"),
  CONSTRAINT "PcBuildCartItem_cartItemId_fkey"
    FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PcBuildCartItem_buildId_slot_key"
  ON "PcBuildCartItem"("buildId", "slot");
CREATE INDEX "PcBuildCartItem_buildId_idx"
  ON "PcBuildCartItem"("buildId");

CREATE TABLE "PcBuildOrderItem" (
  "orderItemId" INTEGER NOT NULL,
  "orderId" INTEGER NOT NULL,
  "buildId" VARCHAR(64) NOT NULL,
  "slot" VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PcBuildOrderItem_pkey" PRIMARY KEY ("orderItemId"),
  CONSTRAINT "PcBuildOrderItem_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PcBuildOrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PcBuildOrderItem_buildId_slot_key"
  ON "PcBuildOrderItem"("buildId", "slot");
CREATE INDEX "PcBuildOrderItem_orderId_buildId_idx"
  ON "PcBuildOrderItem"("orderId", "buildId");

CREATE TABLE "PcBuilderSavedBuild" (
  "id" VARCHAR(64) NOT NULL,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "shareToken" VARCHAR(64) NOT NULL,
  "selectionHash" CHAR(64) NOT NULL,
  "selections" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PcBuilderSavedBuild_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PcBuilderSavedBuild_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PcBuilderSavedBuild_selections_object_check"
    CHECK (jsonb_typeof("selections") = 'object')
);

CREATE UNIQUE INDEX "PcBuilderSavedBuild_shareToken_key"
  ON "PcBuilderSavedBuild"("shareToken");
CREATE UNIQUE INDEX "PcBuilderSavedBuild_userId_selectionHash_key"
  ON "PcBuilderSavedBuild"("userId", "selectionHash");
CREATE INDEX "PcBuilderSavedBuild_userId_updatedAt_idx"
  ON "PcBuilderSavedBuild"("userId", "updatedAt" DESC);
