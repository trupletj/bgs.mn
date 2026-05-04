create table if not exists public.policy_scope_targets (
  id bigserial primary key,
  policy_id text not null,
  target_type text not null check (target_type in ('heltes', 'alba')),
  target_bteg_id text not null,
  target_name text,
  parent_bteg_id text,
  created_at timestamp with time zone default now(),
  unique (policy_id, target_type, target_bteg_id)
);

create index if not exists idx_policy_scope_targets_policy
  on public.policy_scope_targets(policy_id);

create index if not exists idx_policy_scope_targets_target
  on public.policy_scope_targets(target_type, target_bteg_id);

grant all on table public.policy_scope_targets to authenticated;
grant all on table public.policy_scope_targets to service_role;

grant all on sequence public.policy_scope_targets_id_seq to authenticated;
grant all on sequence public.policy_scope_targets_id_seq to service_role;
