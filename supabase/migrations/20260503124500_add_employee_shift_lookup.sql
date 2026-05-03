create or replace function public.get_employee_shift_for_modal(p_bteg_id text)
returns table (
  day_date date,
  start_at timestamp without time zone,
  end_at timestamp without time zone,
  current_group_name text,
  shift_type text,
  is_working boolean
)
language plpgsql
security definer
set search_path = public, target
as $$
begin
  return query
  with local_clock as (
    select
      (now() at time zone 'Asia/Ulaanbaatar')::timestamp as local_now,
      (now() at time zone 'Asia/Ulaanbaatar')::date as today,
      (now() at time zone 'Asia/Ulaanbaatar')::time as local_time
  ),
  candidate_shifts as (
    select
      w.day_date::date as day_date,
      w.start_at,
      w.end_at,
      w.current_group_name::text as current_group_name,
      case
        when lc.local_now between w.start_at and w.end_at then 0
        when w.start_at::date < w.end_at::date
          and w.end_at::date = lc.today
          and lc.local_time < time '15:00'
        then 1
        when w.day_date::date = lc.today then 2
        else 3
      end as shift_priority,
      lc.local_now
    from target.vw_worker_day_log_14d w
    cross join local_clock lc
    where w.worker_id::text = p_bteg_id
  )
  select
    cs.day_date,
    cs.start_at,
    cs.end_at,
    cs.current_group_name,
    case
      when extract(hour from cs.start_at) between 7 and 8
        and extract(hour from cs.end_at) between 18 and 20
        and cs.start_at::date = cs.end_at::date
      then 'Өдрийн ээлж'
      when extract(hour from cs.start_at) between 18 and 20
        and extract(hour from cs.end_at) between 7 and 12
        and cs.start_at::date < cs.end_at::date
      then 'Шөнийн ээлж'
      when extract(hour from cs.start_at) between 12 and 13
        and extract(hour from cs.end_at) between 19 and 20
      then 'Өдрийн дунд ээлж'
      when extract(hour from cs.start_at) between 12 and 13
        and extract(hour from cs.end_at) between 7 and 8
        and cs.start_at::date < cs.end_at::date
      then 'Урт шөнийн ээлж'
      else 'Тодорхойгүй ээлж'
    end as shift_type,
    (cs.local_now between cs.start_at and cs.end_at) as is_working
  from candidate_shifts cs
  order by cs.shift_priority asc, cs.start_at desc
  limit 1;
end;
$$;

grant execute on function public.get_employee_shift_for_modal(text) to anon;
grant execute on function public.get_employee_shift_for_modal(text) to authenticated;
grant execute on function public.get_employee_shift_for_modal(text) to service_role;
