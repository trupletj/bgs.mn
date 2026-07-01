-- 1.3/1.4 — grants, RLS policies, permission seed
GRANT ALL ON ALL TABLES    IN SCHEMA bgs_attendance TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bgs_attendance TO authenticated;

ALTER TABLE bgs_attendance.shift_exchanges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.buses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.bus_routes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.external_companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.external_operators     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.external_passengers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.passenger_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bgs_attendance.attendance_logs        ENABLE ROW LEVEL SECURITY;

-- HR admin: full access
CREATE POLICY se_admin_all ON bgs_attendance.shift_exchanges
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY bus_admin_all ON bgs_attendance.buses
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY br_admin_all ON bgs_attendance.bus_routes
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY ec_admin_all ON bgs_attendance.external_companies
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY eo_admin_all ON bgs_attendance.external_operators
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY ep_admin_all ON bgs_attendance.external_passengers
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY pa_admin_all ON bgs_attendance.passenger_assignments
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));
CREATE POLICY al_admin_all ON bgs_attendance.attendance_logs
  FOR ALL USING (public.has_permission(auth.uid(),'shift_exchange','admin'))
  WITH CHECK (public.has_permission(auth.uid(),'shift_exchange','admin'));

-- Viewers (shift_exchange/view): read-only
CREATE POLICY se_view_select ON bgs_attendance.shift_exchanges
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));
CREATE POLICY bus_view_select ON bgs_attendance.buses
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));
CREATE POLICY br_view_select ON bgs_attendance.bus_routes
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));
CREATE POLICY ec_view_select ON bgs_attendance.external_companies
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));
CREATE POLICY ep_view_select ON bgs_attendance.external_passengers
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));
CREATE POLICY pa_view_select ON bgs_attendance.passenger_assignments
  FOR SELECT USING (public.has_permission(auth.uid(),'shift_exchange','view'));

-- Trip Leader: read own bus + its passengers
CREATE POLICY bus_trip_leader_select ON bgs_attendance.buses
  FOR SELECT USING (trip_leader_id = public.current_user_id());
CREATE POLICY pa_trip_leader_select ON bgs_attendance.passenger_assignments
  FOR SELECT USING (
    bus_id IN (SELECT id FROM bgs_attendance.buses
               WHERE trip_leader_id = public.current_user_id())
  );

-- External Operator: manage own company's passengers + read own operator row
CREATE POLICY ep_external_operator_all ON bgs_attendance.external_passengers
  FOR ALL USING (
    company_id IN (
      SELECT eo.company_id FROM bgs_attendance.external_operators eo
      JOIN public.profile p ON p.id = eo.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT eo.company_id FROM bgs_attendance.external_operators eo
      JOIN public.profile p ON p.id = eo.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );
CREATE POLICY eo_external_operator_select ON bgs_attendance.external_operators
  FOR SELECT USING (
    profile_id IN (SELECT id FROM public.profile WHERE auth_user_id = auth.uid())
  );

-- Permission seed (id has no default; compute next, idempotent)
INSERT INTO public.permissions (id, description, module, action)
SELECT (SELECT COALESCE(max(id),0) FROM public.permissions) + 1,
       'Ээлж солилцоо — бүрэн админ эрх', 'shift_exchange', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE module='shift_exchange' AND action='admin');

INSERT INTO public.permissions (id, description, module, action)
SELECT (SELECT COALESCE(max(id),0) FROM public.permissions) + 1,
       'Ээлж солилцоо — харах эрх', 'shift_exchange', 'view'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE module='shift_exchange' AND action='view');
