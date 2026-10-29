# Phase 4 activation readiness audit — 2026-10-26

Historical finding snapshot. The subsequent implementation and current runtime
conditions are documented in [the blocker fix report](payment-transport-blocker-fixes.md).
Do not treat proposed corrections below as still unimplemented.

**Decision: NO-GO for instrumented AIBL gateway activation in the current state.**
Local functional compatibility is demonstrated. Security dependencies and a
confirmed connector exception-isolation gap still need correction and review.
No gateway instrumentation, bank request, migration or payment operation was
performed by this audit. Credentials and secret files were not read.

| Audit area | Result and evidence |
| --- | --- |
| Central paymentFetch | Preserves method/body/headers, no-store, redirect:error and 20-second AIBL/EPS or 30-second SSL deadlines. No wrapper retry. Returns the original Response or error. HTTP response timing ends at response headers; subsequent gateway body validation is separate. Existing PaymentEvent writes are awaited, so telemetry DB latency can still affect wrapper latency; network timeout starts after the initial event insert. |
| Default and approval gates | OFF by default; storage and explicit approval required for instrumented mode. Node major restricted to 22/24, proxies and insecure TLS environment rejected for that mode. These checks do not enforce a security-patched runtime or dependency version. |
| Separate Agent | No global dispatcher replacement. The Agent has separate connection pools, TLS sessions, connection establishment and defaults. It does not inherit custom global dispatcher/proxy/CA callbacks; normal Node TLS defaults still apply. Instrumented mode is a real transport change, not purely passive logging. |
| Runtime compatibility | Tool process: Node 24.13.0, bundled Undici 7.18.2, npm Agent 6.29.0; lockfile agrees. New real loopback test exercises central paymentFetch with native fetch and the npm Agent, including exact socket evidence/reuse. PASS proves this local interface combination, not deployment or bank compatibility. |
| TLS and proxies | No rejectUnauthorized:false, custom checkServerIdentity override or global DNS policy in production monitoring code. Local trusted certificate success and untrusted certificate failure pass. Proxies are rejected rather than silently bypassed by the gate. Actual deployment CA/proxy/global-dispatcher policy remains an approval-time precondition; .env was not inspected. |
| Request correlation | request:create scopes the request; sendHeaders joins the exact socket. A failed connection is joined only through the identical error object. No hostname/time matching. No pre-connect ownership inference. |
| DNS/TCP/TLS attribution | OS lookup, actual TCP events and TCP-connect-to-secureConnect interval. Reused requests have null current handshake timings; historical values remain a connection snapshot. Missing evidence is N/A; HTTP/2 unsupported. No wire DNS, packet-loss or bank-internal visibility claim. |
| Persistence/retention | Whitelist sanitization at write/read; bounded queue, short writer transactions, advisory serialization, retained-ID idempotency and 10,000-slot ring. Seven days is a maximum query window, not guaranteed survival. Shutdown, rejection, overflow and ring eviction can lose evidence. Counters are process-local. Authenticated maintenance deletes bounded expired batches. |
| Inspector v1.4/UI | RBAC before data access, private/no-store response, separate attempts and no aggregation of unrelated handshakes. UI shows missing evidence, queue health and inbound TLS limitations. Existing Inspector regression passes. No browser session was tested during this audit. |
| Disable/rollback | New captures stop with mode OFF. Existing listeners/Agent are retained in process state, so restart is required for complete disposal. Do not destroy sockets or retry an uncertain payment during rollback. |
| Original DB migration | Static additive DDL is ready for approval review: one sequence/table, bounded slots/payload, unique attempt ID and request/expiry indexes, no financial-table alterations. Original gen_eco migration ledger/schema were not read or modified. Execution approval remains separate. |
| Provider scope | Approval flag applies to AIBL, EPS and SSLCommerz, including the live SSLCommerz allowlisted origin. It is not an AIBL-only approval boundary. Use an isolated AIBL-only test instance, or add/review a fail-closed provider-specific gate before shared-instance activation. |

## Confirmed activation blockers and proposed corrections

**A1 — Dependency/runtime security.** Installed npm Undici 6.29.0 is in the
affected range for the TLS 1.2 renegotiation process-crash advisory. The bundled
fetch implementation, Undici 7.18.2, is also in the affected range, including an
excessive-content-encoding crash that occurs before application body handling.
No exploit was executed. An allowlisted bank endpoint reduces exposure but does
not establish that an affected transport is ready to activate.

- [Upstream TLS renegotiation advisory](https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm)
- [Upstream fetch content-encoding advisory](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)

Minimum correction for these identified advisories: review/pin npm Undici 6.29.1
or a later reviewed compatible security release, and use a patched Node 24
release whose bundled Undici includes the relevant 7.30.1 fixes. Upgrading the
npm Agent alone does not update Node native fetch. Confirm exact installed
versions and rerun the local native-fetch/Agent boundary after the upgrade.
Update the pinned-version contract/comment and Inspector version metadata/type
together; currently request-inspector.ts and transport-types.ts name 6.29.0.
Do not force TLS 1.3 or disable validation to work around dependency issues.
No dependency, lockfile or runtime was upgraded automatically.

**A2 — Connector telemetry setup can escape.** In createObservedConnector(),
ObservedConnection construction and observeIpLiteral() are outside an isolation
try/catch. AsyncLocalStorage.run() also encloses the standard connector without
the before/after invocation guard used by PaymentTransportCapture.run().
A strict offline VM fault injection into the telemetry constructor reproduced:

```text
telemetryConstructorExceptionEscapes: true
dispatchCalls: 0
callbackCalls: 0
networkIO: 0
```

This proves a telemetry-only setup error can prevent transport completion. It
does not claim that such an error occurred in a real payment or that every
connector error crashes the process.

Proposed minimal correction: isolate only monitoring setup; on a failure before
standard connector invocation, dispatch exactly once using an unobserved standard
connector with normal TLS verification and no stale connection ALS context.
Never catch an actual connector/network error and resend; once invocation starts,
preserve its original socket, callback and error. Add fault regressions covering
constructor/IP-literal/context failure before and after invocation, exact-one
dispatch/callback and original TLS/network failure preservation. This production
transport correction is proposed, not applied during this audit.

**A3 — AIBL-only approval scope.** The three current environment gates authorize
the shared monitoring path, not a provider. An approved isolated AIBL-only process
with no EPS/SSL traffic can meet the scope; enabling the same flags in a shared
payment process cannot be represented as an AIBL-only change. A provider-specific
gate is the minimal code alternative; it was not added during this audit.

## Migration approval boundary

prisma.config.ts selects prisma/migrations-release as the active history. The
transport migration there is byte-identical to the archived prisma/migrations
copy. The user's dedicated gen_eco_transport_uat migration and 51/51 PostgreSQL
UAT result are accepted as user-reported evidence; database tests were not rerun.

For an isolated runtime test using that already migrated UAT database, no original
gen_eco migration is needed. A later deployment using gen_eco needs independent
connected-target verification, backup and migration-ledger/pending-list review
before explicit execution approval. Prisma migrate deploy applies all pending
migrations, so an approved transport SQL file is not blanket approval for the
pending chain. No reset/down migration is needed for monitoring rollback.

## Safe rollback after a future approved activation

1. Stop accepting new test operations on the isolated instance and allow existing
   requests to finish. Do not cancel sockets and automatically replay payments.
2. Configure PAYMENT_TRANSPORT_MONITORING_MODE=off and
   PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED=false in that process/deployment.
   Set PAYMENT_TRANSPORT_STORAGE_ENABLED=false to stop collection/read access,
   or leave storage enabled solely to inspect retained history with mode OFF.
3. Restart the instance. This clears the dedicated Agent, diagnostics listeners,
   ALS state and process-local queue; queued telemetry can be lost. A flag-only
   hot toggle does not dispose the old Agent/listeners.
4. Confirm currentConfiguration.mode=off. New paymentFetch operations use the
   original default dispatcher. Preserve evidence and financial records. Resolve
   any uncertain payment only through the existing authorized verification flow.

## Minimum next approved runtime test

1. Approve/correct A1/A2 and establish A3 isolation; automate the affected offline
   checks once for the final patched combination, without repeating migrations.
2. Use a dedicated instance targeting gen_eco_transport_uat, with approved UAT
   credentials, reviewed CA/proxy settings and no unrelated gateway traffic.
3. Obtain explicit activation and bank-call approval before setting the gates.
   Begin with one AUTH-only smoke operation using the existing getAiblWalletToken
   flow and a server-generated Request ID. Discard the returned token without
   logging/caching it; do not initiate, verify/settle, capture or refund a payment.
4. Confirm persisted sanitized AUTH evidence and Inspector v1.4: exact connection
   attribution, valid certificate, observed stages only and no sensitive fields.
   Inbound/ngrok TLS stays NOT_OBSERVABLE. Roll back afterward. This is a gateway
   smoke test; a payment lifecycle test requires separate explicit approval.

## Validation provenance and changes

- Rerun here: transport 58/58, Inspector 28/28, AIBL offline 172/172 PASS.
- Updated local/build-boundary suite: 12/12 PASS, including the new native-fetch
  central paymentFetch/separate-Agent test. No real bank requests or DB writes.
- Focused ESLint on the changed test: PASS. Whitespace review: no errors.
- User-reported existing evidence: PostgreSQL 51/51, typecheck, lint, build and
  dedicated UAT migration PASS. No repeated build, migration or SQL UAT here.
- Changed only the local test and audit/documentation files. No production
  payment/transport, credential, gateway or migration configuration changed.
