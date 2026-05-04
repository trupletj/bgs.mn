create index if not exists idx_section_policy_active
  on public.section(policy_id)
  where is_deleted = false;

create index if not exists idx_clause_policy_active
  on public.clause(policy_id)
  where is_deleted = false;

create index if not exists idx_clause_section_active
  on public.clause(section_id)
  where is_deleted = false;

create index if not exists idx_clause_parent_active
  on public.clause(parent_id)
  where is_deleted = false;

create index if not exists idx_clause_job_position_clause
  on public.clause_job_position(clause_id);
