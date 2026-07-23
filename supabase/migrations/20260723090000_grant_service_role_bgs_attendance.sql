-- Fix: service_role missing GRANTs on bgs_attendance schema (see
-- SHIFT_EXCHANGE_KNOWN_ISSUES.md — "service_role-д bgs_attendance schema-ийн
-- GRANT дутуу"). 20260628095025_shift_exchange_schema.sql only granted USAGE
-- to authenticated/anon, and 20260628095224_shift_exchange_rls_permissions.sql
-- only granted table/sequence privileges to authenticated. Any future
-- service-role script/admin tooling querying bgs_attendance would otherwise
-- fail with "permission denied for schema bgs_attendance" (42501). service_role
-- bypasses RLS but still needs the underlying GRANT.
GRANT USAGE ON SCHEMA bgs_attendance TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA bgs_attendance TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bgs_attendance TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA bgs_attendance GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA bgs_attendance GRANT ALL ON SEQUENCES TO service_role;
