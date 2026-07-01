-- Hardening per Supabase advisor findings

-- 1) Pin search_path on trigger functions authored for this feature
ALTER FUNCTION public.handle_h_autobus_direction_sync() SET search_path = public;
ALTER FUNCTION bgs_attendance.set_updated_at() SET search_path = '';
ALTER FUNCTION public.handle_sf_guard_user_sync() SET search_path = public;

-- 2) Enable RLS on the new public lookup table (read-only reference data).
ALTER TABLE public.autobus_direction ENABLE ROW LEVEL SECURITY;
CREATE POLICY autobus_direction_read ON public.autobus_direction
  FOR SELECT TO authenticated USING (true);

-- 3) Only `authenticated` should call these RPCs (not anon/public)
REVOKE EXECUTE ON FUNCTION public.current_user_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION bgs_attendance.check_bus_capacity(bigint) FROM anon, public;
REVOKE EXECUTE ON FUNCTION bgs_attendance.bulk_assign_passengers(bigint, text, uuid[], boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION bgs_attendance.transfer_passenger(bigint, bigint) FROM anon, public;
