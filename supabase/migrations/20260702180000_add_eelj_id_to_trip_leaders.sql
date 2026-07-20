-- trip_leaders хэсэгт bus_id-тай холбогдож буй shift_exchanges.eelj_id-г
-- хадгална (mobile апп legacy eelj_id-аар query хийдэг тул шууд агуулж байх нь дээр).

ALTER TABLE bgs_attendance.trip_leaders
  ADD COLUMN IF NOT EXISTS eelj_id bigint;

CREATE INDEX IF NOT EXISTS idx_trip_leaders_eelj ON bgs_attendance.trip_leaders(eelj_id);

-- sync_bus_trip_leader() trigger-д eelj_id бичих алхам нэмнэ.
CREATE OR REPLACE FUNCTION bgs_attendance.sync_bus_trip_leader()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
BEGIN
  DELETE FROM bgs_attendance.trip_leaders WHERE bus_id = NEW.id;
  IF NEW.trip_leader_id IS NOT NULL THEN
    INSERT INTO bgs_attendance.trip_leaders (bteg_id, bus_id, name, phone, is_active, eelj_id)
    SELECT u.bteg_id, NEW.id,
           NULLIF(trim(coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')), ''),
           u.phone, true, se.eelj_id
    FROM public.users u
    LEFT JOIN bgs_attendance.shift_exchanges se ON se.id = NEW.shift_exchange_id
    WHERE u.id = NEW.trip_leader_id
    ON CONFLICT (bteg_id, bus_id) DO UPDATE
      SET is_active = true, name = EXCLUDED.name, phone = EXCLUDED.phone,
          eelj_id = EXCLUDED.eelj_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Одоо байгаа мөрүүдийг backfill хийнэ.
UPDATE bgs_attendance.trip_leaders tl
SET eelj_id = se.eelj_id
FROM bgs_attendance.buses b
JOIN bgs_attendance.shift_exchanges se ON se.id = b.shift_exchange_id
WHERE b.id = tl.bus_id
  AND tl.eelj_id IS DISTINCT FROM se.eelj_id;
