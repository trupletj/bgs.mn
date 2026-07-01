-- Эцсийн баталгааг (is_finalized) буцаах: QR-ийн is_confirmed-д хүрэхгүй, зөвхөн
-- HR-ийн баталгааг цуцалж, finalize-ийн attendance_logs мөрийг устгана (давхардахгүй).
create or replace function bgs_attendance.unfinalize_passengers(
  p_assignment_ids bigint[]
)
returns int
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare
  v_count int;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;

  delete from bgs_attendance.attendance_logs
  where passenger_assignment_id = any(p_assignment_ids)
    and notes = 'Эцсийн баталгаажуулалт';

  with upd as (
    update bgs_attendance.passenger_assignments
    set is_finalized = false, finalized_at = null, finalized_by = null
    where id = any(p_assignment_ids) and is_finalized
    returning 1
  )
  select count(*)::int into v_count from upd;
  return v_count;
end;
$$;

revoke execute on function bgs_attendance.unfinalize_passengers(bigint[]) from anon, public;
grant  execute on function bgs_attendance.unfinalize_passengers(bigint[]) to authenticated;
