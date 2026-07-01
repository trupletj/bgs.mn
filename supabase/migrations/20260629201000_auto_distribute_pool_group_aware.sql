-- Ухаалаг хуваарилалт: чиглэл доторх хүмүүсийг "unit"-ээр (companion бүлэг = нэг unit,
-- ганц хүн = нэг unit) FFD (том нь эхэлж) аргаар автобусанд багцална. Нэг бүлгийн
-- гишүүд (capacity-д багтвал) нэг автобусанд хамт орно. Зөвхөн bus_id IS NULL мөрийг
-- хөдөлгөнө (идемпотент, баталгаажсан/хуваарилагдсан хүмүүс хэвээр).
create or replace function bgs_attendance.auto_distribute_pool(
  p_exchange_id bigint,
  p_capacity    int default 45
)
returns table (buses_created int, assigned int, still_pooled int)
language plpgsql
security definer
set search_path = bgs_attendance, public
as $$
declare
  v_dir_str  text;
  v_created  int := 0;
  v_assigned int := 0;
  v_cap      int;       -- зорчигчийн дээд хязгаар (ахлахын суудал нөөцилсөн)
  v_seq      int;
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
    select d.id as dir_uuid, d.bteg_id as dir_bteg, d.name as dir_name
    from bgs_attendance.passenger_assignments pa
    join public.users u on u.id = pa.internal_user_id
    join public.autobus_direction d
      on d.bteg_id = coalesce(pa.autobus_direction_id, u.autobus_direction_id)
    where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
    group by d.id, d.bteg_id, d.name
  loop
    for unit in
      -- companion бүлгүүд (тухайн чиглэлд pool-д байгаа гишүүд)
      select array_agg(pa.id order by pa.id) as ids, count(*)::int as sz, min(pa.id) as minid
      from bgs_attendance.passenger_assignments pa
      join public.users u on u.id = pa.internal_user_id
      join bgs_attendance.companion_group_members cgm on cgm.internal_user_id = pa.internal_user_id
      where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
        and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
      group by cgm.group_id
      union all
      -- бүлэггүй ганц хүн
      select array[pa.id], 1, pa.id
      from bgs_attendance.passenger_assignments pa
      join public.users u on u.id = pa.internal_user_id
      where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
        and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
        and not exists (
          select 1 from bgs_attendance.companion_group_members cgm
          where cgm.internal_user_id = pa.internal_user_id
        )
      order by sz desc, minid
    loop
      v_ids := unit.ids;
      while array_length(v_ids, 1) is not null and array_length(v_ids, 1) > 0 loop
        v_sz := array_length(v_ids, 1);

        -- (1) багтах сул зайтай идэвхтэй автобус (best-fit: хамгийн бага хүрэлцэх)
        select bus.id into v_bus_id
        from bgs_attendance.buses bus
        join bgs_attendance.bus_routes br on br.bus_id = bus.id
        where bus.shift_exchange_id = p_exchange_id and bus.is_active
          and br.direction_id = r.dir_uuid
          and (bgs_attendance.passenger_capacity(bus.capacity)
               - (select count(*) from bgs_attendance.passenger_assignments pc where pc.bus_id = bus.id)) >= v_sz
        order by (bgs_attendance.passenger_capacity(bus.capacity)
               - (select count(*) from bgs_attendance.passenger_assignments pc where pc.bus_id = bus.id)) asc, bus.id
        limit 1;

        if v_bus_id is not null then
          update bgs_attendance.passenger_assignments set bus_id = v_bus_id where id = any(v_ids);
          v_assigned := v_assigned + v_sz;
          v_ids := array[]::bigint[];
        else
          -- (2) шинэ автобус
          select count(*) into v_seq
          from bgs_attendance.buses bus
          join bgs_attendance.bus_routes br on br.bus_id = bus.id
          where bus.shift_exchange_id = p_exchange_id and br.direction_id = r.dir_uuid;
          v_seq := v_seq + 1;
          insert into bgs_attendance.buses (shift_exchange_id, direction, name, capacity)
          values (p_exchange_id, v_dir_str, coalesce(r.dir_name, 'Чиглэл') || ' #' || v_seq, p_capacity)
          returning id into v_bus_id;
          v_created := v_created + 1;
          insert into bgs_attendance.bus_routes (bus_id, direction_id, stop_order) values (v_bus_id, r.dir_uuid, 1);

          if v_sz <= v_cap then
            update bgs_attendance.passenger_assignments set bus_id = v_bus_id where id = any(v_ids);
            v_assigned := v_assigned + v_sz;
            v_ids := array[]::bigint[];
          else
            -- бүлэг автобусаас том: эхний v_cap-ийг тавьж, үлдсэнийг үргэлжлүүлнэ
            update bgs_attendance.passenger_assignments set bus_id = v_bus_id
            where id = any(v_ids[1:v_cap]);
            v_assigned := v_assigned + v_cap;
            v_ids := v_ids[v_cap + 1 : array_length(v_ids, 1)];
          end if;
        end if;
      end loop;
    end loop;
  end loop;

  select count(*) into still_pooled
  from bgs_attendance.passenger_assignments pa
  where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null;
  buses_created := v_created; assigned := v_assigned; return next;
end;
$$;
