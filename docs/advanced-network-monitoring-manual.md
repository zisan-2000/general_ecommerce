# Deshi Plus Advanced Network Monitoring Manual

`/admin/payment-control` → **Network**-এ Windows host statistics, approved probe
measurements এবং Payment API observations আলাদা দেখা যায়। বর্তমানে অনুমোদিত
probe শুধু **TCP 127.0.0.1:3000**, interval **কমপক্ষে 60 seconds**। Collector
নিজে শুরু করতে হবে। Dashboard খুললে বা refresh করলে probe শুরু হয় না।

Implementation static review হয়েছে; collector, migration, build, typecheck, lint,
probe বা payment test এখানে চালানো হয়নি। Runtime readiness আপনার নিচের checks-এর
ফলাফলের ওপর নির্ভর করবে। Existing payment/refund/dispute settlement logic পরিবর্তন নেই।

## Metrics এবং সীমা

| Scope | Measurement | অর্থ |
| --- | --- | --- |
| Selected Windows NIC | Unicast + non-unicast sent/received counters | OS cumulative packet counts; প্রতিটি sample-এ raw total ও previous observation থেকে delta |
| Selected Windows NIC | Incoming + outgoing discarded packets | NIC/OS discards; network path packet loss নয় |
| Entire Windows host IPv4 TCP stack | SegmentsResent, FailedConnectionAttempts | সব application মিলিয়ে host counters; NIC বা payment request-specific নয় |
| Approved TCP target | ConnectAsync elapsed, outcome, timeout, bounded socket error code | TCP connection establishment latency; HTTP response time নয় |
| Approved TCP target | Packet sent/received/dropped, packet loss | **N/A**; handshake outcome থেকে packets বা packet loss বানানো হয় না |
| Probe | Jitter | Adjacent successful latency measurements-এর absolute difference-এর mean; কমপক্ষে দুই consecutive success; configuration change/long gap across নয় |
| Payment API | HTTP result, fetch-to-headers duration, timeout, allowlisted socket/DNS/TLS code, Request ID | Existing `paymentFetch` observations; response body download timing নয় |
| Payment API | Packet loss, retransmissions, provider internal network | **N/A**; gateway network-এ visibility নেই |

Windows counters-এর সংজ্ঞা Microsoft-এর [interface statistics](https://learn.microsoft.com/en-us/dotnet/api/system.net.networkinformation.ipv4interfacestatistics?view=net-10.0)
এবং [TCP statistics](https://learn.microsoft.com/en-us/dotnet/api/system.net.networkinformation.tcpstatistics?view=net-10.0)
documentation অনুযায়ী। Collector-এ `.NET` OS APIs ব্যবহৃত হয়েছে; packet capture বা SDK নেই।

Interface নির্বাচন না করলে/unsupported/down হলে NIC metrics N/A। TCP OS counters
আলাদাভাবে পাওয়া গেলে সেগুলো থাকবে। Loopback traffic physical NIC-এ দেখা যাবে এমন
নিশ্চয়তা নেই। First sample বা collector restart baseline; counter decrease/reset বা
adapter change-এ affected delta N/A। Counter values decimal strings/DB BigInt;
JavaScript safe-integer range-এর বাইরে chart value N/A, table-এ exact count থাকবে।

Chart missing measurements-কে zero বানায় না। Historical stale measurements timestamp
সহ দেখা যায়। Host 180 seconds পুরোনো হলে stale; probe freshness threshold
`max(180 seconds, 2.5 × interval)`। Charts এবং probe statistics সর্বোচ্চ latest 240
rows প্রতি scope; probe stats current target version। API totals/average/max পুরো
selected range। History 25-row pages, range 1/6/24/168 hours। Older records deleted
হয় না; retention-এর জন্য আলাদা reviewed operational policy লাগবে।

Future separately approved ICMP targets-এর জন্য collector/allowlist support আছে।
সেখানে actual `.NET Ping` attempts/replies থেকে echo no-reply percentage বের হয়;
এটি end-to-end echo observation, কোথায় packet হারিয়েছে তা বলে না।
Wire packet totals সেখানে N/A-ই থাকে; echo attempts/replies আলাদা probe observations।
Local unreachable/unsupported/error mixed window-এ no-reply percentage-ও N/A। Default policy
ICMP allow করে না। EPS/SSLCommerz কিংবা অন্য IP-তে probe করার অনুমতি এখন নেই।
এই setup-এ কোনো ICMP target যোগ করবেন না; packet-loss display **N/A** থাকবে।

## Database এবং local configuration

1. Local/staging database backup এবং migration history/schema drift review করুন।
2. `prisma/migrations/20261014150000_advanced_network_monitoring/migration.sql`
   review করুন। এটি পাঁচটি monitoring table এবং PaymentEvent-এর তিনটি nullable
   timing/binding column ও index যোগ করে। Money, order, inventory বা refund rows
   update/delete/backfill করে না।
3. Existing Payment Control Center migration আগে applied থাকতে হবে। Migration
   deploy সব pending migration চালায়; আগে প্রতিটির scope review করুন। Low-traffic
   staging window ব্যবহার করুন। SQL transaction, lock timeout 5s, statement timeout
   60s আছে। Timeout/failed migration হলে metadata review ছাড়া blind retry নয়।
4. Prisma Client regenerate করে আপনার validation চালান। নতুন generated client
   এখনো তৈরি হয়নি; regeneration-এর আগে নতুন Prisma model typings unavailable থাকবে।

নিচের commands **আপনি** সঠিক local/staging database-এ review ও backup-এর পরে চালাবেন:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

Secrets নিজের private environment-এ সেট করুন। `.env.local` এই কাজের সময় পড়া বা
পরিবর্তন করা হয়নি। Token dashboard/DB-তে লেখা বা ফেরত দেওয়া হয় না।

| Variable | কোথায় | Value/ব্যবহার |
| --- | --- | --- |
| NETWORK_MONITOR_AGENT_KEYS_JSON | Next server | JSON object: collector ID → unique secret; token 32–256 characters, `[A-Za-z0-9_-]`; secure random secret তৈরি করুন |
| NETWORK_MONITOR_ALLOWED_PROBES_JSON | Next server, optional | Default localhost TCP 3000, min interval 60s; নিচের policy ধরে রাখুন; `[]` হলে সব probes disabled |
| PAYMENT_NETWORK_AGENT_ID | Next server, optional | App এবং collector **একই host** হলে exact collector ID; অন্য host হলে unset রাখুন |
| NETWORK_MONITOR_ALERT_PROBE_LATENCY_MS | Next server, optional | Default 250 ms |
| NETWORK_MONITOR_ALERT_API_LATENCY_MS | Next server, optional | Default 2000 ms |
| NETWORK_MONITOR_ALERT_LOSS_PCT | Next server, optional | Default 5%; TCP-তে কোনো loss alert হয় না |
| NETWORK_MONITOR_API_URL | Collector process | `http://127.0.0.1:3000` local development; remote ingestion হলে public HTTPS app URL |
| NETWORK_MONITOR_AGENT_ID | Collector process | যেমন `windows-local`; server key mapping ও admin registered ID একই |
| NETWORK_MONITOR_AGENT_TOKEN | Collector process | ওই ID-এর server mapping-এর exact token; process environment-এ দিন, command arguments-এ নয় |
| NETWORK_MONITOR_INTERFACE_ID | Collector process, optional | একটি exact Windows network interface ID অথবা unique name; না দিলে NIC N/A |

বর্তমানে অনুমোদিত policy JSON (secret নয়):

```json
[{"address":"127.0.0.1","protocol":"TCP","port":3000,"minIntervalSeconds":60}]
```

Server token mapping-এর shape: `{"windows-local":"<YOUR_PRIVATE_RANDOM_TOKEN>"}`।
Placeholder নিজে replace করুন; কোনো token report/screenshots/Git-এ দেবেন না।
Monitoring key payment gateway credentials থেকে আলাদা রাখুন।

Interface ID/name নিজে দেখার read-only command:

```powershell
[System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Select-Object Id, Name, OperationalStatus
```

Admin access existing `admin.panel.access` এবং GLOBAL `settings.payment.manage`
অথবা GLOBAL `settings.manage`। Collector endpoints admin cookies ব্যবহার করে না;
per-agent bearer token ও enabled registration যাচাই করে।

## Collector চালানোর ধাপ

1. Server configuration দিয়ে Next application নিজে চালু করুন।
2. Payment Control Center → Network → Collector settings-এ `windows-local` ID ও
   non-sensitive label দিয়ে disabled collector register করুন।
3. ওই collector-এর target রাখুন: `127.0.0.1`, TCP, port `3000`, interval `60`,
   timeout `3000 ms`। Target ও collector enable করুন। একই endpoint-এর duplicate
   target reject হয়। অন্য address/protocol/port বা interval <60 server reject করবে।
4. পৃথক Windows PowerShell 5.1 বা PowerShell 7 process-এ collector variables নিজে
   সেট করে repository root থেকে চালান। একটি host/ID-এর জন্য একটি instance রাখুন।

```powershell
& .\scripts\network-monitor\windows-collector.ps1
```

Execution policy script block করলে নিজের approved script-signing/policy process
অনুসরণ করুন; machine-wide policy weaken করবেন না। Script Windows built-in .NET
APIs ব্যবহার করে; external agent, SDK, service installation বা elevation নেই।

5. প্রথম sample-এ delta N/A; অন্তত দুই subsequent observations-এর জন্য অপেক্ষা
   করুন। Dashboard visible Network tab-এ 10-second polling করে; background tab-এ
   polling pause। Probe/sample rate কমপক্ষে 60 seconds।
6. Ctrl+C collector বন্ধ করে। Disable collector/target reachable config refresh-এ
   কার্যকর হয়। App unavailable হলে cached approval সর্বোচ্চ 180s পরে expire।
   HTTP redirects follow হয় না; credential অন্য origin-এ forward হয় না।

Collector RAM-এ সর্বোচ্চ চারটি short-outage samples রাখে, 270s পরে discard করে;
server timestamp age সর্বোচ্চ 300s ও future skew 30s। Long outages-এর data recover
হওয়ার দাবি নেই। Session ID, sequence, measurement UUID, target version, per-agent
lock ও interval checks duplicate/out-of-order samples reject করে। Missing samples
নতুন packet counts তৈরি করে না। Labels, OS counters, approved endpoint snapshots,
bounded error codes সংরক্ষিত হয়; packet payload, MAC, machine hostname, headers,
token, response body বা raw exception নেই।

## Alerts এবং Request ID correlation

Host connection-failure delta, latest probe failure, recent measured probe latency
এবং approved ICMP echo no-reply rate-এর alerts collector ingestion-এ evaluate হয়।
Probe latency/loss window latest 10 samples within 12.5 × interval; ICMP loss
alert-এর জন্য অন্তত 10 valid samples। Unknown data alert resolve করে না।
Dashboard refresh latest API result per provider/explicit host in range থেকে
connection failure, timeout, HTTP error, high latency alert evaluate করে।
Concurrent refresh একই observation-এর occurrence count বাড়ায় না। OPEN/RESOLVED,
last timestamp, value/threshold, target/request reference retained থাকে। Healthy
watermarks without a previous failure alert list-এ দেখানো হয় না। Email/SMS নেই।

Payment Details → Timeline-এর Request ID click করুন অথবা Network correlation-এ
exact UUID দিন। `PAYMENT_NETWORK_AGENT_ID` থাকলে completed request-এর start/end
ও একই collector-এর ±120s samples পাওয়া যাবে। Correlation time context; host-wide
retransmission বা NIC discard কোনো নির্দিষ্ট payment/gateway-এর দায় প্রমাণ করে না।
Unbound, old, unfinished request বা absent samples-এ N/A/empty context থাকবে।
এখান থেকে কোনো gateway request, refund বা payment settlement হয় না।

## Manual test checklist

| ID | আপনি যা যাচাই করবেন | Expected result |
| --- | --- | --- |
| NM01 | Migration/client regenerate, typecheck/lint/build | Results report করুন; schema না থাকলে diagnostics 503; runtime PASS দাবি নেই |
| NM02 | Collector ছাড়া Network view | OS/probe values N/A, no fabricated packets; existing API history retained |
| NM03 | Wrong/missing token বা disabled collector | Config/ingestion denied; কোনো secret response/log-এ নেই |
| NM04 | Approved localhost setup enable, collector নিজে শুরু | TCP success, measured latency; দ্বিতীয় observation থেকে supported host deltas; TCP loss/count N/A |
| NM05 | Wrong/unset/down NIC selection | NIC N/A, available host-wide IPv4 TCP counters independent |
| NM06 | 59-second interval, different IP/port, ICMP target save চেষ্টা | Server approval reject; EPS/SSLCommerz target কখনো enable/probe নয় |
| NM07 | Duplicate endpoint add; same sample retry ও concurrent admin refresh review | Duplicate target reject; stored sample once; alert observation count once |
| NM08 | Local Next server 60–90s বন্ধ করে restart, collector চলমান রাখুন | Actual connection-refused outcome short RAM buffer থেকে upload; FAILURE alert/history; refusal-কে TIMEOUT/loss বলা হবে না |
| NM09 | Collector stop/restart, adapter change | Session baseline বা scope reset; affected delta N/A; stale warning after threshold |
| NM10 | Collector/target disable | Next reachable config refresh-এ probe stop; unavailable app-এ max180s lease; no endless cached probing |
| NM11 | Time/source filters, pagination, hidden tab | Scope-separated tables/chart, correct timestamps; chart bounded sample labels; hidden polling pause |
| NM12 | Existing payment Request ID click, with/without explicit same-host binding | Exact API event correlation; only bound same-host temporal context; unknown host N/A |
| NM13 | Real local measurement configured latency threshold অতিক্রম করে | Scoped high-latency alert; no generated/fake latency |
| NM14 | Existing payment history/refund/dispute workflows ও COD/manual UI inspect | Original behavior maintained; new monitoring does not change financial records |
| NM15 | DB/network response/log inspect | No agent token, gateway secret, customer payload, raw packet contents বা raw exceptions |

Localhost server বন্ধ করলে সাধারণত **connection refused**, reliable timeout নয়।
Actual timeout/retransmission/packet-loss event তৈরি হয়নি বলে zero failure বা PASS
ধরবেন না। Timeout branch review করুন এবং outcome কেবল প্রকৃত permitted event ঘটলে
পরীক্ষা করুন। বর্তমানে EPS/SSLCommerz probe, packet-loss injection, firewall change
বা নতুন target দিয়ে timeout test করার অনুমতি নেই।

Report-এ Windows/PowerShell version, UTC timestamps, collector/target state,
NM01–NM15 ফল, sanitised Request ID/error code এবং N/A কারণ দিন। Credentials দেবেন না।

## পরিবর্তিত ফাইল

- `prisma/schema.prisma`
- `prisma/migrations/20261014150000_advanced_network_monitoring/migration.sql`
- `lib/network-monitor/{policy,configuration,ingestion,alerts,queries,types}.ts`
- `lib/payment-control/{telemetry,types}.ts`
- `app/api/network-monitor/{config,ingest}/route.ts`
- `app/api/admin/payment-control/network/route.ts`
- `app/api/admin/payment-control/network/config/route.ts`
- `components/admin/payment-control/{NetworkMonitoringPanel,NetworkMonitorSettings,PaymentControlCenter}.tsx`
- `scripts/network-monitor/windows-collector.ps1`
- এই guide এবং `docs/payment-control-center-manual.md`-এর Network reference
