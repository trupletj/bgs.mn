-- Rename misleading generic `bteg_id` columns (they store a *different* target
-- table's own PK, not an employee's bteg_id) to `<source_table>_id`, matching
-- the pattern already used by shift_exchanges.eelj_id / trip_leaders.eelj_id.
-- public.users.bteg_id is intentionally NOT touched (it genuinely is the
-- employee's bteg_id and is referenced by dozens of FKs).

-- 1. Column renames -----------------------------------------------------
ALTER TABLE public.eelj_groups RENAME COLUMN bteg_id TO sf_guard_group_id;
ALTER TABLE public.user_groups RENAME COLUMN bteg_id TO sf_guard_user_group_id;
ALTER TABLE public.autobus_direction RENAME COLUMN bteg_id TO h_autobus_direction_id;

-- 2. Constraint renames (cosmetic, keeps names in sync with the columns) -
ALTER TABLE public.eelj_groups RENAME CONSTRAINT eelj_groups_bteg_id_key TO eelj_groups_sf_guard_group_id_key;
ALTER TABLE public.user_groups RENAME CONSTRAINT user_groups_bteg_id_key TO user_groups_sf_guard_user_group_id_key;
ALTER TABLE public.autobus_direction RENAME CONSTRAINT autobus_direction_bteg_id_key TO autobus_direction_h_autobus_direction_id_key;

-- 3. Functions that read/write the renamed columns -----------------------

CREATE OR REPLACE FUNCTION public.handle_h_autobus_direction_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.autobus_direction WHERE h_autobus_direction_id = OLD.id::TEXT;
        RETURN OLD;
    END IF;

    -- Singer/SDC soft-delete: treat _sdc_deleted_at as a delete
    IF NEW._sdc_deleted_at IS NOT NULL THEN
        DELETE FROM public.autobus_direction WHERE h_autobus_direction_id = NEW.id::TEXT;
        RETURN NEW;
    END IF;

    INSERT INTO public.autobus_direction
        (h_autobus_direction_id, name, zam_tsag, district_id, city_id, created_at, updated_at)
    VALUES
        (NEW.id::TEXT, NEW.name, NEW.zam_tsag, NEW.district_id::TEXT,
         NEW.city_id::TEXT, NEW.created_at, NEW.updated_at)
    ON CONFLICT (h_autobus_direction_id) DO UPDATE SET
        name = EXCLUDED.name, zam_tsag = EXCLUDED.zam_tsag,
        district_id = EXCLUDED.district_id, city_id = EXCLUDED.city_id,
        created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_sf_guard_group_sync()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.eelj_groups WHERE sf_guard_group_id = OLD.id::TEXT;
        RETURN OLD;
    END IF;
    INSERT INTO public.eelj_groups
        (sf_guard_group_id, name, description, cheif_id, organization_id,
         created_user_id, updated_user_id, created_at, updated_at)
    VALUES
        (NEW.id::TEXT, NEW.name, NEW.description, NEW.cheif_id::TEXT, NEW.organization_id::TEXT,
         NEW.created_user_id::TEXT, NEW.updated_user_id::TEXT, NEW.created_at, NEW.updated_at)
    ON CONFLICT (sf_guard_group_id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        cheif_id = EXCLUDED.cheif_id, organization_id = EXCLUDED.organization_id,
        created_user_id = EXCLUDED.created_user_id, updated_user_id = EXCLUDED.updated_user_id,
        created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_sf_guard_user_group_sync()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    safe_user  TEXT := NULL;
    safe_group TEXT := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.user_groups WHERE sf_guard_user_group_id = OLD.id::TEXT;
        RETURN OLD;
    END IF;

    IF NEW.user_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.users u WHERE u.bteg_id = NEW.user_id::TEXT) THEN
        safe_user := NEW.user_id::TEXT;
    END IF;
    IF NEW.group_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.eelj_groups g WHERE g.sf_guard_group_id = NEW.group_id::TEXT) THEN
        safe_group := NEW.group_id::TEXT;
    END IF;

    INSERT INTO public.user_groups
        (sf_guard_user_group_id, user_id, group_id, role, organization_id,
         created_user_id, updated_user_id, created_at, updated_at)
    VALUES
        (NEW.id::TEXT, safe_user, safe_group, NEW.role, NEW.organization_id::TEXT,
         NEW.created_user_id::TEXT, NEW.updated_user_id::TEXT, NEW.created_at, NEW.updated_at)
    ON CONFLICT (sf_guard_user_group_id) DO UPDATE SET
        user_id = EXCLUDED.user_id, group_id = EXCLUDED.group_id,
        role = EXCLUDED.role, organization_id = EXCLUDED.organization_id,
        created_user_id = EXCLUDED.created_user_id, updated_user_id = EXCLUDED.updated_user_id,
        created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_sf_guard_user_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    target_phone TEXT;
    existing_by_phone RECORD;
    existing_by_id RECORD;
    safe_org TEXT := NULL;
    safe_dept TEXT := NULL;
    safe_heltes TEXT := NULL;
    safe_group TEXT := NULL;
    safe_direction TEXT := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.users
        SET is_active = false, updated_at = now()
        WHERE bteg_id = OLD.id::TEXT;
        RETURN OLD;
    END IF;

    target_phone := COALESCE(NULLIF(NEW.phone2, ''), NULLIF(NEW.phone, ''));

    IF NEW.organization_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.organization o WHERE o.bteg_id = NEW.organization_id::TEXT) THEN
        safe_org := NEW.organization_id::TEXT;
    END IF;
    IF NEW.department_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.alba a WHERE a.bteg_id = NEW.department_id::TEXT) THEN
        safe_dept := NEW.department_id::TEXT;
    END IF;
    IF NEW.heltes_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.heltes h WHERE h.bteg_id = NEW.heltes_id::TEXT) THEN
        safe_heltes := NEW.heltes_id::TEXT;
    END IF;
    IF NEW.sf_guard_group_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.eelj_groups g WHERE g.sf_guard_group_id = NEW.sf_guard_group_id::TEXT) THEN
        safe_group := NEW.sf_guard_group_id::TEXT;
    END IF;
    IF NEW.autobus_direction_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.autobus_direction d WHERE d.h_autobus_direction_id = NEW.autobus_direction_id::TEXT) THEN
        safe_direction := NEW.autobus_direction_id::TEXT;
    END IF;

    SELECT id, phone, is_active INTO existing_by_id
    FROM public.users WHERE bteg_id = NEW.id::TEXT LIMIT 1;

    SELECT id, bteg_id, is_active INTO existing_by_phone
    FROM public.users WHERE phone = target_phone AND bteg_id != NEW.id::TEXT LIMIT 1;

    IF existing_by_phone.id IS NOT NULL THEN
        IF existing_by_phone.is_active = false THEN
            UPDATE public.users
            SET phone = phone || '_old_' || existing_by_phone.bteg_id
            WHERE id = existing_by_phone.id;
        ELSE
            RAISE NOTICE 'Идэвхтэй ажилтан ижил дугаартай байна: %', target_phone;
            RETURN NEW;
        END IF;
    END IF;

    IF existing_by_id.id IS NOT NULL THEN
        UPDATE public.users SET
            email = NEW.email_address, phone = target_phone,
            idcard_number = NEW.idcard_number, is_active = NEW.is_active,
            address = NEW.address, register_number = NEW.register_number,
            gazar_id = NEW.gazar_id::TEXT, alba_id = NEW.alba_id::TEXT,
            heltes_id = safe_heltes, job_position_id = NEW.position_id::TEXT,
            nice_name = NEW.nice_name, updated_at = NEW.updated_at,
            first_name = NEW.first_name, last_name = NEW.last_name,
            organization_id = safe_org, department_id = safe_dept,
            department_name = NEW.department_name, heltes_name = NEW.heltes_name,
            position_name = NEW.position_name,
            sf_guard_group_id = safe_group,
            autobus_direction_id = safe_direction
        WHERE id = existing_by_id.id;
    ELSE
        IF NEW.is_active = true THEN
            INSERT INTO public.users (
                bteg_id, email, phone, idcard_number, is_active, address,
                register_number, gazar_id, alba_id, heltes_id, job_position_id,
                nice_name, created_at, updated_at, first_name, last_name,
                organization_id, department_id, department_name, heltes_name, position_name,
                sf_guard_group_id, autobus_direction_id
            )
            VALUES (
                NEW.id::TEXT, NEW.email_address, target_phone, NEW.idcard_number,
                NEW.is_active, NEW.address, NEW.register_number, NEW.gazar_id::TEXT,
                NEW.alba_id::TEXT, safe_heltes, NEW.position_id::TEXT,
                NEW.nice_name, NEW.created_at, NEW.updated_at, NEW.first_name, NEW.last_name,
                safe_org, safe_dept, NEW.department_name, NEW.heltes_name, NEW.position_name,
                safe_group, safe_direction
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION bgs_attendance.add_my_org_eelj_group_to_pool(p_exchange_id bigint, p_group_bteg_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
declare
  v_org text;
  v_added int;
begin
  if not (
    public.has_permission(auth.uid(), 'shift_exchange', 'submit')
    or public.has_permission(auth.uid(), 'shift_exchange', 'admin')
  ) then
    raise exception 'Permission denied';
  end if;

  select organization_id into v_org
  from public.eelj_groups
  where sf_guard_group_id = p_group_bteg_id;

  if v_org is null or v_org <> public.current_user_org_id() then
    raise exception 'Зөвхөн өөрийн байгууллагын ээлжийн бүлгийг холбож болно';
  end if;

  insert into bgs_attendance.shift_exchange_groups (shift_exchange_id, group_bteg_id)
  values (p_exchange_id, p_group_bteg_id)
  on conflict (shift_exchange_id, group_bteg_id) do nothing;

  with ins as (
    insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
    select p_exchange_id, null, u.id
    from public.users u
    where u.is_active
      and u.sf_guard_group_id = p_group_bteg_id
      and u.organization_id = v_org
      and not exists (
        select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = p_exchange_id and pa.internal_user_id = u.id
      )
    returning 1
  )
  select count(*)::int into v_added from ins;
  return v_added;
end;
$function$;

-- Deprecated (unused per docs) but kept consistent so it doesn't silently
-- break if ever invoked again.
CREATE OR REPLACE FUNCTION bgs_attendance.auto_assign_group(p_exchange_id bigint, p_group_bteg_id text)
 RETURNS TABLE(assigned integer, pooled integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
declare
  v_assigned int := 0; v_pooled int := 0; w record; v_bus_id bigint;
begin
  if not public.has_permission(auth.uid(),'shift_exchange','admin') then
    raise exception 'Permission denied';
  end if;
  for w in
    select u.id as user_id, u.autobus_direction_id as dir
    from public.users u
    left join public.alba a on a.bteg_id = u.department_id
    left join public.heltes h on h.bteg_id = u.heltes_id
    where u.is_active and u.sf_guard_group_id = p_group_bteg_id
      and not exists (select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = p_exchange_id and pa.internal_user_id = u.id)
    order by a.name nulls last, h.name nulls last, u.last_name, u.first_name
  loop
    select b.id into v_bus_id
    from bgs_attendance.buses b
    join bgs_attendance.bus_routes br on br.bus_id = b.id
    join public.autobus_direction d on d.id = br.direction_id
    where b.shift_exchange_id = p_exchange_id and b.is_active
      and w.dir is not null and d.h_autobus_direction_id = w.dir
      and (select count(*) from bgs_attendance.passenger_assignments pa where pa.bus_id = b.id and pa.is_trip_leader is not true)
          < bgs_attendance.passenger_capacity(b.capacity)
    order by (select count(*) from bgs_attendance.passenger_assignments pa where pa.bus_id = b.id and pa.is_trip_leader is not true) asc, b.id asc
    limit 1;
    if v_bus_id is not null then
      insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
      values (p_exchange_id, v_bus_id, w.user_id);
      v_assigned := v_assigned + 1;
    else
      insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
      values (p_exchange_id, null, w.user_id);
      v_pooled := v_pooled + 1;
    end if;
  end loop;
  assigned := v_assigned; pooled := v_pooled; return next;
end;
$function$;

CREATE OR REPLACE FUNCTION bgs_attendance.auto_distribute_pool(p_exchange_id bigint, p_capacity integer DEFAULT 45)
 RETURNS TABLE(buses_created integer, assigned integer, still_pooled integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
declare
  v_dir_str  text;
  v_created  int := 0;
  v_assigned int := 0;
  v_cap      int;
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
    select d.id as dir_uuid, d.h_autobus_direction_id as dir_bteg, d.name as dir_name
    from bgs_attendance.passenger_assignments pa
    join public.users u on u.id = pa.internal_user_id
    join public.autobus_direction d
      on d.h_autobus_direction_id = coalesce(pa.autobus_direction_id, u.autobus_direction_id)
    where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
    group by d.id, d.h_autobus_direction_id, d.name
  loop
    for unit in
      -- companion бүлгүүд: эхэлж (sz>1), хооронд нь minid-ээр
      select array_agg(pa.id order by pa.id) as ids, count(*)::int as sz,
             lpad(min(pa.id)::text, 12, '0') as sort_key
      from bgs_attendance.passenger_assignments pa
      join public.users u on u.id = pa.internal_user_id
      join bgs_attendance.companion_group_members cgm on cgm.internal_user_id = pa.internal_user_id
      where pa.shift_exchange_id = p_exchange_id and pa.bus_id is null
        and coalesce(pa.autobus_direction_id, u.autobus_direction_id) = r.dir_bteg
      group by cgm.group_id
      union all
      -- бүлэггүй ганц хүн: алба → хэлтэс → нэрээр
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
          select count(*) into v_seq
          from bgs_attendance.buses bus
          join bgs_attendance.bus_routes br on br.bus_id = bus.id
          where bus.shift_exchange_id = p_exchange_id and br.direction_id = r.dir_uuid;
          v_seq := v_seq + 1;
          insert into bgs_attendance.buses (shift_exchange_id, direction, name, capacity)
          values (p_exchange_id, v_dir_str, coalesce(r.dir_name, 'Чиглэл') || ' ' || v_seq, p_capacity)
          returning id into v_bus_id;
          v_created := v_created + 1;
          insert into bgs_attendance.bus_routes (bus_id, direction_id, stop_order) values (v_bus_id, r.dir_uuid, 1);

          if v_sz <= v_cap then
            update bgs_attendance.passenger_assignments set bus_id = v_bus_id where id = any(v_ids);
            v_assigned := v_assigned + v_sz;
            v_ids := array[]::bigint[];
          else
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
$function$;

CREATE OR REPLACE FUNCTION bgs_attendance.bulk_assign_passengers(p_bus_id bigint, p_eelj_group_bteg_id text, p_direction_ids uuid[] DEFAULT NULL::uuid[], p_order_by_alba boolean DEFAULT true)
 RETURNS TABLE(inserted integer, skipped_capacity integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
declare
  v_shift_exchange_id bigint; v_capacity int; v_current int; v_remaining int; v_dir_bteg text[];
begin
  select shift_exchange_id, capacity into v_shift_exchange_id, v_capacity
  from bgs_attendance.buses where id = p_bus_id;
  if v_shift_exchange_id is null then raise exception 'Bus not found: %', p_bus_id; end if;

  select count(*) into v_current
  from bgs_attendance.passenger_assignments where bus_id = p_bus_id and is_trip_leader is not true;
  v_remaining := greatest(bgs_attendance.passenger_capacity(v_capacity) - v_current, 0);

  select array_agg(d.h_autobus_direction_id) into v_dir_bteg
  from public.autobus_direction d
  where d.id = any (coalesce(nullif(p_direction_ids, '{}'::uuid[]),
    (select array_agg(direction_id) from bgs_attendance.bus_routes where bus_id = p_bus_id)));

  with cand as (
    select u.id as user_id,
      row_number() over (order by
        case when p_order_by_alba then a.name end nulls last,
        h.name nulls last, u.last_name, u.first_name) as rn
    from public.users u
    left join public.alba a on a.bteg_id = u.department_id
    left join public.heltes h on h.bteg_id = u.heltes_id
    where u.is_active and u.sf_guard_group_id = p_eelj_group_bteg_id
      and (v_dir_bteg is null or u.autobus_direction_id = any (v_dir_bteg))
      and not exists (select 1 from bgs_attendance.passenger_assignments pa
        where pa.shift_exchange_id = v_shift_exchange_id and pa.internal_user_id = u.id)
  ),
  ins as (
    insert into bgs_attendance.passenger_assignments (shift_exchange_id, bus_id, internal_user_id)
    select v_shift_exchange_id, p_bus_id, user_id from cand where rn <= v_remaining
    returning 1
  )
  select (select count(*)::int from ins), (select count(*)::int from cand where rn > v_remaining)
  into inserted, skipped_capacity;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION bgs_attendance.set_assignment_direction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.internal_user_id IS NOT NULL THEN
    SELECT u.bteg_id,
           COALESCE(NEW.autobus_direction_id, u.autobus_direction_id)
      INTO NEW.bteg_id, NEW.autobus_direction_id
    FROM public.users u
    WHERE u.id = NEW.internal_user_id;
  END IF;

  IF NEW.autobus_direction_id IS NOT NULL THEN
    SELECT ad.zam_tsag
      INTO NEW.zam_tsag
    FROM public.autobus_direction ad
    WHERE ad.h_autobus_direction_id = NEW.autobus_direction_id;
  END IF;

  IF NEW.shift_exchange_id IS NOT NULL THEN
    SELECT se.eelj_id
      INTO NEW.h_eelj_soliltsoo_id
    FROM bgs_attendance.shift_exchanges se
    WHERE se.id = NEW.shift_exchange_id;
  END IF;

  RETURN NEW;
END;
$function$;
