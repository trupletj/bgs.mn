-- HR-ийн "батлах" (finalize) feature бүрэн хасах. QR-ийн is_confirmed хэвээр.

-- 1) set_passengers_confirmed-г is_finalized хамааралгүйгээр дахин үүсгэнэ.
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
        confirmed_by  = case when p_confirmed then v_uid else null end
    where id = any(p_assignment_ids)
      and is_confirmed is distinct from p_confirmed
    returning 1
  )
  select count(*)::int into v_count from upd;
  return v_count;
end;
$$;

-- 2) finalize RPC-уудыг устгана.
drop function if exists bgs_attendance.finalize_bus(bigint);
drop function if exists bgs_attendance.unfinalize_passengers(bigint[]);

-- 3) finalize-ийн attendance_logs мөрүүдийг цэвэрлэнэ.
delete from bgs_attendance.attendance_logs where notes = 'Эцсийн баталгаажуулалт';

-- 4) finalize баганануудыг устгана.
alter table bgs_attendance.passenger_assignments
  drop column if exists is_finalized,
  drop column if exists finalized_at,
  drop column if exists finalized_by;
