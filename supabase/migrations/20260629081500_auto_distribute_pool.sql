-- Ухаалаг хуваарилалт: pool дахь зорчигчдыг чиглэлээр нь автобусанд автоматаар
-- хуваарилна. Одоо байгаа тухайн чиглэлийн автобусыг эхэлж дүүргээд, дараа нь
-- шаардлагатай бол шинэ автобус (capacity=p_capacity) үүсгэнэ. Зөвхөн bus_id IS NULL
-- (pool) мөрийг хөдөлгөх тул хэдийн хуваарилагдсан/баталгаажсан хүмүүс хэвээр үлдэнэ.
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
  v_moved    int;
  v_remaining int;
  v_seq      int;
  v_bus_id   bigint;
  r record;
  b record;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;
  if p_capacity <= 0 then
    raise exception 'Capacity must be positive';
  end if;

  select direction into v_dir_str
  from bgs_attendance.shift_exchanges
  where id = p_exchange_id;
  if v_dir_str is null then
    raise exception 'Exchange not found: %', p_exchange_id;
  end if;

  -- pool дахь хүчинтэй чиглэл бүрийг (text bteg_id -> uuid) тогтооно.
  -- NULL/тодорхойгүй чиглэлтэй хүн энэ join-д орохгүй тул pool-д үлдэнэ.
  for r in
    select d.id as dir_uuid, d.bteg_id as dir_bteg, d.name as dir_name
    from bgs_attendance.passenger_assignments pa
    join public.users u on u.id = pa.internal_user_id
    join public.autobus_direction d
      on d.bteg_id = coalesce(pa.autobus_direction_id, u.autobus_direction_id)
    where pa.shift_exchange_id = p_exchange_id
      and pa.bus_id is null
    group by d.id, d.bteg_id, d.name
  loop
    -- (1) Тухайн чиглэлийг дамждаг идэвхтэй автобусуудыг сул орон зайгаар нь
    --     (least-loaded эхэлж) дүүргэнэ.
    for b in
      select bus.id as bus_id,
             bus.capacity - (
               select count(*) from bgs_attendance.passenger_assignments pc
               where pc.bus_id = bus.id
             ) as free
      from bgs_attendance.buses bus
      join bgs_attendance.bus_routes br on br.bus_id = bus.id
      where bus.shift_exchange_id = p_exchange_id
        and bus.is_active
        and br.direction_id = r.dir_uuid
      order by free desc, bus.id
    loop
      if b.free <= 0 then
        continue;
      end if;
      with pool as (
        select pa.id
        from bgs_attendance.passenger_assignments pa
        join public.users u on u.id = pa.internal_user_id
        where pa.shift_exchange_id = p_exchange_id
          and pa.bus_id is null
          and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
        order by pa.id
        limit b.free
      ),
      upd as (
        update bgs_attendance.passenger_assignments p
        set bus_id = b.bus_id
        from pool
        where p.id = pool.id
        returning 1
      )
      select count(*) into v_moved from upd;
      v_assigned := v_assigned + v_moved;
    end loop;

    -- (2) Үлдсэн хүмүүст шинэ автобус үүсгэнэ. seq-ийг өмнө нь тухайн чиглэлд
    --     үүссэн автобусын тоогоор эхлүүлж, дахин ажиллахад '#1' давтахгүй.
    select count(*) into v_seq
    from bgs_attendance.buses bus
    join bgs_attendance.bus_routes br on br.bus_id = bus.id
    where bus.shift_exchange_id = p_exchange_id
      and br.direction_id = r.dir_uuid;

    loop
      select count(*) into v_remaining
      from bgs_attendance.passenger_assignments pa
      join public.users u on u.id = pa.internal_user_id
      where pa.shift_exchange_id = p_exchange_id
        and pa.bus_id is null
        and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg;
      exit when v_remaining = 0;

      v_seq := v_seq + 1;
      insert into bgs_attendance.buses (shift_exchange_id, direction, name, capacity)
      values (p_exchange_id, v_dir_str,
              coalesce(r.dir_name, 'Чиглэл') || ' #' || v_seq, p_capacity)
      returning id into v_bus_id;
      v_created := v_created + 1;

      insert into bgs_attendance.bus_routes (bus_id, direction_id, stop_order)
      values (v_bus_id, r.dir_uuid, 1);

      with pool as (
        select pa.id
        from bgs_attendance.passenger_assignments pa
        join public.users u on u.id = pa.internal_user_id
        where pa.shift_exchange_id = p_exchange_id
          and pa.bus_id is null
          and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
        order by pa.id
        limit p_capacity
      ),
      upd as (
        update bgs_attendance.passenger_assignments p
        set bus_id = v_bus_id
        from pool
        where p.id = pool.id
        returning 1
      )
      select count(*) into v_moved from upd;
      v_assigned := v_assigned + v_moved;
    end loop;
  end loop;

  select count(*) into still_pooled
  from bgs_attendance.passenger_assignments pa
  where pa.shift_exchange_id = p_exchange_id
    and pa.bus_id is null;

  buses_created := v_created;
  assigned := v_assigned;
  return next;
end;
$$;

revoke execute on function bgs_attendance.auto_distribute_pool(bigint, int) from anon, public;
grant  execute on function bgs_attendance.auto_distribute_pool(bigint, int) to authenticated;
