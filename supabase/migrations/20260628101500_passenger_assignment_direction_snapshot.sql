-- Snapshot the passenger's autobus_direction onto the assignment row at
-- assignment time (so reports stay stable even if users.autobus_direction_id
-- later changes via target sync). Auto-filled for internal users via trigger.

ALTER TABLE bgs_attendance.passenger_assignments
  ADD COLUMN IF NOT EXISTS autobus_direction_id text
  REFERENCES public.autobus_direction(bteg_id)
  ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pa_direction
  ON bgs_attendance.passenger_assignments(autobus_direction_id);

CREATE OR REPLACE FUNCTION bgs_attendance.set_assignment_direction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_user_id IS NOT NULL AND NEW.autobus_direction_id IS NULL THEN
    SELECT u.autobus_direction_id INTO NEW.autobus_direction_id
    FROM public.users u WHERE u.id = NEW.internal_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pa_set_direction ON bgs_attendance.passenger_assignments;
CREATE TRIGGER trg_pa_set_direction
  BEFORE INSERT ON bgs_attendance.passenger_assignments
  FOR EACH ROW EXECUTE FUNCTION bgs_attendance.set_assignment_direction();

UPDATE bgs_attendance.passenger_assignments pa
SET autobus_direction_id = u.autobus_direction_id
FROM public.users u
WHERE pa.internal_user_id = u.id
  AND pa.autobus_direction_id IS NULL
  AND u.autobus_direction_id IS NOT NULL;
