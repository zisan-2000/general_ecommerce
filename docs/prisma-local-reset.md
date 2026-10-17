# Local gen eco database reset

এই নির্দেশনা শুধু disposable local PostgreSQL `gen_eco` database-এর জন্য। Reset
করলে ওই database-এর application schema-এর existing data মুছে যাবে। Production
database access বা reset এই কাজের অংশ নয়। Application-এর payment/refund/inventory
logic এবং `schema.prisma` অপরিবর্তিত আছে।

## Migration chain audit

`prisma.config.ts`-এ active history `prisma/migrations-release`। এই directory-তে
প্রথমে থাকা `20260930130000_ensure_pc_builder_storage` migration `CartItem` table
আগে থেকেই আছে ধরে `ALTER TABLE` করছিল। Core tables তৈরির baseline ও আরও ছয়টি
dependency migration Git commit `1c3b36237`-এ মুছে যাওয়ায় empty database replay
ব্যর্থ হচ্ছিল।

ওই commit-এর parent থেকে SQL অপরিবর্তিত ফিরিয়ে আনা হয়েছে:

- `00000000000000_squashed_baseline`
- `20260912170000_add_product_model_warranty`
- `20260913130000_ensure_pc_builder_storage`
- `20260916120000_add_configurable_bundles`
- `20260916130000_harden_configurable_bundle_cart`
- `20260916140000_add_product_specification_groups`
- `20260917120000_add_bundle_group_pricing_mode`

Archived history থেকে exact SQL release history-তে যুক্ত হয়েছে:

- `20260928_add_home_footer_description`
- `20261004191500_add_product_best_selling`
- `20261005000000_google_ecommerce_tracking`

নতুন `20261015090000_complete_release_schema` migration current schema-এর আগে
থেকেই থাকা order consent fields, refund review/payout fields, indexes/FKs এবং
missing `RefundPayoutStatus`, `OrderStatus.REFUNDED`,
`CustomerNotificationType.ORDER_UPDATE` যোগ করে। কোনো capture/refund/order status
পরিবর্তন বা data backfill করে না। PostgreSQL provider lock file যোগ হয়েছে।

Working tree-তে আগে থেকেই থাকা release copies
`20261014120000_payment_control_center` এবং
`20261014150000_advanced_network_monitoring` পরিবর্তন করা হয়নি। এগুলো active
chain-এর অংশ এবং archived originals-এর সঙ্গে identical। Checkout/commit-এ এই
SQL files-ও রাখতে হবে।

SQL text dependency inventory-তে 20 migration files, 229 tables ও 155 enum types
আছে। এই source inventory-তে missing table dependency, unconditional duplicate
table/index/column declaration বা current schema-এর missing scalar column/enum
পাওয়া যায়নি। এটি PostgreSQL execution বা shadow-database validation নয়; reset
সফল হয়েছে এমন runtime দাবি করা হচ্ছে না। কোনো Prisma command, database connection,
migration, seed, build বা test এই implementation-এর সময় চালানো হয়নি।

## Local configuration

`prisma.local-reset.config.ts` normal application config import করে না। আলাদা
`LOCAL_RESET_DATABASE_URL` লাগে; missing URL, production process, non-loopback
host, অন্য database name, অন্য schema অথবা connection override query parameters
reject হয়। Allowed host `127.0.0.1`, `localhost` বা `[::1]`; database exact
`gen_eco`; schema `public`। URL যাচাই হওয়ার পরে ওই CLI process-এর `DATABASE_URL`
ও checked local URL-এ pin করা হয়। কোনো `.env` file পরিবর্তন করা হয় না।

নিজের local connection URL প্রস্তুত রাখুন, উদাহরণের shape:

```text
postgresql://<LOCAL_USER>:<URL_ENCODED_PASSWORD>@127.0.0.1:5432/gen_eco?schema=public
```

Actual URL chat, Git, logs বা command arguments-এ দেবেন না। নিচের secure prompt-এ
নিজে লিখুন। PostgreSQL service চলমান থাকতে হবে। Local database role-এর schema
reset/table creation এবং `pg_trgm` extension তৈরির permission লাগবে। এই chain-এর
enum additions-এর জন্য PostgreSQL 12 বা নতুন version ব্যবহার করুন।

## আপনার চালানোর commands

Next dev server, Windows network collector এবং এই local database ব্যবহার করা অন্য
application process আগে বন্ধ করুন। Repository root-এ non-production PowerShell
থেকে installed Prisma 6.19.3 CLI ব্যবহার করুন:

```powershell
Set-Location 'E:\Ecommerce\General\general_ecommerce'

$localResetSecret = Read-Host 'Local gen_eco PostgreSQL URL' -AsSecureString
$env:LOCAL_RESET_DATABASE_URL = [System.Net.NetworkCredential]::new('', $localResetSecret).Password
$localResetSecret.Dispose()
Remove-Variable localResetSecret

try {
    & .\node_modules\.bin\prisma.cmd migrate reset --config .\prisma.local-reset.config.ts --skip-seed --skip-generate
    if ($LASTEXITCODE -ne 0) { throw 'Reset failed. Stop here and report the migration name and sanitized error.' }

    & .\node_modules\.bin\prisma.cmd generate --config .\prisma.local-reset.config.ts
    if ($LASTEXITCODE -ne 0) { throw 'Prisma Client generation failed.' }

    & .\node_modules\.bin\prisma.cmd migrate status --config .\prisma.local-reset.config.ts
    if ($LASTEXITCODE -ne 0) { throw 'Migration status needs review.' }
}
finally {
    Remove-Item Env:\LOCAL_RESET_DATABASE_URL -ErrorAction SilentlyContinue
}
```

Prisma confirmation prompt-এ **local `gen_eco` host/database** দেখে reset নিশ্চিত
করুন। `--force` দেওয়া হয়নি। Local URL অন্য target হলে config আগেই stop করবে।
`--skip-seed --skip-generate` reset-এর automatic seed/generation বন্ধ রাখে;
পরের command client generate করে। Existing policy-content migration নিজের
published policy/FAQ rows insert করে, তাই skip-seed হলেও সব tables row-empty হবে
এমন নয়। কোনো admin/customer/demo seed চালানো হচ্ছে না।

Reset-এর পরে application চালাতে তার নিজের environment-এর local URL আপনাকেই সেট
করতে হবে। Local-reset config শুধু ওই Prisma commands-এর target নিয়ন্ত্রণ করে।

ফলাফল report করুন: প্রথম failed migration name ও sanitized error অথবা reset
completion, client generation এবং migration status output। কোনো credential নয়।

এই restored chain কোনো existing production database-এ deploy/resolve করার
instructions নয়। Production history reconciliation আলাদা audit প্রয়োজন।

Baseline ও migration ordering-এর reference:
[Prisma baselining documentation](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining)।
