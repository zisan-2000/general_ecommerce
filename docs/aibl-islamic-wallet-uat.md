# AIBL Islamic Wallet (Al-Arafah Islami Bank) — UAT integration

**This is AIBL Islamic Wallet, NOT Islami Bank Bangladesh PLC.** This feature is UAT only and is **not enabled by default**. Nothing here authorizes a live payment rollout.

## Supplied documents and unresolved bank contract details

- AIBL Islamic Wallet Payment Gateway preliminary v1.0: token = POST form-url-encoded PGService/token; order creation = POST form-url-encoded PGService/orderID; verification = POST form-url-encoded PGService/verify.
- PG callback documented as POST, with RESCODE, STATUS, AMOUNT, MESSAGE, SESSIONKEY, TRANSNO and BILLNO. A callback is **never** proof of payment.
- The PDF/Postman point to iwtest.aibl.com.bd (UAT API /iwPGAPI; hosted /iwepayuat/epayment/{OrderID}); the supplied UAT credentials note points to iwpay.aibl.com.bd (API /iwPGAPI; hosted /iwepay/epayment/{OrderID}). These hosts are not interchangeable without bank confirmation.
- The Postman collection contains only token/orderID calls, no verify request. It has placeholder redirect URLs ("1"), a hardcoded token and test credentials. Do not import/commit this collection with embedded secrets, and never use those placeholders.
- The PDF describes walletNo as required; the provided orderID Postman request leaves it blank and the screenshot shows wallet entry on the hosted page. Our UAT attempt sends an empty walletNo for bank-hosted entry; **confirm this is accepted** before enabling.
- Verify response documented as code=200, msg="Order Verified", transactionID. Confirm actual capitalization/types with bank-hosted UAT evidence. No authoritative unsuccessful transaction verification mapping was provided; browser DECLINE/CANCEL and non-200 verify are kept PENDING for manual review. Do not release inventory based on browser data alone.
- Callback URLs include a signed query-state and bill reference. Confirm bank preserves query strings when posting to approved_url, decline_url and cancel_url.

## Server-only environment setup

Set these **outside Git** (deployment secret manager / private .env):

    AIBL_WALLET_ENV=uat
    AIBL_WALLET_UAT_HOST=iwtest.aibl.com.bd
    AIBL_WALLET_API_USER=
    AIBL_WALLET_API_PASS=
    AIBL_WALLET_MERCHANT_ID=
    AIBL_WALLET_ACCESS_KEY=

The default is the PDF/Postman test host. Using iwpay.aibl.com.bd is rejected unless AIBL_WALLET_IWPAY_UAT_CONFIRMED=true is also explicitly set **after the bank confirms it is a UAT gateway for these credentials**. Live mode always returns 503.

Also configure public HTTPS NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL and NEXTAUTH_SECRET or AUTH_SECRET for callback signing. Never use localhost as the bank callback origin. Register and activate an AIBL Wallet gateway in Admin > Payment Settings **only after** configuration and staging sign-off.

The supplied credential text/Postman are sensitive. Rotate UAT credentials if the files have been shared or committed. No secrets, tokens, session keys, full provider bodies, or customer wallet numbers belong in source code or payment logs.

## Server flow

1. Order created as PENDING / UNPAID with warehouse stock reservations, not deductions.
2. Initiation authenticated for owner or signed guest token, same as EPS; server derives BDT amount exclusively from Order.
3. Obtain a one-time token and durably store a unique merchant billNo as Payment.externalId **before** PGService/orderID network call. Concurrent/replayed initiations cannot duplicate the bank charge.
4. On documented orderID response, check that the returned amount exactly matches the Order and store the bank OrderID for a whitelisted HTTPS redirect.
5. Bank POST callbacks check signed state, expected BILLNO and AMOUNT, then perform server-to-server PGService/verify using the bank OrderID + original billNo + amount.
6. Only code 200 + exact "Order Verified" + non-empty transactionID can capture payment and update Order to PAID; stock reservations are validated and committed in the same database transaction.
7. Any unknown, unsuccessful or timed-out status is **PENDING**, never a fabricated failure. Existing INITIATED attempts cannot be retried by creating a new charge. Use /api/aibl-wallet/status or authenticated reconciliation cron to review pending attempts.
8. AIBL original-source automatic refunds are **not** part of the documented contract. Use the existing manual refund review/payout workflow.

## Endpoints

- POST /api/aibl-wallet/init — user/guest authenticated initial payment or redirect reuse.
- POST /api/aibl-wallet/status — user/guest/admin payment verification.
- POST /api/aibl-wallet/approved|decline|cancel — signed redirect callbacks.
- GET /api/cron/reconcile-aibl-wallet — CRON_SECRET Bearer; checks a bounded pending batch and safely expires only untouched orders without any payment attempt.

## Staging acceptance tests (no live transfers)

- Bank confirmation of UAT hostname, callback behavior, walletNo rule, verify response field casing, and terminal outcome contract.
- Authenticated and guest payment attempts, server-side amount and BDT enforcement, signed callback state and amount mismatch rejection.
- Real verified success: payment CAPTURED, order PAID, inventory committed exactly once. Duplicate callbacks/status/cron must be idempotent.
- Browser cancel/decline and non-200 verification: pending/manual review, never early stock release.
- Timeout before/after remote bank order creation: durable pending attempt blocks unsafe retry.
- Competing order changes/shipments, wrong authorization, disabled gateway, tampered payment reference, wrong merchant account.
- Cart/analytics success UI should derive from an authenticated server payment state rather than a user-editable URL status. Existing common payment-result page has this separate hardening gap.
- Verify required migrations actually deployed from active prisma.config.ts (currently migrations-release), and test order/checkout/stock regression before deployment.

**Do not infer a live URL, automatically mark a declined/cancelled attempt as terminal, or merge this UAT feature into production before the above are signed off.**
