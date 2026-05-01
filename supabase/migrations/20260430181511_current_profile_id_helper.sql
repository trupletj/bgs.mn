-- public.current_profile_id()
--
-- RLS policy дотор `profile_id IN (SELECT id FROM profile WHERE auth_user_id = auth.uid())`
-- хэлбэрийн subquery-г товч `profile_id = public.current_profile_id()` хэлбэр болгоход
-- ашиглана. `auth_user_id` дээр UNIQUE constraint (`profile_auth_user_id_key`) байгаа
-- тул lookup нь нэг index hit.

create or replace function public.current_profile_id()
returns bigint
language sql
stable
security invoker
set search_path = public, auth
as $$
  select id
  from public.profile
  where auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_profile_id() to authenticated;
