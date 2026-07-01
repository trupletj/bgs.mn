-- Хамтрагч бүлэг (companion group): хүн дээр тогтмол наалддаг глобал бүлэг.
-- Ухаалаг хуваарилалт нэг бүлгийн гишүүдийг (ижил чиглэлд) нэг автобусанд хадгална.
create table if not exists bgs_attendance.companion_groups (
  id bigserial primary key,
  name text not null,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create table if not exists bgs_attendance.companion_group_members (
  id bigserial primary key,
  group_id bigint not null references bgs_attendance.companion_groups(id) on delete cascade,
  internal_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (internal_user_id)
);
create index if not exists idx_cgm_group on bgs_attendance.companion_group_members(group_id);

alter table bgs_attendance.companion_groups enable row level security;
alter table bgs_attendance.companion_group_members enable row level security;

create policy cg_admin_all on bgs_attendance.companion_groups
  for all using (public.has_permission(auth.uid(),'shift_exchange','admin'))
  with check (public.has_permission(auth.uid(),'shift_exchange','admin'));
create policy cg_view_select on bgs_attendance.companion_groups
  for select using (public.has_permission(auth.uid(),'shift_exchange','view'));

create policy cgm_admin_all on bgs_attendance.companion_group_members
  for all using (public.has_permission(auth.uid(),'shift_exchange','admin'))
  with check (public.has_permission(auth.uid(),'shift_exchange','admin'));
create policy cgm_view_select on bgs_attendance.companion_group_members
  for select using (public.has_permission(auth.uid(),'shift_exchange','view'));

grant all on bgs_attendance.companion_groups, bgs_attendance.companion_group_members to authenticated;
grant usage, select on sequence bgs_attendance.companion_groups_id_seq to authenticated;
grant usage, select on sequence bgs_attendance.companion_group_members_id_seq to authenticated;
