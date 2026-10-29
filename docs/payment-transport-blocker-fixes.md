# Phase 4 blocker fixes — 2026-10-26

Instrumentation remains OFF. No gateway request, migration, financial record
change, Node machine installation, commit or push was performed.

| Blocker | Status |
| --- | --- |
| npm Undici | FIXED: direct installed and locked version 6.29.1; no other locked Undici instance. Install scripts were disabled. |
| Node/bundled Undici | PARTIAL: actual default executable is still C:/Program Files/nodejs/node.exe, Node 24.13.0 / native Undici 7.18.2. A checksum-verified portable Node 24.22.1 / native Undici 7.30.1 was used for validation/build only. Deployment runtime is not verified. |
| Connector isolation | FIXED: telemetry setup failure before dispatch selects one standard unobserved connector; network/callback failures after invocation are never retried. |
| AIBL-only isolation | FIXED: exact provider and operation allowlists, empty by default, with invalid flags/lists failing closed. AIBL_WALLET + AUTH does not activate any EPS/SSLCommerz or other AIBL operation. |

**Decision:** NO-GO on the current default Node runtime. CONDITIONAL GO for a
future explicitly approved, isolated AUTH-only backend smoke test when the actual
test process passes the patched runtime check. This is not public deployment
approval: npm audit still reports critical/high dependencies outside this patch.

## Runtime and dependency evidence

[Node's official 24.22.1 release](https://nodejs.org/en/blog/release/v24.22.1)
includes Undici 7.30.1. The [Undici 6.29.1 security release](https://github.com/nodejs/undici/releases/tag/v6.29.1)
fixes the identified npm transport issues while keeping the existing 6.x interface.
The reviewed connector still returns its socket, despite the void type declaration.
New native-fetch/Agent and real local fallback/TLS tests pass with these versions.

Portable Node was downloaded from nodejs.org into the task's TEMP directory;
the archive's SHA-256 matched the official SHASUMS256.txt before extraction/use.
Child PATH overrides selected it without modifying machine/user PATH, registry,
Node installation, .env or .env.local. Native fetch is not replaced by npm fetch.

| Execution context | Actual runtime status |
| --- | --- |
| Default development terminal / normal npm resolution | 24.13.0 / 7.18.2, incompatible; instrumented gate returns PATCHED_NODE_REQUIRED |
| Automated validation and guarded build child processes | Verified portable 24.22.1 / 7.30.1, compatible, npm Agent 6.29.1 |
| Already-running dev server | Not introspected or restarted; must restart under patched Node |
| Deployment | Not contacted; engine/.node-version hints do not prove the deployed runtime |

package.json engines and .node-version record the reviewed Node line. An engine
warning on the old executable is expected, not proof the machine was upgraded.
The active gate also independently checks bundled Undici, so a patched npm Agent
cannot make a vulnerable native fetch runtime eligible for instrumentation.

Run `npm run check:payment-transport:runtime` in the exact terminal/container/service
used to launch the application. It prints only process executable and version
metadata; exit 0 requires Node >=24.22.1 <25, native Undici >=7.30.1 <8 and the
reviewed npm Agent 6.29.1. It does not load dotenv, connect to a DB, call a gateway
or set flags. Inspector currentConfiguration also reports server-side versions.

## Connector and approval guarantees

The fallback connector uses the original resolver and standard TLS settings,
independent of measurement ALS. It retains original connector arguments and the
normal connector's deadlines. The existing paymentFetch abort signal, 20/30-second
deadlines, bodies, headers, no-store and redirect:error behavior are unchanged.

Fallback is selected only before the measured connector is invoked. A recorded
invocation flag prevents any subsequent retry. A retained socket survives a
post-return telemetry context failure; original synchronous network/callback
exceptions survive even if the context wrapper also throws. Callback network
errors stay errors. DNS observation/context and socket-listener failures are
isolated. No global dispatcher change or TLS verification bypass is introduced.

Tests assert exact-one measured/unobserved dispatch and callback behavior,
original error identity, original argument identity, DNS callback forwarding,
and real successful TLS fallback with only one local HTTP request. The same
fallback without a trusted test CA rejects TLS without reaching the HTTP handler.

Two new process settings are required for any capture (including passive mode):

| Setting | Default | First future approved smoke scope |
| --- | --- | --- |
| PAYMENT_TRANSPORT_ALLOWED_PROVIDERS | none | AIBL_WALLET |
| PAYMENT_TRANSPORT_ALLOWED_OPERATIONS | none | AUTH |

Lists are exact, comma-separated names. Unknown names, wildcards, empty entries,
duplicate entries, wrong casing and invalid boolean/mode values fail closed.
Supported providers: AIBL_WALLET, EPS, SSLCOMMERZ. Operations: AUTH, INITIALIZE,
STATUS_QUERY, VERIFY. Explicit multi-provider/multi-operation lists authorize
their cross-product; do not add names beyond the approved scope. No list is
written to any environment file by this task. Nonapproved calls return before
subscription/Agent creation and use original native fetch with original options.

The existing explicit approval, storage, proxy and TLS checks remain in place.
Instrumented mode now accepts only the reviewed patched Node 24 line. Node 22/25
and unknown/prerelease/native-Undici versions fail closed pending separate review.

## Security check result

npm audit after the upgrade reports no Undici finding. Full repository audit is
still nonzero: **13 package findings — 2 critical, 5 high, 6 moderate**.

| Severity | Packages flagged |
| --- | --- |
| Critical | next, dompurify |
| High | @vercel/blob, @vercel/cli-config, @vercel/oidc, follow-redirects, zod |
| Moderate | fast-uri, nodemailer, postcss-nested, postcss-selector-parser, sanitize-html, tailwindcss |

These are dependency audit findings, not proof every advisory is exploitable in
this application's configuration. They remain unresolved and must not be described
as a clean application security audit. Next.js affects the hosting surface and Zod
is used in transport sanitization; their advisories need separate applicability
review/remediation. Evidence payload/array limits reduce exposure but do not patch
Zod. No broad npm audit fix, framework upgrade or unrelated refactor was run.

## Validation

All successful validation below uses portable Node 24.22.1 / native Undici 7.30.1:

| Check | Result |
| --- | --- |
| Transport regression, connector faults, approval matrix | 80/80 PASS |
| Technical Inspector | 28/28 PASS |
| AIBL offline | 173/173 PASS |
| Local transport / native-fetch-Agent / fallback / build boundary | 13/13 PASS |
| Typecheck | PASS |
| ESLint | PASS |
| Guarded production build | PASS, exit 0; compiled in 69 seconds, build TypeScript in 58 seconds, static generation complete |
| npm audit | FAIL for 13 remaining findings; no Undici finding |
| Original DB / PostgreSQL UAT | Not rerun: persistence/migrations unchanged; operator's 51/51 result retained |

The patched native FormData producer exposed an offline fixture cancellation
issue: an oversized outgoing FormData body could enqueue after cancellation.
Oversized fixtures now fully serialize the same real multipart bytes first;
boundaries, signed URL, rejection status/codes and all original assertions remain.
A new incoming-style chunked ReadableStream regression confirms the real parser
still cancels and rejects >16 KB before bank verification or transaction access.
No test is skipped/deleted and no unhandled-rejection handler suppresses failures.
Production AIBL parsing, validation, settlement and inventory code are unchanged.

Build uses the existing npm run build through the process-scoped UAT wrapper,
monitoring OFF, approval false and an intentionally unusable DB URL. Database
unavailable messages during prerender are expected. This does not validate real
storefront data or constitute deployable runtime/bank evidence.

## Windows runtime upgrade — operator action only

1. Use the existing Node manager to select 24.22.1, or use the official signed
   [Windows x64 installer](https://nodejs.org/dist/v24.22.1/node-v24.22.1-x64.msi)
   if the installation is MSI-managed. Do not layer competing installation methods.
   Compare the downloaded file with the official SHASUMS256.txt and verify its
   Windows signature before running it. No installer was executed by this task.
2. Close/reopen terminals and the IDE after upgrading, and restart Node services
   so they do not retain the old executable. Use `where.exe node` to identify
   duplicate PATH installations, then run `npm run check:payment-transport:runtime`
   from the actual application launch environment. Do not print connection URLs.
3. Apply the same patched runtime to deployment separately; .node-version/engines
   are configuration hints, not verification. Check the deployment process's
   runtime metadata before any activation approval. No DB migration is part of
   the Node/Undici upgrade.

## Approval-only activation and rollback — NOT executed

Use an isolated instance targeting the already migrated gen_eco_transport_uat
database through securely configured child-process credentials. Do not change
or migrate gen_eco. Resolve the runtime precondition and review remaining host
security findings before allowing external access; keep this smoke test private.

Only after explicit approval for the test process and one AIBL AUTH request:

```powershell
npm run check:payment-transport:runtime
if ($LASTEXITCODE -ne 0) { throw 'Patched runtime required' }
$env:PAYMENT_TRANSPORT_ALLOWED_PROVIDERS = 'AIBL_WALLET'
$env:PAYMENT_TRANSPORT_ALLOWED_OPERATIONS = 'AUTH'
$env:PAYMENT_TRANSPORT_STORAGE_ENABLED = 'true'
$env:PAYMENT_TRANSPORT_INSTRUMENTED_APPROVED = 'true'
$env:PAYMENT_TRANSPORT_MONITORING_MODE = 'instrumented'
npm run dev
```

The actual database target must be independently verified as gen_eco_transport_uat
before an approved smoke runner writes telemetry. Do not remove a real required
proxy or disable TLS to satisfy the gate. Invoke only the existing server-side
getAiblWalletToken flow with a fresh Request ID; discard its one-time token without
logging/reusing it. No checkout initialization or admin verify/settlement action
belongs to this AUTH-only approval. An AUTH-only runner invocation still requires
explicit bank-call approval; none was created/executed here.

Inspect the retained AUTH attempt in Inspector v1.4 after the background insert;
certificate validation and observed socket/timing evidence must be honest, and
tokens/body/credentials absent. No payment outcome or bank-internal network
metric is inferred. Local integration success does not prove real bank TLS/HTTP.

For rollback: stop new operations, let in-flight requests finish, set mode=off,
approval=false, clear both scope allowlists and restart. Set storage=false to
disable history access too, or retain storage for read-only historical inspection.
Restart disposes process-owned Agent/listeners; do not destroy in-flight sockets,
replay uncertain payments, revert financial data or run a down migration.

## Exact files changed by this task

- package.json — patched dependency, Node engine, runtime check and test command.
- package-lock.json — only Undici version/integrity and root engine metadata.
- .node-version — reviewed runtime hint; not an installer or activation flag.
- lib/payment-control/transport-connector.ts — isolated monitoring setup/fallback.
- lib/payment-control/transport-config.ts — explicit scopes, flag validation and patched runtime gate.
- lib/payment-control/transport-monitor.ts — provider/operation gate before capture/Agent creation.
- lib/payment-control/transport-types.ts — scope metadata and patched connector version.
- lib/payment-control/request-inspector.ts — truthful patched connector metadata.
- components/admin/payment-control/TechnicalInspector.tsx — visible approved scopes.
- scripts/verify-payment-transport-runtime.mjs — safe process/runtime verification.
- tests/payment-transport.test.ts — updated patched-runtime gate expectations.
- tests/payment-transport-hardening.test.mjs — exact new config import in isolated VM fixtures.
- tests/payment-transport-connector-isolation.test.mjs — connector fault regressions.
- tests/payment-transport-approval.test.mjs — scope, runtime and flag-combination regressions.
- tests/payment-transport-local.test.mjs — real fallback and strict-TLS compatibility.
- tests/aibl-wallet-callback.test.mjs — serialized oversized fixtures and cancellation regression.
- docs/payment-transport-monitoring.md — current gate/version and AUTH-only instructions.
- docs/payment-transport-activation-readiness.md — marks prior snapshot as historical.
- docs/payment-transport-uat.md — points to current gates/runtime results.
- docs/payment-transport-blocker-fixes.md — this evidence, limitations and procedures.
