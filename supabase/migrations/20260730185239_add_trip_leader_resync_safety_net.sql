-- Safety net for the trip-leader "stuck flag" bug class (see
-- 20260729140000_fix_trip_leader_sync_flag_null_bug.sql for the root-cause
-- fix). That fix only protects *future* syncs; any manual UPDATE of
-- bgs_attendance.buses.trip_leader_id done outside a
-- bgs_attendance.sync_write='true' context (e.g. an ad-hoc SQL backfill)
-- still gets trip_leader_assigned_externally flagged false by
-- track_trip_leader_assignment_source(), permanently freezing that bus from
-- future external sync. This happened twice already: the 2026-07-29 manual
-- backfill of 10 buses on shift_exchanges.id=3249, and would have happened
-- again on 2026-07-30 for shift_exchanges.id=3250 had it not been caught.
--
-- This RPC is the supported way to fix a stuck/stale trip leader instead of
-- a raw UPDATE: it sets sync_write itself, so trip_leader_assigned_externally
-- always ends up correctly true afterward and the bus resumes normal syncing.

CREATE OR REPLACE FUNCTION bgs_attendance.resync_stuck_trip_leaders()
RETURNS TABLE(bus_id bigint, shift_exchange_id bigint, old_trip_leader_id uuid, new_trip_leader_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM set_config('bgs_attendance.sync_write', 'true', true);

  CREATE TEMP TABLE _resync_targets ON COMMIT DROP AS
  SELECT b.id AS bus_id, b.shift_exchange_id AS se_id, b.trip_leader_id AS old_id, u.id AS new_id
  FROM bgs_attendance.buses b
  JOIN target.h_autobus ha ON ha.id = b.h_autobus_id
  JOIN public.users u ON u.bteg_id = ha.user_id::text
  WHERE b.is_active = true
    AND b.trip_leader_assigned_externally = false
    AND u.id IS DISTINCT FROM b.trip_leader_id;

  -- Null out first so a same-exchange swap (A's new leader is currently B's
  -- leader, and vice versa) never trips uq_bus_leader_per_exchange mid-batch.
  UPDATE bgs_attendance.buses b
  SET trip_leader_id = NULL
  FROM _resync_targets t
  WHERE b.id = t.bus_id;

  UPDATE bgs_attendance.buses b
  SET trip_leader_id = t.new_id,
      trip_leader_assigned_externally = true
  FROM _resync_targets t
  WHERE b.id = t.bus_id;

  RETURN QUERY SELECT t.bus_id, t.se_id, t.old_id, t.new_id FROM _resync_targets t;
END;
$$;

ALTER FUNCTION bgs_attendance.resync_stuck_trip_leaders() OWNER TO postgres;

-- SECURITY DEFINER functions get an implicit EXECUTE grant to PUBLIC on
-- creation, which under PostgREST means anon/authenticated could call this
-- over /rest/v1/rpc/... — explicitly close that before opening it to
-- service_role only (caught by the Supabase security linter).
REVOKE ALL ON FUNCTION bgs_attendance.resync_stuck_trip_leaders() FROM PUBLIC;
REVOKE ALL ON FUNCTION bgs_attendance.resync_stuck_trip_leaders() FROM anon;
REVOKE ALL ON FUNCTION bgs_attendance.resync_stuck_trip_leaders() FROM authenticated;
GRANT EXECUTE ON FUNCTION bgs_attendance.resync_stuck_trip_leaders() TO service_role;

COMMENT ON FUNCTION bgs_attendance.resync_stuck_trip_leaders() IS
  'Maintenance RPC: re-resolves trip_leader_id from target.h_autobus for any bus stuck with trip_leader_assigned_externally=false and a stale/wrong value, correctly marking it externally=true afterward. Use this instead of a raw UPDATE when fixing stuck trip leaders by hand.';
