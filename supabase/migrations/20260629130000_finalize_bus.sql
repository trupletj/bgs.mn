-- HR-ийн эцсийн баталгаажуулалт: автобусны зорчигчдыг "баталсан" (is_finalized)
-- болгож, attendance_logs-д бүртгэл үлдээнэ. is_confirmed (QR суулт)-аас тусдаа.
alter table bgs_attendance.passenger_assignments
  add column if not exists is_finalized boolean not null default false,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references public.users(id);

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

  -- зөвхөн хараахан баталгаажаагүй мөрд attendance_logs бичнэ (давхардахгүй)
  insert into bgs_attendance.attendance_logs
    (passenger_assignment_id, scanned_by, device_info, notes)
  select pa.id, v_uid, 'final-confirm', 'Эцсийн баталгаажуулалт'
  from bgs_attendance.passenger_assignments pa
  where pa.bus_id = p_bus_id and not pa.is_finalized;

  with upd as (
    update bgs_attendance.passenger_assignments
    set is_finalized = true, finalized_at = now(), finalized_by = v_uid
    where bus_id = p_bus_id and not is_finalized
    returning 1
  )
  select count(*)::int into v_count from upd;
  return v_count;
end;
$$;

revoke execute on function bgs_attendance.finalize_bus(bigint) from anon, public;
grant  execute on function bgs_attendance.finalize_bus(bigint) to authenticated;
