-- Catch-up migration: public.user_groups existed live on production (supa.bgs.mn / Cloud)
-- but was never recorded as a migration, due to the historical cloud-only DDL workflow.
-- Placed here (before 20260706190000_rename_target_sync_bteg_id_columns.sql, which renames
-- both this table's and eelj_groups' `bteg_id` column) using the pre-rename column/constraint
-- names, matching the table's shape at this point in migration history.

CREATE TABLE public.user_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bteg_id text NOT NULL,
    user_id text,
    group_id text,
    role text,
    organization_id text,
    created_user_id text,
    updated_user_id text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_bteg_id_key UNIQUE (bteg_id);

CREATE INDEX idx_user_groups_group_id ON public.user_groups USING btree (group_id);

CREATE INDEX idx_user_groups_user_id ON public.user_groups USING btree (user_id);

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.eelj_groups(bteg_id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public.user_groups
    ADD CONSTRAINT user_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(bteg_id) ON UPDATE CASCADE ON DELETE SET NULL;
