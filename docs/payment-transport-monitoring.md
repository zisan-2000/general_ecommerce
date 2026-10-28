# Payment transport evidence (Inspector schema 1.4)

**Current activation status:** connector isolation and explicit provider/operation
gates are implemented; npm Undici is patched. Default machine Node still needs
upgrading. See the [blocker fix report](payment-transport-blocker-fixes.md) for
runtime validation, security limitations and the approval-only AUTH procedure.
No instructions in this document grant gateway-call or activation approval.

## Local architecture audit

The local Node executable is **24.13.0**, with native-fetch Undici **7.18.2**.
The optional connector is pinned to patched npm Undici **6.29.1** in package.json
and package-lock.json. Instrumented mode requires reviewed Node **24.22.1+ <25**
with native Undici **7.30.1+ <8**. Portable 24.22.1 was validated without changing
the default machine installation. The lockfile upgrade ran with scripts disabled.

All audited AIBL, EPS and SSLCommerz outbound token, initialization, status and
verification calls use `paymentFetch()` in `lib/payment-control/telemetry.ts`.
The wrapper uses Node/Next native fetch, preserving the existing 20-second AIBL/EPS
and 30-second SSLCommerz deadlines, bodies, headers, cache and redirect options.
No Axios calls or application-level automatic retry were found on these paths.
Each subsequent wrapper call has independent attempt IDs, even with a shared
payment Request ID. Undici's internal repeated sends are separated when observed.

The default transport uses the existing global dispatcher and its pooling. No
global dispatcher, DNS policy, TLS trust store or gateway contract is changed.
The Windows collector remains host/probe context and supplies no payment handshake
durations. No packet capture or probe is introduced by this implementation.

## Modes and approval boundary

The default is OFF. No `.env` or secret file was read or changed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PAYMENT_TRANSPORT_MONITORING_MODE` | `off` | `off`, `passive`, or `instrumented` |
| `PAYMENT_TRANSPORT_STORAGE_ENABLED` | disabled | Must be `true` to collect/read evidence after migration review |
| `PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED` | disabled | Must be `true` to opt into the independent gateway Agent |
| `PAYMENT_TRANSPORT_ALLOWED_PROVIDERS` | none | Explicit comma-separated provider names; first smoke test: `AIBL_WALLET` |
| `PAYMENT_TRANSPORT_ALLOWED_OPERATIONS` | none | Explicit comma-separated operations; first smoke test: `AUTH` |
| `PAYMENT_INBOUND_TLS_TERMINATION` | unknown | Optional `UPSTREAM_PROXY`, operator configuration only |

**APPROVAL REQUIRED before enabling instrumented mode.** It uses a separate,
gateway-scoped Undici Agent/pool instead of the process's current global
dispatcher. The component is implemented and integrated behind the gates; it
has not been enabled. Before approval, review custom global dispatcher setup,
outbound proxy requirements, certificate/CA environment, Node version and hosting
lifecycle. A custom proxy or dispatcher may have policies this independent Agent
cannot preserve. Do not simply remove proxy environment variables to pass a gate.

Passive mode does not replace the transport. It observes exact sendHeaders
request/socket associations and connection reuse where supported, but cannot
recover earlier DNS/TCP/TLS timing. Its first observation of a socket is UNKNOWN
unless a correlated new-connection event was also observed. HTTP success is never
treated as a measured handshake. Passive and instrumented evidence is labelled.

Instrumented mode is limited to reviewed patched Node 24.22.1+ / native Undici 7.30.1+
(socket connectionAttempt events),
HTTP/1.1, direct HTTPS and the current exact gateway origin allowlist:

- AIBL: `https://iwtest.aibl.com.bd`
- EPS: `https://sandboxpgapi.eps.com.bd`
- SSLCommerz: `https://sandbox.sslcommerz.com`, `https://securepay.sslcommerz.com`

Hosted payment pages and incoming callbacks are excluded. Live EPS/AIBL URLs are
not added. Instrumented mode refuses configured HTTP/HTTPS/ALL proxies, Node env
proxy mode and `NODE_TLS_REJECT_UNAUTHORIZED=0`. It never disables certificate
validation, supplies a custom CA, forces new connections, or changes TLS session
caching. ALPN remains the standard connector's HTTP/1.1 policy. HTTP/2 evidence,
if seen through a passive/custom dispatcher, is explicitly unsupported for timing
attribution. The installed standard connector returns its socket although its TS
signature says void; the narrow cast is version-pinned and must be reviewed on
an Undici upgrade. Native Undici 7 fetch accepts the npm Undici dispatcher contract;
this particular combination still requires the operator's local validation.

If optional Agent initialization fails **before any dispatch**, native transport
remains available and collection falls back to passive observation. Once a fetch
is dispatched, a failure is returned through the original path without a new
transport fallback/retry. Monitoring initialization, collection and storage
exceptions are prevented from changing a successful HTTP result.

Configuration/origin/runtime initialization is inside the monitoring exception
boundary. Context setup failures before callback invocation dispatch the original
HTTP operation once; an already-created HTTP promise/error is preserved unchanged.
Every diagnostics subscriber has its own synchronous exception boundary. Registration
is marked complete only after all listeners succeed. Partial registration rolls back
only our listeners; failed rollback blocks re-registration until cleanup succeeds.
Shared runtime state prevents duplicates. Restart development servers that still
have an older subscribed runtime without listener references; capture stays unavailable
instead of adding another listener set. No diagnostic message/error text is logged.

## What is actually measured

DNS wraps the connector's real `dns.lookup()` call and forwards its original
options and callback unchanged. It measures monotonic start/completion times,
outcome and address family where available. This is **OS_NAME_RESOLUTION**, not
proof that any DNS packet was sent. IP literals have no lookup. Interrupted lookup
without observed completion has no fabricated completion time/duration.

TCP duration is `connectionAttempt` to `connect`, matched to the winning actual
socket address internally. Individual IPv4/IPv6 failures/timeouts are retained,
bounded to eight attempts. Addresses are not serialized. Missing start events
produce NOT_OBSERVABLE, not a fabricated zero. Successful TCP timing excludes DNS.

TLS duration is the actual Node `connect` to `secureConnect` callback interval,
labelled **TCP_CONNECT_TO_SECURE_CONNECT**. It is an application event measurement,
not packet capture or an independently observed first TLS packet. Protocol, cipher,
ALPN, certificate authorization and TLS session resumption come from TLSSocket.
Session resumption is distinct from reusing an already connected socket. No keys,
certificates, sessions, keylog events or authorizationError text are stored.

Diagnostics subscriptions use request:create to scope request objects, then
client:sendHeaders to join the **same request and actual socket**. beforeConnect
does not establish ownership and is deliberately not used for attribution.
An unsuccessful connection is joined only when the **identical connector error
object** is seen on request:error. Wrapped/different errors stay UNATTRIBUTED;
hostname/time proximity never joins evidence. ERROR_OBJECT_CORRELATED means the
failed connection affected the request; it does not assert a request was sent.
If request:create is missing, timestamps are explicitly labelled MONITORING_SCOPE
boundaries and the outcome is NOT_OBSERVED, not an observed HTTP duration.

A reused socket retains its connection ID, but all current attempt DNS/TCP/TLS
metrics say REUSED with null times/durations. Old measured timings remain in the
separate connectionEvidence snapshot. First send on a known new socket is NEW.
Concurrent requests are never associated by hostname, queue order or timestamps.

## Persistence, privacy and limits

There is an additive proposed migration:
`prisma/migrations/20261025120000_payment_transport_evidence/migration.sql`.
The operator reports it applied successfully to gen_eco_transport_uat; original
gen_eco status has not been inspected. It creates only the transport table and its sequence;
it does not alter Payment, Order or PaymentEvent records.

The existing PaymentEvent columns cannot hold structured per-attempt/socket evidence
without overloading diagnostic codes. A separate table stores a whitelisted JSON
projection, request/attempt/connection IDs, provider, operation and timestamps.
Both write and read boundaries strip unknown properties and reject unapproved
origins, sensitive query URLs, invalid IDs, invalid durations and inconsistent reuse.
No raw payloads, headers, customer identity, wallet data, tokens, fingerprints,
certificate bodies or exception text are retained.

Projection is exception-safe for getters/proxies and strict about metric ownership,
connection IDs, observed/failure states, reuse, HTTP/2 limitations and TLS validation.
Durations must match the collector's three-decimal millisecond precision. Wall-clock
elapsed times may differ from monotonic durations by at most 2,000 ms, accommodating
small clock adjustments; larger inconsistencies are rejected, never repaired or
estimated. A telemetry rejection never changes the payment result.

Memory: 128 active scopes, at most 8 HTTP attempts per scope, 8 TCP address attempts
per connection, a 128-row waiting queue plus one in-flight record, one database writer
per process, weak request/socket/error associations. Overflow/rejected evidence is
dropped. Every scheduled drain has a rejection handler; failed drains reset running
state, discard the batch and permit future enqueueing, with no automatic retry.
No database work runs in a socket or diagnostics callback. Inspector collectionHealth
exposes saturating accepted/persisted/duplicate/drop/rejection/write/drain counters
for the CURRENT_PROCESS_ONLY, not payment-specific or cluster-wide completeness.
Counters reset on process restart, and a process/serverless shutdown can lose
unflushed telemetry. Zero counters never prove complete capture.

Storage: 10,000 physical row slots maximum (sequence modulo ring), an **8,000-byte
compact UTF-8 JSON** application limit and the unchanged **20,000-byte JSONB text**
DB constraint. The whitelist produces ASCII-only values and durations without
exponent expansion. JSONB separator whitespace is conservatively bounded by doubling
compact bytes: at most 16,000 bytes, with 4,000 bytes additional headroom. Unknown
multibyte payload fields are stripped; multibyte content in allowed ASCII fields
is rejected. Oversized evidence is rejected without affecting payments.

All transport writers take the same short transaction-level advisory lock, separate
from financial locks. Under explicit READ COMMITTED, a subsequent INSERT statement
checks retained attemptId before allocating a slot. Duplicates do not advance the
sequence, overwrite unrelated slots, refresh expiry or weaken unique constraints.
New attempts overwrite the next ring slot. Lock/statement/transaction waits are
bounded; lock contention/storage errors drop telemetry, never retry a payment.
Idempotency applies while the attempt remains in the ring; no unbounded tombstone
history is maintained after eviction/cleanup. Concurrency fixtures model this SQL
contract offline; they do not replace an approved PostgreSQL integration check.

Seven days is a **maximum query window**, not a seven-day survival guarantee:
ring rollover, queue loss or rejection may remove evidence earlier. Expired rows
are excluded from reads even before physical deletion. Daily authenticated
`GET /api/cron/payment-transport-retention` deletes
up to 1,000 expired rows per call. Schedule up to ten bounded calls if necessary;
the hard ring cap applies even if cleanup is not scheduled. Use existing
`Authorization: Bearer <CRON_SECRET>` from your scheduler, never a query parameter.
Missing table/storage failure yields UNAVAILABLE and does not affect payments.

The read-only Inspector keeps existing RBAC and Cache-Control: private, no-store.
Schema 1.4 preserves v1.3 fields and adds transportEvidence. Its attempts list is
capped at 100 retained rows per Request ID. Legacy handshakes fields show a summary
only for one attributed attempt. Multiple attempts are never averaged/combined.
currentConfiguration describes the current runtime, not a historical attempt's mode.

## Incoming callbacks and ngrok

Browser/bank -> ngrok TLS, ngrok -> application, and application -> gateway are
separate connections. The application cannot observe the external ngrok TLS
handshake. With operator configuration UPSTREAM_PROXY, the Inspector reports that
termination location and NOT_OBSERVABLE application handshake visibility. It never
trusts forwarded headers as authenticated proxy evidence. No authenticated proxy
telemetry source is installed, so trustedProxyMeasurements remains NOT_COLLECTED.
Callback state/payload checks and authoritative bank verification do not establish
callback sender authentication; the existing separate evidence remains intact.

## Validation commands

From the repository in PowerShell, run the isolated offline suites first. They
mock OS/socket/Undici events and database writes; they make no network requests
and require no production database or bank credentials:

```powershell
npm run test:payment-transport
npm run test:payment-inspector
npm run test:aibl-wallet:offline
npm run typecheck
npm run lint
npm run build
```

Pre-migration hardening adds offline regressions for throwing subscribers,
registration rollback, configuration/context failures, duplicate IDs, ring rollover,
concurrent writers, drain rejection, sanitizer exceptions, overflow, byte limits,
cross-field consistency and original payment HTTP error/result preservation.
Current automated results and runtime provenance are in the blocker fix report.
Keep instrumented mode OFF until the target runtime and explicit test approval
are confirmed; do not repeat completed UAT migrations or database tests.

The transport suite covers successful DNS/TCP/TLS boundaries, new/reused sockets,
two requests sharing one socket, concurrency, provider isolation, DNS failure,
TCP refusal, certificate failure, timeout, retries, abort, missing instrumentation,
false correlation prevention, HTTP/2 unsupported behavior, sanitization, feature
gates, actual connector event wiring, telemetry failure isolation and storage caps.
Inspector regressions cover legacy field preservation, multiple attempts,
reused timing, payment status independence and existing access authorization.

After database migration approval, inspect all pending migrations first. Applying
`migrate deploy` applies **all** pending migrations, so review the full list:

```powershell
npx prisma migrate status
# Only after approving every pending migration for the intended database:
npx prisma migrate deploy
npx prisma generate
```

No reset, seed or migration was executed during implementation.

## Manual AIBL UAT after approval

1. Review the blocker fix report and its already automated validation results.
2. Use the already migrated dedicated UAT database; do not migrate gen_eco for this test.
3. Review the independent direct Agent/pooling change, proxy/CA requirements and
   pinned runtime. Explicit approval is required before setting the next flags.
4. For this PowerShell process only, after approval, set:

   ```powershell
   $env:PAYMENT_TRANSPORT_STORAGE_ENABLED = 'true'
   $env:PAYMENT_TRANSPORT_MONITORING_MODE = 'instrumented'
   $env:PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED = 'true'
   $env:PAYMENT_TRANSPORT_ALLOWED_PROVIDERS = 'AIBL_WALLET'
   $env:PAYMENT_TRANSPORT_ALLOWED_OPERATIONS = 'AUTH'
   $env:PAYMENT_INBOUND_TLS_TERMINATION = 'UPSTREAM_PROXY'
   npm run dev
   ```

   Start the application from this process. Do not print or modify credentials.
   If configuration status reports PROXY_TRANSPORT_REVIEW_REQUIRED, stop here and
   review proxy compatibility; do not bypass the gate. Passive mode may be used
   independently, but cannot provide earlier handshake stage timings.
5. The first approval is AUTH-only: invoke getAiblWalletToken once with a fresh
   server Request ID and discard the token without printing it. Do not use checkout
   initialization or an admin verification/settlement action for this smoke test.
6. Copy its new server Request ID from Payment Control Center and open
   `/admin/payment-control/requests/<requestId>`. Wait briefly for the bounded
   background insert, then refresh. Current monitoring mode must be instrumented.
7. Only approved AUTH calls are instrumented. Other operations/providers retain
   native fetch and do not imply monitoring approval. On a
   fresh connection expect a connection ID and SOCKET_CORRELATED attribution.
   DNS/TCP/TLS values appear only where their actual start/end events were seen.
   Check that TCP timing excludes DNS; TLS uses the labelled event interval.
8. A later operation may reuse the same connection, or legitimately open another
   one because of pooling/concurrency/keepalive. If reused, verify the same ID,
   REUSED status and null current handshake durations; the snapshot may reference
   old timings. Do not force connections or assume a second request must reuse.
9. AUTH-only has no payment callback. Inbound proxy TLS and callback sender
   authentication are not validated by this smoke test.
10. Confirm no payment was initiated/settled and Inspector RBAC remains enforced.
11. Turn monitoring mode back to off and restart to restore the original default
    transport. Do not toggle modes mid-payment to try to recover missing evidence.

No runtime success is claimed until the operator supplies the test/UAT results.

## Official references

- [Undici diagnostics channels](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md)
- [Pinned connector source](https://github.com/nodejs/undici/blob/v6.29.1/lib/core/connect.js)
- [Node 24 net events](https://nodejs.org/docs/latest-v24.x/api/net.html)
- [Node 24 TLS socket events](https://nodejs.org/docs/latest-v24.x/api/tls.html)
- [Node 24 DNS / OS name resolution](https://nodejs.org/docs/latest-v24.x/api/dns.html)
