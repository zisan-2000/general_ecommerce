# Active release migration history

This is the active Prisma migration history for new and existing deployments.
The older incremental SQL is retained in `prisma/migrations` as an audit archive.

Existing databases must mark the squashed baseline as applied once; new databases
apply it normally through `prisma migrate deploy`. See the Phase 9 runbook.

For the disposable local `gen_eco` database, use the guarded
[`prisma.local-reset.config.ts`](../../prisma.local-reset.config.ts) and follow
[the local reset instructions](../../docs/prisma-local-reset.md).
The normal `prisma.config.ts` and existing migration SQL remain unchanged.

