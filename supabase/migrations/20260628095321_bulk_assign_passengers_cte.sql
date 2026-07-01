-- Rewrite bulk_assign_passengers without a TEMP TABLE (safe for multiple
-- calls in one transaction; single CTE INSERT).
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

  WITH cand AS (
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
      )
  ),
  ins AS (
    INSERT INTO bgs_attendance.passenger_assignments
      (shift_exchange_id, bus_id, internal_user_id)
    SELECT v_shift_exchange_id, p_bus_id, user_id
    FROM cand WHERE rn <= v_remaining
    RETURNING 1
  )
  SELECT (SELECT count(*)::int FROM ins),
         (SELECT count(*)::int FROM cand WHERE rn > v_remaining)
  INTO inserted, skipped_capacity;

  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION bgs_attendance.bulk_assign_passengers(bigint, text, uuid[], boolean) TO authenticated;
