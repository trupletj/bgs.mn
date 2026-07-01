-- Trip-leader registry keyed by bteg_id (+ the bus they lead), auto-synced from
-- buses.trip_leader_id. Lets the mobile app check "am I a trip leader" instantly
-- via bteg_id (the reliable identity; users.auth_user_id is mostly NULL).

CREATE TABLE bgs_attendance.trip_leaders (
  id         bigserial PRIMARY KEY,
  bteg_id    text NOT NULL
             REFERENCES public.users(bteg_id) ON UPDATE CASCADE ON DELETE CASCADE,
  bus_id     bigint NOT NULL
             REFERENCES bgs_attendance.buses(id) ON DELETE CASCADE,
  name       text,
  phone      text,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (bteg_id, bus_id)
);
CREATE INDEX idx_trip_leaders_bteg ON bgs_attendance.trip_leaders(bteg_id);
CREATE INDEX idx_trip_leaders_bus  ON bgs_attendance.trip_leaders(bus_id);

GRANT ALL ON bgs_attendance.trip_leaders TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE bgs_attendance.trip_leaders_id_seq TO authenticated;

ALTER TABLE bgs_attendance.trip_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tl_admin_all ON bgs_attendance.trip_leaders
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY tl_view_select ON bgs_attendance.trip_leaders
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));
CREATE POLICY tl_self_select ON bgs_attendance.trip_leaders
  FOR SELECT USING (bteg_id = public.current_bteg_id()::text);

-- Identity fix: resolve current_user_id via the reliable bteg_id chain
-- (public.users.auth_user_id is populated for only ~1% of users).
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE bteg_id = public.current_bteg_id()::text
  LIMIT 1;
$$;

-- Quick check: am I a trip leader? (mobile calls this)
CREATE OR REPLACE FUNCTION bgs_attendance.am_i_trip_leader()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bgs_attendance.trip_leaders
    WHERE bteg_id = public.current_bteg_id()::text AND is_active
  );
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.am_i_trip_leader() FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.am_i_trip_leader() TO authenticated;

-- Buses I lead (with exchange info + counts)
CREATE OR REPLACE FUNCTION bgs_attendance.get_my_led_buses()
RETURNS TABLE (
  bus_id bigint, bus_name text, direction text, departure_time timestamptz,
  capacity int, shift_exchange_id bigint, exchange_name text,
  exchange_date date, exchange_status text,
  passenger_count int, confirmed_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
  SELECT
    b.id, b.name, b.direction, b.departure_time, b.capacity,
    se.id, se.name, se.exchange_date, se.status,
    (SELECT count(*)::int FROM bgs_attendance.passenger_assignments pa WHERE pa.bus_id = b.id),
    (SELECT count(*)::int FROM bgs_attendance.passenger_assignments pa WHERE pa.bus_id = b.id AND pa.is_confirmed)
  FROM bgs_attendance.trip_leaders tl
  JOIN bgs_attendance.buses b ON b.id = tl.bus_id
  JOIN bgs_attendance.shift_exchanges se ON se.id = b.shift_exchange_id
  WHERE tl.bteg_id = public.current_bteg_id()::text
    AND tl.is_active
    AND se.status <> 'cancelled'
    AND se.exchange_date >= current_date - interval '1 day'
  ORDER BY se.exchange_date ASC, b.id ASC;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.get_my_led_buses() FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.get_my_led_buses() TO authenticated;

-- Auto-sync: buses.trip_leader_id → trip_leaders
CREATE OR REPLACE FUNCTION bgs_attendance.sync_bus_trip_leader()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
BEGIN
  DELETE FROM bgs_attendance.trip_leaders WHERE bus_id = NEW.id;
  IF NEW.trip_leader_id IS NOT NULL THEN
    INSERT INTO bgs_attendance.trip_leaders (bteg_id, bus_id, name, phone, is_active)
    SELECT u.bteg_id, NEW.id,
           NULLIF(trim(coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')), ''),
           u.phone, true
    FROM public.users u
    WHERE u.id = NEW.trip_leader_id
    ON CONFLICT (bteg_id, bus_id) DO UPDATE
      SET is_active = true, name = EXCLUDED.name, phone = EXCLUDED.phone;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bus_trip_leader ON bgs_attendance.buses;
CREATE TRIGGER trg_sync_bus_trip_leader
  AFTER INSERT OR UPDATE OF trip_leader_id ON bgs_attendance.buses
  FOR EACH ROW EXECUTE FUNCTION bgs_attendance.sync_bus_trip_leader();

-- Backfill from existing bus leaders
INSERT INTO bgs_attendance.trip_leaders (bteg_id, bus_id, name, phone, is_active)
SELECT u.bteg_id, b.id,
       NULLIF(trim(coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')), ''),
       u.phone, true
FROM bgs_attendance.buses b
JOIN public.users u ON u.id = b.trip_leader_id
WHERE b.trip_leader_id IS NOT NULL
ON CONFLICT (bteg_id, bus_id) DO NOTHING;
