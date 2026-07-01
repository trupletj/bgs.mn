-- Автобус устгахад бүртгэлтэй зорчигчид нь устахгүй, харин "Хуваарилаагүй зорчигчид"
-- (pool, bus_id IS NULL) руу шилжинэ. bus_id FK нь CASCADE тул эхлээд pool руу
-- зөөж, дараа нь автобусыг устгана. original_bus_id (NO ACTION) FK-г бас цэвэрлэнэ.
create or replace function bgs_attendance.delete_bus(p_bus_id bigint)
returns int
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare
  v_moved int;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;

  with upd as (
    update bgs_attendance.passenger_assignments
    set bus_id = null
    where bus_id = p_bus_id
    returning 1
  )
  select count(*)::int into v_moved from upd;

  update bgs_attendance.passenger_assignments
  set original_bus_id = null
  where original_bus_id = p_bus_id;

  delete from bgs_attendance.buses where id = p_bus_id;

  return v_moved;
end;
$$;

revoke execute on function bgs_attendance.delete_bus(bigint) from anon, public;
grant  execute on function bgs_attendance.delete_bus(bigint) to authenticated;
