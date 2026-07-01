-- Denormalize bteg_id onto passenger_assignments so the QR scanner (mini-service)
-- can match a scanned passenger by bteg_id (QR payload: {id_card_number, bteg_id, key})
-- without joining public.users. Auto-filled from the user via the existing
-- BEFORE INSERT trigger; backfilled for existing rows.

ALTER TABLE bgs_attendance.passenger_assignments
  ADD COLUMN IF NOT EXISTS bteg_id text;

UPDATE bgs_attendance.passenger_assignments pa
SET bteg_id = u.bteg_id
FROM public.users u
WHERE pa.internal_user_id = u.id AND pa.bteg_id IS NULL;

ALTER TABLE bgs_attendance.passenger_assignments
  ALTER COLUMN bteg_id SET NOT NULL;

ALTER TABLE bgs_attendance.passenger_assignments
  ADD CONSTRAINT passenger_assignments_bteg_id_fkey
  FOREIGN KEY (bteg_id) REFERENCES public.users(bteg_id)
  ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pa_bus_bteg
  ON bgs_attendance.passenger_assignments(bus_id, bteg_id);

-- Extend the BEFORE INSERT trigger to also snapshot bteg_id from the user
CREATE OR REPLACE FUNCTION bgs_attendance.set_assignment_direction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_user_id IS NOT NULL THEN
    SELECT u.bteg_id,
           COALESCE(NEW.autobus_direction_id, u.autobus_direction_id)
      INTO NEW.bteg_id, NEW.autobus_direction_id
    FROM public.users u
    WHERE u.id = NEW.internal_user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Rewrite confirm_passenger: match by bteg_id (from QR) on a given bus, use
-- public.current_user_id() (NOT auth.uid()) for confirmed_by / scanned_by, and
-- only allow the bus's trip leader (or an admin) to confirm.
DROP FUNCTION IF EXISTS bgs_attendance.confirm_passenger(bigint);

CREATE OR REPLACE FUNCTION bgs_attendance.confirm_passenger(
  p_bteg_id     bigint,
  p_bus_id      bigint,
  p_device_info text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_uid uuid;
  v_assignment_id bigint;
  v_confirmed boolean;
  v_name text;
BEGIN
  v_uid := public.current_user_id();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status','error','message','Нэвтрээгүй хэрэглэгч');
  END IF;

  IF NOT (
    public.has_permission(auth.uid(),'shift_exchange','admin')
    OR EXISTS (
      SELECT 1 FROM bgs_attendance.trip_leaders tl
      WHERE tl.bus_id = p_bus_id AND tl.is_active
        AND tl.bteg_id = public.current_bteg_id()::text
    )
  ) THEN
    RETURN jsonb_build_object('status','forbidden','message','Та энэ автобусны ахлах биш');
  END IF;

  SELECT pa.id, pa.is_confirmed,
         NULLIF(trim(coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')), '')
    INTO v_assignment_id, v_confirmed, v_name
  FROM bgs_attendance.passenger_assignments pa
  JOIN public.users u ON u.id = pa.internal_user_id
  WHERE pa.bus_id = p_bus_id AND pa.bteg_id = p_bteg_id::text
  LIMIT 1;

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object('status','not_found','message','Энэ автобусанд бүртгэлгүй');
  END IF;

  IF v_confirmed THEN
    RETURN jsonb_build_object(
      'status','already', 'passenger_name', v_name, 'assignment_id', v_assignment_id);
  END IF;

  UPDATE bgs_attendance.passenger_assignments
  SET is_confirmed = true, confirmed_at = now(), confirmed_by = v_uid
  WHERE id = v_assignment_id;

  INSERT INTO bgs_attendance.attendance_logs
    (passenger_assignment_id, scanned_by, scanned_at, device_info)
  VALUES (v_assignment_id, v_uid, now(), p_device_info);

  RETURN jsonb_build_object(
    'status','confirmed', 'passenger_name', v_name, 'assignment_id', v_assignment_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.confirm_passenger(bigint, bigint, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.confirm_passenger(bigint, bigint, text) TO authenticated;
