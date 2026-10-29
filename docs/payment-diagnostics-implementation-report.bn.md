# Deshi Plus — Payment Diagnostics Implementation Report

কাজের সময়: ২৯–৩০ অক্টোবর ২০২৬, Asia/Dhaka। Repository: `E:\Ecommerce\General\general_ecommerce`, branch `main`।

## A. Project Audit

শুরুর working tree পরিষ্কার ছিল। Main repository থেকেই stack, payment providers, callbacks, checkout, Prisma schema, RBAC, inventory lifecycle, reconciliation, cron, existing tests ও deployment configuration পরীক্ষা করা হয়েছে। নিষিদ্ধ `deshiplus_eps_trace` project-এর source/design/repository ব্যবহার করা হয়নি।

বাস্তব stack: Next.js App Router 16.3.7, React 19, TypeScript, Prisma 6.19.3/PostgreSQL, NextAuth JWT এবং global/warehouse RBAC। Existing Payment Control Center, request inspector, safe payment events, optional socket-correlated DNS/TCP/TLS telemetry ও separate host monitoring আগে থেকেই ছিল।

EPS শুধু configured Sandbox এবং AIBL শুধু issued UAT endpoints গ্রহণ করে। EPS-এর exact `Success` + reference/amount checks এবং AIBL-এর exact verification contract/original initialization binding আলাদা। AIBL `/verify` HTTP telemetry-র existing operation `STATUS_QUERY`; নতুন adapter তার meaning `VERIFY_REQUEST` দেখায়, original operation বদলায় না।

প্রধান ঘাটতি ছিল attempt-wide investigation, explicit confidence/findings, broader read-only consistency checks, isolated bounded packet capture এবং restricted bank-evidence export। EPS init response-এ request-ID header ছিল না। Checkout lookup index-এর পুরোনো migration reference অনুপস্থিত ছিল; fresh release schema-তেও lookup index ছিল না। দুটি stale regression assertion/reference সংশোধন ও additive index migration দেওয়া হয়েছে।

## B. Architecture

Existing event/transport infrastructure-এর উপর নতুন read model ও rule engine বসানো হয়েছে। নতুন tracing vendor, message broker, dependency বা application microservice যোগ হয়নি। Capture-এর প্রয়োজনীয় privileged work আলাদা process-এ; Next.js handlers কখনো shell/Dumpcap/TShark চালায় না।

- স্থায়ী attempt trace UUID internal Payment ID থেকে derive হয়; financial row backfill/update লাগে না। এটি authorization token নয়।
- Individual server request IDs দিয়ে initialization-এর আগের AUTH/TOKEN এবং পরের callback/reconciliation evidence correlate হয়। Order/time proximity দিয়ে অন্য attempt-এর evidence জোড়া হয় না।
- Financial snapshot `REPEATABLE READ` + `SET TRANSACTION READ ONLY`; gateway request, repair বা financial lock নেই।
- Capture queue/manifest-এর জন্য একটি independent table; authorization/audit/host health-এর existing models পুনর্ব্যবহার।
- Diagnostics OFF থাকলে নতুন browser collection/capture বন্ধ থাকে। Existing core payment logging ও retry policies পরিবর্তিত হয়নি।

কেন এই নকশা: repository-তে আগে থাকা verified payment controls ও useful telemetry বজায় রেখে observability বাড়ানো যায়; নতুন infrastructure failure checkout-এর dependency হয় না।

## C. Implemented Modules

1. EPS/AIBL diagnostic interpretation adapters, stable attempt trace ও request correlation।
2. Optional browser API/redirect/network-interruption reports; server-issued request ID ও order ownership/signed guest token validation। Client reports সবসময় untrusted হিসেবে চিহ্নিত।
3. Order-level unassigned browser reports আলাদা view; response না পেলে সেগুলোকে নির্দিষ্ট payment attempt বলে দাবি করা হয় না।
4. Read-only payment/order/amount/duplicate reference, verification, reconciliation, reservation, warehouse availability, aggregate stock এবং commit-ledger checks। Missing bank reference-এ check `NOT_OBSERVED`। Original snapshot না থাকলে catalog-related historical mismatch `WARNING`।
5. Rule-based observed failure assessment: `CONFIRMED`, `PROBABLE`, `UNKNOWN`; evidence IDs, severity, component, merchant check, action ও bank confirmation requirement। Bank internal root cause সবসময় evidence ছাড়া `UNKNOWN`।
6. Dashboard, filters, timeline, transport evidence, certificate expiry where observed, capture health/readiness/progress ও explicit query/sample limits।
7. Dedicated capture/export/evidence permissions, rate limits, exact-origin mutations এবং sensitive action-এর durable audit।
8. Standalone capture agent: fixed executable arguments, no shell, independently approved public gateway IPs, interface validation, time/size/queue limits, process cleanup ও stale-temp janitor।
9. Real PCAPNG parsing, packet count, destination validation, micro/nanosecond timestamp normalization, payload/options removal, TShark retransmission observations এবং SHA-256।
10. JSON, formula-safe CSV, paginated PDF, restricted verified PCAPNG download ও bounded retention cron।

## D. Changed Files

নতুন files:

```text
app/admin/payment-control/diagnostics/page.tsx
app/api/admin/payment-control/diagnostics/route.ts
app/api/admin/payment-control/diagnostics/[id]/route.ts
app/api/admin/payment-control/diagnostics/captures/route.ts
app/api/admin/payment-control/diagnostics/captures/[id]/route.ts
app/api/payment-diagnostics/frontend/route.ts
app/api/payment-diagnostics/capture-agent/route.ts
app/api/payment-diagnostics/capture-agent/[id]/route.ts
app/api/cron/payment-diagnostics-retention/route.ts
components/admin/payment-control/PaymentDiagnostics.tsx
lib/payment-control/browser-diagnostics.ts
lib/payment-control/diagnostic-adapters.ts
lib/payment-control/diagnostic-policy.ts
lib/payment-control/diagnostic-authorization.ts
lib/payment-control/diagnostic-overview.ts
lib/payment-control/investigation.ts
lib/payment-control/investigation-engine.ts
lib/payment-control/consistency.ts
lib/payment-control/investigation-report.ts
lib/payment-control/pcapng.ts
lib/payment-control/capture-policy.ts
lib/payment-control/capture-storage.ts
lib/payment-control/capture.ts
scripts/lib/payment-capture-runner.ts
scripts/payment-capture-agent.ts
scripts/payment-diagnostics-verify-build.mjs
scripts/verify-payment-diagnostics-artifacts.mjs
tests/payment-diagnostics.test.ts
tests/payment-diagnostics-security.test.mjs
tests/eps-diagnostics-regression.test.mjs
tests/payment-capture-local.test.mjs
tests/payment-diagnostics-postgres.test.mjs
tsconfig.payment-diagnostics-verification.json
prisma/migrations-release/20261029120000_payment_diagnostic_capture/migration.sql
prisma/migrations-release/20261029121000_order_checkout_lookup_index/migration.sql
prisma/migrations/20261029120000_payment_diagnostic_capture/migration.sql
prisma/migrations/20261029121000_order_checkout_lookup_index/migration.sql
docs/payment-diagnostics-operations.md
docs/payment-diagnostics-implementation-report.bn.md
```

পরিবর্তিত existing files:

```text
.gitignore
package.json
next.config.ts
prisma/schema.prisma
lib/rbac-config.ts
lib/payment-control/queries.ts
lib/payment-control/telemetry.ts
lib/payment-control/transport-connector.ts
lib/payment-control/transport-observer.ts
lib/payment-control/transport-sanitizer.ts
lib/payment-control/transport-types.ts
app/admin/payment-control/page.tsx
app/api/eps/init/route.ts
app/ecommerce/checkout/page.tsx
tests/order-idempotency.test.mjs
tests/pc-builder-checkout-lifecycle.test.mjs
```

`.env`, production financial data, existing gateway verification functions এবং inventory helpers পরিবর্তন করা হয়নি। Generated Prisma output ও `.next` QA artifacts ignored; commit-এর source list-এর অংশ নয়।

## E. Database Changes

`PaymentDiagnosticCapture` diagnostics-only queue/manifest table এবং checkout JSON-key-এর non-unique lookup index যোগ করা হয়েছে। Active history `prisma/migrations-release`; historical mirror-এর দুই SQL file hash মিলেছে। নতুন migration-এ financial data update/delete/backfill নেই। Index হলো performance support; existing advisory lock-এর idempotency policy বহাল।

সম্পূর্ণ নতুন, random-role temporary PostgreSQL 17 cluster ও free loopback port-এ **২৫টি release migration** apply করে পরীক্ষা হয়েছে। প্রথমে actual server data-directory test-owned directory কি না যাচাই করা হয়েছে। Existing application database, `DATABASE_URL` বা financial records-এ migration/reset/repair চালানো হয়নি। Test শেষে temporary server stop ও owned directory cleanup হয়েছে।

Actual Prisma read-only investigation, captured/unpaid mismatch, capture advisory-lock concurrency, readiness guard, constraints ও lookup index পরীক্ষা হয়েছে। Real EPS/AIBL settlement functions + real inventory helpers + mocked gateway responses দিয়ে দুই warehouse-এর reservation একবার commit এবং native transaction rollback যাচাই হয়েছে। Reporting snapshot/notification/commission side effects test-এ isolated stubs; bank requests সম্পূর্ণ mocks।

`prisma validate`: PASS। প্রথম `prisma generate`-এ running Windows process-এর query-engine DLL rename-এ EPERM এসেছে; generated model/type files লেখা হয়েছে এবং actual PostgreSQL queries-তে চলেছে। Clean generation সফল বলে দাবি করা হচ্ছে না। Staging/deployment-এ safe maintenance/install window-তে `prisma generate` সফল করতে হবে; running developer app বন্ধ করা হয়নি।

## F. Payment Safety

EPS/AIBL success criteria, signed callback state, amount/reference/account guards, duplicate capture prevention, transaction idempotency, reservation identity, multi-warehouse commit, refund/reconciliation ও admin payment-field protection অক্ষত। নতুন diagnostics থেকে financial repair/PAID update বা automatic payment retry নেই। Callback receipt-কে payment success ধরা হয় না।

Existing regression tests ছাড়াও native PostgreSQL-এ concurrent verified settlement একবার capture/দুইটি warehouse deduction করেছে। Forced post-commit exception-এ Payment/Order/Stock/InventoryLog একসঙ্গে rollback এবং reservations retained হয়েছে। এই tests real bank success-এর দাবি নয়।

## G. Network Diagnostics

Application transport evidence-এ DNS OS lookup, TCP attempts, TLS handshake/certificate validation ও available expiry দেখা যায়। Reused/unobserved handshakes-এ নতুন timing বানানো হয় না। HTTP status, adapter business rejection এবং verification outcome আলাদা।

Installed Dumpcap/TShark **4.6.9** দিয়ে explicitly authorized controlled loopback TLS fixture capture হয়েছে: **৩৫৮ packets**, **২৭,৭৭২ derived bytes**, retransmission observations **০**; packet parsing/hash/payload removal ও temp cleanup PASS। Actual output-এর nanosecond clock প্রথমে reject হওয়ায় explicit normalization ও regression test যোগ করা হয়েছে। Canonical evidence original wire file নয়; encrypted application payload/TLS keys retained হয় না।

Production capture default OFF। Actual payment egress-visible host/interface, approved current gateway IPs, private persistent storage/ACL, service identity/capture permission, token/HTTPS, retention scheduler এবং readiness আগে configure/verify করতে হবে। Customer browser-to-bank traffic backend agent স্বয়ংক্রিয়ভাবে দেখতে পাবে না। Capture window-এর retransmission/reset নির্দিষ্ট payment বা bank fault প্রমাণ করে না।

## H. Admin Dashboard

Route: **`/admin/payment-control/diagnostics`**; existing Payment Control Center থেকে link আছে। Global payment management + existing staff authentication প্রয়োজন; capture, report export ও PCAPNG-এর জন্য তিনটি আলাদা permissions আছে।

List-এর assessment latest 100 matching attempts/100 events; detail সর্বোচ্চ 1,000 correlated events এবং প্রথম 20 request-এর transport window পড়ে। UI-তে coverage, sample limits ও missing evidence দেখানো হয়। Success rate captured + refunded states গণনা করে; HTTP/transport metric event-based, bank business-success rate নয়।

Authenticated browser UAT সম্পন্ন হয়নি। Read-only browser automation attempt aborted হয়েছে; login/authentication automation বা financial UI action করা হয়নি। Source/build, authorization tests ও native data reader যাচাইকে authenticated UI journey PASS বলা হচ্ছে না।

## I. Evidence Reports

Payment detail থেকে JSON/CSV/PDF export; authorized available capture থেকে PCAPNG download। JSON-এ manifest checksum, sanitized reference hash, provider-specific verification context, timeline, network/consistency checks, findings/action ও limitations থাকে। CSV formula injection neutralized। PDF built-in English technical font দিয়ে page-wrap/footer সহ তৈরি হয়; two-page synthetic fixture render করে visually checked হয়েছে। Actual bank/customer report প্রকাশ করা হয়নি।

PCAPNG download-এর আগে file size/hash যাচাই এবং dedicated authorization + durable export audit আছে। TLS key logging/disabled TLS verification থাকলে capture enable হয় না। JSON/PDF/CSV actual bytes ও report-payload checksum scope আলাদা header/manifest-এ বলা আছে। Formal compliance certification দাবি করা হয়নি।

## J. Automated Tests এবং Phase Results

সব runtime checks Node **24.22.1** দিয়ে হয়েছে; machine-এর global Node বদলানো হয়নি। `.next/payment-diagnostics-*-results.txt`-এ local logs আছে। Build isolated output directory, deliberately unusable DB URL, blank gateway credentials ও external-network guard ব্যবহার করে; production deployment নয়।

| Check | Final result |
| --- | --- |
| Diagnostics/security/EPS offline suite | ৭৩ tests, PASS |
| Combined relevant regression suite | ৪৯১ tests: ৪৭৬ PASS, ০ FAIL, ১৫ explicit skips |
| Real Dumpcap/TShark controlled loopback integration | ১ test, PASS; ৩৫৮ packets |
| Fresh PostgreSQL/release migration/native settlement integration | ৯ tests, PASS; ২৫ release migrations |
| Prisma schema validation | PASS |
| TypeScript | PASS; build-এর full typecheck enabled, কোনো ignoreBuildErrors নয় |
| Repository-wide ESLint | PASS |
| Isolated production build | PASS; exit 0, compile 57s, TypeScript 30.4s |
| Deployment artifact privacy verifier | PASS; ৭৬২ server manifests, ০ environment/private evidence references |
| Real EPS / Real AIBL transaction | NOT_TESTED / NOT_TESTED |
| Authenticated browser UAT | NOT_TESTED |

Commands:

```powershell
npm run test:payment-diagnostics
npm run test:aibl-wallet:offline
npm run test:order-inventory
npm run test:order-idempotency
npm run test:admin-order-editor
npm run test:payment-transport
npm run test:payment-transport:local
npm run test:payment-transport:postgres
npm run test:payment-capture:local
npm run test:payment-diagnostics:postgres
npm run validate:schema
npm run lint
npm run typecheck
npm run build:payment-diagnostics:verify
npm run verify:payment-diagnostics:artifacts
```

Local capture/PostgreSQL opt-in variables ও exact invocation [operations guide](payment-diagnostics-operations.md)-এ আছে। Session-এ required Node ব্যবহারের prefix: `npm exec --yes --package=node@24.22.1 -- node ...`। Combined regression run উপরের relevant test files একবারে চালিয়েছে। Existing strict transport-PostgreSQL suite-এর **১৫টি specific cases** dedicated approved target credentials না থাকায় skipped/NOT_TESTED; তার guard শিথিল করা হয়নি। নতুন fresh-cluster suite আলাদা server/fixtures-এ কাজ করেছে, skipped suite-এর পূর্ণ বিকল্প বলে দাবি করা হয়নি।

| Phase | Implementation / verification |
| --- | --- |
| 1 Audit | PASS; main code/schema/tests/config reviewed |
| 2 Architecture | PASS; existing infrastructure reused |
| 3 Instrumentation | Server/adapters/browser helpers PASS; authenticated browser UAT pending |
| 4 Database diagnostics | PASS; unit + actual fresh PostgreSQL read-only checks |
| 5 Network diagnostics | PASS locally; actual deployment egress visibility pending |
| 6 Investigation engine | PASS; observed/probable/unknown evidence rules tested |
| 7 Admin dashboard | Source/build/API gates implemented; authenticated UI UAT pending |
| 8 Evidence reporting | PASS; JSON/CSV/PDF/derived PCAPNG, authorization/integrity checks |
| 9 QA/security | Executed tests PASS; explicit skipped/external checks listed |
| 10 Final rollout verification | PARTIAL; no production activation/deployment |

## K. Remaining Requirements

1. Backup/drift/pending migration review করে approved staging/production target-এ migration deploy ও clean Prisma generation। Existing database-এ কোনো automatic deploy করা হয়নি।
2. New RBAC keys provision/assign এবং authenticated browser checkout/admin/export/capture UAT।
3. Separately authorized EPS Sandbox/AIBL UAT end-to-end payment/callback tests; real bank test এই implementation চলাকালে করা হয়নি। Existing code নতুন live environment support করে না।
4. Actual egress host/interface, operator-verified gateway addresses, persistent private storage/NTFS ACL/capabilities, service supervisor/token/HTTPS এবং retention cron deployment/sign-off।
5. Existing strict transport PostgreSQL suite-এর dedicated target configuration ও বাকি ১৫টি cases।
6. Formal security/compliance review এবং production load/retention/incident drills। Bank internal cause নিশ্চিত করতে প্রয়োজনীয় bank-side UTC logs।

এগুলোকে PASS দেখানো হয়নি। New passive browser diagnostics ও packet capture default OFF; `.env` enable করা হয়নি। Production rollout/rollback-এর বিস্তারিত plan [operations guide](payment-diagnostics-operations.md)-এ আছে।

## L. Final Status

| Item | Status |
| --- | --- |
| Architecture Implementation | PASS |
| Frontend Diagnostics | PARTIAL — helpers/source tests pass; authenticated browser UAT pending |
| Backend Diagnostics | PASS |
| EPS Instrumentation | PASS — offline/native PostgreSQL tests, real bank NOT_TESTED |
| AIBL Instrumentation | PASS — offline/native PostgreSQL tests, real bank NOT_TESTED |
| Database Diagnostics | PASS — actual fresh PostgreSQL; existing financial database unchanged |
| Network Capture Implementation | PASS — controlled real Dumpcap/TShark capture; deployment visibility pending |
| Admin Dashboard | PARTIAL — implementation/build/gates verified; authenticated browser UAT pending |
| Evidence Reporting | PASS |
| Automated Tests | PASS for executed cases; ১৫ legacy PostgreSQL cases NOT_TESTED |
| Real EPS Test | NOT_TESTED |
| Real AIBL Test | NOT_TESTED |
| Production Readiness | **NO-GO** — rollout prerequisites ও external validation বাকি |

Git push/deployment করা হয়নি। Local commit hash final response-এ দেওয়া হবে।

## Deployment packaging security review

Final `.nft.json` audit-এ existing EPS route ও নতুন capture route দুটিতেই inherited Prisma tracing থেকে repository `.env` reference পাওয়া যায়। `outputFileTracingExcludes` দিয়ে environment files, protected upload directories ও PCAPNG/private evidence server deployment trace থেকে বাদ দেওয়া হয়েছে। Runtime local/VPS files delete করা হয়নি; normal local `.env` loading পরিবর্তন করা হয়নি। Standalone/serverless deployment-এ secrets runtime environment দিয়ে এবং protected uploads/evidence separately provisioned persistent storage দিয়ে দিতে হবে। Runtime upload paths-এর existing authorization logic অপরিবর্তিত।

`verify:payment-diagnostics:artifacts` actual built server manifests scan করে private/environment file references-এর count যাচাই করেছে: **৭৬২ manifests, ০ unexpected references, exit 0**। এটি formal secret/compliance audit-এর দাবি নয়।

## Final verification

তিনটি disjoint test groups মিলিয়ে **৫০১ registered tests: ৪৮৬ PASS, ০ FAIL, ১৫ explicit skips**। এর মধ্যে ৭৩টি নতুন diagnostics/security/EPS offline cases combined suite-এর অংশ; সেগুলোকে আবার total-এ যোগ করা হয়নি। Controlled real capture ১টি এবং fresh PostgreSQL suite ৯টি cases আলাদা।

Final build, full TypeScript, repository-wide ESLint, schema validation, migration SQL mirror hashes, whitespace check এবং artifact privacy check সফল। সব temporary test PostgreSQL processes stopped/cleaned; controlled capture raw temporary files cleaned। Running main development server বন্ধ করা হয়নি। Actual application `.env` এবং existing financial database অপরিবর্তিত।

চালানোর সময় পাওয়া সমস্যা ঠিক করে সংশ্লিষ্ট checks পুনরায় চালানো হয়েছে: stale test references, modern Dumpcap timestamp resolution, Windows daemon-test pipe lifetime, insufficient worker heap propagation, storage containment edge case এবং inherited environment-file tracing। EPS/AIBL financial verification rules পরিবর্তন করে tests pass করানো হয়নি।

**Local implementation/QA reviewable; production activation NO-GO**, যতক্ষণ K-এর deployment, authorization, browser এবং authorized provider UAT requirements পূরণ না হয়।
