alter table public.food_report_daily_snapshot enable row level security;

drop policy if exists "Authenticated users can read food report snapshots"
  on public.food_report_daily_snapshot;

create policy "Authenticated users can read food report snapshots"
  on public.food_report_daily_snapshot
  for select
  to authenticated
  using (true);

revoke all on public.food_report_daily_snapshot from anon;
revoke all on public.food_report_daily_snapshot from public;
grant select on public.food_report_daily_snapshot to authenticated;

revoke execute on function public.snapshot_food_report_day(date, boolean) from public, anon, authenticated;
revoke execute on function public.snapshot_due_food_reports() from public, anon, authenticated;
revoke execute on function public.get_food_monthly_report(date) from public, anon;
grant execute on function public.get_food_monthly_report(date) to authenticated;
