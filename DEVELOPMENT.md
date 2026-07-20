# Local Development Setup

This document covers the local Supabase development workflow for bgs.mn.

**`supa.bgs.mn`** — a self-hosted Supabase stack running via Docker on the team's Ubuntu server — **is the production backend**. Supabase Cloud is being phased out and should not be treated as a source of truth going forward.

Local development runs a full Supabase stack via the Supabase CLI (`supabase/config.toml`, `supabase/migrations/`, `supabase/functions/` already in this repo), with schema kept in sync with `supa.bgs.mn` through committed migrations, and **real production data** refreshed locally as needed (the team is small — 2-3 developers — so real data is used directly rather than synthetic fixtures).

Server connection details (host, SSH user, `POSTGRES_PASSWORD`, MessagePro key) live in the team's password manager, not in this repo — ask whoever administers the server for access.

## Prerequisites

- Docker Desktop (must be running before any `supabase` CLI command)
- Node.js + npm
- SSH access to the production server — send your **public** key to whoever administers it to be added to `~/.ssh/authorized_keys`. Never share or request the account password.

## First-time setup

1. Clone the repo, `npm install`.
2. Get the server host and SSH username from the password manager, and confirm your key works: `ssh -i ~/.ssh/<your-key> <SERVER_USER>@<SERVER_HOST> 'echo ok'`.
3. Get these secrets from the team's password manager (never from git or chat):
   - `POSTGRES_PASSWORD` for `supa.bgs.mn` (needed to push/pull migrations and data)
   - MessagePro SMS gateway API key
4. Start Docker Desktop.
5. Boot the local stack — this applies every committed migration to a fresh local Postgres:
   ```bash
   npx supabase start
   ```
   Since `supabase/migrations/` is kept in sync with production (see "Making schema changes" below), a fresh clone should not need a `db pull` — the committed migrations already reflect `supa.bgs.mn`'s schema.
6. Create `supabase/.env` (gitignored, covered by the root `.env*` pattern) for local Edge Function secrets:
   ```
   MESSAGEPRO_URL=https://api-text.callpro.mn/v1/sms
   MESSAGEPRO_FROM=72777080
   MESSAGEPRO_KEY=<from password manager>
   SEND_SMS_HOOK_SECRET=v1,whsec_<generate your own — see below>
   ```
   Generate a fresh secret rather than reusing anyone else's:
   ```bash
   python3 -c "import base64,secrets; print('v1,whsec_'+base64.b64encode(secrets.token_bytes(32)).decode())"
   ```
7. Create `.env.local` (gitignored) with the local keys `npx supabase status` prints (`PUBLISHABLE_KEY` / `SECRET_KEY`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<PUBLISHABLE_KEY>
   SUPABASE_SERVICE_ROLE_KEY=<SECRET_KEY>
   ```
8. Pull today's real data so the app has something to work with — see the next section.
9. `npm run dev`.

Local URLs once running: app `http://localhost:3000`, Studio `http://127.0.0.1:54323`, API `http://127.0.0.1:54321`.

## Daily: refreshing local data from production

App data (orders, attendance, users, etc.) changes constantly on `supa.bgs.mn`. Refresh your local copy whenever you want current data:

```bash
export SUPA_BGS_MN_PG_PASSWORD='...'          # POSTGRES_PASSWORD from the password manager
export SUPA_BGS_MN_SSH_KEY=~/.ssh/<your-key>  # your own SSH private key for the server
export SUPA_BGS_MN_SSH_HOST='<SERVER_USER>@<SERVER_HOST>'  # from the password manager
./scripts/refresh-local-data.sh
```

This resets your local DB to a clean schema (from migrations), recreates the 8 storage buckets, and re-imports the latest `auth.users` / `auth.identities` / `storage.objects` plus all application data (`public`, `bgs_attendance`, `target`, `mobile` schemas) from `supa.bgs.mn`, via an SSH tunnel to the Postgres pooler.

⚠️ This pulls real employee data (names, phone numbers, etc.) onto your machine. Treat your local database like production data — don't dump/export it elsewhere, don't commit it, wipe it if your laptop changes hands.

## Making schema changes

1. Either `npx supabase migration new <descriptive_name>` and write the SQL by hand, or make the change in local Studio (`http://127.0.0.1:54323`) and run `npx supabase db diff -f <descriptive_name>` to capture it automatically.
2. `npx supabase db reset` to verify the new migration applies cleanly to a fresh database.
3. Commit the migration file.
4. Push it to production:
   ```bash
   ssh -L 5433:localhost:5433 -i ~/.ssh/<your-key> <SERVER_USER>@<SERVER_HOST>   # leave this running in its own terminal
   ```
   In another terminal:
   ```bash
   npx supabase db push --db-url "postgresql://supabase_admin.your-tenant-id:$SUPA_BGS_MN_PG_PASSWORD@127.0.0.1:5433/postgres?sslmode=disable" --debug
   ```
   Only migrations not already recorded in `supa.bgs.mn`'s `supabase_migrations.schema_migrations` table get applied. **Always include `--debug`** — see Gotchas.

## Updating Edge Functions on production

`supabase/functions/verify-user` is a real HTTP edge function in both environments — update it by copying the file and recreating the functions container:

```bash
scp -i ~/.ssh/<your-key> supabase/functions/verify-user/index.ts \
  <SERVER_USER>@<SERVER_HOST>:~/appdata/supabase/supabase/docker/volumes/functions/verify-user/index.ts
ssh -i ~/.ssh/<your-key> <SERVER_USER>@<SERVER_HOST> \
  'cd ~/appdata/supabase/supabase/docker && docker compose -f docker-compose.yml -f docker-compose.s3.yml -f docker-compose.bgs.yml up -d --force-recreate functions'
```

`sms-hook` and `create-auth-user` are edge functions **locally**, but native Postgres functions (`public.send_sms_hook`, `public.before_user_created_hook`) **on production** — see Gotchas for why. If you change their logic, you need to update both the edge function (for local dev) and the corresponding SQL function on `supa.bgs.mn` (for production) by hand.

## Adding a new developer

1. They generate an SSH keypair locally and send you the **public** key only.
2. Add it to `~/.ssh/authorized_keys` on the production server.
3. Share the server host/SSH username, `POSTGRES_PASSWORD`, and the MessagePro key via the team's password manager.
4. They follow "First-time setup" above.

## Gotchas

- **Supavisor's client-facing TLS is unconfigured on self-host.** Commands against the pooler (port 5433) intermittently fail with a misleading `tls error (server refused TLS connection)` even with `sslmode=disable` in the connection string. Always add `--debug` to any `supabase db push` / `db pull` / `migration repair` run against `supa.bgs.mn` — the real underlying error (only visible in debug output) is usually unrelated, and `--debug` mode reliably avoids the flake.
- **`supabase migration repair` silently mis-parses many version arguments passed at once** (it treats the whole space-joined list as one invalid version string). If you ever need to bulk-repair migration history, loop one version per command instead.
- **The real Postgres superuser on both `supa.bgs.mn` and local is `supabase_admin`, not `postgres`.** A `postgres` role exists but is not a superuser.
- **Supavisor requires a tenant-qualified username**: `<role>.your-tenant-id`, not just `<role>`. `your-tenant-id` is the literal, never-customized value of `POOLER_TENANT_ID` in `supa.bgs.mn`'s `.env`.
- If `supabase/migrations/` ever needs reconciling with production again, don't trust `supabase db pull` alone to catch every gap — diff `information_schema.columns` / `pg_tables` / `pg_views` / `pg_proc` between the live source and a local replay directly. `db pull` can silently under-report drift if its own shadow-database replay hits the same errors a real `db reset` would.
