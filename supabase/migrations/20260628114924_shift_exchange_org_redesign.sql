-- External companies/operators/passengers are redundant: public.organization
-- already holds all companies (incl. contractors) and public.users holds their
-- employees (organization_id). Passenger = a users row. A company rep (with
-- shift_exchange/submit, scoped to their organization_id) submits own-org people
-- into a POOL (bus_id NULL); HR assigns them to buses.

-- 1. passenger_assignments: drop external, allow pool, audit submitter
ALTER TABLE bgs_attendance.passenger_assignments
  DROP CONSTRAINT IF EXISTS chk_one_passenger,
  DROP CONSTRAINT IF EXISTS uq_external_per_exchange,
  DROP COLUMN IF EXISTS external_passenger_id;

ALTER TABLE bgs_attendance.passenger_assignments
  ALTER COLUMN bus_id DROP NOT NULL,
  ALTER COLUMN internal_user_id SET NOT NULL,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.users(id);

-- 2. Drop the redundant external_* tables (all empty)
DROP TABLE IF EXISTS bgs_attendance.external_passengers CASCADE;
DROP TABLE IF EXISTS bgs_attendance.external_operators CASCADE;
DROP TABLE IF EXISTS bgs_attendance.external_companies CASCADE;

-- 3. Permission seed: shift_exchange/submit
INSERT INTO public.permissions (id, description, module, action)
SELECT (SELECT COALESCE(max(id),0) FROM public.permissions) + 1,
       'Ээлж солилцоо — өөрийн байгууллагын зорчигч оруулах', 'shift_exchange', 'submit'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE module='shift_exchange' AND action='submit');

-- 4. Helper: current user's organization_id (bteg-based, reliable)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = public.current_user_id();
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;

-- 5. Submit RLS (org-scoped)
CREATE POLICY pa_submit_select ON bgs_attendance.passenger_assignments
  FOR SELECT USING (
    public.has_permission(auth.uid(),'shift_exchange','submit')
    AND EXISTS (SELECT 1 FROM public.users tu
                WHERE tu.id = internal_user_id
                  AND tu.organization_id = public.current_user_org_id())
  );
CREATE POLICY pa_submit_insert ON bgs_attendance.passenger_assignments
  FOR INSERT WITH CHECK (
    public.has_permission(auth.uid(),'shift_exchange','submit')
    AND bus_id IS NULL
    AND EXISTS (SELECT 1 FROM public.users tu
                WHERE tu.id = internal_user_id
                  AND tu.organization_id = public.current_user_org_id())
  );
CREATE POLICY pa_submit_delete ON bgs_attendance.passenger_assignments
  FOR DELETE USING (
    public.has_permission(auth.uid(),'shift_exchange','submit')
    AND bus_id IS NULL AND NOT is_confirmed
    AND EXISTS (SELECT 1 FROM public.users tu
                WHERE tu.id = internal_user_id
                  AND tu.organization_id = public.current_user_org_id())
  );
CREATE POLICY se_submit_select ON bgs_attendance.shift_exchanges
  FOR SELECT USING (
    public.has_permission(auth.uid(),'shift_exchange','submit') AND status = 'published'
  );

-- 6a. Rep: submit own-org users into the pool
CREATE OR REPLACE FUNCTION bgs_attendance.submit_passengers_to_pool(
  p_shift_exchange_id bigint,
  p_user_ids uuid[]
)
RETURNS TABLE (inserted int, skipped int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE v_org text;
BEGIN
  IF NOT (public.has_permission(auth.uid(),'shift_exchange','submit')
          OR public.has_permission(auth.uid(),'shift_exchange','admin')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  v_org := public.current_user_org_id();
  IF v_org IS NULL THEN RAISE EXCEPTION 'Хэрэглэгчид байгууллага алга'; END IF;

  WITH valid AS (
    SELECT u.id FROM public.users u
    WHERE u.id = ANY (p_user_ids) AND u.organization_id = v_org AND u.is_active
  ),
  ins AS (
    INSERT INTO bgs_attendance.passenger_assignments
      (shift_exchange_id, bus_id, internal_user_id, submitted_by)
    SELECT p_shift_exchange_id, NULL, v.id, public.current_user_id() FROM valid v
    ON CONFLICT (shift_exchange_id, internal_user_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*)::int FROM ins),
         (SELECT count(*)::int FROM unnest(p_user_ids)) - (SELECT count(*)::int FROM ins)
  INTO inserted, skipped;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.submit_passengers_to_pool(bigint, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.submit_passengers_to_pool(bigint, uuid[]) TO authenticated;

-- 6b. HR: bulk assign an organization to a bus (pool first, then insert)
CREATE OR REPLACE FUNCTION bgs_attendance.bulk_assign_by_org(
  p_bus_id bigint,
  p_org_bteg_id text,
  p_order_by_alba boolean DEFAULT true
)
RETURNS TABLE (assigned int, skipped_capacity int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_sx bigint; v_cap int; v_cur int; v_remaining int;
  v_pooled_total int; v_notinx_total int;
  v_moved int := 0; v_inserted int := 0; v_rem2 int;
BEGIN
  IF NOT public.has_permission(auth.uid(),'shift_exchange','admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT shift_exchange_id, capacity INTO v_sx, v_cap
  FROM bgs_attendance.buses WHERE id = p_bus_id;
  IF v_sx IS NULL THEN RAISE EXCEPTION 'Bus not found: %', p_bus_id; END IF;

  SELECT count(*) INTO v_cur
  FROM bgs_attendance.passenger_assignments WHERE bus_id = p_bus_id;
  v_remaining := GREATEST(v_cap - v_cur, 0);

  SELECT count(*) INTO v_pooled_total
  FROM bgs_attendance.passenger_assignments pa
  JOIN public.users u ON u.id = pa.internal_user_id
  WHERE pa.shift_exchange_id = v_sx AND pa.bus_id IS NULL AND u.organization_id = p_org_bteg_id;

  SELECT count(*) INTO v_notinx_total
  FROM public.users u
  WHERE u.is_active AND u.organization_id = p_org_bteg_id
    AND NOT EXISTS (SELECT 1 FROM bgs_attendance.passenger_assignments pa
                    WHERE pa.shift_exchange_id = v_sx AND pa.internal_user_id = u.id);

  WITH pool AS (
    SELECT pa.id,
      row_number() OVER (ORDER BY
        CASE WHEN p_order_by_alba THEN a.name END NULLS LAST,
        h.name NULLS LAST, u.last_name, u.first_name) AS rn
    FROM bgs_attendance.passenger_assignments pa
    JOIN public.users u ON u.id = pa.internal_user_id
    LEFT JOIN public.alba a ON a.bteg_id = u.department_id
    LEFT JOIN public.heltes h ON h.bteg_id = u.heltes_id
    WHERE pa.shift_exchange_id = v_sx AND pa.bus_id IS NULL AND u.organization_id = p_org_bteg_id
  ),
  upd AS (
    UPDATE bgs_attendance.passenger_assignments p SET bus_id = p_bus_id
    FROM pool WHERE p.id = pool.id AND pool.rn <= v_remaining
    RETURNING 1
  )
  SELECT count(*)::int INTO v_moved FROM upd;

  v_rem2 := v_remaining - v_moved;

  IF v_rem2 > 0 THEN
    WITH cand AS (
      SELECT u.id,
        row_number() OVER (ORDER BY
          CASE WHEN p_order_by_alba THEN a.name END NULLS LAST,
          h.name NULLS LAST, u.last_name, u.first_name) AS rn
      FROM public.users u
      LEFT JOIN public.alba a ON a.bteg_id = u.department_id
      LEFT JOIN public.heltes h ON h.bteg_id = u.heltes_id
      WHERE u.is_active AND u.organization_id = p_org_bteg_id
        AND NOT EXISTS (SELECT 1 FROM bgs_attendance.passenger_assignments pa
                        WHERE pa.shift_exchange_id = v_sx AND pa.internal_user_id = u.id)
    ),
    ins AS (
      INSERT INTO bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
      SELECT v_sx, p_bus_id, id FROM cand WHERE rn <= v_rem2
      RETURNING 1
    )
    SELECT count(*)::int INTO v_inserted FROM ins;
  END IF;

  assigned := v_moved + v_inserted;
  skipped_capacity := (v_pooled_total - v_moved) + (v_notinx_total - v_inserted);
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.bulk_assign_by_org(bigint, text, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.bulk_assign_by_org(bigint, text, boolean) TO authenticated;

-- 6c. HR: send an assignment back to the pool
CREATE OR REPLACE FUNCTION bgs_attendance.unassign_to_pool(p_assignment_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(),'shift_exchange','admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  UPDATE bgs_attendance.passenger_assignments SET bus_id = NULL WHERE id = p_assignment_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.unassign_to_pool(bigint) FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.unassign_to_pool(bigint) TO authenticated;
