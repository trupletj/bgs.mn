
  create table "target"."sf_guard_user_group" (
    "user_id" bigint,
    "role" text,
    "created_user_id" bigint,
    "organization_id" bigint,
    "group_id" bigint,
    "updated_at" timestamp without time zone,
    "id" bigint not null,
    "created_at" timestamp without time zone,
    "updated_user_id" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
      );


CREATE UNIQUE INDEX sf_guard_user_group_pkey ON target.sf_guard_user_group USING btree (id);

alter table "target"."sf_guard_user_group" add constraint "sf_guard_user_group_pkey" PRIMARY KEY using index "sf_guard_user_group_pkey";


