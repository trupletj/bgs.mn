-- 1) Эцсийн баталгаажуулалт зөвхөн QR уншсан (is_confirmed) зорчигчдод ажиллана.
create or replace function bgs_attendance.finalize_bus(p_bus_id bigint)
returns int
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare
  v_uid uuid;
  v_count int;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;
  v_uid := public.current_user_id();

  insert into bgs_attendance.attendance_logs
    (passenger_assignment_id, scanned_by, device_info, notes)
  select pa.id, v_uid, 'final-confirm', 'Эцсийн баталгаажуулалт'
  from bgs_attendance.passenger_assignments pa
  where pa.bus_id = p_bus_id and pa.is_confirmed and not pa.is_finalized;

  with upd as (
    update bgs_attendance.passenger_assignments
    set is_finalized = true, finalized_at = now(), finalized_by = v_uid
    where bus_id = p_bus_id and is_confirmed and not is_finalized
    returning 1
  )
  select count(*)::int into v_count from upd;
  return v_count;
end;
$$;

-- 2) Гараар QR уншсан/уншаагүй төлөв тохируулах (олон зорчигч зэрэг).
--    Уншаагүй болгоход эцсийн баталгаа (is_finalized) мөн цуцлагдана.
create or replace function bgs_attendance.set_passengers_confirmed(
  p_assignment_ids bigint[],
  p_confirmed boolean
)
returns int
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare
  v_uid uuid;
  v_count int;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;
  v_uid := public.current_user_id();

  with upd as (
    update bgs_attendance.passenger_assignments
    set is_confirmed = p_confirmed,
        confirmed_at  = case when p_confirmed then now()  else null end,
        confirmed_by  = case when p_confirmed then v_uid else null end,
        is_finalized  = case when p_confirmed then is_finalized else false end,
        finalized_at  = case when p_confirmed then finalized_at else null end,
        finalized_by  = case when p_confirmed then finalized_by else null end
    where id = any(p_assignment_ids)
      and is_confirmed is distinct from p_confirmed
    returning 1
  )
  select count(*)::int into v_count from upd;
  return v_count;
end;
$$;

revoke execute on function bgs_attendance.set_passengers_confirmed(bigint[], boolean) from anon, public;
grant  execute on function bgs_attendance.set_passengers_confirmed(bigint[], boolean) to authenticated;
