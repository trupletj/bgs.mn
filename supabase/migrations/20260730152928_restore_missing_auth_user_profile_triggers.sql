-- The trigger bindings on auth.users for profile auto-provisioning were lost
-- (likely during the self-host cutover / Postgres upgrade) even though the
-- underlying functions survived. Recreate them so every new OTP sign-in gets
-- a public.profile row immediately, instead of crashing SiteHeader for users
-- with no profile.
--
-- Applied by hand on supa.bgs.mn on 2026-07-30 after confirming via
-- pg_trigger that auth.users had zero non-internal triggers, which left 45+
-- phone-OTP sign-ins since 2026-07-21 without a profile row.
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_from_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_profile
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_from_auth_user();

-- Backfill: create/refresh profile rows for every existing auth user that
-- has a phone number, matching public.users by phone for name/position/dept.
SELECT public.create_profiles_for_existing_auth_users();
