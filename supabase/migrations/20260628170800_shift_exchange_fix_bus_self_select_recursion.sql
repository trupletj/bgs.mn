-- bus_self_passenger_select policy нь passenger_assignments-ийг шууд уншсанаар
-- passenger_assignments-ийн pa_trip_leader_select (buses-ийг уншдаг)-тай харилцан
-- RLS давталт (infinite recursion) үүсгэж байв. SECURITY DEFINER helper-ээр RLS-ийг
-- bypass хийж давталтыг таслана.

create or replace function bgs_attendance.current_user_on_bus(p_bus_id bigint)
returns boolean
language sql
stable
security definer
set search_path = bgs_attendance, public
as $$
  select exists (
    select 1
    from bgs_attendance.passenger_assignments pa
    where pa.bus_id = p_bus_id
      and pa.internal_user_id = public.current_user_id()
  );
$$;

grant execute on function bgs_attendance.current_user_on_bus(bigint) to authenticated;

drop policy if exists bus_self_passenger_select on bgs_attendance.buses;

create policy bus_self_passenger_select
  on bgs_attendance.buses
  for select
  to authenticated
  using (bgs_attendance.current_user_on_bus(id));
