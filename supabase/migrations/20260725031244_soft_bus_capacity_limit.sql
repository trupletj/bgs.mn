-- Soft bus-capacity limit: 45 хүний хатуу хязгаарлалтыг зөөлрүүлэх.
-- Context: shared-context/SHIFT_EXCHANGE_FLOW.md → "RECOMMENDATION (2026-07-23)".
-- Асуудал: автобус дүүрсэн (capacity-1, ахлахын 1 суудал нөөцлөгдсөн) үед доорх
-- RPC-үүд insert/transfer-ийг бүрэн блоклодог байсан (register_scanned_passenger:
-- status='full', transfer_passenger: RAISE EXCEPTION, bulk_*: rn/remaining шүүлтээр
-- insert хийхгүй орхигдуулдаг). Энэ migration нь блоклохын оронд зөвхөн
-- анхааруулга (warning / skipped_capacity-г "хэтэрсэн тоо" болгож дахин ашиглах)
-- болгоно — insert/transfer үргэлж явагдана.
--
-- passenger_capacity(), check_bus_capacity(), auto_distribute_pool() ӨӨРЧЛӨГДӨӨГҮЙ
-- (санал болгосон шийдлийн дагуу).
--
-- Applied against current definitions in bgs.mn/supabase/migrations:
--   register_scanned_passenger ← 20260707160000_catch_up_missing_schema_objects.sql
--   transfer_passenger, bulk_assign_by_org, bulk_transfer_passengers,
--   passenger_capacity, check_bus_capacity ← 20260629100000_reserve_trip_leader_seat.sql
--   bulk_assign_passengers ← 20260706190000_rename_target_sync_bteg_id_columns.sql

-- ── 1. register_scanned_passenger: блоклохгүй, 'warning' талбар нэмнэ ────────
CREATE OR REPLACE FUNCTION bgs_attendance.register_scanned_passenger(p_bteg_id bigint, p_target_bus_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
    DECLARE
      v_uid uuid;
      v_user record;
      v_target_bus record;
      v_asgn record;
      v_cur_count int;
      v_name text;
      v_new_original bigint;
      v_warning text;
    BEGIN
      v_uid := public.current_user_id();
      IF v_uid IS NULL THEN
        RETURN jsonb_build_object('status','error','message','Нэвтрээгүй хэрэглэгч');
      END IF;

      IF NOT (
        public.has_permission(auth.uid(),'shift_exchange','admin')
        OR EXISTS (
          SELECT 1 FROM bgs_attendance.trip_leaders tl
          WHERE tl.bus_id = p_target_bus_id AND tl.is_active
            AND tl.bteg_id = public.current_bteg_id()::text
        )
      ) THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;

      SELECT id, first_name, last_name INTO v_user
      FROM public.users WHERE bteg_id = p_bteg_id::text;

      IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('status','user_not_found');
      END IF;
      v_name := nullif(trim(concat_ws(' ', v_user.last_name, v_user.first_name)), '');

      SELECT id, shift_exchange_id, capacity INTO v_target_bus
      FROM bgs_attendance.buses WHERE id = p_target_bus_id;

      IF v_target_bus.id IS NULL THEN
        RETURN jsonb_build_object('status','bus_not_found');
      END IF;

      SELECT id, bus_id, original_bus_id INTO v_asgn
      FROM bgs_attendance.passenger_assignments
      WHERE internal_user_id = v_user.id
        AND shift_exchange_id = v_target_bus.shift_exchange_id
      LIMIT 1;

      IF v_asgn.id IS NOT NULL AND v_asgn.bus_id = p_target_bus_id THEN
        RETURN jsonb_build_object('status','already_this_bus', 'passenger_name', v_name);
      END IF;

      SELECT count(*) INTO v_cur_count
      FROM bgs_attendance.passenger_assignments WHERE bus_id = p_target_bus_id;

      -- Хатуу блоклохгүй — зөвхөн шинээр орсны дараах тоо capacity-г давбал warning.
      IF v_cur_count >= bgs_attendance.passenger_capacity(v_target_bus.capacity) THEN
        v_warning := format('Автобус дүүрсэн байна (%s/%s)', v_cur_count + 1, bgs_attendance.passenger_capacity(v_target_bus.capacity));
      END IF;

      IF v_asgn.id IS NULL THEN
        INSERT INTO bgs_attendance.passenger_assignments
          (internal_user_id, bteg_id, bus_id, original_bus_id, shift_exchange_id,
           is_confirmed, confirmed_at, confirmed_by, confirmed_by_bteg_id)
        VALUES
          (v_user.id, p_bteg_id::text, p_target_bus_id, p_target_bus_id, v_target_bus.shift_exchange_id,
           true, now(), v_uid, public.current_bteg_id()::text);
      ELSE
        v_new_original := coalesce(v_asgn.original_bus_id, v_asgn.bus_id);
        IF v_new_original = p_target_bus_id THEN
          v_new_original := NULL;
        END IF;

        UPDATE bgs_attendance.passenger_assignments
        SET original_bus_id = v_new_original,
            bus_id = p_target_bus_id,
            is_confirmed = true,
            confirmed_at = now(),
            confirmed_by = v_uid,
            confirmed_by_bteg_id = public.current_bteg_id()::text
        WHERE id = v_asgn.id;
      END IF;

      IF v_warning IS NOT NULL THEN
        RETURN jsonb_build_object('status','transferred', 'passenger_name', v_name, 'warning', v_warning);
      END IF;
      RETURN jsonb_build_object('status','transferred', 'passenger_name', v_name);
    END;
    $$;

-- ── 2. transfer_passenger: capacity дүүрсэн бол exception шидэхгүй ──────────
CREATE OR REPLACE FUNCTION bgs_attendance.transfer_passenger(
  p_assignment_id bigint,
  p_target_bus_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bgs_attendance', 'public'
AS $$
DECLARE
  v_cap int; v_src_shift bigint; v_tgt_shift bigint;
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

  UPDATE bgs_attendance.passenger_assignments
  SET original_bus_id = coalesce(original_bus_id, bus_id),
      bus_id = p_target_bus_id
  WHERE id = p_assignment_id;
END;
$$;

-- ── 3. bulk_assign_passengers: бүгдийг insert хийж, skipped_capacity-г ──────
--       "хэтэрсэн хүний тоо" (overflow warning) болгож дахин ашиглана.
CREATE OR REPLACE FUNCTION bgs_attendance.bulk_assign_passengers(p_bus_id bigint, p_eelj_group_bteg_id text, p_direction_ids uuid[] DEFAULT NULL::uuid[],
p_order_by_alba boolean DEFAULT true)
 RETURNS TABLE(inserted integer, skipped_capacity integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $$
declare
  v_shift_exchange_id bigint; v_capacity int; v_current int; v_dir_bteg text[];
begin
  select shift_exchange_id, capacity into v_shift_exchange_id, v_capacity
  from bgs_attendance.buses where id = p_bus_id;
  if v_shift_exchange_id is null then raise exception 'Bus not found: %', p_bus_id; end if;

  select count(*) into v_current
  from bgs_attendance.passenger_assignments where bus_id = p_bus_id and is_trip_leader is not true;

  select array_agg(d.h_autobus_direction_id) into v_dir_bteg
  from public.autobus_direction d
  where d.id = any (coalesce(nullif(p_direction_ids, '{}'::uuid[]),
    (select array_agg(direction_id) from bgs_attendance.bus_routes where bus_id = p_bus_id)));

  with cand as (
    select u.id as user_id
    from public.users u
    left join public.alba a on a.bteg_id = u.department_id
    left join public.heltes h on h.bteg_id = u.heltes_id
    where u.is_active and u.sf_guard_group_id = p_eelj_group_bteg_id
      and (v_dir_bteg is null or u.autobus_direction_id = any (v_dir_bteg))
      and not exists (select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = v_shift_exchange_id and pa.internal_user_id = u.id)
  ),
  ins as (
    insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
    select v_shift_exchange_id, p_bus_id, user_id from cand
    returning 1
  )
  select (select count(*)::int from ins)
  into inserted;

  skipped_capacity := greatest(v_current + inserted - bgs_attendance.passenger_capacity(v_capacity), 0);
  return next;
end;
$$;

-- ── 4. bulk_assign_by_org: pool + шинэ ажилчдыг бүгдийг шилжүүлж/insert хийнэ ─
CREATE OR REPLACE FUNCTION bgs_attendance.bulk_assign_by_org(
  p_bus_id bigint,
  p_org_bteg_id text,
  p_order_by_alba boolean DEFAULT true
)
RETURNS TABLE (assigned int, skipped_capacity int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_sx bigint; v_cap int; v_cur int;
  v_moved int := 0; v_inserted int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(),'shift_exchange','admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT shift_exchange_id, capacity INTO v_sx, v_cap
  FROM bgs_attendance.buses WHERE id = p_bus_id;
  IF v_sx IS NULL THEN RAISE EXCEPTION 'Bus not found: %', p_bus_id; END IF;

  SELECT count(*) INTO v_cur
  FROM bgs_attendance.passenger_assignments WHERE bus_id = p_bus_id;

  WITH pool AS (
    SELECT pa.id
    FROM bgs_attendance.passenger_assignments pa
    JOIN public.users u ON u.id = pa.internal_user_id
    WHERE pa.shift_exchange_id = v_sx AND pa.bus_id IS NULL AND u.organization_id = p_org_bteg_id
  ),
  upd AS (
    UPDATE bgs_attendance.passenger_assignments p SET bus_id = p_bus_id
    FROM pool WHERE p.id = pool.id
    RETURNING 1
  )
  SELECT count(*)::int INTO v_moved FROM upd;

  WITH cand AS (
    SELECT u.id
    FROM public.users u
    WHERE u.is_active AND u.organization_id = p_org_bteg_id
      AND NOT EXISTS (SELECT 1 FROM bgs_attendance.passenger_assignments pa
                      WHERE pa.shift_exchange_id = v_sx AND pa.internal_user_id = u.id)
  ),
  ins AS (
    INSERT INTO bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
    SELECT v_sx, p_bus_id, id FROM cand
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;

  assigned := v_moved + v_inserted;
  skipped_capacity := greatest(v_cur + assigned - bgs_attendance.passenger_capacity(v_cap), 0);
  RETURN NEXT;
END;
$$;

-- ── 5. bulk_transfer_passengers: бүгдийг шилжүүлж, overflow-г тоолно ────────
CREATE OR REPLACE FUNCTION bgs_attendance.bulk_transfer_passengers(
  p_assignment_ids bigint[],
  p_target_bus_id  bigint
)
RETURNS TABLE (transferred int, skipped_capacity int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bgs_attendance, public
AS $$
DECLARE
  v_tgt_shift bigint;
  v_cap       int;
  v_cur       int;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'shift_exchange', 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT shift_exchange_id, capacity INTO v_tgt_shift, v_cap
  FROM bgs_attendance.buses WHERE id = p_target_bus_id;
  IF v_tgt_shift IS NULL THEN
    RAISE EXCEPTION 'Target bus not found: %', p_target_bus_id;
  END IF;

  SELECT count(*) INTO v_cur
  FROM bgs_attendance.passenger_assignments WHERE bus_id = p_target_bus_id;

  WITH elig AS (
    SELECT pa.id
    FROM bgs_attendance.passenger_assignments pa
    WHERE pa.id = ANY(p_assignment_ids)
      AND pa.shift_exchange_id = v_tgt_shift
      AND pa.bus_id IS DISTINCT FROM p_target_bus_id
  ),
  upd AS (
    UPDATE bgs_attendance.passenger_assignments p
    SET bus_id = p_target_bus_id
    FROM elig
    WHERE p.id = elig.id
    RETURNING 1
  )
  SELECT count(*)::int INTO transferred FROM upd;

  skipped_capacity := greatest(v_cur + transferred - bgs_attendance.passenger_capacity(v_cap), 0);
  RETURN NEXT;
END;
$$;
