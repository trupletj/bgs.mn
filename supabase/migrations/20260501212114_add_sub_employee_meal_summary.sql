alter table public.daily_meal_summary
  add column if not exists sub_employee_total integer default 0;

create or replace function public.refresh_daily_meal_summary()
returns void
language plpgsql
as $$
begin
    insert into public.daily_meal_summary (
        date,
        dining_hall_id,
        breakfast_count,
        morning_meal_count,
        lunch_count,
        dinner_count,
        night_meal_count,
        extend_morning_count,
        extend_lunch_count,
        manual_override_total,
        extra_serving_total,
        wrong_location_total,
        sub_employee_total,
        grand_total,
        updated_at
    )
    select
        date,
        dining_hall_id,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'breakfast'), 0) as breakfast_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'morning_meal'), 0) as morning_meal_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'lunch'), 0) as lunch_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'dinner'), 0) as dinner_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'night_meal'), 0) as night_meal_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'extend_morning_meal'), 0) as extend_morning_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'extend_lunch'), 0) as extend_lunch_count,
        count(*) filter (where is_manual_override = true) as manual_override_total,
        count(*) filter (where is_extra_serving = true) as extra_serving_total,
        count(*) filter (where is_wrong_location = true) as wrong_location_total,
        count(*) filter (where sub_employee_id is not null) as sub_employee_total,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end), 0) as grand_total,
        now()
    from public.meal_logs
    where date >= current_date - interval '1 day'
    group by date, dining_hall_id
    on conflict (date, dining_hall_id)
    do update set
        breakfast_count = excluded.breakfast_count,
        morning_meal_count = excluded.morning_meal_count,
        lunch_count = excluded.lunch_count,
        dinner_count = excluded.dinner_count,
        night_meal_count = excluded.night_meal_count,
        extend_morning_count = excluded.extend_morning_count,
        extend_lunch_count = excluded.extend_lunch_count,
        manual_override_total = excluded.manual_override_total,
        extra_serving_total = excluded.extra_serving_total,
        wrong_location_total = excluded.wrong_location_total,
        sub_employee_total = excluded.sub_employee_total,
        grand_total = excluded.grand_total,
        updated_at = now();
end;
$$;
