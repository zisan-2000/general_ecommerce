# Phase 4 isolated transport UAT

Historical validation record; current patched-runtime results, provider/operation
gates and approval-only instructions are in [the blocker fix report](payment-transport-blocker-fixes.md).

Validation performed on 2026-10-26 (Asia/Dhaka):

| Check | Result |
| --- | --- |
| Existing transport/hardening regression | PASS — 58/58 |
| Inspector regression | PASS — 28/28 |
| AIBL offline regression | PASS — 172/172 |
| Local transport/Inspector JSON and build-boundary integration | PASS — 11/11 |
| PostgreSQL connection-target rejection guards | PASS — 5/5 |
| PostgreSQL scenarios using actual persistence SQL | NOT TESTED — 15 SKIPPED, credentials unavailable |
| Typecheck | PASS, also passed inside the guarded production build |
| ESLint | PASS, full npm run lint and focused final-file checks |
| Production build | PASS, exit 0 with intentionally unavailable DB messages during prerender |
| Admin browser UI session | PARTIAL — regression/build covered; no browser session tested |
| Real bank gateway transport | APPROVAL REQUIRED — no bank requests made |

There are 274 passing test cases, zero failing test cases and 15 explicit skips.
No original gen_eco or cloned customer/order/payment records were modified.
No migration, backup/restore, payment, global dispatcher replacement or real
instrumentation activation was performed. No production source changed in this
UAT task. Database authentication, rather than application logic, blocks the
remaining PostgreSQL validation. A noninteractive psql connection to the exact
test target stopped with "no password supplied"; no authenticated query or write
was performed. Credentials were not read from .env or .env.local.

The build deliberately cannot load database-backed storefront data; its generated
artifacts are validation artifacts, not a deployment validated against real data.
It initially emitted a shell-spawn deprecation warning; the wrapper now launches
npm's Node CLI directly, with no shell. The boundary tests cover this configuration.

These runners do not authorize real gateway instrumentation. Default monitoring
remains OFF. They never bootstrap gateway/payment/settlement modules.

## Local transport

`npm run test:payment-transport:local`

Runs actual application connector, observer, diagnostics subscriber, sanitizer
and Inspector aggregation against an ephemeral loopback HTTPS server. Tests
cover OS lookup, TCP and verified TLS timings, reuse, simultaneous independent
connections, certificate rejection, connection refusal, unavailable evidence,
sanitization and measured evidence in Inspector JSON. A process-local socket
guard rejects non-loopback destinations. A VM import boundary substitutes only
the approved-origin list with localhost; production allowlists stay unchanged.
The disposable certificate is trusted only by the test Agent, never globally.
No instrumentation approval flag or global dispatcher is changed.

Inspector uses synthetic in-memory PaymentEvent fixtures. This confirms actual
JSON aggregation, not a browser/admin-login or end-to-end database/UI session.
Local success is not evidence of DNS/TCP/TLS measurements from a bank gateway.

## Dedicated PostgreSQL database

`npm run test:payment-transport:postgres`

Connected-target guard correction (2026-10-26): the old query used
`inet_server_addr()::text`. PostgreSQL's explicit inet-to-text conversion retains
the host mask, producing `127.0.0.1/32` or `::1/128`; the exact loopback comparison
therefore rejected valid local connections. The query now uses
`host(inet_server_addr())`, which removes the mask before the unchanged exact
`127.0.0.1` / `::1` check. See the PostgreSQL 17
[network functions reference](https://www.postgresql.org/docs/17/functions-net.html).
This fixes a confirmed guard implementation defect; it is not evidence that a
particular live connection's database/port/schema has been validated.

The exact URL/connected-target guard now lives in
`tests/helpers/payment-transport-postgres-target.mjs`. Structured safe errors
preserve fixed failed-check codes through the runner's redaction catch:
`UAT_DATABASE_MATCH`, `UAT_PORT_MATCH`, `UAT_SCHEMA_MATCH`, `UAT_SERVER_LOOPBACK`.
Only known database names, numeric ports and fixed schema/address categories
are displayed. Arbitrary server strings, database usernames, credentials and
connection URLs are never included. PostgreSQL performs normal authentication;
there is no additional username allowlist and no authentication bypass.

After this correction the PostgreSQL command runs 35 offline safety/regression
checks successfully (the original five are preserved). All 15 real database
scenarios remain SKIPPED in the agent process because its dedicated connection
variable is unavailable. No secret file was inspected to obtain credentials.
Use the same command in the authenticated terminal where the dedicated UAT
variable is already configured; it never falls back to the app's DATABASE_URL.

Authentication must be supplied securely to the runner's child environment as
`PAYMENT_TRANSPORT_UAT_DATABASE_URL`. It has no dotenv or DATABASE_URL fallback.
Never share a credential URL in logs/chat. Do not change the application's .env.
When the variable is unavailable, five URL/target rejection tests still run and
all fifteen database scenarios explicitly SKIP; this is not PostgreSQL UAT PASS.

Only `localhost:5432/gen_eco_transport_uat`, public schema, is accepted. The
runner independently checks current_database(), inet_server_addr(), server port
and schema on the actual connection before writes, including each persistence
transaction. The application Prisma singleton is not imported; an explicit
datasource creates a dedicated client with query/error logging disabled.

The fifteen scenarios cover concurrent writers, the actual advisory lock,
concurrent duplicates, ring rollover, separate Request IDs, duplicate safety,
constraints, timeouts/contention, storage failure/recovery, actual read/query
logic, seven-day TTL/expiry filtering and bounded slot constraints. Actual private
persistTransportAttempt source is exposed only inside the VM test harness; no
production export or persistence behavior is changed.

Use this runner exclusively against the dedicated test evidence table. Setup
requires it to be empty and aborts without clearing any existing records. No
customer, Payment, Order, Inventory or Settlement records are queried, copied,
updated or deleted. The SQL facade exposes only evidence-table/sequence commands
and rejects commands targeting financial tables. This restriction is separately
tested; no financial-table snapshots or data reads are necessary.

Each run uses random synthetic Request/Attempt IDs, at most three concurrent
writers and short transaction/connection timeouts. Ring rollover uses setval
under the same writer lock, not 10,000 payment requests. Integer slot bounds plus
the primary key prove the 10,000-row ceiling without filling the table. Finally,
only owned IDs are deleted and the exact original sequence value/is_called are
restored under lock. Unexpected evidence or sequence activity from another writer
causes a fail-closed abort, never deletion/restoration over another writer's state.
Keep other transport writers disconnected from this dedicated test DB for the run.
Setup/constraint/authentication/cleanup failures are redacted to fixed error codes.

No database reset, recreation, backup, restore or migration is performed.

## Guarded production build

`npm run build:payment-transport:uat`

Runs the existing `npm run build` with a deliberately unusable child-scoped
DATABASE_URL, monitoring OFF, storage disabled and approval false. A synchronous
Node preloader blocks external JS socket/DNS connections and PostgreSQL sockets,
and preserves itself through cross-env/Next child spawns. It never edits .env.
The database override also protects native Prisma connections which do not use
JavaScript sockets. Next can load its usual build configuration, but cannot use
the original database URL. This may reveal static pages that require database
availability; such failures must be reported, not bypassed by connecting gen_eco.

The guard does not claim to sandbox arbitrary native executables. Test source
imports no bank SDK or bank transport, and the application build is not a payment
test. It must not be used to execute unreviewed native commands.

The regular regression/type/lint commands remain unchanged:

```powershell
npm run test:payment-transport
npm run test:payment-inspector
npm run test:aibl-wallet:offline
npm run typecheck
npm run lint
```

Real gateway measurements and instrumented-mode activation require separate
approval. Do not enable PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED for this UAT.
