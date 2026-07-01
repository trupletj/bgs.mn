-- Ээлжийн бүлэг холбоход зөвхөн хуваарилаагүй жагсаалт (pool)-д нэмнэ. Автобусанд
-- хуваарилахгүй — хуваарилалт нь зөвхөн "Ухаалаг хуваарилах" (auto_distribute_pool).
create or replace function bgs_attendance.add_eelj_group_to_pool(
  p_exchange_id bigint,
  p_group_bteg_id text
)
returns int
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare v_added int;
begin
  if not public.has_permission(auth.uid(),'shift_exchange','admin') then
    raise exception 'Permission denied';
  end if;
  with ins as (
    insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
    select p_exchange_id, null, u.id
    from public.users u
    where u.is_active and u.sf_guard_group_id = p_group_bteg_id
      and not exists (
        select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = p_exchange_id and pa.internal_user_id = u.id
      )
    returning 1
  )
  select count(*)::int into v_added from ins;
  return v_added;
end;
$$;

revoke execute on function bgs_attendance.add_eelj_group_to_pool(bigint, text) from anon, public;
grant  execute on function bgs_attendance.add_eelj_group_to_pool(bigint, text) to authenticated;
