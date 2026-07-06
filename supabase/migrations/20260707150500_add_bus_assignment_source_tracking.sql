-- Tracks whether passenger_assignments.bus_id was last set by the external
-- legacy sync (target.h_user_autobus_address) or by an internal HR action
-- (any of the 11 existing shift-exchange RPCs). A generic trigger is used
-- instead of editing all 11 call sites: the sync function sets a
-- transaction-local GUC before writing bus_id, and this trigger reads it.
ALTER TABLE bgs_attendance.passenger_assignments
  ADD COLUMN bus_assigned_externally boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION bgs_attendance.track_bus_assignment_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.bus_id IS NOT DISTINCT FROM OLD.bus_id THEN
    RETURN NEW;
  END IF;

  IF NEW.bus_id IS NOT NULL
     AND coalesce(current_setting('bgs_attendance.sync_write', true), 'false') = 'true' THEN
    NEW.bus_assigned_externally := true;
  ELSE
    NEW.bus_assigned_externally := false;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_track_bus_assignment_source
BEFORE INSERT OR UPDATE OF bus_id ON bgs_attendance.passenger_assignments
FOR EACH ROW EXECUTE FUNCTION bgs_attendance.track_bus_assignment_source();
