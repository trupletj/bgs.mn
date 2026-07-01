-- Автобус бүрт аялалын ахлахын 1 суудал нөөцлөнө: зорчигчийн дээд хязгаар =
-- capacity - 1 (ахлахтай нийлээд нийт capacity хүн сууна). Бүх хуваарилалтын замд
-- (manual, bulk, auto, transfer) мөрдөгдөхөөр capacity шалгалтуудыг нэг helper
-- (passenger_capacity)-аар дамжуулна.

create or replace function bgs_attendance.passenger_capacity(p_capacity int)
returns int
language sql
immutable
set search_path = ''
as $$
  select greatest(coalesce(p_capacity, 0) - 1, 0);
$$;

-- ── check_bus_capacity: is_full нь ахлахын суудлыг нөөцөлнө ──────────────────
create or replace function bgs_attendance.check_bus_capacity(p_bus_id bigint)
returns table (current_count int, capacity int, is_full boolean)
language sql
stable
security definer
set search_path to 'bgs_attendance', 'public'
as $$
  select
    count(pa.id)::int as current_count,
    b.capacity,
    count(pa.id) >= bgs_attendance.passenger_capacity(b.capacity) as is_full
  from bgs_attendance.buses b
  left join bgs_attendance.passenger_assignments pa on pa.bus_id = b.id
  where b.id = p_bus_id
  group by b.capacity;
$$;

-- ── transfer_passenger ──────────────────────────────────────────────────────
create or replace function bgs_attendance.transfer_passenger(
  p_assignment_id bigint,
  p_target_bus_id bigint
)
returns void
language plpgsql
security definer
set search_path to 'bgs_attendance', 'public'
as $$
declare
  v_cap int; v_cur int; v_src_shift bigint; v_tgt_shift bigint;
begin
  select pa.shift_exchange_id into v_src_shift
  from bgs_attendance.passenger_assignments pa where pa.id = p_assignment_id;
  if v_src_shift is null then raise exception 'Assignment not found'; end if;

  select shift_exchange_id, capacity into v_tgt_shift, v_cap
  from bgs_attendance.buses where id = p_target_bus_id;
  if v_tgt_shift is null then raise exception 'Target bus not found'; end if;
  if v_tgt_shift <> v_src_shift then
    raise exception 'Target bus belongs to a different shift exchange';
  end if;

  select count(*) into v_cur
  from bgs_attendance.passenger_assignments where bus_id = p_target_bus_id;
  if v_cur >= bgs_attendance.passenger_capacity(v_cap) then
    raise exception 'Target bus is full (%/%)', v_cur, bgs_attendance.passenger_capacity(v_cap);
  end if;

  update bgs_attendance.passenger_assignments
  set original_bus_id = coalesce(original_bus_id, bus_id),
      bus_id = p_target_bus_id
  where id = p_assignment_id;
end;
$$;

-- ── auto_assign_group ───────────────────────────────────────────────────────
create or replace function bgs_attendance.auto_assign_group(
  p_exchange_id bigint,
  p_group_bteg_id text
)
returns table (assigned int, pooled int)
language plpgsql
security definer
set search_path to 'bgs_attendance', 'public'
as $$
declare
  v_assigned int := 0;
  v_pooled   int := 0;
  w record;
  v_bus_id bigint;
begin
  if not public.has_permission(auth.uid(),'shift_exchange','admin') then
    raise exception 'Permission denied';
  end if;

  for w in
    select u.id as user_id, u.autobus_direction_id as dir
    from public.users u
    left join public.alba   a on a.bteg_id = u.department_id
    left join public.heltes h on h.bteg_id = u.heltes_id
    where u.is_active
      and u.sf_guard_group_id = p_group_bteg_id
      and not exists (
        select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = p_exchange_id and pa.internal_user_id = u.id
      )
    order by a.name nulls last, h.name nulls last, u.last_name, u.first_name
  loop
    select b.id into v_bus_id
    from bgs_attendance.buses b
    join bgs_attendance.bus_routes br on br.bus_id = b.id
    join public.autobus_direction d on d.id = br.direction_id
    where b.shift_exchange_id = p_exchange_id
      and b.is_active
      and w.dir is not null
      and d.bteg_id = w.dir
      and (select count(*) from bgs_attendance.passenger_assignments pa
           where pa.bus_id = b.id) < bgs_attendance.passenger_capacity(b.capacity)
    order by (select count(*) from bgs_attendance.passenger_assignments pa
              where pa.bus_id = b.id) asc, b.id asc
    limit 1;

    if v_bus_id is not null then
      insert into bgs_attendance.passenger_assignments
        (shift_exchange_id, bus_id, internal_user_id)
      values (p_exchange_id, v_bus_id, w.user_id);
      v_assigned := v_assigned + 1;
    else
      insert into bgs_attendance.passenger_assignments
        (shift_exchange_id, bus_id, internal_user_id)
      values (p_exchange_id, null, w.user_id);
      v_pooled := v_pooled + 1;
    end if;
  end loop;

  assigned := v_assigned;
  pooled := v_pooled;
  return next;
end;
$$;

-- ── bulk_assign_passengers ──────────────────────────────────────────────────
create or replace function bgs_attendance.bulk_assign_passengers(
  p_bus_id              bigint,
  p_eelj_group_bteg_id  text,
  p_direction_ids       uuid[]  default null,
  p_order_by_alba       boolean default true
)
returns table (inserted int, skipped_capacity int)
language plpgsql
security definer
set search_path to 'bgs_attendance', 'public'
as $$
declare
  v_shift_exchange_id bigint;
  v_capacity int;
  v_current  int;
  v_remaining int;
  v_dir_bteg  text[];
begin
  select shift_exchange_id, capacity
    into v_shift_exchange_id, v_capacity
  from bgs_attendance.buses where id = p_bus_id;
  if v_shift_exchange_id is null then
    raise exception 'Bus not found: %', p_bus_id;
  end if;

  select count(*) into v_current
  from bgs_attendance.passenger_assignments where bus_id = p_bus_id;
  v_remaining := greatest(bgs_attendance.passenger_capacity(v_capacity) - v_current, 0);

  select array_agg(d.bteg_id) into v_dir_bteg
  from public.autobus_direction d
  where d.id = any (
    coalesce(
      nullif(p_direction_ids, '{}'::uuid[]),
      (select array_agg(direction_id) from bgs_attendance.bus_routes where bus_id = p_bus_id)
    )
  );

  with cand as (
    select u.id as user_id,
           row_number() over (
             order by
               case when p_order_by_alba then a.name end nulls last,
               h.name nulls last,
               u.last_name, u.first_name
           ) as rn
    from public.users u
    left join public.alba   a on a.bteg_id = u.department_id
    left join public.heltes h on h.bteg_id = u.heltes_id
    where u.is_active
      and u.sf_guard_group_id = p_eelj_group_bteg_id
      and (v_dir_bteg is null or u.autobus_direction_id = any (v_dir_bteg))
      and not exists (
        select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = v_shift_exchange_id
          and pa.internal_user_id = u.id
      )
  ),
  ins as (
    insert into bgs_attendance.passenger_assignments
      (shift_exchange_id, bus_id, internal_user_id)
    select v_shift_exchange_id, p_bus_id, user_id
    from cand where rn <= v_remaining
    returning 1
  )
  select (select count(*)::int from ins),
         (select count(*)::int from cand where rn > v_remaining)
  into inserted, skipped_capacity;

  return next;
end;
$$;

-- ── bulk_assign_by_org ──────────────────────────────────────────────────────
create or replace function bgs_attendance.bulk_assign_by_org(
  p_bus_id bigint,
  p_org_bteg_id text,
  p_order_by_alba boolean default true
)
returns table (assigned int, skipped_capacity int)
language plpgsql
security definer
set search_path to 'bgs_attendance', 'public'
as $$
declare
  v_sx bigint; v_cap int; v_cur int; v_remaining int;
  v_pooled_total int; v_notinx_total int;
  v_moved int := 0; v_inserted int := 0; v_rem2 int;
begin
  if not public.has_permission(auth.uid(),'shift_exchange','admin') then
    raise exception 'Permission denied';
  end if;
  select shift_exchange_id, capacity into v_sx, v_cap
  from bgs_attendance.buses where id = p_bus_id;
  if v_sx is null then raise exception 'Bus not found: %', p_bus_id; end if;

  select count(*) into v_cur
  from bgs_attendance.passenger_assignments where bus_id = p_bus_id;
  v_remaining := greatest(bgs_attendance.passenger_capacity(v_cap) - v_cur, 0);

  select count(*) into v_pooled_total
  from bgs_attendance.passenger_assignments pa
  join public.users u on u.id = pa.internal_user_id
  where pa.shift_exchange_id = v_sx and pa.bus_id is null and u.organization_id = p_org_bteg_id;

  select count(*) into v_notinx_total
  from public.users u
  where u.is_active and u.organization_id = p_org_bteg_id
    and not exists (select 1 from bgs_attendance.passenger_assignments pa
                    where pa.shift_exchange_id = v_sx and pa.internal_user_id = u.id);

  with pool as (
    select pa.id,
      row_number() over (order by
        case when p_order_by_alba then a.name end nulls last,
        h.name nulls last, u.last_name, u.first_name) as rn
    from bgs_attendance.passenger_assignments pa
    join public.users u on u.id = pa.internal_user_id
    left join public.alba a on a.bteg_id = u.department_id
    left join public.heltes h on h.bteg_id = u.heltes_id
    where pa.shift_exchange_id = v_sx and pa.bus_id is null and u.organization_id = p_org_bteg_id
  ),
  upd as (
    update bgs_attendance.passenger_assignments p set bus_id = p_bus_id
    from pool where p.id = pool.id and pool.rn <= v_remaining
    returning 1
  )
  select count(*)::int into v_moved from upd;

  v_rem2 := v_remaining - v_moved;

  if v_rem2 > 0 then
    with cand as (
      select u.id,
        row_number() over (order by
          case when p_order_by_alba then a.name end nulls last,
          h.name nulls last, u.last_name, u.first_name) as rn
      from public.users u
      left join public.alba a on a.bteg_id = u.department_id
      left join public.heltes h on h.bteg_id = u.heltes_id
      where u.is_active and u.organization_id = p_org_bteg_id
        and not exists (select 1 from bgs_attendance.passenger_assignments pa
                        where pa.shift_exchange_id = v_sx and pa.internal_user_id = u.id)
    ),
    ins as (
      insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
      select v_sx, p_bus_id, id from cand where rn <= v_rem2
      returning 1
    )
    select count(*)::int into v_inserted from ins;
  end if;

  assigned := v_moved + v_inserted;
  skipped_capacity := (v_pooled_total - v_moved) + (v_notinx_total - v_inserted);
  return next;
end;
$$;

-- ── auto_distribute_pool (ахлахын суудал нөөцөлсөн) ─────────────────────────
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
    -- (1) одоо байгаа автобусыг ахлахын суудлыг нөөцөлж дүүргэнэ.
    for b in
      select bus.id as bus_id,
             bgs_attendance.passenger_capacity(bus.capacity) - (
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

    -- (2) үлдсэн хүмүүст шинэ автобус — тус бүр passenger_capacity хүртэл дүүргэнэ.
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
        limit bgs_attendance.passenger_capacity(p_capacity)
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

-- ── bulk_transfer_passengers (ахлахын суудал нөөцөлсөн) ─────────────────────
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
  v_remaining := greatest(bgs_attendance.passenger_capacity(v_cap) - v_cur, 0);

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
