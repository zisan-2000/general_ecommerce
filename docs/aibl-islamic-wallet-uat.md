# AIBL Islamic Wallet UAT Integration

এই integration Al-Arafah Islami Bank-এর Islamic Wallet-এর জন্য। Branch:
`feature/aibl-islamic-wallet-uat-20261017`। Live mode নেই; gateway default disabled।
Implementation এবং static code review হয়েছে। কোনো build/lint/typecheck/test,
Prisma execution, database connection, bank API request বা payment transaction
চালানো হয়নি। Runtime UAT success বা production readiness দাবি করা হচ্ছে না।

## Reference এবং API contract

২০২৬-১০-১৮ তারিখে ব্যবহারকারীর দেওয়া bank confirmation অনুযায়ী API ও hosted base
সংশোধিত। এই confirmation আগের credentials note-এর URL-গুলোকে supersede করে:

- API: `https://iwtest.aibl.com.bd/iwPGAPI/`
- Hosted: `https://iwtest.aibl.com.bd/iwepayuat/epayment/{OrderID}`

PDF-এর ছয়টি page ও supplied Postman-এর দুইটি request review করা হয়েছে। Hosted URL
bank-confirmed base থেকে তৈরি হয়; Token, orderID ও verify একই confirmed API base
ব্যবহার করে। Merchant callback URL তৈরির origin/path/signed state অপরিবর্তিত। Postman-এর
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
AIBL_WALLET_API_BASE_URL=https://iwtest.aibl.com.bd/iwPGAPI/
AIBL_WALLET_HOSTED_BASE_URL=https://iwtest.aibl.com.bd/iwepayuat/epayment/
AIBL_WALLET_API_USER=
AIBL_WALLET_API_PASS=
AIBL_WALLET_MERCHANT_ID=
AIBL_WALLET_ACCESS_KEY=
```

URLs exact trailing slash-সহ দরকার। Different host/path, HTTP, query credentials
বা `AIBL_WALLET_ENV=live` reject হবে। `.env.example`-এ শুধু public configuration ও
empty credential placeholders আছে। `.env.local` পড়া/পরিবর্তন করা হয়নি।

API base account fingerprint-এর অংশ। আগের base-এ তৈরি কোনো persisted payment
attempt থাকলে সেটিকে নতুন host-এ স্বয়ংক্রিয়ভাবে rebind বা reinitialize করা হবে না;
account mismatch হলে verification/resume manual review চাইবে। Existing order,
attempt, fingerprint বা inventory reservation এই URL correction-এ পরিবর্তন হয় না।

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
যাচাই করুন। Hostname বা ENV-এর `uat` label একা সেই নিশ্চয়তা দেয় না।**

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
8. Callback POST JSON, form-urlencoded অথবা multipart/form-data, maximum 16 KB।
   Observed HTML form-এর `data` field-এ JSON string callback-only parser decode করে;
   exact `BILLNO`, `AMOUNT`, `TRANSNO` শুধু parsed object থেকে আসে। সাতটি observed
   auxiliary outer name explicit allowlist-এ আছে; values সম্পূর্ণ ignore/discard হয়।
   Documented flat callbacks-ও supported; init/status body parsing অপরিবর্তিত। Unknown
   outer field, mixed reference sources, duplicate form/JSON keys (escaped-equivalent keys-সহ), non-object
   JSON, recursive envelope বা nested object/array values reject হয়। Raw JSON,
   parser error fragments, SESSIONKEY বা full references log হয় না।
   Multipart body bounded হওয়ার পর native FormData parser চলে; duplicate fields,
   file uploads ও malformed multipart reject হয়। Signed query state,
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

### Callback rejection diagnostics

পুরোনো `CALLBACK_REFERENCE_MISMATCH` event bill এবং amount-এর একাধিক condition
একত্রে বোঝাত; raw callback সংরক্ষিত না থাকায় historical event-এর exact কারণ এখন
পুনরুদ্ধার করা যায় না। Multipart support-এর ঘাটতি পৃথক confirmed issue ছিল;
unsupported multipart 415 দিত, reference-mismatch event নয়।

নতুন callback rejection-এ fixed detail codes পাওয়া যাবে:

- `BILLNO_MISMATCH`: exact uppercase `BILLNO` signed attempt-এর সমান নয়/missing।
- `AMOUNT_MISSING`: `AMOUNT` absent, null অথবা empty string।
- `AMOUNT_INVALID`: বিদ্যমান strict money parser value গ্রহণ করেনি।
- `AMOUNT_MISMATCH`: valid normalized amount stored Payment amount-এর সমান নয়।

একাধিক condition fail হলে একই callback Request ID-তে একাধিক event থাকে। নতুন
AIBL telemetry-তে full transaction reference রাখা হয় না; internal Payment ID,
Order ID ও Request ID correlation ব্যবহার হয়। পুরোনো DB events পরিবর্তন করা হয়নি।
Values, raw fields/body, OTP, SESSIONKEY বা reference fragments log হয় না।
Bill/amount-এর aliases, trimming, comma removal বা অতিরিক্ত decimal rounding যোগ
হয়নি। Invalid callback verification শুরু করে না। Valid callback আগের মতো bank
verify-এর exact success ও atomic inventory/payment settlement-এর উপর নির্ভর করে।

নিজে পরবর্তী অনুমোদিত UAT-এ form-urlencoded এবং multipart callback, duplicate
fields/file/oversized body rejection ও প্রতিটি detail code যাচাই করুন। Valid
payment-এ expected timeline CALLBACK → STATUS_QUERY → VERIFY → SETTLEMENT এবং
CAPTURED/PAID once; callback/cron race-এ দ্বিতীয় inventory commit নয়। ইতোমধ্যে
settled Order #4 reset বা নতুন payment attempt তৈরি করার প্রয়োজন নেই।

### Confirmed ngrok callback envelope — current behavior

User-confirmed actual ngrok traffic-এ এই exact outer names পাওয়া গেছে:
`data`, `access_token`, `economic`, `mobile_no`, `paid_amount`, `reference_no`,
`responsecode`, `transaction_id`। পুরোনো `Object.keys(body).length !== 1` guard
এই valid observed shape-কে JSON parsing-এর আগেই reject করছিল। এখন শুধু এই সাতটি
auxiliary name explicit allowlist-এ আছে; `data`-only envelopes-ও supported।

- `data` অবশ্যই JSON-string text form field; URL-encoded/multipart দুটোই supported।
  URL decoding একবারই হয়। Outer JSON envelope, files, duplicate form fields,
  unknown/case-variant/bracketed names এবং 16 KB-এর বেশি request reject হয়।
- Auxiliary values text হতে হবে এবং পুরো request-এর একই size cap-এর মধ্যে থাকবে।
  তাদের format/semantics অনুমান করা হয় না; authentication, payment routing,
  amount/reference matching বা settlement-এ কোনো auxiliary value ব্যবহার হয় না।
  JSON-looking metadata text-ও কখনো recursively decode বা merge করা হয় না।
- `reference_no`, `paid_amount`, `transaction_id` কখনো `BILLNO`, `AMOUNT`, `TRANSNO`
  হিসেবে map হয় না। Exact inner JSON references, signed state, bank verification,
  locked atomic settlement ও duplicate inventory protection অপরিবর্তিত।
- Parser শুধু decoded inner object ফেরত দেয়; outer token/mobile/reference/status
  values return, persist, log বা diagnostics-এ expose করা হয় না।
- Auxiliary field থাকলে `data` আবশ্যক; legacy flat references দিয়ে ওই envelope
  fallback করতে পারে না। Valid legacy flat callbacks শুধু সাতটি documented keys
  (`RESCODE`, `STATUS`, `AMOUNT`, `MESSAGE`, `SESSIONKEY`, `TRANSNO`, `BILLNO`) ব্যবহার করে।
  Unknown legacy fields ও object/array values reject হয়।
  Legacy JSON duplicate keys-ও callback-only mode-এ reject হয় (`AIBL_CB_BODY_JSON_DUPLICATE_KEY`);
  init/status JSON parsing-এর default আচরণ অপরিবর্তিত।
- Nested data object/array, recursive envelope ও duplicate JSON keys-এর আগের
  rejection বজায় আছে। HTTP/JSON `STATUS` বা outer responsecode একা PAID করতে পারে না।

`AIBL_CB_OUTER_AUX_IGNORED` একটি fixed progress event। `AIBL_CB_AUX_WITHOUT_DATA`
ও `AIBL_CB_AUX_TYPE_INVALID` envelope errors আলাদা করে। Unknown-envelope counts-এ
allowed auxiliary names unknown হিসেবে গণনা হয় না; values কখনো log হয় না।
Other extra keys এবং outer uppercase BILLNO/AMOUNT/TRANSNO (matching হলেও) reject হয়।

Offline regressions exact eight-field shape, all three callback routes, ignored
conflicting metadata, inner validation/verified transaction matching, UNKNOWN
bank result, signed state, unknown/duplicate/bracketed names, files, malformed JSON,
size limits, legacy compatibility এবং duplicate settlement cover করে।
Run `npm run test:aibl-wallet:offline`, `npm run typecheck`, `npm run lint` নিজে।
Implementation-এর সময় tests/build/API/database operations চালানো হয়নি। Actual UAT
success দাবি করা হয়নি; outer fields-এর business semantics এখনো unconfirmed এবং unused।

### Order #8 outer-field investigation (historical; superseded above)

Read-only audit-এ Request ID prefix `5a9fad49`-এর একটি request পাওয়া গেছে:
FORM_URLENCODED → OUTER_BODY_PARSED → DATA_PRESENT → OUTER_FIELDS_UNEXPECTED →
INVALID_CALLBACK। Payment INITIATED এবং Order PENDING/UNPAID। Exact rejecting
condition: `data` উপস্থিত থাকার পরে `Object.keys(body).length !== 1`। অতিরিক্ত
decoded outer keys থাকায় nested JSON parsing-এর আগেই request reject হয়েছে।
সেই JSON valid ছিল বা bill/amount matching pass করত—এটি এখনো প্রমাণিত নয়।

Existing safe events অতিরিক্ত keys-এর নাম/সংখ্যা সংরক্ষণ করেনি; dev log-এও request
prefix নেই। AIBL এখনো কোনো additional outer field-এর exact name/type/purpose বা
non-authoritative status নিশ্চিত করেনি। তাই acceptance restriction পরিবর্তন হয়নি।
Extra decoded keys genuine additional controls নাকি incorrect form encoding থেকে
হয়েছে, শুধু existing events দিয়ে সেটিও নির্ধারণ করা যায় না।

নতুন diagnostics শুধুমাত্র unexpected outer-field rejection-এর আগে emit হবে:

- `AIBL_CB_OUTER_EXTRA_COUNT_0` ... `_10`, অথবা `_GT10`: `data` ছাড়া distinct outer
  keys-এর সংখ্যা; দশের বেশি হলে capped category। Duplicate fields আগেই reject হয়।
- `AIBL_CB_OUTER_UNKNOWN_COUNT_0` ... `_10`, অথবা `_GT10`: নিচের fixed documented
  names ছাড়া বাকি extra keys-এর সংখ্যা। কোনো unknown key name/hash/value log হয় না।
- `AIBL_CB_OUTER_FIELD_RESCODE`, `_STATUS`, `_AMOUNT`, `_MESSAGE`, `_SESSIONKEY`,
  `_TRANSNO`, `_BILLNO`: bank-documented JSON key-টি ভুল outer level-এ উপস্থিত।
  এগুলো presence-only fixed labels; field values/type coercion/aliases যোগ হয়নি।
  Recognition acceptance-এর অনুমতি নয়; এই fields-ও reject হয়।

Timeline-এর একই Request ID-তে সব observations এবং original rejection দেখা যাবে।
এগুলো `DIAGNOSTIC / RECEIVED`; field counts zero/nonzero নিজে payment success নয়।
Raw field names arbitrary হওয়ায় সেগুলো অনুমান বা log না করে unknown count রাখা হয়।
কোনো auxiliary allowlist এখনো নেই; common HTML/CSRF field names-ও অনুমান করা হয়নি।

AIBL-এর কাছ থেকে শুধু নিম্নের structural তথ্য প্রয়োজন, কোনো actual value নয়:

1. বাস্তব callback form-এর প্রতিটি outer key-এর exact case-sensitive নাম।
2. প্রতিটির type, purpose, optional/required status, multiplicity ও length bounds।
3. কোনটি auxiliary এবং কেন সেটি ignore করা নিরাপদ; authentication/signature,
   payment routing, BILLNO, AMOUNT বা TRANSNO-তে এর কোনো প্রভাব নেই কি না।
4. Payment references/amount-এর একমাত্র authoritative callback source exact `data`
   JSON কি না; mixed-source fields কেন পাঠানো হয়, যদি পাঠানো হয়।
5. `application/x-www-form-urlencoded` data ঠিক একবার encode হয় কি না, বিশেষ করে
   JSON-এর literal `&`, `+`, `%`, `=` ও UTF-8 text। Values বাদ দেওয়া field-name/type
   list যথেষ্ট; SESSIONKEY, OTP, signed URLs বা raw callback পাঠানোর প্রয়োজন নেই।

Contract নিশ্চিত হলে সম্ভাব্য minimal fix হলো শুধু confirmed non-authoritative
auxiliary names ও bounded text shape-এর explicit allowlist; unknown extras ও mixed
payment references reject থাকবে। Bill/amount/TRANSNO শুধু parsed `data` থেকে যাবে,
bank verification ও atomic/idempotent settlement অপরিবর্তিত থাকবে। এখন এটি
implement করা হয়নি। Legitimate auxiliary acceptance test-এর পরিবর্তে বর্তমান tests
safe presence/count diagnostics, unknown-name privacy, matching/conflicting mixed
references, duplicate extras ও file rejection cover করে। নতুন tests execute হয়নি।

Run `npm run test:aibl-wallet:offline` নিজে; updated runtime-এর structure জানতে
bank-supported existing callback redelivery ব্যবহার করা যায়—নতুন charge দরকার নেই।
Unknown count nonzero থাকলে bank field-name contract এখনো প্রয়োজন হবে। Order #8
বা অন্য কোনো database record investigation-এর সময় পরিবর্তন করা হয়নি।

### Order #7 parsing investigation

Read-only audit-এ Request ID prefix `c5aff01a`-এর একটি request পাওয়া গেছে:
`AIBL_CB_CONTENT_FORM_URLENCODED` → `INVALID_CALLBACK` (REJECTED)। Field-presence,
STATUS_QUERY, VERIFY বা settlement events নেই; Order/Payment PENDING/UNPAID এবং
INITIATED। Historical exception message/payload রাখা হয়নি; local dev log-এও এই
request-এর error reason পাওয়া যায়নি। তাই exact rejection branch প্রমাণিত নয়।
Normal telemetry অনুযায়ী failure window callback body/envelope parsing-এর মধ্যে;
missing events একা `readAiblBody()` নাকি nested JSON parser throw করেছে তা বলে না।

নতুন fixed diagnostics একই Request/Payment/Order ID-তে Timeline-এ থাকবে:

| Codes (all prefixed `AIBL_CB_`) | Meaning |
| --- | --- |
| `BODY_MISSING`, `BODY_READ_FAILED`, `BODY_TOO_LARGE`, `BODY_DECODE_FAILED` | Missing stream, read failure, existing 16 KB limit, buffering/decoding stage |
| `FORM_MALFORMED`, `FORM_DUPLICATE_FIELD`, `FORM_FILE_REJECTED` | Native form parser failure, duplicate outer field, file rejected |
| `CONTENT_UNSUPPORTED`, `BODY_JSON_INVALID`, `BODY_JSON_NOT_OBJECT` | Unsupported media type or invalid direct JSON body |
| `OUTER_BODY_PARSED`, `DATA_PRESENT`, `DATA_JSON_PARSED` | Successful parser milestones, outcome RECEIVED |
| `DATA_MISSING` | No exact `data` property; observation only, legacy flat callbacks still supported |
| `ENVELOPE_CONTENT_INVALID`, `OUTER_FIELDS_UNEXPECTED`, `DATA_TYPE_INVALID` | Non-form envelope, extra outer fields, non-string data |
| `DATA_JSON_INVALID`, `DATA_JSON_NOT_OBJECT`, `DATA_RECURSIVE`, `DATA_NESTED_VALUE`, `DATA_JSON_DUPLICATE_KEY` | Nested JSON syntax/shape/duplicate-key rejection |
| `BODY_PARSE_FAILED` | Unexpected parser exception without a typed reason |
| `RATE_LIMIT_FAILED/REJECTED`, `STATE_CHECK_FAILED/INVALID`, `PAYMENT_LOOKUP_FAILED/NOT_FOUND`, `FIELD_VALIDATION_FAILED`, `TRANSNO_INVALID`, `VERIFY_FAILED`, `RESULT_FAILED` | Other callback failure stages; existing specific verify/settlement diagnostics still apply |

Existing `INVALID_CALLBACK` remains for compatibility, accompanied by its fixed
stage/reason. No arbitrary error text or arbitrary outer field names, raw JSON, SESSIONKEY,
OTP, credentials or bank references are added to logs. Typed errors keep existing
HTTP statuses/messages. Progress diagnostics must not change acceptance if logging
is unavailable. No schema/migration or new configuration is needed.

URL-encoded decoding still occurs exactly once using `URLSearchParams`; then
`JSON.parse(data)` parses JSON. No `decodeURIComponent` fallback, HTML unescaping,
double-JSON parsing or alternative field alias is added. The standard URL parser
is permissive about malformed percent sequences; `FORM_MALFORMED` is not a claim
that every malformed URL escape throws. Invalid resulting JSON still rejects.
Only the seven traffic-confirmed auxiliary names described above are exempt from
outer-field rejection; all other extra names and mixed reference sources still reject.

Use `npm run test:aibl-wallet:offline` for focused tests of reason codes and raw
wire decoding, including literal plus/percent/UTF-8 preservation, double encoding,
extra submit fields, stream failures and the existing rejection cases. These are
synthetic branch regressions, not a reproduction of the unknown Order #7 payload;
tests/build/typecheck were not executed during this investigation.

After loading updated handlers, a bank-supported redelivery of the existing
callback, or a provider-confirmed sanitized reproduction, is needed to identify
the real branch. Do not create a new charge just to collect diagnostics. Reopen
the existing transaction Timeline and collect fixed codes for the new Request ID.
PCC manual verification tests a different path and cannot confirm callback parsing.
Any later authorized redelivery still requires bank verification before settlement.

### Live verification diagnostics (Order #5 investigation)

এই diagnostics historical failure-এর root cause প্রমাণ করে না; updated handler-এ
পরবর্তী authorized verification-এর runtime evidence সংগ্রহ করে। Security checks,
bank request fields, UNKNOWN handling ও settlement decisions অপরিবর্তিত। কোনো
নতুন schema/migration বা environment variable প্রয়োজন নেই। Existing
`PAYMENT_CONTROL_LOGGING_ENABLED` অবশ্যই `false` হবে না।

`/admin/payment-control` → existing AIBL transaction → **Timeline**-এ নতুন
`DIAGNOSTIC` events দেখা যাবে। Guard/presence observations-এ `SUCCESS` = PASS/true,
`REJECTED` = FAIL/false। Decimal-instance observation বা optional alternative field
absent হওয়া নিজে payment rejection নয়; actual guards ও failure stage একসঙ্গে দেখুন।
Diagnostic events আলাদা operation হওয়ায় API request/latency metrics-এ গণনা হয় না।

| Fixed diagnostic codes | Meaning |
| --- | --- |
| `AIBL_CONFIG_UAT`, `AIBL_CONFIG_API_URL`, `AIBL_CONFIG_HOSTED_URL`, `AIBL_CONFIG_CREDENTIALS_PRESENT` | Live handler configuration checks; values never stored |
| `AIBL_ORDER_ID`, `AIBL_MERCHANT_BILL_FORMAT`, `AIBL_BANK_ORDER_ID` | Existing attempt identifiers pass existing validation |
| `AIBL_AMOUNT_DECIMAL_INSTANCE`, `AIBL_AMOUNT_DECIMAL_RECOGNIZED` | `instanceof Prisma.Decimal` and optional `Prisma.Decimal.isDecimal()` observations |
| `AIBL_AMOUNT_STRING_VALID` | Recognized Decimal's string parses, or original primitive parses; diagnostic candidate only |
| `AIBL_AMOUNT_VALID`, `AIBL_AMOUNT_NONZERO` | Actual unchanged conversion produces valid, nonzero money |
| `AIBL_CURRENCY_BDT`, `AIBL_ACCOUNT_FINGERPRINT_MATCH`, `AIBL_INITIALIZATION_VALIDATED` | Currency, stored/runtime fingerprint equality and initialization |
| `AIBL_ORDER_EXISTS`, `AIBL_ORDER_GATEWAY_MATCH`, `AIBL_ORDER_CURRENCY_BDT`, `AIBL_ORDER_TOTAL_MATCH` | Linked Order checks; not evaluated when attempt guards fail |
| `AIBL_BANK_SUCCESS_CONFIRMED` | Existing strict bank success validator accepts the response |

| Failure stage | Meaning |
| --- | --- |
| `PRE_VERIFY_VALIDATION_FAILED` | Before verify request: config/attempt/Order validation or its evaluation/read failed |
| `BANK_VERIFY_REQUEST_FAILED` | Verify request preparation/transport or response timeout failed |
| `BANK_VERIFY_RESPONSE_REJECTED` | Non-2xx, malformed/bounded-response failure, or unconfirmed strict success; UNKNOWN still remains pending |
| `SETTLEMENT_VALIDATION_FAILED` | Callback verified-reference mismatch or an explicit AIBL validation error inside settlement |
| `DATABASE_SETTLEMENT_FAILED` | Settlement transaction/operation failed; includes inventory, lifecycle or notification errors, not proof of a database-engine fault |

Existing `SETTLEMENT_REJECTED` remains. Same server-generated Request ID joins its
stage event, query guard results, `STATUS_QUERY`, `VERIFY` and settlement. Callback
uses its existing UUID throughout verification. Authorized status responses also
return `X-Payment-Request-Id`; do not share cookies, request bodies, signed URLs or
bank references. Standalone PCC comparison/cron queries get server-generated IDs.
Failure before authorized payment lookup may have a response ID without payment
events; this is separate from `queryAiblWalletPayment()` validation.

Settlement failures additionally identify the last operation/check using
`AIBL_SETTLEMENT_DATABASE_READ`, `AIBL_SETTLEMENT_ATTEMPT`,
`AIBL_SETTLEMENT_CAPTURE_STATE`, `AIBL_SETTLEMENT_ORDER_STATE`,
`AIBL_SETTLEMENT_OTHER_PAYMENT`, `AIBL_SETTLEMENT_OTHER_TRANSACTION`,
`AIBL_SETTLEMENT_INVENTORY_SNAPSHOT`, `AIBL_SETTLEMENT_CALLBACK_REFERENCE`,
`AIBL_SETTLEMENT_INVENTORY_COMMIT`, `AIBL_SETTLEMENT_WRITE`,
`AIBL_SETTLEMENT_ORDER_LIFECYCLE` or `AIBL_SETTLEMENT_NOTIFICATIONS`.
These events are persisted after rollback; no independent diagnostic connection
is opened while holding settlement locks.

Callback diagnostics run only after signed state and payment lookup pass:

- `AIBL_CB_CONTENT_*`: `FORM_URLENCODED`, `MULTIPART`, `JSON`, `OTHER` or `MISSING`.
  Header values/boundaries are not stored. A parser rejection can have only this
  category and `INVALID_CALLBACK`, without parsed-field observations.
- `AIBL_CB_BILLNO_PRESENT`, `AIBL_CB_AMOUNT_PRESENT`: exact uppercase own-property presence.
- `AIBL_CB_ALT_BILL_CAMEL/LOWER/SNAKE/PASCAL`: presence of `billNo`, `billno`,
  `bill_no`, `BillNo`, respectively. `AIBL_CB_ALT_AMOUNT_LOWER/PASCAL` observes
  `amount`, `Amount`. These names are observations, not accepted bank aliases.
- `AIBL_CB_BILLNO_TYPE_*`, `AIBL_CB_AMOUNT_TYPE_*`: `STRING`, `NUMBER`, `NULL`,
  `MISSING` or `OTHER`; never actual field values. An empty string remains type
  STRING and is independently rejected as `AMOUNT_MISSING`.

Order #5-এ নতুন charge ছাড়া নিজে evidence সংগ্রহ করার ধাপ:

1. Dev server চালু থাকলে প্রথম observation-এর আগে restart করবেন না; hot reload-এ
   updated handler আসতে দিন। এতে restart করে failure হারিয়ে যাওয়ার ঝুঁকি কমে।
2. Admin PCC-তে Order #5-এর **existing** AIBL transaction খুলুন। Checkout retry,
   initialization, নতুন payment, reset বা database edit করবেন না।
3. শুধু status তুলনা চাইলে **Compare gateway status** ব্যবহার করুন: bank verify
   query ও reconciliation/diagnostic records হয়; settlement/inventory হয় না।
   এটি `/api/aibl-wallet/status` handler-এর runtime-এর সমতুল্য প্রমাণ নয়।
4. সমস্যাযুক্ত একই handler পরীক্ষা করতে **Verify and settle pending AIBL payment**
   একবার চাপুন। এটি existing bank OrderID দিয়ে শুধু verify করে; নতুন token/orderID
   বা charge তৈরি করে না। Bank success ও সব checks pass হলে existing behavior
   অনুযায়ী CAPTURED/PAID ও inventory commit হতে পারে।
5. Browser Network-এ ওই status response থেকে শুধু HTTP status,
   `X-Payment-Request-Id` এবং sanitized error message নোট করুন। PCC details
   refresh/reopen করুন (error হলে UI নিজে refresh নাও করতে পারে)। Timeline-এর
   একই Request ID-এর diagnostics ও terminal events সংগ্রহ করুন; প্রয়োজনে
   **Load older events**। Complete trace-এর জন্য Timeline ব্যবহার করুন;
   Network correlation preview bounded হতে পারে।
6. `AIBL_ACCOUNT_FINGERPRINT_MATCH` FAIL হলে runtime/account mismatch প্রমাণিত।
   `AMOUNT_DECIMAL_INSTANCE` FAIL, `AMOUNT_DECIMAL_RECOGNIZED` ও
   `AMOUNT_STRING_VALID` PASS, কিন্তু `AMOUNT_VALID` FAIL হলে Decimal class
   identity/conversion path-এর সমস্যা নির্দেশ করে। Evidence অনুযায়ী পরে fix করুন;
   কোনো guard disable বা stored fingerprint/amount সম্পাদনা করবেন না।

Old callback-এর missing metadata এই পরিবর্তন দিয়ে উদ্ধার করা যাবে না। Future
legitimate callback বা isolated offline mock-এ নতুন metadata দেখা যাবে; Order #5
নিয়ে artificial callback, নতুন payment বা raw payload logging প্রয়োজন নেই।
Implementation-এর সময় API, tests, build, migration বা database writes চালানো হয়নি।

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
credentials report-এ দেবেন না। নিচের offline suite-এ transport mocks, callback
validation, duplicate bank references ও concurrent settlement assertions আছে;
agent suite execute করেনি।

## Isolated offline callback tests

Project root থেকে PowerShell-এ চালান:

```powershell
npm run test:aibl-wallet:offline
```

শুধু দুইটি named suite চলে; integration/database suites চালু হয় না। Existing
`node:test`, TypeScript এবং VM pattern reuse হয়েছে; নতুন dependency নেই। Test
helper actual callback/parser, HMAC validation, verify response validation,
settlement, inventory commit ও order lifecycle source চালায়। Bank transport,
Prisma operations, reporting/commission/notification writes এবং HTTP response
adapters memory-only। Rate limiter/cache/result receipt boundary mock করা হয়েছে;
এসব boundary-এর পূর্ণ runtime behavior এই suite-এর coverage নয়।

`.env`/`.env.local`, real credentials ও PrismaClient import হয় না। প্রতিটি fixture
নিজস্ব synthetic environment/state পায়; Order ID `900004`, real Order #4 নয়।
Unapproved imports এবং native fetch fail closed; intercepted verify transport
শুধু in-memory HTTP response ফেরায়, কোনো request পাঠায় না।

Expected result: সব tests PASS, 0 FAIL। URL-encoded/multipart, nested JSON `data`, duplicate/file/body
rejection, চারটি field diagnostic code, invalid state, SUCCESS/UNKNOWN/timeout,
transaction mismatch, duplicate/concurrent callback এবং rollback cover হয়।
Nested format-এ approved/decline/cancel routes, UNKNOWN bank response, malformed/
ambiguous/oversized envelope, duplicate escaped JSON keys, exact casing rejection,
safe diagnostics, transaction matching ও duplicate settlement-ও cover হয়।
Unknown result-এ Payment INITIATED ও Order UNPAID থাকে; stock/reservations retained।
Success-এ CAPTURED/PAID ও physical stock commit একবার।

Lock serialization ও rollback এখানে in-memory model; এটি বাস্তব PostgreSQL
locking/constraints, provider behavior, browser cookies বা real UAT success-এর
প্রমাণ নয়। User-run ফলাফল না পাওয়া পর্যন্ত suite-এর PASS দাবি করা হচ্ছে না।

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
