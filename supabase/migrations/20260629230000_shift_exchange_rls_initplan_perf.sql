-- Гүйцэтгэлийн сайжруулалт: RLS бодлогууд auth.uid()/has_permission()-ийг МӨР БҮРТ
-- дахин тооцдог байсныг (select ...)-д ороож НЭГ УДАА (initplan) тооцдог болгов.
-- Логик яг хэвээр — зөвхөн тооцоолох тоо буурна. Мөр-хамааралтай (current_user_on_bus(id),
-- rep_can_register(shift_exchange_id)) хэсгийг хэвээр үлдээв.

-- attendance_logs
drop policy if exists al_admin_all on bgs_attendance.attendance_logs;
create policy al_admin_all on bgs_attendance.attendance_logs for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));

-- bus_routes
drop policy if exists br_admin_all on bgs_attendance.bus_routes;
create policy br_admin_all on bgs_attendance.bus_routes for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists br_passenger_select on bgs_attendance.bus_routes;
create policy br_passenger_select on bgs_attendance.bus_routes for select
  using (bus_id in (select pa.bus_id from bgs_attendance.passenger_assignments pa
    where pa.internal_user_id = (select public.current_user_id()) and pa.bus_id is not null));
drop policy if exists br_view_select on bgs_attendance.bus_routes;
create policy br_view_select on bgs_attendance.bus_routes for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));

-- buses
drop policy if exists bus_admin_all on bgs_attendance.buses;
create policy bus_admin_all on bgs_attendance.buses for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists bus_trip_leader_select on bgs_attendance.buses;
create policy bus_trip_leader_select on bgs_attendance.buses for select
  using (trip_leader_id = (select public.current_user_id()));
drop policy if exists bus_view_select on bgs_attendance.buses;
create policy bus_view_select on bgs_attendance.buses for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));

-- companion_group_members
drop policy if exists cgm_admin_all on bgs_attendance.companion_group_members;
create policy cgm_admin_all on bgs_attendance.companion_group_members for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists cgm_view_select on bgs_attendance.companion_group_members;
create policy cgm_view_select on bgs_attendance.companion_group_members for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));

-- companion_groups
drop policy if exists cg_admin_all on bgs_attendance.companion_groups;
create policy cg_admin_all on bgs_attendance.companion_groups for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists cg_view_select on bgs_attendance.companion_groups;
create policy cg_view_select on bgs_attendance.companion_groups for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));

-- passenger_assignments
drop policy if exists pa_admin_all on bgs_attendance.passenger_assignments;
create policy pa_admin_all on bgs_attendance.passenger_assignments for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists pa_self_select on bgs_attendance.passenger_assignments;
create policy pa_self_select on bgs_attendance.passenger_assignments for select
  using (internal_user_id = (select public.current_user_id()));
drop policy if exists pa_view_select on bgs_attendance.passenger_assignments;
create policy pa_view_select on bgs_attendance.passenger_assignments for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));
drop policy if exists pa_submit_select on bgs_attendance.passenger_assignments;
create policy pa_submit_select on bgs_attendance.passenger_assignments for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','submit'))
    and exists (select 1 from public.users tu
      where tu.id = passenger_assignments.internal_user_id
        and tu.organization_id = (select public.current_user_org_id())));
drop policy if exists pa_trip_leader_select on bgs_attendance.passenger_assignments;
create policy pa_trip_leader_select on bgs_attendance.passenger_assignments for select
  using (bus_id in (select buses.id from bgs_attendance.buses
    where buses.trip_leader_id = (select public.current_user_id())));
drop policy if exists pa_submit_insert on bgs_attendance.passenger_assignments;
create policy pa_submit_insert on bgs_attendance.passenger_assignments for insert
  with check ((select public.has_permission(auth.uid(),'shift_exchange','submit'))
    and (bus_id is null)
    and exists (select 1 from public.users tu
      where tu.id = passenger_assignments.internal_user_id
        and tu.organization_id = (select public.current_user_org_id())));
drop policy if exists pa_submit_delete on bgs_attendance.passenger_assignments;
create policy pa_submit_delete on bgs_attendance.passenger_assignments for delete
  using ((select public.has_permission(auth.uid(),'shift_exchange','submit'))
    and (not is_confirmed)
    and bgs_attendance.rep_can_register(shift_exchange_id)
    and exists (select 1 from public.users tu
      where tu.id = passenger_assignments.internal_user_id
        and tu.organization_id = (select public.current_user_org_id())));

-- shift_exchange_groups
drop policy if exists seg_admin_all on bgs_attendance.shift_exchange_groups;
create policy seg_admin_all on bgs_attendance.shift_exchange_groups for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists seg_view_select on bgs_attendance.shift_exchange_groups;
create policy seg_view_select on bgs_attendance.shift_exchange_groups for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));

-- shift_exchanges
drop policy if exists se_admin_all on bgs_attendance.shift_exchanges;
create policy se_admin_all on bgs_attendance.shift_exchanges for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists se_passenger_select on bgs_attendance.shift_exchanges;
create policy se_passenger_select on bgs_attendance.shift_exchanges for select
  using (id in (select b.shift_exchange_id from bgs_attendance.buses b
    join bgs_attendance.passenger_assignments pa on pa.bus_id = b.id
    where pa.internal_user_id = (select public.current_user_id()) and pa.bus_id is not null));
drop policy if exists se_submit_select on bgs_attendance.shift_exchanges;
create policy se_submit_select on bgs_attendance.shift_exchanges for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','submit')) and (status = 'published'));
drop policy if exists se_view_select on bgs_attendance.shift_exchanges;
create policy se_view_select on bgs_attendance.shift_exchanges for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));

-- trip_leaders
drop policy if exists tl_admin_all on bgs_attendance.trip_leaders;
create policy tl_admin_all on bgs_attendance.trip_leaders for all
  using ((select public.has_permission(auth.uid(),'shift_exchange','admin')))
  with check ((select public.has_permission(auth.uid(),'shift_exchange','admin')));
drop policy if exists tl_passenger_select on bgs_attendance.trip_leaders;
create policy tl_passenger_select on bgs_attendance.trip_leaders for select
  using (bus_id in (select pa.bus_id from bgs_attendance.passenger_assignments pa
    where pa.internal_user_id = (select public.current_user_id()) and pa.bus_id is not null));
drop policy if exists tl_self_select on bgs_attendance.trip_leaders;
create policy tl_self_select on bgs_attendance.trip_leaders for select
  using (bteg_id = (select public.current_bteg_id())::text);
drop policy if exists tl_view_select on bgs_attendance.trip_leaders;
create policy tl_view_select on bgs_attendance.trip_leaders for select
  using ((select public.has_permission(auth.uid(),'shift_exchange','view')));
