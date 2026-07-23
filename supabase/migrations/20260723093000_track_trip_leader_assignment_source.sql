-- Fix: bgs_attendance.handle_h_autobus_sync() (fires AFTER INSERT/UPDATE/DELETE
-- on target.h_autobus — i.e. on ANY legacy-system edit to that bus row, not
-- just trip-leader-related ones) always recomputes trip_leader_id from the
-- legacy system's h_autobus.user_id and overwrites bgs_attendance.buses on
-- every sync ("external wins"). This silently reverts any trip leader HR
-- assigned manually in bgs.mn the next time the legacy row is touched for
-- ANY reason (driver info refresh, capacity refresh, ...). It is the same
-- clobber-bug class already found and fixed for passenger_assignments.bus_id
-- on 2026-07-09 (see handle_h_user_autobus_address_sync / bus_assigned_externally
-- in SHIFT_EXCHANGE_KNOWN_ISSUES.md) but was never applied to trip_leader_id.
--
-- Reported symptom (2026-07-23): trip leader info / trip-leader-as-passenger-
-- row missing from the shift-exchange Excel export for some buses.
--
-- ⚠️ Written from the last known migration-file version of
-- handle_h_autobus_sync() (20260707150000_fix_h_autobus_sync_capacity_bug.sql).
-- handle_h_user_autobus_address_sync() is KNOWN to have an undocumented
-- 2026-07-09 hotfix applied directly via the Supabase SQL editor (never
-- captured in a migration) — verify the LIVE body of handle_h_autobus_sync()
-- matches this file's starting point before applying, so this migration
-- doesn't silently revert some other undocumented hotfix.

ALTER TABLE bgs_attendance.buses
  ADD COLUMN IF NOT EXISTS trip_leader_assigned_externally boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION bgs_attendance.track_trip_leader_assignment_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.trip_leader_id IS NOT DISTINCT FROM OLD.trip_leader_id THEN
    RETURN NEW;
  END IF;

  IF NEW.trip_leader_id IS NOT NULL
     AND coalesce(current_setting('bgs_attendance.sync_write', true), 'false') = 'true' THEN
    NEW.trip_leader_assigned_externally := true;
  ELSE
    NEW.trip_leader_assigned_externally := false;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_track_trip_leader_assignment_source ON bgs_attendance.buses;
CREATE TRIGGER trg_track_trip_leader_assignment_source
BEFORE INSERT OR UPDATE OF trip_leader_id ON bgs_attendance.buses
FOR EACH ROW EXECUTE FUNCTION bgs_attendance.track_trip_leader_assignment_source();

CREATE OR REPLACE FUNCTION bgs_attendance.handle_h_autobus_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
DECLARE
  v_shift_exchange_id bigint;
  v_direction text;
  v_trip_leader_id uuid;
  v_dir_uuid uuid;
  v_bus_id bigint;
BEGIN
  PERFORM set_config('bgs_attendance.sync_write', 'true', true);

  IF TG_OP = 'DELETE' THEN
    UPDATE bgs_attendance.buses SET is_active = false, updated_at = now()
    WHERE h_autobus_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW._sdc_deleted_at IS NOT NULL THEN
    UPDATE bgs_attendance.buses SET is_active = false, updated_at = now()
    WHERE h_autobus_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT se.id, se.direction INTO v_shift_exchange_id, v_direction
  FROM bgs_attendance.shift_exchanges se WHERE se.eelj_id = NEW.eel_soliltsoo_id;
  IF v_shift_exchange_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.id INTO v_trip_leader_id FROM public.users u WHERE u.bteg_id = NEW.user_id::text;

  -- "Steal the seat": only take trip_leader_id away from another bus in the
  -- same exchange if THAT bus's current assignment wasn't itself an HR
  -- override (so an HR-placed leader on a different bus is never clobbered).
  IF v_trip_leader_id IS NOT NULL THEN
    UPDATE bgs_attendance.buses
    SET trip_leader_id = NULL
    WHERE shift_exchange_id = v_shift_exchange_id
      AND trip_leader_id = v_trip_leader_id
      AND h_autobus_id IS DISTINCT FROM NEW.id
      AND trip_leader_assigned_externally IS NOT FALSE;
  END IF;

  INSERT INTO bgs_attendance.buses (
    h_autobus_id, shift_exchange_id, direction, name, capacity,
    departure_time, trip_leader_id, is_active,
    h_autobus_number, h_autobus_driver_name, h_autobus_driver_phone,
    h_autobus_extra_driver_name, h_autobus_extra_driver_phone,
    h_autobus_apart_position, created_at, updated_at
  ) VALUES (
    NEW.id, v_shift_exchange_id, v_direction,
    COALESCE(NEW.full_name, NEW.eelj, 'Автобус #' || NEW.id),
    COALESCE(NEW.number_person, 45)::int,
    CASE WHEN NEW.day_date IS NOT NULL
      THEN (NEW.day_date::date + COALESCE(NEW.start_time, time '00:30')) AT TIME ZONE 'Asia/Ulaanbaatar'
      ELSE NULL END,
    v_trip_leader_id, COALESCE(NEW.is_active, true),
    NEW.number, NEW.driver_name, NEW.driver_phone_number,
    NEW.extra_driver_name, NEW.extra_driver_phone_number, NEW.apart_position,
    now(), now()
  )
  ON CONFLICT (h_autobus_id) WHERE h_autobus_id IS NOT NULL DO UPDATE SET
    shift_exchange_id = EXCLUDED.shift_exchange_id,
    direction          = EXCLUDED.direction,
    name               = EXCLUDED.name,
    capacity           = EXCLUDED.capacity,
    departure_time     = EXCLUDED.departure_time,
    trip_leader_id     = CASE
                            WHEN bgs_attendance.buses.trip_leader_assigned_externally IS NOT FALSE
                            THEN EXCLUDED.trip_leader_id
                            ELSE bgs_attendance.buses.trip_leader_id
                          END,
    is_active          = EXCLUDED.is_active,
    h_autobus_number             = EXCLUDED.h_autobus_number,
    h_autobus_driver_name        = EXCLUDED.h_autobus_driver_name,
    h_autobus_driver_phone       = EXCLUDED.h_autobus_driver_phone,
    h_autobus_extra_driver_name  = EXCLUDED.h_autobus_extra_driver_name,
    h_autobus_extra_driver_phone = EXCLUDED.h_autobus_extra_driver_phone,
    h_autobus_apart_position     = EXCLUDED.h_autobus_apart_position,
    updated_at = now()
  RETURNING id INTO v_bus_id;

  SELECT ad.id INTO v_dir_uuid FROM public.autobus_direction ad
  WHERE ad.h_autobus_direction_id = NEW.direction_id::text;
  IF v_dir_uuid IS NOT NULL THEN
    INSERT INTO bgs_attendance.bus_routes (bus_id, direction_id, stop_order)
    VALUES (v_bus_id, v_dir_uuid, 1)
    ON CONFLICT (bus_id, direction_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
