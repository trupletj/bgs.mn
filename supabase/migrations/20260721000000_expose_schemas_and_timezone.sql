-- Parity fix (2026-07-21 cutover): mirror Cloud's PostgREST exposed schemas and
-- session timezone, which were never captured anywhere in this repo.
--
-- Cloud's `authenticator` role has:
--   pgrst.db_schemas = public, graphql_public, bgs_attendance, mobile
-- (note: target is intentionally NOT exposed — apps read target-derived data via
-- the sync triggers into public/bgs_attendance, never target directly).
-- Without this, the attendance and mobile apps get HTTP 406 on every bgs_attendance
-- / mobile REST call. config.toml's [api] schemas is the matching local-dev setting.
--
-- Cloud also pins the DB session timezone to Asia/Ulaanbaatar; self-host defaulted
-- to UTC, which would shift every now()/date rendering by 8 hours.
--
-- NB: on supa.bgs.mn this was applied by hand as supabase_admin via `docker exec`
-- (ALTER ROLE authenticator / ALTER DATABASE need privileges the pooler's SET ROLE
-- postgres doesn't have), plus PGRST_DB_SCHEMAS in the docker .env was updated and
-- the rest container restarted. Local `supabase db reset` applies it fine.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, bgs_attendance, mobile';
ALTER DATABASE postgres SET "TimeZone" = 'Asia/Ulaanbaatar';
