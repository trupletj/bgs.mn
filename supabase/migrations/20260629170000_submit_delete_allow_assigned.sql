-- Гэрээт компанийн төлөөлөгч өөрийн байгууллагын зорчигчийг автобусанд
-- хуваарилагдсан байсан ч устгаж чадна (баталгаажаагүй бол). bus_id IS NULL нөхцөл
-- хассан — устгахад зорчигч автобуснаас бүрэн хасагдана.
drop policy if exists pa_submit_delete on bgs_attendance.passenger_assignments;

create policy pa_submit_delete on bgs_attendance.passenger_assignments
for delete
using (
  public.has_permission(auth.uid(), 'shift_exchange', 'submit')
  and not is_confirmed
  and exists (
    select 1 from public.users tu
    where tu.id = passenger_assignments.internal_user_id
      and tu.organization_id = public.current_user_org_id()
  )
);
