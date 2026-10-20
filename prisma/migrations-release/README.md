# Active release migration history

This is the active Prisma migration history for new and existing deployments.
The older incremental SQL is retained in `prisma/migrations` as an audit archive.

Empty databases apply the baseline normally through `prisma migrate deploy`.
For existing databases, verify schema equivalence and the recorded migration
ledger before choosing a separate, reviewed history reconciliation procedure.
See the Phase 9 runbook for baseline guidance.

The AIBL integration restores missing historical SQL from local `main` without
rewriting existing migration contents. Before deployment, compare the target's
recorded history with every restored migration. Do not run baseline DDL against an
existing schema whose equivalent migrations are not recorded.

For the disposable local `gen_eco` database, use the guarded
[`prisma.local-reset.config.ts`](../../prisma.local-reset.config.ts) and follow
[the local reset instructions](../../docs/prisma-local-reset.md).
The normal `prisma.config.ts` and existing migration SQL remain unchanged.

For AIBL UAT configuration and manual deployment checks, see
[the integration guide](../../docs/aibl-islamic-wallet-uat.md).

