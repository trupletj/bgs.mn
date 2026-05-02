alter table public.sub_employee_meal_plans
  add column if not exists morning_meal_count integer default 0;

do $$
declare
  v_sql text;
  v_updated_sql text;
begin
  select pg_get_functiondef(p.oid)
  into v_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_meal_expected_vs_actual'
    and pg_get_function_arguments(p.oid) = 'p_date date, p_hall_id integer';

  if v_sql is null then
    raise exception 'Function public.get_meal_expected_vs_actual(date, integer) not found';
  end if;

  if v_sql not like '%smp.morning_meal_count%' then
    v_updated_sql := regexp_replace(
      v_sql,
      '(SELECT ''breakfast''::text AS meal_type, smp\.breakfast_count::bigint AS cnt\s+WHERE smp\.breakfast_count > 0\s+UNION ALL\s+)(SELECT ''lunch''::text, smp\.lunch_count::bigint\s+WHERE smp\.lunch_count > 0)',
      E'\\1SELECT ''morning_meal''::text, coalesce(smp.morning_meal_count, 0)::bigint\n            WHERE coalesce(smp.morning_meal_count, 0) > 0\n\n            UNION ALL\n            \\2',
      'n'
    );

    if v_updated_sql = v_sql then
      raise exception 'Could not patch sub_employee_meal_plans morning_meal_count into get_meal_expected_vs_actual';
    end if;

    execute v_updated_sql;
  end if;
end;
$$;

alter function public.get_meal_expected_vs_actual(date, integer)
  set search_path = public, target;
