alter table public.policy_revision_targets
add column if not exists change_action text not null default 'updated';

alter table public.policy_revision_targets
drop constraint if exists policy_revision_targets_change_action_check;

alter table public.policy_revision_targets
add constraint policy_revision_targets_change_action_check
check (change_action in ('updated', 'added', 'invalidated', 'deleted'));
