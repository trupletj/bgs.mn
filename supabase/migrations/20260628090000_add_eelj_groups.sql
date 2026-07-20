-- Catch-up migration: public.eelj_groups existed live on production (supa.bgs.mn / Cloud)
-- but was never recorded as a migration, due to the historical cloud-only DDL workflow.
-- Placed here (before 20260628153347_link_eelj_groups_auto_assign.sql) since that migration
-- adds a hard FK referencing this table.
--
-- Uses the pre-rename column/constraint names (`bteg_id`), matching the table's shape as of
-- this point in migration history — 20260706190000_rename_target_sync_bteg_id_columns.sql
-- later renames it to `sf_guard_group_id`, same as it does on the real production timeline.

CREATE TABLE public.eelj_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bteg_id text NOT NULL,
    name text,
    description text,
    cheif_id text,
    organization_id text,
    created_user_id text,
    updated_user_id text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);

ALTER TABLE ONLY public.eelj_groups
    ADD CONSTRAINT eelj_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.eelj_groups
    ADD CONSTRAINT eelj_groups_bteg_id_key UNIQUE (bteg_id);
