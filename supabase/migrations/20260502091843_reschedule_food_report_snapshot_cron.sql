do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'snapshot-food-report-daily';

    perform cron.schedule(
      'snapshot-food-report-daily',
      '0 18 * * *',
      'select public.snapshot_due_food_reports();'
    );
  end if;
end;
$$;
