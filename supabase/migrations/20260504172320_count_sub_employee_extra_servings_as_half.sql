alter table public.food_report_daily_snapshot
  alter column actual_count type numeric using actual_count::numeric,
  alter column actual_count set default 0;

do $$
declare
  v_sql text;
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

  v_sql := replace(
    v_sql,
    'actual_count bigint)',
    'actual_count numeric)'
  );

  v_sql := replace(
    v_sql,
    'ml.sub_employee_id IS NOT NULL AS is_sub_employee,',
    'ml.sub_employee_id IS NOT NULL AS is_sub_employee,

            ml.is_extra_serving,'
  );

  v_sql := replace(
    v_sql,
    '          AND ml.is_extra_serving = false',
    ''
  );

  v_sql := replace(
    v_sql,
    'COUNT(DISTINCT ar.id)::bigint AS act_count',
    'COALESCE(SUM(CASE WHEN ar.is_extra_serving THEN 0.5 ELSE 1 END), 0)::numeric AS act_count'
  );

  v_sql := replace(
    v_sql,
    'COALESCE(a.act_count, 0)::bigint AS actual_count',
    'COALESCE(a.act_count, 0)::numeric AS actual_count'
  );

  drop function public.get_meal_expected_vs_actual(date, integer);
  execute v_sql;
end;
$$;

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(p.oid)
  into v_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'snapshot_food_report_day'
    and pg_get_function_arguments(p.oid) like 'p_date date, p_force boolean%';

  if v_sql is null then
    raise exception 'Function public.snapshot_food_report_day(date, boolean) not found';
  end if;

  v_sql := replace(
    v_sql,
    'sum(actual_count)::bigint as actual_count',
    'sum(actual_count)::numeric as actual_count'
  );

  v_sql := replace(
    v_sql,
    'coalesce(ea.actual_count, 0)::bigint as actual_count',
    'coalesce(ea.actual_count, 0)::numeric as actual_count'
  );

  execute v_sql;
end;
$$;

do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(p.oid)
  into v_sql
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_food_monthly_report'
    and pg_get_function_arguments(p.oid) = 'p_month date';

  if v_sql is null then
    raise exception 'Function public.get_food_monthly_report(date) not found';
  end if;

  v_sql := replace(
    v_sql,
    'actual_count bigint,',
    'actual_count numeric,'
  );

  v_sql := replace(
    v_sql,
    'sum(fr.actual_count)::bigint AS actual_count',
    'sum(fr.actual_count)::numeric AS actual_count'
  );

  drop function public.get_food_monthly_report(date);
  execute v_sql;
end;
$$;

grant execute on function public.get_meal_expected_vs_actual(date, integer) to anon, authenticated;
grant execute on function public.get_food_monthly_report(date) to authenticated;
