# Phase 9 distribution runbook

## New database

1. Configure `DATABASE_URL` for an empty PostgreSQL database.
2. Run `npx prisma migrate deploy`.
3. Run `npm run seed:universal` twice; both runs must succeed.
4. Run `npx tsx scripts/verify-universal-seed.ts`.
5. Optionally apply one guarded `STORE_PRESET` and verify it.

The active migration history is `prisma/migrations-release`. The squashed baseline
also creates the migration-owned PC Builder external tables.

## Existing pre-Phase-9 database

1. Take and verify a database backup.
2. Confirm the database already contains the application schema.
3. Set `ALLOW_PHASE9_BASELINE_RESOLVE=true` and run
   `npm run resolve:phase9-baseline` exactly once.
4. Run `npx prisma migrate status`; it must report up to date.
5. Run the universal seed and database verifier.
6. Audit and neutralize known demo credentials before exposing the deployment.

Never run the squashed baseline DDL directly against an existing database. Prisma's
`migrate resolve --applied` records equivalence without recreating tables.

## Preset switching

Preset application is an explicit configuration mutation. It disables navigation
for categories owned by the other bundled presets, activates the chosen categories,
sets the exact optional-module flags, and ensures typed attribute mappings. It does
not delete catalog or historical order rows.

## Restore

Source rollback is a normal git revert. Database restore uses the backup taken before
baseline reconciliation or credential cleanup. Banned historical demo accounts can
be recovered only by an authorized administrator assigning new, non-demo credentials.

