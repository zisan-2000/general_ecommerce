# AIBL Islamic Wallet UAT Integration

এই integration Al-Arafah Islami Bank-এর Islamic Wallet-এর জন্য। Branch:
`feature/aibl-islamic-wallet-uat-20261017`। Live mode নেই; gateway default disabled।
Implementation এবং static code review হয়েছে। কোনো build/lint/typecheck/test,
Prisma execution, database connection, bank API request বা payment transaction
চালানো হয়নি। Runtime UAT success বা production readiness দাবি করা হচ্ছে না।

## Reference এবং API contract

Supplied credentials note-এর public URLs authoritative:

- API: `https://iwpay.aibl.com.bd/iwPGAPI/`
- Hosted: `https://iwpay.aibl.com.bd/iwepay/epayment/{OrderID}`

PDF-এর ছয়টি page ও supplied Postman-এর দুইটি request review করা হয়েছে। PDF/Postman-এর
`iwtest`/`iwepayuat` example host দিয়ে issued URLs override করা হয়নি। Postman-এর
placeholder callback URLs, embedded credentials/token বা example bill/amount কোডে
আনা হয়নি। Documents-এর sample commands execution instructions হিসেবে নেওয়া হয়নি।

| Operation | Method এবং endpoint | Exact form fields | Response acceptance |
| --- | --- | --- | --- |
| Token | POST `PGService/token` | `api_user`, `api_pass`, `merchantID` | Non-empty `token`; any supplied lower-case `code` must be 200 |
| Initialize | POST `PGService/orderID` | `api_user`, `api_pass`, `merchantID`, `accessKey`, `walletNo`, `amount`, `approved_url`, `decline_url`, `cancel_url`, `pay_description`, `billNo`, `token` | Safe string `OrderID`, exact normalized `amount` matching DB; conflicting supplied lower-case `code` rejects |
| Verify | POST `PGService/verify` | `api_user`, `api_pass`, `merchantID`, `accessKey`, `OrderID`, `amount`, `bill_no` | Exact lower-case `code` 200 or string `200`, exact `msg` = `Order Verified`, valid non-zero `transactionID` |

সব bank request native `fetch()`/`URLSearchParams` দিয়ে
`application/x-www-form-urlencoded`। Redirect following বন্ধ, timeout 20 seconds,
response body maximum 32 KB। কোনো automatic bank-request retry নেই। One-time token
শুধু ওই initialization-এর memory-তে থাকে; DB, browser বা logs-এ নেই।

Verify helper `Code`, `Msg`, `TransactionID`, `transactionId` aliases, message
case-folding বা trimming করে success বানায় না। Transaction ID string অথবা
positive safe integer হতে পারে; unsafe numeric IDs reject হয়। Real UAT-এর actual
casing/types না মেলা পর্যন্ত pending থাকবে; aliases অনুমান করে fallback হবে না।

PDF verify response-এ echoed amount/currency/bill documented নেই। সেগুলো response-এ
আছে বলে validation claim করা হয়নি। Verify request original bank OrderID, bill,
validated initialization amount এবং authoritative DB Order-এর সঙ্গে bind হয়।
PCC read-only comparison-এর echoed amount/reference match columns তাই N/A।

## Server configuration

নিজের private environment-এ সেট করুন; actual values Git-এ দেবেন না:

```env
AIBL_WALLET_ENV=uat
AIBL_WALLET_API_BASE_URL=https://iwpay.aibl.com.bd/iwPGAPI/
AIBL_WALLET_HOSTED_BASE_URL=https://iwpay.aibl.com.bd/iwepay/epayment/
AIBL_WALLET_API_USER=
AIBL_WALLET_API_PASS=
AIBL_WALLET_MERCHANT_ID=
AIBL_WALLET_ACCESS_KEY=
```

URLs exact trailing slash-সহ দরকার। Different host/path, HTTP, query credentials
বা `AIBL_WALLET_ENV=live` reject হবে। `.env.example`-এ শুধু public configuration ও
empty credential placeholders আছে। `.env.local` পড়া/পরিবর্তন করা হয়নি।

আরও প্রয়োজন:

- `NEXT_PUBLIC_APP_URL` অথবা supported `NEXT_PUBLIC_BASE_URL`-এ public HTTPS app
  origin; path/query/credentials নয়। Origin নির্বাচনের existing precedence বজায় আছে।
- `NEXTAUTH_SECRET` অথবা `AUTH_SECRET`; stable private signing secret।
- Cron চালালে private `CRON_SECRET`।
- Existing PostgreSQL/auth/distributed rate-limit setup। Production runtime-এ
  existing distributed rate-limit configuration লাগবে।

Public HTTPS origin দিয়েই browser checkout খুলুন; bank callbacks ও Secure cookies
একই origin-এ ফিরতে হবে। Localhost/private HTTP callback ব্যবহার করবেন না।
**Actual payment test-এর আগে issued UAT account/wallet real funds charge করে কি না
যাচাই করুন। `iwpay` hostname বা ENV-এর `uat` label একা সেই নিশ্চয়তা দেয় না।**

## Payment এবং inventory flow

1. Admin-এ AIBL Wallet gateway create করুন; metadata শুধু type, active flag,
   contract ও `uat` environment। Credentials form বা admin GET-এ নেই।
2. Order `PENDING/UNPAID`, method `AIBL_WALLET:<gatewayId>`। Customer input amount
   bank-এ যায় না; priced Order grand total authoritative, currency BDT।
3. Physical variants, virtual bundle components ও preassembled bundle stock
   existing warehouse reservation mechanisms-এ hold হয়; AIBL holds-এর expiry null।
   Existing optional `bundleStockLimit` quota order creation-এ আগের pipeline অনুযায়ী
   set aside হয়; verification-এ সেটি দ্বিতীয়বার decrement হয় না।
4. Owner session বা signed guest authorization ছাড়া initialization হয় না। Admin
   অন্য customer's charge initialize করতে পারে না। Same-origin এবং rate-limit
   checks আছে। Fresh order response/authorized init-এ HttpOnly Secure pending
   cookie (24 hours) দেওয়া হয়; guest API token-ও 24-hour scoped order grant।
5. Existing active attempt থাকলে validated hosted URL সর্বোচ্চ 30 minutes পর্যন্ত
   reuse হয়। Otherwise নতুন remote order নয়; verification/manual review দরকার।
6. Authentication-এর পরে order lock নিয়ে unique 31-character alphanumeric bill,
   `Payment.INITIATED` এবং exact reservation snapshot durable করা হয়। এরপর lock/
   transaction ছেড়ে bank orderID request হয়। Concurrent init সর্বোচ্চ একবার
   orderID পাঠায়; race-এ unused auth token discard হতে পারে।
7. Returned OrderID/amount validate করে sanitized bank ID সংরক্ষণ হয়। Invalid
   amount/structure হলে redirect বন্ধ এবং attempt pending; raw payload সংরক্ষিত নয়।
8. Callback POST JSON অথবা form-urlencoded, maximum 16 KB। Signed query state,
   exact `BILLNO` ও `AMOUNT` validate হয়। Non-empty `TRANSNO` supplied হলে successful
   server verification-এর transaction ID-এর সঙ্গে মেলানো হয়। `SESSIONKEY`, raw
   `MESSAGE`, payload বা token সংরক্ষণ/log করা হয় না।
9. Browser APPROVED/DECLINE/CANCEL/RESCODE একা settlement করে না। Bank verify-এর
   documented success পেলেই order lock নিয়ে payment/account/bill/currency/amount,
   competing captures, reservation identity/quantities/warehouses আবার যাচাই হয়।
10. Variant/bundle holds commit, Payment CAPTURED, Order PAID, verified bank
    transaction ID, notification ও PENDING→CONFIRMED transition একই DB transaction।
    Mismatch/DB failure হলে সব settlement changes rollback; bank charge হয়ে থাকলে
    order pending রেখে manual review করতে হবে।
11. Cross-order bank OrderID/transaction reuse PostgreSQL advisory locks + metadata
    lookup দিয়ে reject হয়; নতুন partial unique indexes DB-level protection যোগ করে।
    Duplicate callback/status/cron দ্বিতীয়বার stock commit করে না।
12. Unknown/non-200/timeout/unverified decline/cancel pending রাখে। Admin order
    update বা shipment route unpaid AIBL order fulfil করতে পারে না। An uncertain
    active payment থাকলে status cancellation দিয়ে stock release করা যায় না;
    generic expired-reservation cleanup AIBL skip করে।

AIBL-এর automatic refund API implement করা হয়নি। Customer existing manual refund
channel বেছে নেবে। Existing approved refund payout tracking এখন AIBL captured
amount cap/duplicate-reference protections-ও প্রয়োগ করে; এটি bank-এ টাকা পাঠায় না।

## Checkout এবং result page

Signed-in checkout-এ COD, Manual, EPS, SSLCommerz-এর সঙ্গে AIBL option আছে।
Unauthenticated checkout-এ sign-in অথবা explicit **guest AIBL Wallet** continuation
পাওয়া যায়; অন্য methods-এর sign-in flow বজায় আছে। Guest order চাইলে backend নিজস্ব
scoped token/cookie দিয়ে authorize করে। Wallet number bank-hosted page-এ দেওয়ার
workflow ধরে `walletNo=` পাঠানো হয়েছে, supplied Postman অনুযায়ী; bank UAT-এ প্রমাণ
পাওয়া এখনো বাকি।

Original order cookie থেকে checkout-এর pending banner-এ resume/verify হয়; customer
আবার details পূরণ বা নতুন order তৈরি না করেই status দেখতে পারে। Gateway disable
করলে fresh initialization/resume বন্ধ, original account credentials থাকলে pending
verification চালু থাকে। 30-minute hosted reuse শেষ হলে নতুন charge নয়।

`/ecommerce/payment-result` URL-এর status/message/orderId উপেক্ষা করে। Trusted
callback/authorized status handler-এর signed HttpOnly read-only receipt (30 min)
থেকে exact Payment/Order পড়ে success দেখায়। Current CAPTURED + PAID + matching
amount/currency ছাড়া cart clear বা online GA4 purchase হয় না। Consent ও analytics
transaction dedupe বজায় আছে; cart clearing payment ID অনুযায়ী once-per-browser।
EPS/SSL callbacks ও EPS status route-এ একই receipt wiring যোগ হয়েছে, bank API
contract/settlement logic rewrite হয়নি। Existing COD/manual purchase behavior আছে।

Receipt expired/absent, cookies disabled বা invalid callback হলে pending দেখায়।
Resume checkout link-এর cookie/owner status flow ব্যবহার করুন। Browser বন্ধ থাকা
অবস্থায় cron capture করলে pending recovery paid state থেকে নতুন result receipt
দেয়। Guest cookie/token expiry বা নতুন browser-এ safe self-service recovery নেই;
identity যাচাই ছাড়া phone/email দিয়ে order access দেওয়া হয়নি। Staff review লাগবে।

## Admin এবং diagnostics

Admin Payment Settings-এ `AIBL_WALLET` create/edit/enable/disable, UAT badge,
order-ID verification এবং PCC link আছে। AIBL settings mutation ও verification-এ
GLOBAL `settings.payment.manage` বা `settings.manage` প্রয়োজন। Verification এবং
PCC access-এ banned staff denied।
PCC-তে AIBL filter, transaction history, bank IDs-এর sanitized projection,
timeline, disputes, refund tracking, API latency/errors, Request ID correlation
এবং comparison support আছে। Network probes-এর authorization বদলানো হয়নি।

**Compare gateway status** read-only। **Verify and settle pending AIBL payment**
explicit bank verification করে eligible payment capture করতে পারে। Unknown result
pending/manual review। EPS/SSL synthetic simulation options অপরিবর্তিত; AIBL-এর
জন্য simulated bank success-কে real UAT success হিসেবে দেখানো হয়নি।

## Migration review এবং আপনার commands

Active config `prisma.config.ts` → `prisma/migrations-release`। `prisma/migrations`
archived history, active নয়। Feature branch-এ main-এর baseline/core dependencies ও
Payment Control Center/network migrations অনুপস্থিত ছিল। Local main-এর missing 13
historical SQL files, README/provider lock ফিরেছে; existing SQL overwrite হয়নি।
`schema.prisma` ও production config পরিবর্তন হয়নি।

নতুন active migration:
`20261017120000_aibl_wallet_reference_uniqueness/migration.sql`। Existing Payment
JSON metadata-তে শুধু দুইটি AIBL-specific partial unique index। Model rewrite,
financial data update/delete/seed নেই। Transaction, lock timeout 5s ও statement
timeout 60s আছে। Expression indexes migration-owned; Prisma schema DSL-এ represent
করা হয়নি। অন্য providers-এর rows index predicate-এ পড়ে না।

প্রথমে নিজে local/staging target, backup, migration ledger এবং pending SQL review
করুন। Existing populated DB-তে restored baseline/dependencies unrecorded হলে
সরাসরি deploy করবেন না—history/schema equivalence review করে আলাদা reconciliation
plan লাগবে। এই feature-এর অংশ হিসেবে কোনো reset/resolve/db-push command নেই।
Bank IDs-এর existing duplicate থাকলে index creation reject করে rollback হবে;
কোনো financial row delete করে uniqueness ঠিক করবেন না।

আপনি চালাবেন, প্রতিটি failure-এ থামবেন:

```powershell
npx --no-install prisma migrate status
npx --no-install prisma validate
```

সব pending migration ও history সঠিক, reviewed local/staging target নিশ্চিত হলে:

```powershell
npx --no-install prisma migrate deploy
npx --no-install prisma generate
npm run typecheck
npm run lint
npm run build
```

এরপর existing regression suites:

```powershell
npm run test:phase0
npm run test:order-idempotency
npm run test:order-inventory
npm run test:configurable-bundles
npm run test:warehouse-bundle-stock
```

প্রকৃত bank requests-এর আগে UAT charging boundary নিশ্চিত করুন। অন্য secrets বা
credentials report-এ দেবেন না। Future automated coverage-এ AIBL transport mocks,
callback validation, cross-order duplicate bank references ও concurrent settlement
assertions যোগ করা প্রয়োজন; এই implementation-এ test execution হয়নি।

## Cron scheduling

`GET /api/cron/reconcile-aibl-wallet`, header `Authorization: Bearer <CRON_SECRET>`।
Maximum five pending INITIATED/AUTHORIZED attempts, oldest updated first, minimum
60-second spacing। Requests sequential এবং DB transaction-এর বাইরে। Missing
bank OrderID/failed verification queue-এর পেছনে যায়; কোনো cancellation/stock release
হয় না। Route তৈরি হয়েছে, scheduler activate হয়নি।

Deployment scheduler-এ HTTPS app URL দিয়ে প্রতি পাঁচ মিনিটে authenticated GET
configure করুন; secret secure header store-এ, URL query-তে নয়। Existing payment
comparison cron read-only diagnostic support-ও AIBL include করে।

## Manual UAT checklist

প্রথমে isolated local/staging DB ও authorized test account ব্যবহার করুন। Negative
response/timing cases আপনার isolated transport mock/harness-এ করা যাবে; real bank
payload বা signed callback URL public logs-এ রাখবেন না। নিচের প্রতিটি case-এর report:
UTC time, app order ID, sanitized merchant bill, Payment/Order state before/after,
reservation/stock changes, HTTP status/allowlisted error এবং timeline outcome।
Token/access key/password/SESSIONKEY/raw bank response বা wallet details দেবেন না।

| ID | Step | Expected result | Report focus |
| --- | --- | --- | --- |
| IW01 | Env/migration readiness review; credentials নিজে সেট | UAT-only config; pending SQL/history reviewed; client regenerated | Command results; no secrets |
| IW02 | Checkout initialize করে AUTH phase দেখুন | Token generation server-only; no browser token; then one orderID call | AUTH HTTP status/duration |
| IW03 | Signed-in customer AIBL select → Place Order | One PENDING/UNPAID order; one INITIATED attempt; bank hosted redirect | Order/bill/bank OrderID |
| IW04 | Guest choice দিয়ে একই checkout | Scoped token/cookie; authenticated account ছাড়া own order payment সম্ভব | Cookie flags; authorized status |
| IW05 | Hosted page-এ wallet entry | Empty walletNo initialize accepted; customer enters wallet on bank page | Bank behavior, no wallet details |
| IW06 | Documented bank success complete | Verify exact code/msg/transactionID; CAPTURED/PAID; holds committed once | Bank field names/types only; DB changes |
| IW07 | Bank decline | Callback alone unpaid/pending; no stock release unless authoritative success arrives | Callback/verification phases |
| IW08 | Bank cancel | Pending/manual review; order remains UNPAID; holds retained | State + holds |
| IW09 | Mock unknown/non-200 response | No success or guessed terminal failure; pending | Error code/outcome |
| IW10 | Valid signed callback-এ BILLNO বদলান | Rejected before bank verification/settlement | Rejection; no DB money change |
| IW11 | Callback AMOUNT বদলান | Rejected; no capture | Amount normalized mismatch |
| IW12 | Init body-তে amount=1 পাঠান | Client amount ignored; bank gets authoritative DB grand total | Actual server-side amount comparison |
| IW13 | Invalid/missing signed state | Fail closed, no verification/capture or fake success UI | Callback result, DB state |
| IW14 | Bank strips callback query parameters | Callback rejected; authorized status/PCC can recover; no state bypass | Whether bank preserves attempt/state |
| IW15 | Same valid callback একাধিকবার/parallel পাঠান | One capture/inventory commit/notification; duplicates safe | Capture/log/reservation counts |
| IW16 | Repeated init/rapid clicks/two tabs | Existing order reused; at most one remote orderID request per attempt | Order/payment counts and INITIALIZE phase |
| IW17 | Auth timeout | No orderID call; order holds retained; explicit auth retry possible | AUTH failure, zero remote order creation |
| IW18 | Timeout after orderID request starts | Durable uncertain attempt blocks new charge; never automatic retry | INITIATED state, request phases |
| IW19 | Browser close/refresh, same browser reopen checkout | Cookie resumes same order within 24h; no duplicate order/charge | Recovered order ID |
| IW20 | While browser closed, cron verifies success | Reopen checkout leads to server-backed success result | Same payment captured once |
| IW21 | Repeated status and cron concurrently | Atomic settlement/idempotency; no double stock deduction | Counts + committed quantities |
| IW22 | Physical item, including multi-warehouse holds | Warehouse quantity stays held until verification; exact holds committed once | Per-warehouse quantity/reserved deltas |
| IW23 | Virtual configurable bundle | Physical component holds match saved quantities/warehouse; commit once | Components + optional quota hold |
| IW24 | Preassembled bundle | BundleStockReservation retained pending; commit only on verified success | Bundle quantity/reserved deltas |
| IW25 | Mock missing/wrong reservation after init | Entire settlement rollback, pending/manual review | No CAPTURED/PAID partial commit |
| IW26 | Reuse bank OrderID or verified transaction across different orders | Advisory + unique-index protection rejects second linkage/capture | Both order states, no extra stock commit |
| IW27 | Other user/invalid guest token/admin warehouse-only permission | No unauthorized initialization/status/settings mutation | 403/404 denial; no data exposure |
| IW28 | Disable gateway with pending attempt | New init/resume denied; old verification still works | Active setting and status result |
| IW29 | HTTP/arbitrary host/live ENV attempt | Config rejects before bank call | Safe config error |
| IW30 | `/payment-result?status=success` forged URL without receipt | Pending; no cart clear/purchase | UI/cart/analytics |
| IW31 | Complete verified payment, refresh result repeatedly | Server success only; cart clear once; consent-aware GA4 purchase deduped | Purchase transaction count |
| IW32 | EPS Sandbox success/pending/duplicate paths | Existing bank contract/settlement works; receipt-based UI correct | EPS regression results |
| IW33 | SSLCommerz success/fail/cancel/IPN | Existing verification/settlement unchanged; result receipt and analytics correct | SSL regression results |
| IW34 | Signed-in COD and Manual checkout | Existing order, stock, confirmation/cart behavior preserved | Counts/status/screenshots |
| IW35 | Manual AIBL refund request → approval → completed payout record | No automatic bank refund; cap/reference protections; repeated payout rejected | Refund states, totals; no secret account data |
| IW36 | Cron without/with wrong bearer secret | 401; no bank/DB settlement work | HTTP status |
| IW37 | Lost/expired guest cookie or different browser | No identity bypass; authorized staff/owner review needed | Access denied safely |
| IW38 | Inspect browser/API/PCC/activity logs | No API password/access key/token/SESSIONKEY/raw payload | Sanitized screenshots only |

## Runtime limitations এবং production readiness

এগুলো actual UAT evidence ছাড়া নিশ্চিত করা সম্ভব নয়:

- Issued account বাস্তবে real funds charge করে কি না।
- Empty walletNo এবং bank-hosted wallet-entry workflow।
- Bank callback query preservation, content type এবং exact BILLNO/AMOUNT/TRANSNO types।
- Token/orderID/verify response casing/types, amount formatting, bill length ও hosted
  session lifetime। Hosted reuse-এর 30-minute cap local safety limit; bank expiry claim নয়।
- Authoritative final failed/cancelled mapping; PDF-এর error codes authentication,
  request/OTP errors-ও বোঝায়, তাই সেগুলো financial terminal state ধরা হয়নি।
- Verify endpoint repeatability ও bank-provided recovery procedure, যদি orderID
  creation-এর response সম্পূর্ণ হারায়। Validated OrderID ছাড়া guessed recovery নয়।

Pending payments/never-initialized AIBL orders-এর automatic expiry নেই। Holds
indefinite হতে পারে; staff queue, bank support ও controlled review লাগবে। নতুন
terminal mapping/recovery contract ছাড়া force-fail বা stock release implement হয়নি।

সব local checks, bank UAT matrix, EPS/SSL/COD/manual regressions, migration approval
এবং monitoring/scheduler review-এর পরে rollout decision নিন। Live gateway enabling
এই feature-এ নেই। কোনো push/merge/commit করা হয়নি।

## পরিবর্তিত ফাইল

নিচের তালিকা implementation শেষে source changes থেকে তৈরি করা হয়েছে।

### নতুন files

- `app/api/aibl-wallet/approved/route.ts`
- `app/api/aibl-wallet/cancel/route.ts`
- `app/api/aibl-wallet/decline/route.ts`
- `app/api/aibl-wallet/init/route.ts`
- `app/api/aibl-wallet/pending/route.ts`
- `app/api/aibl-wallet/status/route.ts`
- `app/api/cron/reconcile-aibl-wallet/route.ts`
- `lib/aibl-wallet-callback.ts`
- `lib/aibl-wallet-http.ts`
- `lib/aibl-wallet.ts`
- `lib/payment-result.ts`
- `prisma/migrations-release/20261017120000_aibl_wallet_reference_uniqueness/migration.sql`

### পুনরুদ্ধার release history এবং metadata

- `prisma/migrations-release/00000000000000_squashed_baseline/migration.sql`
- `prisma/migrations-release/20260912170000_add_product_model_warranty/migration.sql`
- `prisma/migrations-release/20260913130000_ensure_pc_builder_storage/migration.sql`
- `prisma/migrations-release/20260916120000_add_configurable_bundles/migration.sql`
- `prisma/migrations-release/20260916130000_harden_configurable_bundle_cart/migration.sql`
- `prisma/migrations-release/20260916140000_add_product_specification_groups/migration.sql`
- `prisma/migrations-release/20260917120000_add_bundle_group_pricing_mode/migration.sql`
- `prisma/migrations-release/20260928_add_home_footer_description/migration.sql`
- `prisma/migrations-release/20261004191500_add_product_best_selling/migration.sql`
- `prisma/migrations-release/20261005000000_google_ecommerce_tracking/migration.sql`
- `prisma/migrations-release/20261014120000_payment_control_center/migration.sql`
- `prisma/migrations-release/20261014150000_advanced_network_monitoring/migration.sql`
- `prisma/migrations-release/20261015090000_complete_release_schema/migration.sql`
- `prisma/migrations-release/README.md`
- `prisma/migrations-release/migration_lock.toml`

### পরিবর্তিত existing files

- `.env.example`
- `app/api/admin/payment-control/refunds/route.ts`
- `app/api/cron/payment-control/route.ts`
- `app/api/eps/status/route.ts`
- `app/api/orders/[id]/route.ts`
- `app/api/orders/route-core.ts`
- `app/api/payment-gateways/route.ts`
- `app/api/payment/[id]/route.ts`
- `app/api/payment/route.ts`
- `app/api/refunds/[id]/payout/route.ts`
- `app/api/shipments/route.ts`
- `app/api/sslcommerz/cancel/route.ts`
- `app/api/sslcommerz/fail/route.ts`
- `app/api/sslcommerz/success/route.ts`
- `app/ecommerce/cart/ShoppingCart.tsx`
- `app/ecommerce/checkout/page.tsx`
- `app/ecommerce/payment-result/PaymentResultClient.tsx`
- `app/ecommerce/payment-result/page.tsx`
- `components/PaymentSystem.tsx`
- `components/admin/payment-control/NetworkMonitoringPanel.tsx`
- `components/admin/payment-control/PaymentControlCenter.tsx`
- `components/checkout/PaymentMethodSelector.tsx`
- `components/ecommarce/FloatingCartButton.tsx`
- `docs/aibl-islamic-wallet-uat.md`
- `lib/aibl-wallet-settings.ts`
- `lib/eps-callback.ts`
- `lib/inventory.ts`
- `lib/order-inventory-lifecycle.ts`
- `lib/payment-control/disputes.ts`
- `lib/payment-control/queries.ts`
- `lib/payment-control/reconciliation.ts`
- `lib/payment-control/telemetry.ts`
- `lib/payment-control/types.ts`
- `lib/sslcommerz.ts`
