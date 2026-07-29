-- Problem: bgs_attendance.handle_h_user_autobus_address_sync() writes
-- passenger_assignments.bus_id straight from the legacy system's
-- h_user_autobus_address.autobus_id ("external wins", see
-- 20260707151000_h_user_autobus_address_sync_bus_id_resolution.sql) with no
-- capacity check at all — unlike auto_distribute_pool/check_bus_capacity,
-- which only ever govern passengers still sitting in the pool (bus_id NULL).
-- So once the legacy system has already dispatched e.g. 47 people onto one
-- physical bus, bgs.mn has no way to reflect that the bus can actually hold
-- 47 — buses.capacity stays wherever h_autobus.number_person (or the 45
-- fallback) left it, understating the bus's real seat count.
--
-- Fix (per user decision 2026-07-29): buses.capacity should never be less
-- than the number of people actually assigned to it. Whenever an assignment
-- lands on a bus and pushes the headcount above the current capacity, grow
-- capacity to match. Never shrink it back down. Below the current capacity
-- (<=45 in the common case), capacity is left exactly as synced from
-- h_autobus.number_person — this trigger only ever raises it.
--
-- Implemented as a generic AFTER trigger on passenger_assignments (not
-- folded into handle_h_user_autobus_address_sync) so it applies uniformly
-- regardless of how the assignment was made — legacy sync, bulk assign,
-- QR scan register/transfer — all of which can already push a bus over
-- capacity per the 20260725031244_soft_bus_capacity_limit.sql "soft cap"
-- change.

CREATE OR REPLACE FUNCTION bgs_attendance.grow_bus_capacity_to_assigned_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_count int;
BEGIN
  IF NEW.bus_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM bgs_attendance.passenger_assignments
  WHERE bus_id = NEW.bus_id;

  UPDATE bgs_attendance.buses
  SET capacity = v_count, updated_at = now()
  WHERE id = NEW.bus_id AND capacity < v_count;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_grow_bus_capacity_to_assigned_count ON bgs_attendance.passenger_assignments;
CREATE TRIGGER trg_grow_bus_capacity_to_assigned_count
AFTER INSERT OR UPDATE OF bus_id ON bgs_attendance.passenger_assignments
FOR EACH ROW EXECUTE FUNCTION bgs_attendance.grow_bus_capacity_to_assigned_count();
