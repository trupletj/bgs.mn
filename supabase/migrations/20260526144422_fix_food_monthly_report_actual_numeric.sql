create or replace function public.get_food_monthly_report(p_month date)
returns table (
  report_month date,
  dining_hall_id bigint,
  dining_hall_name text,
  org_name text,
  dep_name text,
  heltes_name text,
  meal_type text,
  expected_count bigint,
  actual_count numeric,
  manual_override_total bigint,
  extra_serving_total bigint,
  wrong_location_total bigint
)
language sql
stable
set search_path = public
as $$
  select
    date_trunc('month', fr.report_date)::date as report_month,
    fr.dining_hall_id,
    dh.name::text as dining_hall_name,
    fr.org_name,
    fr.dep_name,
    fr.heltes_name,
    fr.meal_type,
    sum(fr.expected_count)::bigint as expected_count,
    sum(fr.actual_count)::numeric as actual_count,
    sum(fr.manual_override_total)::bigint as manual_override_total,
    sum(fr.extra_serving_total)::bigint as extra_serving_total,
    sum(fr.wrong_location_total)::bigint as wrong_location_total
  from public.food_report_daily_snapshot fr
  left join public.dining_hall dh on dh.id = fr.dining_hall_id
  where fr.report_date >= date_trunc('month', p_month)::date
    and fr.report_date < (date_trunc('month', p_month)::date + interval '1 month')
  group by 1, 2, 3, 4, 5, 6, 7
  order by 3 nulls last, 4, 7;
$$;

revoke execute on function public.get_food_monthly_report(date) from public, anon;
grant execute on function public.get_food_monthly_report(date) to authenticated;
