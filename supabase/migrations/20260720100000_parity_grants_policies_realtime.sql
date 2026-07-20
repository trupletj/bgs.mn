-- Parity fixes from the 2026-07-20 Cloud vs supa.bgs.mn audit.
-- Mirrors Cloud's live permission/realtime state that was never captured in a
-- migration (granted via earlier migrations that were repair-marked without
-- executing on self-host, or added directly via the Cloud dashboard):
--   1. Schema USAGE + table + sequence grants on bgs_attendance / mobile / target
--   2. Four storage.objects policies for the avatars and chat-media buckets
--   3. supabase_realtime publication membership (3 tables)
--   4. Tighten two public tables that were more permissive than Cloud
-- All statements are idempotent (GRANT/REVOKE re-run safely; CREATE POLICY and
-- ALTER PUBLICATION are wrapped to ignore duplicates).
--
-- NB: on supa.bgs.mn this was applied by hand as supabase_admin via `docker exec`
-- (not `supabase db push`). Pushing through the Supavisor pooler does `SET ROLE
-- postgres`, and postgres is neither superuser nor the owner of the
-- bgs_attendance/mobile/target schemas there, so the schema/table GRANTs silently
-- no-op through the pooler (the storage-policy and publication statements do apply,
-- since those objects' owners permit it). Local `supabase db reset` runs fine
-- because the local postgres role IS a superuser.

-- 1. Schema USAGE (matches Cloud ACLs exactly: target has NO anon usage)
GRANT USAGE ON SCHEMA bgs_attendance TO anon, authenticated;
GRANT USAGE ON SCHEMA mobile TO anon, authenticated;
GRANT USAGE ON SCHEMA target TO authenticated;

-- 1a. Table grants (exact mirror of Cloud's information_schema.role_table_grants)
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.attendance_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.bus_routes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.buses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.companion_group_members TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.companion_groups TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.passenger_assignments TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.shift_exchange_groups TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.shift_exchanges TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON bgs_attendance.trip_leaders TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON bgs_attendance.trip_leader_notes TO authenticated;
GRANT INSERT, SELECT, UPDATE ON mobile.conversation_members TO authenticated;
GRANT INSERT, SELECT, UPDATE ON mobile.conversations TO authenticated;
GRANT INSERT, SELECT, UPDATE ON mobile.messages TO authenticated;
GRANT SELECT ON mobile.contacts TO authenticated;
GRANT SELECT ON mobile.group_join_requests TO authenticated;
GRANT SELECT ON target.h_autobus TO authenticated;
GRANT SELECT ON target.h_eelj_soliltsoo TO authenticated;
GRANT SELECT ON target.h_user_autobus_address TO authenticated;

-- 1b. Sequence USAGE (needed for INSERTs into identity/serial columns)
GRANT USAGE ON SEQUENCE bgs_attendance.attendance_logs_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.bus_routes_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.buses_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.companion_group_members_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.companion_groups_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.passenger_assignments_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.shift_exchange_groups_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.shift_exchanges_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.trip_leader_notes_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bgs_attendance.trip_leaders_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE mobile.conversations_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE mobile.messages_id_seq TO authenticated;

-- 2. Storage policies for avatars / chat-media (added on Cloud via dashboard,
--    never captured in a migration until now)
DO $$ BEGIN
  CREATE POLICY avatars_select ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY avatars_insert ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY chat_media_select ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'chat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY chat_media_insert ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Realtime publication membership (chat + live bus assignment updates)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bgs_attendance.passenger_assignments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mobile.conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mobile.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Tighten public tables to match Cloud (anon has no access to either;
--    authenticated keeps only SELECT on food_report_daily_snapshot)
REVOKE ALL ON public.food_report_daily_snapshot FROM anon;
REVOKE ALL ON public.food_report_daily_snapshot FROM authenticated;
GRANT SELECT ON public.food_report_daily_snapshot TO authenticated;
REVOKE ALL ON public.user_autobus_request FROM anon;
REVOKE ALL ON public.user_autobus_request FROM authenticated;
