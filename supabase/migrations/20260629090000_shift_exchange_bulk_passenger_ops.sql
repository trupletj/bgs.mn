-- Олон зорчигчийг зэрэг pool руу буцаах / өөр автобус руу шилжүүлэх bulk RPC-ууд.
-- Нэг нэгээр нь хийхэд удаан байсныг хурдасгана. Зөвхөн admin.

create or replace function bgs_attendance.bulk_unassign_to_pool(
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
  with upd as (
    update bgs_attendance.passenger_assignments
    set bus_id = null
    where id = any(p_assignment_ids)
      and bus_id is not null
    returning 1
  )
  select count(*)::int into v_count from upd;
  return v_count;
end;
$$;

revoke execute on function bgs_attendance.bulk_unassign_to_pool(bigint[]) from anon, public;
grant  execute on function bgs_attendance.bulk_unassign_to_pool(bigint[]) to authenticated;

create or replace function bgs_attendance.bulk_transfer_passengers(
  p_assignment_ids bigint[],
  p_target_bus_id  bigint
)
returns table (transferred int, skipped_capacity int)
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare
  v_tgt_shift bigint;
  v_cap       int;
  v_cur       int;
  v_remaining int;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;

  select shift_exchange_id, capacity into v_tgt_shift, v_cap
  from bgs_attendance.buses where id = p_target_bus_id;
  if v_tgt_shift is null then
    raise exception 'Target bus not found: %', p_target_bus_id;
  end if;

  select count(*) into v_cur
  from bgs_attendance.passenger_assignments where bus_id = p_target_bus_id;
  v_remaining := greatest(v_cap - v_cur, 0);

  -- Зорилтот автобустай ижил ээлжийн, target дээр аль хэдийн биш мөрүүд л тохиромжтой.
  with elig as (
    select pa.id
    from bgs_attendance.passenger_assignments pa
    where pa.id = any(p_assignment_ids)
      and pa.shift_exchange_id = v_tgt_shift
      and pa.bus_id is distinct from p_target_bus_id
  ),
  pick as (
    select id, row_number() over (order by id) as rn from elig
  ),
  upd as (
    update bgs_attendance.passenger_assignments p
    set bus_id = p_target_bus_id
    from pick
    where p.id = pick.id and pick.rn <= v_remaining
    returning 1
  )
  select (select count(*)::int from upd),
         (select count(*)::int from elig) - (select count(*)::int from upd)
  into transferred, skipped_capacity;
  return next;
end;
$$;

revoke execute on function bgs_attendance.bulk_transfer_passengers(bigint[], bigint) from anon, public;
grant  execute on function bgs_attendance.bulk_transfer_passengers(bigint[], bigint) to authenticated;
