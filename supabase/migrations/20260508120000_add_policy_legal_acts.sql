create table if not exists public.legal_acts (
  id uuid primary key default gen_random_uuid(),
  act_type text not null check (act_type in ('03', '04')),
  act_number text not null,
  act_date date not null,
  title text not null,
  body_text text,
  notes text,
  created_by bigint references public.profile(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_deleted boolean not null default false
);

create table if not exists public.legal_act_attachments (
  id uuid primary key default gen_random_uuid(),
  legal_act_id uuid not null references public.legal_acts(id) on delete cascade,
  bucket text not null default 'policy-legal-acts',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.policy_revisions (
  id uuid primary key default gen_random_uuid(),
  legal_act_id uuid not null references public.legal_acts(id) on delete cascade,
  policy_id uuid not null references public.policy(id),
  summary text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.policy_revision_targets (
  id uuid primary key default gen_random_uuid(),
  policy_revision_id uuid not null references public.policy_revisions(id) on delete cascade,
  target_type text not null check (target_type in ('policy', 'section', 'clause')),
  policy_id uuid references public.policy(id),
  section_id uuid references public.section(id),
  clause_id uuid references public.clause(id),
  change_note text,
  created_at timestamp with time zone not null default now(),
  constraint policy_revision_target_matches_type check (
    (target_type = 'policy' and policy_id is not null and section_id is null and clause_id is null)
    or
    (target_type = 'section' and section_id is not null and clause_id is null)
    or
    (target_type = 'clause' and clause_id is not null)
  )
);

create index if not exists idx_legal_acts_type_date
  on public.legal_acts(act_type, act_date desc)
  where is_deleted = false;

create index if not exists idx_legal_act_attachments_act
  on public.legal_act_attachments(legal_act_id);

create index if not exists idx_policy_revisions_policy
  on public.policy_revisions(policy_id);

create index if not exists idx_policy_revisions_legal_act
  on public.policy_revisions(legal_act_id);

create index if not exists idx_policy_revision_targets_revision
  on public.policy_revision_targets(policy_revision_id);

create index if not exists idx_policy_revision_targets_policy
  on public.policy_revision_targets(policy_id);

create index if not exists idx_policy_revision_targets_section
  on public.policy_revision_targets(section_id);

create index if not exists idx_policy_revision_targets_clause
  on public.policy_revision_targets(clause_id);

create or replace function public.set_legal_acts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists legal_acts_updated_at on public.legal_acts;
create trigger legal_acts_updated_at
  before update on public.legal_acts
  for each row
  execute function public.set_legal_acts_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-legal-acts',
  'policy-legal-acts',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.legal_acts enable row level security;
alter table public.legal_act_attachments enable row level security;
alter table public.policy_revisions enable row level security;
alter table public.policy_revision_targets enable row level security;

drop policy if exists "Policy users can read legal acts" on public.legal_acts;
create policy "Policy users can read legal acts"
  on public.legal_acts
  for select
  to authenticated
  using (public.has_permission(auth.uid(), 'policy', 'access'));

drop policy if exists "Policy creators can create legal acts" on public.legal_acts;
create policy "Policy creators can create legal acts"
  on public.legal_acts
  for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'policy', 'create'));

drop policy if exists "Policy editors can update legal acts" on public.legal_acts;
create policy "Policy editors can update legal acts"
  on public.legal_acts
  for update
  to authenticated
  using (public.has_permission(auth.uid(), 'policy', 'edit'))
  with check (public.has_permission(auth.uid(), 'policy', 'edit'));

drop policy if exists "Policy users can read legal act attachments" on public.legal_act_attachments;
create policy "Policy users can read legal act attachments"
  on public.legal_act_attachments
  for select
  to authenticated
  using (public.has_permission(auth.uid(), 'policy', 'access'));

drop policy if exists "Policy creators can create legal act attachments" on public.legal_act_attachments;
create policy "Policy creators can create legal act attachments"
  on public.legal_act_attachments
  for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'policy', 'create'));

drop policy if exists "Policy users can read policy revisions" on public.policy_revisions;
create policy "Policy users can read policy revisions"
  on public.policy_revisions
  for select
  to authenticated
  using (public.has_permission(auth.uid(), 'policy', 'access'));

drop policy if exists "Policy creators can create policy revisions" on public.policy_revisions;
create policy "Policy creators can create policy revisions"
  on public.policy_revisions
  for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'policy', 'create'));

drop policy if exists "Policy users can read policy revision targets" on public.policy_revision_targets;
create policy "Policy users can read policy revision targets"
  on public.policy_revision_targets
  for select
  to authenticated
  using (public.has_permission(auth.uid(), 'policy', 'access'));

drop policy if exists "Policy creators can create policy revision targets" on public.policy_revision_targets;
create policy "Policy creators can create policy revision targets"
  on public.policy_revision_targets
  for insert
  to authenticated
  with check (public.has_permission(auth.uid(), 'policy', 'create'));

drop policy if exists "Policy users can read legal act files" on storage.objects;
create policy "Policy users can read legal act files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'policy-legal-acts'
    and public.has_permission(auth.uid(), 'policy', 'access')
  );

drop policy if exists "Policy creators can upload legal act files" on storage.objects;
create policy "Policy creators can upload legal act files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'policy-legal-acts'
    and public.has_permission(auth.uid(), 'policy', 'create')
  );

drop policy if exists "Policy editors can replace legal act files" on storage.objects;
create policy "Policy editors can replace legal act files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'policy-legal-acts'
    and public.has_permission(auth.uid(), 'policy', 'edit')
  )
  with check (
    bucket_id = 'policy-legal-acts'
    and public.has_permission(auth.uid(), 'policy', 'edit')
  );

grant select, insert, update on public.legal_acts to authenticated;
grant select, insert on public.legal_act_attachments to authenticated;
grant select, insert on public.policy_revisions to authenticated;
grant select, insert on public.policy_revision_targets to authenticated;
grant all on public.legal_acts to service_role;
grant all on public.legal_act_attachments to service_role;
grant all on public.policy_revisions to service_role;
grant all on public.policy_revision_targets to service_role;
