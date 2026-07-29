-- Fix: bgs_attendance.track_trip_leader_assignment_source() (BEFORE INSERT OR
-- UPDATE OF trip_leader_id ON bgs_attendance.buses) is supposed to record
-- *who* wrote trip_leader_id — sync (external, from handle_h_autobus_sync)
-- vs. an HR action in the app (manual) — so handle_h_autobus_sync's "external
-- wins, but never clobber a manual HR pick" guard on the ON CONFLICT UPDATE
-- (trip_leader_assigned_externally IS NOT FALSE -> take the new synced value)
-- works correctly.
--
-- Bug: the flag was set from `NEW.trip_leader_id IS NOT NULL AND sync_write`,
-- not from `sync_write` alone. So whenever handle_h_autobus_sync's very first
-- INSERT for an h_autobus row couldn't yet resolve a trip leader (v_trip_leader_id
-- NULL — e.g. the legacy user_id hadn't been linked into public.users yet),
-- the resulting NULL got mislabeled trip_leader_assigned_externally = false,
-- i.e. "manually protected", even though no human ever touched it. Every
-- later sync for that h_autobus row then hit the ON CONFLICT guard's ELSE
-- branch and silently kept the stale NULL forever, because
-- `NEW.trip_leader_id IS NOT DISTINCT FROM OLD.trip_leader_id` (both NULL)
-- also short-circuits this trigger before the flag could ever be corrected.
--
-- Confirmed 2026-07-29 against shift_exchanges.id=3249 (eelj_id=2014): 10 of
-- 11 buses had trip_leader_assigned_externally=false with trip_leader_id
-- stuck NULL despite the correct legacy user resolving fine in public.users
-- by the time of later syncs; those 10 rows were manually backfilled.
--
-- Fix: the flag should reflect the writer (sync vs. app), not the value
-- written. Drop the `NEW.trip_leader_id IS NOT NULL` condition so any write
-- made while bgs_attendance.sync_write='true' (i.e. by handle_h_autobus_sync,
-- INSERT or UPDATE, NULL or not) is always marked externally=true, letting
-- future syncs keep recomputing it. Only a write made outside that context
-- (the bgs.mn app / HR) is marked externally=false and protected from sync.

CREATE OR REPLACE FUNCTION bgs_attendance.track_trip_leader_assignment_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.trip_leader_id IS NOT DISTINCT FROM OLD.trip_leader_id THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('bgs_attendance.sync_write', true), 'false') = 'true' THEN
    NEW.trip_leader_assigned_externally := true;
  ELSE
    NEW.trip_leader_assigned_externally := false;
  END IF;

  RETURN NEW;
END;
$function$;
