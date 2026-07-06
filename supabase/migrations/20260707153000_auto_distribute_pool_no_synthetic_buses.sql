-- Buses are now sourced from the external target.h_autobus sync (see
-- backfill_h_autobus_to_buses + handle_h_autobus_sync). auto_distribute_pool
-- must stop inventing its own bus rows: units that don't fit into an
-- existing active bus for their direction now simply stay in the pool
-- until the external system provides more buses. buses_created is kept in
-- the return signature (always 0 now) to avoid an API/type change.
CREATE OR REPLACE FUNCTION bgs_attendance.auto_distribute_pool(p_exchange_id bigint, p_capacity integer DEFAULT 45)
 RETURNS TABLE(buses_created integer, assigned integer, still_pooled integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
declare
  v_dir_str  text;
  v_assigned int := 0;
  v_cap      int;
  v_bus_id   bigint;
  v_ids      bigint[];
  v_sz       int;
  r record;
  unit record;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;
  if p_capacity <= 0 then raise exception 'Capacity must be positive'; end if;
  v_cap := bgs_attendance.passenger_capacity(p_capacity);
  if v_cap < 1 then raise exception 'Багтаамж хэт бага'; end if;

  select direction into v_dir_str from bgs_attendance.shift_exchanges where id = p_exchange_id;
  if v_dir_str is null then raise exception 'Exchange not found: %', p_exchange_id; end if;

  for r in
    select d.id as dir_uuid, d.h_autobus_direction_id as dir_bteg, d.name as dir_name
    from bgs_attendance.passenger_assignments pa
    join public.users u on u.id = pa.internal_user_id
    join public.autobus_direction d
      on d.h_autobus_direction_id = coalesce(pa.autobus_direction_id, u.autobus_direction_id)
    where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
    group by d.id, d.h_autobus_direction_id, d.name
  loop
    for unit in
      select array_agg(pa.id order by pa.id) as ids, count(*)::int as sz,
             lpad(min(pa.id)::text, 12, '0') as sort_key
      from bgs_attendance.passenger_assignments pa
      join public.users u on u.id = pa.internal_user_id
      join bgs_attendance.companion_group_members cgm on cgm.internal_user_id = pa.internal_user_id
      where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
        and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
      group by cgm.group_id
      union all
      select array[pa.id], 1,
             coalesce(u.department_name,'') || '|' || coalesce(u.heltes_name,'') || '|'
               || coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')
      from bgs_attendance.passenger_assignments pa
      join public.users u on u.id = pa.internal_user_id
      where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
        and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
        and not exists (
          select 1 from bgs_attendance.companion_group_members cgm
          where cgm.internal_user_id = pa.internal_user_id
        )
      order by sz desc, sort_key
    loop
      v_ids := unit.ids;
      while array_length(v_ids, 1) is not null and array_length(v_ids, 1) > 0 loop
        v_sz := array_length(v_ids, 1);

        select bus.id into v_bus_id
        from bgs_attendance.buses bus
        join bgs_attendance.bus_routes br on br.bus_id = bus.id
        where bus.shift_exchange_id = p_exchange_id and bus.is_active
          and br.direction_id = r.dir_uuid
          and (bgs_attendance.passenger_capacity(bus.capacity)
               - (select count(*) from bgs_attendance.passenger_assignments pc where pc.bus_id = bus.id and pc.is_trip_leader is not true)) >= v_sz
        order by (bgs_attendance.passenger_capacity(bus.capacity)
               - (select count(*) from bgs_attendance.passenger_assignments pc where pc.bus_id = bus.id and pc.is_trip_leader is not true)) asc, bus.id
        limit 1;

        if v_bus_id is not null then
          update bgs_attendance.passenger_assignments set bus_id = v_bus_id where id = any(v_ids);
          v_assigned := v_assigned + v_sz;
          v_ids := array[]::bigint[];
        else
          -- No existing bus has room: leave this unit in the pool (bus_id
          -- stays NULL) instead of inventing a new bus row. Stop iterating
          -- this unit's remainder; it will show up in still_pooled below.
          v_ids := array[]::bigint[];
        end if;
      end loop;
    end loop;
  end loop;

  select count(*) into still_pooled
  from bgs_attendance.passenger_assignments pa
  where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null;
  buses_created := 0; assigned := v_assigned; return next;
end;
$function$;
