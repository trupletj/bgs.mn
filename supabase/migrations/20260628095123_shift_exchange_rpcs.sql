-- 1.2 — helper + RPCs
-- NOTE: bulk_assign_passengers below is the initial (TEMP TABLE) version;
-- it is superseded by the CTE version in 20260628095321_bulk_assign_passengers_cte.sql.

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;

CREATE OR REPLACE FUNCTION bgs_attendance.check_bus_capacity(p_bus_id bigint)
RETURNS TABLE (current_count int, capacity int, is_full boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
  SELECT
    COUNT(pa.id)::int AS current_count,
    b.capacity,
    COUNT(pa.id) >= b.capacity AS is_full
  FROM bgs_attendance.buses b
  LEFT JOIN bgs_attendance.passenger_assignments pa ON pa.bus_id = b.id
  WHERE b.id = p_bus_id
  GROUP BY b.capacity;
$$;
GRANT EXECUTE ON FUNCTION bgs_attendance.check_bus_capacity(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION bgs_attendance.bulk_assign_passengers(
  p_bus_id              bigint,
  p_eelj_group_bteg_id  text,
  p_direction_ids       uuid[]  DEFAULT NULL,
  p_order_by_alba       boolean DEFAULT true
)
RETURNS TABLE (inserted int, skipped_capacity int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_shift_exchange_id bigint;
  v_capacity int;
  v_current  int;
  v_remaining int;
  v_dir_bteg  text[];
  v_candidates int;
  v_to_insert  int;
BEGIN
  SELECT shift_exchange_id, capacity INTO v_shift_exchange_id, v_capacity
  FROM bgs_attendance.buses WHERE id = p_bus_id;
  IF v_shift_exchange_id IS NULL THEN
    RAISE EXCEPTION 'Bus not found: %', p_bus_id;
  END IF;

  SELECT count(*) INTO v_current
  FROM bgs_attendance.passenger_assignments WHERE bus_id = p_bus_id;
  v_remaining := GREATEST(v_capacity - v_current, 0);

  SELECT array_agg(d.bteg_id) INTO v_dir_bteg
  FROM public.autobus_direction d
  WHERE d.id = ANY (
    COALESCE(
      NULLIF(p_direction_ids, '{}'::uuid[]),
      (SELECT array_agg(direction_id) FROM bgs_attendance.bus_routes WHERE bus_id = p_bus_id)
    )
  );

  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  SELECT u.id AS user_id,
         row_number() OVER (
           ORDER BY
             CASE WHEN p_order_by_alba THEN a.name END NULLS LAST,
             h.name NULLS LAST,
             u.last_name, u.first_name
         ) AS rn
  FROM public.users u
  LEFT JOIN public.alba   a ON a.bteg_id = u.department_id
  LEFT JOIN public.heltes h ON h.bteg_id = u.heltes_id
  WHERE u.is_active
    AND u.sf_guard_group_id = p_eelj_group_bteg_id
    AND (v_dir_bteg IS NULL OR u.autobus_direction_id = ANY (v_dir_bteg))
    AND NOT EXISTS (
      SELECT 1 FROM bgs_attendance.passenger_assignments pa
      WHERE pa.shift_exchange_id = v_shift_exchange_id
        AND pa.internal_user_id = u.id
    );

  SELECT count(*) INTO v_candidates FROM _cand;
  v_to_insert := LEAST(v_candidates, v_remaining);

  INSERT INTO bgs_attendance.passenger_assignments
    (shift_exchange_id, bus_id, internal_user_id)
  SELECT v_shift_exchange_id, p_bus_id, c.user_id
  FROM _cand c WHERE c.rn <= v_to_insert;

  inserted := v_to_insert;
  skipped_capacity := v_candidates - v_to_insert;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION bgs_attendance.bulk_assign_passengers(bigint, text, uuid[], boolean) TO authenticated;

CREATE OR REPLACE FUNCTION bgs_attendance.transfer_passenger(
  p_assignment_id  bigint,
  p_target_bus_id  bigint
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_cap int; v_cur int; v_src_shift bigint; v_tgt_shift bigint;
BEGIN
  SELECT pa.shift_exchange_id INTO v_src_shift
  FROM bgs_attendance.passenger_assignments pa WHERE pa.id = p_assignment_id;
  IF v_src_shift IS NULL THEN RAISE EXCEPTION 'Assignment not found'; END IF;

  SELECT shift_exchange_id, capacity INTO v_tgt_shift, v_cap
  FROM bgs_attendance.buses WHERE id = p_target_bus_id;
  IF v_tgt_shift IS NULL THEN RAISE EXCEPTION 'Target bus not found'; END IF;
  IF v_tgt_shift <> v_src_shift THEN
    RAISE EXCEPTION 'Target bus belongs to a different shift exchange';
  END IF;

  SELECT count(*) INTO v_cur
  FROM bgs_attendance.passenger_assignments WHERE bus_id = p_target_bus_id;
  IF v_cur >= v_cap THEN
    RAISE EXCEPTION 'Target bus is full (%/%)', v_cur, v_cap;
  END IF;

  UPDATE bgs_attendance.passenger_assignments
  SET bus_id = p_target_bus_id WHERE id = p_assignment_id;
END;
$$;
GRANT EXECUTE ON FUNCTION bgs_attendance.transfer_passenger(bigint, bigint) TO authenticated;
