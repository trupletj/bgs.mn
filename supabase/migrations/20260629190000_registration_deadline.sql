-- Гадаад компанийн төлөөлөгчийн бүртгэх/устгах эцсийн хугацаа = exchange_date - 2 өдөр.
-- HR тодорхой огноо хүртэл түр нээж болно (registration_override_until). Хугацаа нь
-- зөвхөн submit (төлөөлөгч)-д үйлчилнэ; admin хэзээ ч засна.
alter table bgs_attendance.shift_exchanges
  add column if not exists registration_override_until timestamptz;

create or replace function bgs_attendance.rep_can_register(p_exchange_id bigint)
returns boolean
language sql
stable
security definer
set search_path = bgs_attendance, public
as $$
  select e.status = 'published'
     and coalesce(e.open_for_registration, false)
     and case
           when e.registration_override_until is not null
             then now() <= e.registration_override_until
           else (now() at time zone 'Asia/Ulaanbaatar')::date <= (e.exchange_date - 2)
         end
  from bgs_attendance.shift_exchanges e
  where e.id = p_exchange_id;
$$;

revoke execute on function bgs_attendance.rep_can_register(bigint) from anon;
grant  execute on function bgs_attendance.rep_can_register(bigint) to authenticated;

-- submit RPC-д хугацааны шалгалт нэмнэ (admin биш бол).
create or replace function bgs_attendance.submit_passengers_to_pool(
  p_shift_exchange_id bigint, p_user_ids uuid[]
)
returns table(inserted integer, skipped integer)
language plpgsql security definer set search_path to 'bgs_attendance', 'public'
as $$
declare v_org text;
begin
  if not (public.has_permission(auth.uid(),'shift_exchange','submit')
          or public.has_permission(auth.uid(),'shift_exchange','admin')) then
    raise exception 'Permission denied';
  end if;
  if not public.has_permission(auth.uid(),'shift_exchange','admin')
     and not bgs_attendance.rep_can_register(p_shift_exchange_id) then
    raise exception 'Бүртгэлийн хугацаа дууссан байна';
  end if;
  v_org := public.current_user_org_id();
  if v_org is null then raise exception 'Хэрэглэгчид байгууллага алга'; end if;

  with valid as (
    select u.id from public.users u
    where u.id = any (p_user_ids) and u.organization_id = v_org and u.is_active
  ),
  ins as (
    insert into bgs_attendance.passenger_assignments
      (shift_exchange_id, bus_id, internal_user_id, submitted_by)
    select p_shift_exchange_id, null, v.id, public.current_user_id() from valid v
    on conflict (shift_exchange_id, internal_user_id) do nothing
    returning 1
  )
  select (select count(*)::int from ins),
         (select count(*)::int from unnest(p_user_ids)) - (select count(*)::int from ins)
  into inserted, skipped;
  return next;
end;
$$;

-- Төлөөлөгчийн устгах policy-д хугацааны шалгалт нэмнэ.
drop policy if exists pa_submit_delete on bgs_attendance.passenger_assignments;
create policy pa_submit_delete on bgs_attendance.passenger_assignments
for delete
using (
  public.has_permission(auth.uid(), 'shift_exchange', 'submit')
  and not is_confirmed
  and bgs_attendance.rep_can_register(shift_exchange_id)
  and exists (
    select 1 from public.users tu
    where tu.id = passenger_assignments.internal_user_id
      and tu.organization_id = public.current_user_org_id()
  )
);
