-- Зорчигч өөрийн хуваарилалтын мэдээллээ харах боломжгүй байсныг засна.
-- Одоо байгаа SELECT policy-ууд зөвхөн admin / submit (org) / trip leader / view
-- эрхтэй хүнд л зөвшөөрдөг тул энгийн зорчигч өөрийн мөрөө уншиж чаддаггүй байв.

-- Зорчигч өөрийн хуваарилалтаа (pool эсвэл автобусанд) харна.
create policy pa_self_select
  on bgs_attendance.passenger_assignments
  for select
  to authenticated
  using (internal_user_id = (select public.current_user_id()));

-- Зорчигч өөрийн суусан автобусныхаа мэдээллийг (нэр, явах цаг г.м) харна.
create policy bus_self_passenger_select
  on bgs_attendance.buses
  for select
  to authenticated
  using (
    exists (
      select 1
      from bgs_attendance.passenger_assignments pa
      where pa.bus_id = buses.id
        and pa.internal_user_id = (select public.current_user_id())
    )
  );
