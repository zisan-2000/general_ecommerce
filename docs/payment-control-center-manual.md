# Payment Control Center manual testing and rollout

Deshi Plus-এর EPS Sandbox ও SSLCommerz transaction diagnostics-এর dashboard:
`/admin/payment-control`। Admin sidebar-এর Overview থেকেও খোলা যাবে।
ব্যবহার শুরুর prerequisites হলো reviewed migration apply, Prisma Client generation
এবং নিচের validation/manual tests। Runtime payment বা refund success-এর sign-off
এই manual test result-এর ভিত্তিতে দিতে হবে।

## Audit এবং implementation

Existing `Payment`-এ gateway settings এবং payment attempts দুটিই থাকে।
Control Center শুধু `orderId != null` এবং provider EPS/SSLCOMMERZ records দেখায়।
`paymentGatewayData` JSON dashboard, event log ও CSV-তে ফেরত যায় না।

EPS-এর confirmed field casing, direct fetch/HMAC, exact verified `Success`,
signed callbacks এবং reservation/commit flow ব্যবহার করা হয়েছে।
SSLCommerz-এর success/IPN validation ও inventory helpers বজায় আছে।
নতুন guard একই order-এর concurrent initialization/capture serialize করে।
Timeout, expired redirect বা browser fail/cancel return-কে confirmed failure ধরা হয় না।

SSLCommerz fail/cancel-এর ক্ষেত্রে server transaction query-তে matching reference,
amount, currency ও `FAILED` নিশ্চিত হলে attempt/order FAILED হবে।
Unknown/unconfirmed cancellation pending থাকবে। Result page-ও unconfirmed
outcome-কে pending দেখাবে। আগে VOIDED/CANCELLED থাকা historical records rewrite করা হয় না।
Existing attempt verify করার সময় gateway disable হওয়া verification বন্ধ করে না।

SSLCommerz transaction-query parameters/status mapping-এর primary reference:
[Official SSLCommerz V4 integration documentation](https://developer.sslcommerz.com/doc/v4/#by-transaction-id)।
Query-only request-এ refund parameters পাঠানো হয় না।

নতুন tables:

| Table | কাজ |
| --- | --- |
| PaymentEvent | Request শুরু/শেষ, callback, verification, settlement ও refund-record event |
| PaymentReconciliation | Gateway বনাম database comparison snapshot |
| PaymentDispute | Complaint, category, assignee, resolution, version |
| PaymentDisputeEvidence | Restricted case note ও external evidence reference |
| PaymentDisputeActivity | Staff update/status/resolution history |
| PaymentSandboxRun | আলাদা synthetic diagnostic run |

Refund-এর জন্য existing `Refund` ব্যবহার করা হয়েছে। Request quantity recheck,
payout claim, reference serialization ও cumulative paid-amount cap order lock-এর
মধ্যে থাকে। একই refund আবার paid করা যাবে না; একই payout reference অন্য refund-এ
ব্যবহার করলে reject হবে। Original-method EPS refund API contract তৈরি করা হয়নি।
Existing customer refund eligibility, approval এবং manual method workflow ব্যবহার করুন।

## Migration এবং configuration

1. Local/staging database backup নিন এবং migration history ও schema drift review করুন।
2. `20261014120000_payment_control_center/migration.sql` review করুন।
   এতে নতুন tables/FKs/indexes এবং existing Payment-এর দুটি index আছে।
   Existing money/status/inventory data update, delete বা backfill নেই।
3. Apply-এর আগে migration status দেখুন। অন্য pending migration থাকলে আগে সেগুলোর
   scope review করুন; `migrate deploy` সব pending migration apply করে।
4. Write traffic কম থাকা staging window-এ apply করুন। SQL transaction,
   5-second lock timeout ও 60-second statement timeout আছে। Lock timeout হলে
   পরিবর্তন rollback হয়; failed migration metadata review ছাড়া retry করবেন না।
   `migrate reset`, `db push` বা migration history মুছে ফেলা ব্যবহার করবেন না।
5. Prisma Client regenerate করুন। Generated client এই implementation-এ পরিবর্তন করা হয়নি।

নিজে চালাবেন:

```powershell
npx prisma migrate status
# Migration review ও backup-এর পরে সঠিক staging database-এ:
npx prisma migrate deploy
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

Existing credentials/configuration নিজে সেট করুন:

- `EPS_ENV=sandbox`
- `EPS_USERNAME`, `EPS_PASSWORD`, `EPS_HASH_KEY`, `EPS_MERCHANT_ID`, `EPS_STORE_ID`
- Existing database URL এবং auth/callback signing secret
- EPS callbacks-এর জন্য public HTTPS application origin; existing supported
  `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_BASE_URL` configuration ব্যবহার করুন
- Admin Payment Settings-এ EPS active এবং SSLCommerz sandbox mode;
  SSLCommerz credentials existing settings workflow-এ নিজে দিন
- Production runtime হলে existing distributed rate-limit configuration

নতুন optional flags:

| Variable | আচরণ |
| --- | --- |
| PAYMENT_CONTROL_LOGGING_ENABLED | Default enabled; exact `false` হলে নতুন payment events লেখা বন্ধ |
| PAYMENT_CONTROL_SANDBOX_SIMULATIONS | Exact `true` হলে non-production environment-এ synthetic simulations চালু |
| PAYMENT_CONTROL_RECONCILIATION_ENABLED | Exact `true` হলে optional comparison cron চালু |
| CRON_SECRET | Existing bearer secret দিয়ে cron authenticate হবে |

Production-এ simulation সবসময় disabled। EPS live endpoint enable করা হয়নি।

Admin UI access-এর জন্য existing `admin.panel.access` এবং GLOBAL
`settings.payment.manage` অথবা GLOBAL `settings.manage` দিন।
Warehouse-only permissions পুরো store-এর financial history দেখার অনুমতি দেয় না।
Refund payout record করতে existing `orders.update` authorization-ও প্রয়োজন;
Control Center payout button global orders-update permission থাকলে দেখায়।
Staff assignee-র global payment-management permission থাকতে হবে।

## Dashboard ব্যবহার

- **History:** Order ID / transaction ID search, provider/status/date filters,
  25-row pagination এবং filtered CSV।
- **Details:** Timeline-এ একই request ID দিয়ে REQUEST_STARTED এবং HTTP result মেলান।
  AUTH failure payment row তৈরির আগেও Network-এ দেখা যায়; order reference থাকে।
- **Compare gateway status:** Actual server-side status query হবে। Comparison শুধু
  snapshot লিখবে; payment capture, order PAID, refund transfer বা inventory update করবে না।
- **Disputes:** Complaint খুলুন, staff assign করুন, evidence note/link যোগ করুন এবং
  resolution দিন। Same request key retry নতুন complaint তৈরি করে না।
  Version conflict হলে reload করুন।
- **Refunds:** Request/approval/paid status ও payout reference দেখুন।
  Button শুধুমাত্র externally completed payout record করে; কোনো অর্থ পাঠায় না।
- **Alerts:** Failed/cancelled history, 15-minute pending, missing callback এবং
  current mismatch evidence দেখায়। Gateway/date filters alert scan-এ প্রযোজ্য।
  এটি dashboard detection; email/SMS পাঠানো হয় না।
- **Network:** HTTP errors, timeout, connection error এবং available allowlisted
  DNS/TLS/socket error code। Latency fetch শুরু থেকে response headers পর্যন্ত।
  Advanced view-এ Windows host counters, approved localhost TCP probe, charts,
  historical alerts ও Request ID correlation আছে। TCP packet loss N/A। Setup,
  আলাদা monitoring filters ও manual checks:
  [Advanced Network Monitoring Manual](advanced-network-monitoring-manual.md)।

Default history/monitoring window 30 days; একটি query-তে সর্বোচ্চ 90-day range।
পুরোনো range আলাদাভাবে বেছে নেওয়া যায়। CSV-তে সর্বোচ্চ 5,000 rows; বেশি হলে
silent truncation-এর বদলে narrower filter চায়। P95 latest সর্বোচ্চ 2,000 request-এর sample।
Alerts latest 100 candidates scan করে এবং total candidate count দেখায়।
একাধিক alert একই payment-এ থাকতে পারে।

Timeline 100-event cursor page ব্যবহার করে। Transaction details-এ latest 50 comparisons/cases
ও 100 refund records দেখায়। Disputes tab paginated; পুরোনো case সেখান থেকে Manage dispute
দিয়ে খুলুন। Case-এর latest 100 evidence/activity entries দেখায়।
Historical payments-এর জন্য retrospective API/callback timing তৈরি করা হয় না।
Logging বন্ধ থাকলে missing-callback diagnosis অসম্পূর্ণ থাকবে।

## Manual test cases

কেবল isolated local/staging database ও sandbox credentials ব্যবহার করুন।
প্রতিটি case-এর actual result নথিভুক্ত করুন; simulation pass-কে real gateway pass ধরবেন না।

| ID | Test | Expected result |
| --- | --- | --- |
| PCC01 | Logged-out user দিয়ে dashboard ও admin APIs খুলুন | Session/permission ছাড়া financial data পাওয়া যাবে না |
| PCC02 | Warehouse-only payment permission দিন | Global financial history, CSV, dispute ও compare access denied |
| PCC03 | অনুমোদিত staff দিয়ে dashboard খুলুন | History, filters, detail timeline ও network summary load |
| PCC04 | Order ID/transaction ID, provider/status/date filter করুন | History ও CSV একই transaction filters মেনে চলে; network/alerts provider/date মেনে চলে |
| PCC05 | Wrong date/invalid ID এবং 5,000-এর বেশি CSV rows চেষ্টা করুন | Validation error; partial/truncated export নয় |
| PCC06 | EPS authenticated ও guest checkout initialize করুন | Unique numeric ID, correct casing, hosted redirect; AUTH/INITIALIZE request pairs সংরক্ষিত |
| PCC07 | EPS verified success সম্পন্ন করুন | CAPTURED/PAID কেবল server verification-এর পরে; reservation একবার commit |
| PCC08 | একই signed callback আবার পাঠান | Duplicate history; নতুন capture বা দ্বিতীয় inventory deduction নয় |
| PCC09 | Wrong signed state/posted transaction ID পাঠান | Rejected/mismatch; amount/order/inventory settle হবে না |
| PCC10 | EPS browser fail/cancel বা unknown provider status | Confirmed terminal status ছাড়া pending; unknown status-এ reservation release নয় |
| PCC11 | SSLCommerz success ও IPN দুবার/একসঙ্গে দিন | Verified capture একবার; order PAID ও inventory commit একবার |
| PCC12 | একই order initialize request দুবার/একসঙ্গে দিন | একটি durable attempt; fresh redirect reuse অথবা 409, দ্বিতীয় remote initialization নয় |
| PCC13 | অনুমোদিত network fixture দিয়ে init/status timeout করুন | TIMEOUT/connection code, duration; unknown attempt pending, unsafe retry নয় |
| PCC14 | SSLCommerz fail/cancel browser callback replay করুন | Server query matching FAILED না দিলে pending; paid order restore/cancel হবে না |
| PCC15 | Pending attempt রেখে 15 মিনিট অপেক্ষা ও Refresh করুন | Pending alert; successful init + কোনো received callback না থাকলে callback-missing alert |
| PCC16 | Compare gateway status চাপুন | Snapshot/history যুক্ত; Payment/Order/Inventory compare action থেকে অপরিবর্তিত |
| PCC17 | Controlled mock/staging fixture-এ gateway amount/ID mismatch করুন | INVALID_AMOUNT/INVALID_REFERENCE বা mismatch; successful capture নয় |
| PCC18 | Complaint খুলে assign/evidence/resolve/reopen করুন | Case history থাকে; financial state বদলায় না |
| PCC19 | একই complaint request key retry ও দুই staff দিয়ে একই version save করুন | Duplicate complaint নয়; stale version 409 |
| PCC20 | Approved staging refund-এর mock external payout record করুন; একই ID/reference আবার দিন | প্রথম record একবার; duplicate payout/reference rejected |
| PCC21 | একসঙ্গে একাধিক refund request/payout করুন; মোট paid amount ছাড়ান | Quantity recheck, cumulative cap ও atomic payout claim enforce |
| PCC22 | Gateway disable করে existing attempt verify করুন | নতুন init বন্ধ; original attempt verification চলতে পারে |
| PCC23 | সব ছয়টি diagnostic simulation চালান | Synthetic traces; real gateway requests, real Payment/Order/Inventory writes শূন্য |
| PCC24 | Production NODE_ENV-এ simulation অথবা opt-in flag ছাড়া চেষ্টা করুন | Simulation denied |
| PCC25 | COD ও Manual Payment checkout/refund regression করুন | Existing checkout flow চলে; shared refund protection double record আটকায় |
| PCC26 | Event/detail/CSV এবং server log inspect করুন | Secret, Authorization, x-hash, callback state, session key, raw payload, customer/card/account data নেই |
| PCC27 | Staging-এ attempt-এর পরে order amount/currency/gateway/status বদলে late callback দিন | Unsafe settlement/order cancellation নয়; mismatch/manual review, দ্বিতীয় inventory deduction নয় |
| PCC28 | Physical, virtual-component bundle এবং preassembled bundle দিয়ে SSLCommerz checkout করুন | Order snapshot অনুযায়ী reserved physical-component/bundle quantities একবার commit; duplicate IPN deduction নয় |

Wrong provider-response amount/ID branch পরীক্ষা করতে controlled gateway mock/fixture দরকার।
Browser-এর initialize amount বদলালে server authoritative Order amount ব্যবহার করবে;
এটি provider-response mismatch test-এর বিকল্প নয়।

Evidence notes ও external links staff input। Secret/card/account data দেবেন না।
Common credential/card/JWT patterns reject হয়; free-text classifier সব sensitive content
চিনতে পারে না। Evidence note financial API event log-এ লেখা হয় না। Link-only evidence-এর
জন্য নিজের access-controlled storage ব্যবহার করুন; এই feature binary upload করে না।

Synthetic REFUND scenario-তে duplicate key ও over-refund trace থাকে।
DUPLICATE_CALLBACK-এ এক capture/এক inventory commit থাকে।
এই আলাদা diagnostic state machine real settlement processors চালায় না;
PCC07–PCC14-এর actual sandbox tests প্রয়োজন।

## Optional reconciliation cron

Scheduler-এ `GET /api/cron/payment-control` যোগ করে existing CRON_SECRET bearer
authentication ব্যবহার করুন। কোনো secret query string-এ দেবেন না।
Flag enable না করলে এই job gateway request করবে না। এটি কখনো refund/settlement করে না।

Job latest 90-day attempts-এর oldest/never-checked records আগে নিয়ে সর্বোচ্চ তিনটি
sequential comparison করে। Provider calls DB transaction-এর বাইরে থাকে।
Route duration 180 seconds; deployment platform-এ ওই duration সমর্থন নিশ্চিত করুন।
Manual compare route duration 60 seconds। Overlapping jobs অতিরিক্ত query/history
তৈরি করতে পারে; এক scheduler instance ব্যবহার করুন।

Existing EPS reconciliation cron actual verified settlement করে এবং আগের মতো আছে।
নতুন comparison cron সেটির বিকল্প নয়। Missing callback-এর confirmed-success mismatch
review করতে existing EPS status/reconciliation workflow ব্যবহার করুন; SSLCommerz-এর
success/IPN verification workflow বজায় আছে। Comparison records থেকে automatic PAID নয়।

## Rollout review এবং limitations

- Schema/client generation ছাড়া Control Center কার্যকর নয়। Telemetry persistence
  failure checkout settlement-কে exception দেয় না; generic server warning হয়।
- Safe logging শুধুমাত্র নতুন PaymentEvent projection-এর guarantee।
  Legacy activity logs বা external gateway/network logs এই implementation purge করে না।
- Refund tracker externally recorded payout দেখায়; bank refund completion-এর
  automatic proof নয়। Existing order-level REFUNDED semantics রাখা হয়েছে;
  partial refund-এর জন্য individual Refund amount/payout ledger দেখুন।
- SSLCommerz virtual-bundle physical quantities এখন OrderBundleComponent snapshot
  থেকে গণনা হয়। Physical, virtual-component bundle ও preassembled bundle regression
  আলাদাভাবে চালান; mismatch হলে capture rollback/manual review expected।
- Refund eligibility/discount allocation-এর existing policy বদলানো হয়নি।
  Paid-amount cap ছাড়ানো request-এ approval হলেও payout record reject হবে;
  amount/policy resolve না করে payment record জোর করে পরিবর্তন করবেন না।
- Event retention/archival policy operator নির্ধারণ করবেন; automatic delete নেই।
- Schema additive হলেও index/FK creation-এর locking staging-এ মাপতে হবে।
  Application rollback করলে নতুন audit tables রাখুন; historical records delete নয়।

## পরিবর্তিত ফাইল

নতুন:

```text
app/admin/payment-control/page.tsx
components/admin/payment-control/PaymentControlCenter.tsx
app/api/admin/payment-control/route.ts
app/api/admin/payment-control/[id]/route.ts
app/api/admin/payment-control/export/route.ts
app/api/admin/payment-control/disputes/route.ts
app/api/admin/payment-control/disputes/[id]/route.ts
app/api/admin/payment-control/refunds/route.ts
app/api/admin/payment-control/simulations/route.ts
app/api/cron/payment-control/route.ts
lib/payment-control/authorization.ts
lib/payment-control/disputes.ts
lib/payment-control/gateway-query.ts
lib/payment-control/queries.ts
lib/payment-control/reconciliation.ts
lib/payment-control/simulation.ts
lib/payment-control/telemetry.ts
lib/payment-control/types.ts
prisma/migrations/20261014120000_payment_control_center/migration.sql
docs/payment-control-center-manual.md
```

আপডেট:

```text
prisma/schema.prisma
components/admin/Sidebar.tsx
proxy.ts
lib/eps.ts
lib/eps-callback.ts
app/api/eps/init/route.ts
lib/sslcommerz.ts
app/api/sslcommerz/init/route.ts
app/api/sslcommerz/success/route.ts
app/api/sslcommerz/fail/route.ts
app/api/sslcommerz/cancel/route.ts
app/api/refunds/route.ts
app/api/refunds/[id]/payout/route.ts
```

## Test report format

```text
Case ID:
Result: PASS / FAIL / BLOCKED
Gateway and environment:
Payment ID and Order ID:
Expected:
Actual:
Evidence: cropped screenshot / redacted event rows
Tester and date:
```

Request header, cookie, token, signed callback URL বা credentials report-এ দেবেন না।
