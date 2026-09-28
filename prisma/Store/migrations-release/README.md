# Active release migration history

This is the active Prisma migration history for new and existing deployments.
The older incremental SQL is retained in `prisma/migrations` as an audit archive.

Existing databases must mark the squashed baseline as applied once; new databases
apply it normally through `prisma migrate deploy`. See the Phase 9 runbook.

