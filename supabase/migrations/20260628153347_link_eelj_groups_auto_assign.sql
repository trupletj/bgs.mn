-- Link eelj_group(s) to a shift exchange; on link, auto-distribute the group's
-- workers across the exchange's buses by direction (autobus_direction_id ↔
-- bus_routes), balanced (least-loaded bus first). Leftovers (no matching bus /
-- no direction / full) go to the pool (bus_id NULL).

CREATE TABLE bgs_attendance.shift_exchange_groups (
  id                bigserial PRIMARY KEY,
  shift_exchange_id bigint NOT NULL
    REFERENCES bgs_attendance.shift_exchanges(id) ON DELETE CASCADE,
  group_bteg_id     text NOT NULL
    REFERENCES public.eelj_groups(bteg_id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (shift_exchange_id, group_bteg_id)
);
CREATE INDEX idx_seg_exchange ON bgs_attendance.shift_exchange_groups(shift_exchange_id);

GRANT ALL ON bgs_attendance.shift_exchange_groups TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE bgs_attendance.shift_exchange_groups_id_seq TO authenticated;

ALTER TABLE bgs_attendance.shift_exchange_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY seg_admin_all ON bgs_attendance.shift_exchange_groups
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY seg_view_select ON bgs_attendance.shift_exchange_groups
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));

CREATE OR REPLACE FUNCTION bgs_attendance.auto_assign_group(
  p_exchange_id   bigint,
  p_group_bteg_id text
)
RETURNS TABLE (assigned int, pooled int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_assigned int := 0;
  v_pooled   int := 0;
  w RECORD;
  v_bus_id bigint;
BEGIN
  IF NOT public.has_permission(auth.uid(),'shift_exchange','admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR w IN
    SELECT u.id AS user_id, u.autobus_direction_id AS dir
    FROM public.users u
    LEFT JOIN public.alba   a ON a.bteg_id = u.department_id
    LEFT JOIN public.heltes h ON h.bteg_id = u.heltes_id
    WHERE u.is_active
      AND u.sf_guard_group_id = p_group_bteg_id
      AND NOT EXISTS (
        SELECT 1 FROM bgs_attendance.passenger_assignments pa
        WHERE pa.shift_exchange_id = p_exchange_id AND pa.internal_user_id = u.id
      )
    ORDER BY a.name NULLS LAST, h.name NULLS LAST, u.last_name, u.first_name
  LOOP
    SELECT b.id INTO v_bus_id
    FROM bgs_attendance.buses b
    JOIN bgs_attendance.bus_routes br ON br.bus_id = b.id
    JOIN public.autobus_direction d ON d.id = br.direction_id
    WHERE b.shift_exchange_id = p_exchange_id
      AND b.is_active
      AND w.dir IS NOT NULL
      AND d.bteg_id = w.dir
      AND (SELECT count(*) FROM bgs_attendance.passenger_assignments pa
           WHERE pa.bus_id = b.id) < b.capacity
    ORDER BY (SELECT count(*) FROM bgs_attendance.passenger_assignments pa
              WHERE pa.bus_id = b.id) ASC, b.id ASC
    LIMIT 1;

    IF v_bus_id IS NOT NULL THEN
      INSERT INTO bgs_attendance.passenger_assignments
        (shift_exchange_id, bus_id, internal_user_id)
      VALUES (p_exchange_id, v_bus_id, w.user_id);
      v_assigned := v_assigned + 1;
    ELSE
      INSERT INTO bgs_attendance.passenger_assignments
        (shift_exchange_id, bus_id, internal_user_id)
      VALUES (p_exchange_id, NULL, w.user_id);
      v_pooled := v_pooled + 1;
    END IF;
  END LOOP;

  assigned := v_assigned;
  pooled := v_pooled;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.auto_assign_group(bigint, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.auto_assign_group(bigint, text) TO authenticated;
