


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "bgs_attendance";


ALTER SCHEMA "bgs_attendance" OWNER TO "postgres";


COMMENT ON SCHEMA "bgs_attendance" IS 'Attendance mini-app өөрийн tables/views/RPCs. target.* шууд биш энэ schema дамжуулж уншина.';



CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "target";


ALTER SCHEMA "target" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."eelj_request_status" AS ENUM (
    'requested',
    'approved',
    'force_approved',
    'rejected'
);


ALTER TYPE "public"."eelj_request_status" OWNER TO "postgres";


CREATE TYPE "public"."meal_type_enum" AS ENUM (
    'breakfast',
    'lunch',
    'dinner',
    'nightmeal',
    'morning_meal',
    'snack'
);


ALTER TYPE "public"."meal_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "bgs_attendance"."get_my_roster_overview"("p_today" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target', 'auth'
    AS $$
DECLARE
  v_bteg_id        bigint;
  v_calendar_start date := p_today - 14;
  v_calendar_end   date := p_today + 14;
  v_lookback_start date := p_today - 28;
  v_lookback_end   date := p_today + 28;
  v_group_name     text := '';
  v_pattern        text;
  v_today_row      target.vw_worker_day_log_14d%ROWTYPE;
  v_today_found    boolean;
  v_phase          text;
  v_today_type     text;
  v_today_state    text;
  v_today_label    text;
  v_days_into      int;
  v_days_remain    int;
  v_phase_start    date;
  v_phase_end      date;
  v_next_start     date;
  v_worker         jsonb;
  v_today          jsonb;
  v_cycle          jsonb;
  v_calendar       jsonb;
BEGIN
  v_bteg_id := public.current_bteg_id();
  IF v_bteg_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'fullName',
      btrim(coalesce(u.last_name, '') || ' ' || upper(coalesce(u.first_name, ''))),
    'position',   coalesce(u.position_name, '—'),
    'department', coalesce(u.department_name, ''),
    'shiftGroup', coalesce(u.heltes_name, '')
  )
  INTO v_worker
  FROM public.users u
  WHERE u.bteg_id = v_bteg_id::text;

  SELECT * INTO v_today_row
  FROM target.vw_worker_day_log_14d v
  WHERE v.worker_id = v_bteg_id AND v.day_date::date = p_today
  LIMIT 1;
  v_today_found := FOUND;

  v_group_name := coalesce(v_today_row.current_group_name, '');

  v_pattern := CASE
    WHEN v_group_name ILIKE '%өдөр шөнө%' THEN 'day-then-night'
    ELSE 'day-only'
  END;

  IF NOT v_today_found OR v_today_row.start_at IS NULL THEN
    v_today_type  := NULL;
    v_today_state := 'resting';
    v_today_label := 'Амралт';
  ELSE
    v_today_type := CASE
      WHEN v_today_row.start_at::time > v_today_row.end_at::time THEN 'night'
      ELSE 'day'
    END;
    v_today_label := CASE v_today_type
      WHEN 'day'   THEN 'Өдрийн ээлж'
      WHEN 'night' THEN 'Шөнийн ээлж'
    END;
    v_today_state := CASE
      WHEN v_today_row.is_ert_tarsan THEN 'early-left'
      WHEN v_today_row.is_hotsorson  THEN 'late'
      WHEN v_today_row.work_start_at IS NOT NULL
       AND v_today_row.work_end_at  IS NOT NULL
       AND v_today_row.work_end_at  > v_today_row.work_start_at + interval '1 minute'
       THEN 'finished'
      WHEN v_today_row.work_start_at IS NOT NULL THEN 'active'
      ELSE 'not-checked-in'
    END;
  END IF;

  v_today := jsonb_build_object(
    'type',           v_today_type,
    'label',          v_today_label,
    'scheduledStart', to_char(v_today_row.start_at,     'YYYY-MM-DD"T"HH24:MI:SS'),
    'scheduledEnd',   to_char(v_today_row.end_at,       'YYYY-MM-DD"T"HH24:MI:SS'),
    'actualStart',    to_char(v_today_row.work_start_at,'YYYY-MM-DD"T"HH24:MI:SS'),
    'actualEnd',      to_char(v_today_row.work_end_at,  'YYYY-MM-DD"T"HH24:MI:SS'),
    'workedMinutes',  CASE
      WHEN v_today_row.work_duration IS NULL THEN NULL
      ELSE v_today_row.work_duration * 60
    END,
    'state',          v_today_state
  );

  WITH window_days AS (
    SELECT g::date AS d FROM generate_series(p_today - 13, p_today + 13, '1 day') g
  ),
  labeled AS (
    SELECT
      w.d,
      CASE
        WHEN v.start_at IS NOT NULL AND (
               v.day_date::date >= p_today
               OR v.work_start_at IS NOT NULL
               OR coalesce(v.udur_tsag_ajil, 0) + coalesce(v.shunu_tsag_ajil, 0) > 0
             )
        THEN true
        ELSE false
      END AS on_duty
    FROM window_days w
    LEFT JOIN target.vw_worker_day_log_14d v
      ON v.worker_id = v_bteg_id AND v.day_date::date = w.d
  ),
  prev_step AS (
    SELECT d, on_duty, LAG(on_duty) OVER (ORDER BY d) AS prev_od FROM labeled
  ),
  grouped AS (
    SELECT
      d, on_duty,
      SUM(CASE WHEN on_duty IS DISTINCT FROM prev_od THEN 1 ELSE 0 END) OVER (ORDER BY d) AS grp
    FROM prev_step
  ),
  today_grp AS (
    SELECT grp, on_duty FROM grouped WHERE d = p_today
  ),
  phase_range AS (
    SELECT min(d) AS pstart, max(d) AS pend, max(on_duty::int) AS od
    FROM grouped
    WHERE grp = (SELECT grp FROM today_grp)
  )
  SELECT
    CASE WHEN od = 1 THEN 'on-duty' ELSE 'off-duty' END,
    (p_today - pstart + 1)::int,
    (pend - p_today)::int,
    pstart,
    pend
  INTO v_phase, v_days_into, v_days_remain, v_phase_start, v_phase_end
  FROM phase_range;

  v_phase        := coalesce(v_phase, 'off-duty');
  v_days_into    := coalesce(v_days_into, 1);
  v_days_remain  := coalesce(v_days_remain, 0);
  v_phase_start  := coalesce(v_phase_start, p_today);
  v_phase_end    := coalesce(v_phase_end, p_today);
  v_next_start   := v_phase_end + 1;

  v_cycle := jsonb_build_object(
    'pattern',            v_pattern,
    'cycleStart',         to_char(v_phase_start, 'YYYY-MM-DD'),
    'cycleDay',           v_days_into,
    'phase',              v_phase,
    'phaseStart',         to_char(v_phase_start, 'YYYY-MM-DD'),
    'phaseEnd',           to_char(v_phase_end,   'YYYY-MM-DD'),
    'daysIntoPhase',      v_days_into,
    'daysRemainingPhase', v_days_remain,
    'nextPhaseStart',     to_char(v_next_start,  'YYYY-MM-DD'),
    'nextPhaseLabel',     CASE v_phase
                            WHEN 'on-duty' THEN 'Амралт эхэлнэ'
                            ELSE 'Ажилд гарна'
                          END
  );

  WITH big_series AS (
    SELECT g::date AS d FROM generate_series(v_lookback_start, v_lookback_end, '1 day') g
  ),
  raw AS (
    SELECT
      s.d,
      v.start_at,
      v.end_at,
      v.work_start_at,
      v.work_end_at,
      v.work_duration,
      v.is_hotsorson,
      v.is_ert_tarsan,
      CASE
        WHEN v.start_at IS NOT NULL AND (
               s.d >= p_today
               OR v.work_start_at IS NOT NULL
               OR coalesce(v.udur_tsag_ajil, 0) + coalesce(v.shunu_tsag_ajil, 0) > 0
             )
        THEN true
        ELSE false
      END AS on_duty,
      CASE
        WHEN v.start_at IS NULL THEN NULL
        WHEN v.start_at::time > v.end_at::time THEN 'night'
        ELSE 'day'
      END AS shift_type
    FROM big_series s
    LEFT JOIN target.vw_worker_day_log_14d v
      ON v.worker_id = v_bteg_id AND v.day_date::date = s.d
  ),
  with_neighbors AS (
    SELECT *,
      LAG(on_duty)  OVER (ORDER BY d) AS prev_od,
      LEAD(on_duty) OVER (ORDER BY d) AS next_od
    FROM raw
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date',         to_char(d, 'YYYY-MM-DD'),
      'dayOfMonth',   extract(day FROM d)::int,
      'dayLabel',     (ARRAY['Ня','Да','Мя','Лх','Пү','Ба','Бя'])
                        [extract(dow FROM d)::int + 1],
      'phase',        CASE WHEN on_duty THEN 'on-duty' ELSE 'off-duty' END,
      'shiftType',    shift_type,
      'isToday',      d = p_today,
      'isCycleStart', d = v_phase_start,
      'transition',   CASE
        WHEN on_duty = true AND coalesce(prev_od, false) = false THEN 'arrival'
        WHEN on_duty = true AND coalesce(next_od, false) = false THEN 'departure'
        ELSE NULL
      END,
      'isLate',       coalesce(is_hotsorson, false),
      'isEarlyLeft',  coalesce(is_ert_tarsan, false),
      'scheduledStart', to_char(start_at,      'YYYY-MM-DD"T"HH24:MI:SS'),
      'scheduledEnd',   to_char(end_at,        'YYYY-MM-DD"T"HH24:MI:SS'),
      'actualStart',    to_char(work_start_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'actualEnd',      to_char(work_end_at,   'YYYY-MM-DD"T"HH24:MI:SS'),
      'workedMinutes',  CASE
        WHEN work_duration IS NULL THEN NULL
        ELSE work_duration * 60
      END
    )
    ORDER BY d
  )
  INTO v_calendar
  FROM with_neighbors
  WHERE d BETWEEN v_calendar_start AND v_calendar_end;

  RETURN jsonb_build_object(
    'worker',   coalesce(v_worker, jsonb_build_object(
                  'fullName',   'Ажилтан',
                  'position',   '—',
                  'department', '',
                  'shiftGroup', v_group_name
                )),
    'today',    v_today,
    'cycle',    v_cycle,
    'calendar', coalesce(v_calendar, '[]'::jsonb)
  );
END;
$$;


ALTER FUNCTION "bgs_attendance"."get_my_roster_overview"("p_today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_attendance_correction_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reviewer_id bigint;
  v_row public.attendance_correction_requests%ROWTYPE;
BEGIN
  v_reviewer_id := public.current_profile_id();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-01: Reviewer profile олдсонгүй';
  END IF;
  IF NOT public.has_permission(auth.uid(), 'attendance', 'review') THEN
    RAISE EXCEPTION 'EX-ATT-05: Хяналтын эрхгүй';
  END IF;

  SELECT * INTO v_row
  FROM public.attendance_correction_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-06: Хүсэлт олдсонгүй';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'EX-ATT-06: Хүсэлт хүлээгдэх төлвөөс өөр төлөвт байна';
  END IF;
  IF v_row.profile_id = v_reviewer_id THEN
    RAISE EXCEPTION 'EX-ATT-04: Өөрийнхөө хүсэлтийг хянах боломжгүй';
  END IF;

  INSERT INTO public.attendance_corrections (
    profile_id, bteg_id, day_date,
    start_at, end_at,
    created_from_request_id, created_by_profile_id
  ) VALUES (
    v_row.profile_id, v_row.bteg_id, v_row.day_date,
    v_row.requested_start_at, v_row.requested_end_at,
    v_row.id, v_reviewer_id
  )
  ON CONFLICT (bteg_id, day_date) DO UPDATE
    SET start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        created_from_request_id = EXCLUDED.created_from_request_id,
        created_by_profile_id = EXCLUDED.created_by_profile_id,
        created_at = now();

  UPDATE public.attendance_correction_requests
     SET status = 'approved',
         reviewed_by_profile_id = v_reviewer_id,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.attendance_correction_status_history (
    request_id, from_status, to_status, actor_profile_id
  ) VALUES (
    p_request_id, 'pending', 'approved', v_reviewer_id
  );
END;
$$;


ALTER FUNCTION "public"."approve_attendance_correction_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_autobus_request"("p_request_id" bigint, "p_force" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
declare
  v_bteg_id bigint;
  v_profile_id bigint;
  v_autobus_user_id bigint;
  v_autobus_id bigint;
begin
  v_bteg_id := public.current_bteg_id();
  v_profile_id := public.current_profile_id();
  if v_bteg_id is null or v_profile_id is null then
    raise exception 'Эрх олгох эрхгүй';
  end if;

  select r.autobus_id into v_autobus_id
  from public.user_autobus_request r
  where r.id = p_request_id;
  if v_autobus_id is null then
    raise exception 'Хүсэлт олдсонгүй';
  end if;

  select a.user_id into v_autobus_user_id
  from target.h_autobus a
  where a.id = v_autobus_id;
  if v_autobus_user_id is distinct from v_bteg_id then
    raise exception 'Та энэ машины ахлах биш байна';
  end if;

  update public.user_autobus_request
  set status = case when p_force
                    then 'force_approved'::public.eelj_request_status
                    else 'approved'::public.eelj_request_status end,
      decided_at = now(),
      decided_by_profile_id = v_profile_id,
      decision_reason = null
  where id = p_request_id;
end;
$$;


ALTER FUNCTION "public"."approve_autobus_request"("p_request_id" bigint, "p_force" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."broadcast_notification"("p_title" "text", "p_message" "text", "p_type" "text" DEFAULT 'info'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_count integer;
begin
  if not has_permission(auth.uid(), 'notification', 'create') then
    raise exception 'permission denied';
  end if;

  insert into public.notifications (profile_id, title, message, type)
  select id, p_title, p_message, coalesce(p_type, 'info')
  from public.profile;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."broadcast_notification"("p_title" "text", "p_message" "text", "p_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_attendance_correction_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id bigint;
  v_row public.attendance_correction_requests%ROWTYPE;
BEGIN
  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-01: Profile олдсонгүй';
  END IF;

  SELECT * INTO v_row
  FROM public.attendance_correction_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-06: Хүсэлт олдсонгүй';
  END IF;
  IF v_row.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'EX-ATT-05: Зөвхөн өөрийн хүсэлтийг цуцлах боломжтой';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'EX-ATT-06: Хүсэлт хүлээгдэх төлвөөс өөр төлөвт байна';
  END IF;

  UPDATE public.attendance_correction_requests
     SET status = 'cancelled',
         updated_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.attendance_correction_status_history (
    request_id, from_status, to_status, actor_profile_id
  ) VALUES (
    p_request_id, 'pending', 'cancelled', v_profile_id
  );
END;
$$;


ALTER FUNCTION "public"."cancel_attendance_correction_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_attendance_correction_request"("p_day_date" "date", "p_requested_start_at" timestamp with time zone, "p_requested_end_at" timestamp with time zone, "p_reason" "text", "p_attachment_url" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id bigint;
  v_bteg_id bigint;
  v_original_start timestamptz;
  v_original_end timestamptz;
  v_request_id uuid;
BEGIN
  v_profile_id := public.current_profile_id();
  v_bteg_id := public.current_bteg_id();

  IF v_profile_id IS NULL OR v_bteg_id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-01: Intranet bteg_id олдсонгүй';
  END IF;

  IF p_day_date > current_date THEN
    RAISE EXCEPTION 'EX-ATT-02: Зөвхөн өнгөрсөн өдөр';
  END IF;
  IF p_day_date < current_date - interval '30 days' THEN
    RAISE EXCEPTION 'EX-ATT-02: Зөвхөн сүүлийн 30 хоног';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance_correction_requests
    WHERE profile_id = v_profile_id
      AND day_date = p_day_date
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'EX-ATT-03: Энэ өдөрт хүлээгдэж буй хүсэлт байна';
  END IF;

  SELECT work_start_at, work_end_at
    INTO v_original_start, v_original_end
  FROM public.get_worker_attendance(v_bteg_id)
  WHERE day_date = p_day_date
  LIMIT 1;

  INSERT INTO public.attendance_correction_requests (
    profile_id, bteg_id, day_date,
    original_start_at, original_end_at,
    requested_start_at, requested_end_at,
    reason, attachment_url,
    status
  ) VALUES (
    v_profile_id, v_bteg_id, p_day_date,
    v_original_start, v_original_end,
    p_requested_start_at, p_requested_end_at,
    p_reason, p_attachment_url,
    'pending'
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.attendance_correction_status_history (
    request_id, from_status, to_status, actor_profile_id
  ) VALUES (
    v_request_id, NULL, 'pending', v_profile_id
  );

  RETURN v_request_id;
END;
$$;


ALTER FUNCTION "public"."create_attendance_correction_request"("p_day_date" "date", "p_requested_start_at" timestamp with time zone, "p_requested_end_at" timestamp with time zone, "p_reason" "text", "p_attachment_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile_from_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    public_user_record RECORD;
    profile_name TEXT;
    profile_position_name TEXT;
    profile_department_name TEXT;
BEGIN
    SELECT 
        nice_name,
        position_name,
        department_name
    INTO public_user_record
    FROM public.users 
    WHERE phone = NEW.phone;
    
    -- Name-г тохируулах: public.users-н nice_name эсвэл auth users-н мэдээллээр
    IF public_user_record.nice_name IS NOT NULL THEN
        profile_name := public_user_record.nice_name;
    ELSE
        profile_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || 
                       COALESCE(NEW.raw_user_meta_data->>'last_name', '');
        IF TRIM(profile_name) = '' THEN
            profile_name := SPLIT_PART(NEW.email, '@', 1); -- email-н эхний хэсгийг ашиглах
        END IF;
    END IF;
    
    -- Position name болон department name-г тохируулах
    profile_position_name := public_user_record.position_name;
    profile_department_name := public_user_record.department_name;
    
    -- Profile үүсгэх
    INSERT INTO public.profile (
        auth_user_id,
        name,
        phone,
        position_name,
        department_name,
        email
    )
    VALUES (
        NEW.id,
        profile_name,
        NEW.phone,
        profile_position_name,
        profile_department_name,
        NEW.email
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        position_name = EXCLUDED.position_name,
        department_name = EXCLUDED.department_name,
        email = EXCLUDED.email;
    
    RAISE NOTICE 'Profile үүсгэгдлээ/шинэчлэгдлээ: auth_user_id=%, name=%', NEW.id, profile_name;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_profile_from_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profiles_for_existing_auth_users"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    created_count INTEGER;
BEGIN
    -- Бүх auth user-үүдэд profile үүсгэх
    WITH inserted_profiles AS (
        INSERT INTO public.profile (
            auth_user_id,
            name,
            phone,
            position_name,
            department_name,
            email
        )
        SELECT 
            au.id,
            COALESCE(
                pu.nice_name,
                COALESCE(au.raw_user_meta_data->>'first_name', '') || ' ' || 
                COALESCE(au.raw_user_meta_data->>'last_name', ''),
                SPLIT_PART(au.email, '@', 1)
            ) as name,
            au.phone,
            pu.position_name,
            pu.department_name,
            au.email
        FROM auth.users au
        LEFT JOIN public.users pu ON au.phone = pu.phone
        WHERE au.phone IS NOT NULL
        ON CONFLICT (auth_user_id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            position_name = EXCLUDED.position_name,
            department_name = EXCLUDED.department_name,
            email = EXCLUDED.email
        RETURNING 1
    )
    SELECT COUNT(*) INTO created_count FROM inserted_profiles;
    
    RAISE NOTICE 'Үүсгэгдсэн/шинэчлэгдсэн profile-үүдийн тоо: %', created_count;
    
    RETURN created_count;
END;
$$;


ALTER FUNCTION "public"."create_profiles_for_existing_auth_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_bteg_id"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target', 'auth'
    AS $$
  select sgu.id
  from public.profile p
  join target.sf_guard_user sgu
    on sgu.phone = p.phone
   and sgu.is_active = true
  where p.auth_user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."current_bteg_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_profile_id"() RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'auth'
    AS $$
  select id
  from public.profile
  where auth_user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."current_profile_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_profile_on_auth_user_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Profile устгах
    DELETE FROM public.profile WHERE auth_user_id = OLD.id;
    
    RAISE NOTICE 'Profile устгагдлаа: auth_user_id=%', OLD.id;
    
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_profile_on_auth_user_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_auth_trigger"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    EXECUTE 'ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created';
END;
$$;


ALTER FUNCTION "public"."disable_auth_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_shift_for_modal"("p_bteg_id" "text") RETURNS TABLE("day_date" "date", "start_at" timestamp without time zone, "end_at" timestamp without time zone, "current_group_name" "text", "shift_type" "text", "is_working" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
begin
  return query
  with local_clock as (
    select
      (now() at time zone 'Asia/Ulaanbaatar')::timestamp as local_now,
      (now() at time zone 'Asia/Ulaanbaatar')::date as today,
      (now() at time zone 'Asia/Ulaanbaatar')::time as local_time
  ),
  candidate_shifts as (
    select
      w.day_date::date as day_date,
      w.start_at,
      w.end_at,
      w.current_group_name::text as current_group_name,
      case
        when lc.local_now between w.start_at and w.end_at then 0
        when w.start_at::date < w.end_at::date
          and w.end_at::date = lc.today
          and lc.local_time < time '15:00'
        then 1
        when w.day_date::date = lc.today then 2
        else 3
      end as shift_priority,
      lc.local_now
    from target.vw_worker_day_log_14d w
    cross join local_clock lc
    where w.worker_id::text = p_bteg_id
  )
  select
    cs.day_date,
    cs.start_at,
    cs.end_at,
    cs.current_group_name,
    case
      when extract(hour from cs.start_at) between 7 and 8
        and extract(hour from cs.end_at) between 18 and 20
        and cs.start_at::date = cs.end_at::date
      then 'Өдрийн ээлж'
      when extract(hour from cs.start_at) between 18 and 20
        and extract(hour from cs.end_at) between 7 and 12
        and cs.start_at::date < cs.end_at::date
      then 'Шөнийн ээлж'
      when extract(hour from cs.start_at) between 12 and 13
        and extract(hour from cs.end_at) between 19 and 20
      then 'Өдрийн дунд ээлж'
      when extract(hour from cs.start_at) between 12 and 13
        and extract(hour from cs.end_at) between 7 and 8
        and cs.start_at::date < cs.end_at::date
      then 'Урт шөнийн ээлж'
      else 'Тодорхойгүй ээлж'
    end as shift_type,
    (cs.local_now between cs.start_at and cs.end_at) as is_working
  from candidate_shifts cs
  order by cs.shift_priority asc, cs.start_at desc
  limit 1;
end;
$$;


ALTER FUNCTION "public"."get_employee_shift_for_modal"("p_bteg_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_food_daily_report"("p_month" "date") RETURNS TABLE("report_date" "date", "dining_hall_id" integer, "dining_hall_name" "text", "org_name" "text", "dep_name" "text", "heltes_name" "text", "meal_type" "text", "expected_count" bigint, "actual_count" numeric, "manual_override_total" bigint, "extra_serving_total" bigint, "wrong_location_total" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    fr.report_date,
    fr.dining_hall_id,
    dh.name::text,
    fr.org_name,
    fr.dep_name,
    fr.heltes_name,
    fr.meal_type,
    fr.expected_count::bigint,
    fr.actual_count::numeric,
    fr.manual_override_total::bigint,
    fr.extra_serving_total::bigint,
    fr.wrong_location_total::bigint
  FROM public.food_report_daily_snapshot fr
  LEFT JOIN public.dining_hall dh ON dh.id = fr.dining_hall_id
  WHERE fr.report_date >= date_trunc('month', p_month)::date
    AND fr.report_date <  date_trunc('month', p_month)::date + interval '1 month'
  ORDER BY fr.report_date, fr.dining_hall_id, fr.org_name;
$$;


ALTER FUNCTION "public"."get_food_daily_report"("p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_food_monthly_report"("p_month" "date") RETURNS TABLE("report_month" "date", "dining_hall_id" bigint, "dining_hall_name" "text", "org_name" "text", "dep_name" "text", "heltes_name" "text", "meal_type" "text", "expected_count" bigint, "actual_count" numeric, "manual_override_total" bigint, "extra_serving_total" bigint, "wrong_location_total" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    date_trunc('month', fr.report_date)::date as report_month,
    fr.dining_hall_id,
    dh.name::text as dining_hall_name,
    fr.org_name,
    fr.dep_name,
    fr.heltes_name,
    fr.meal_type,
    sum(fr.expected_count)::bigint as expected_count,
    sum(fr.actual_count)::numeric as actual_count,
    sum(fr.manual_override_total)::bigint as manual_override_total,
    sum(fr.extra_serving_total)::bigint as extra_serving_total,
    sum(fr.wrong_location_total)::bigint as wrong_location_total
  from public.food_report_daily_snapshot fr
  left join public.dining_hall dh on dh.id = fr.dining_hall_id
  where fr.report_date >= date_trunc('month', p_month)::date
    and fr.report_date < (date_trunc('month', p_month)::date + interval '1 month')
  group by 1, 2, 3, 4, 5, 6, 7
  order by 3 nulls last, 4, 7;
$$;


ALTER FUNCTION "public"."get_food_monthly_report"("p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_food_report_finalized_dates"("p_month" "date") RETURNS TABLE("report_date" "date")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT DISTINCT report_date
  FROM public.food_report_daily_snapshot
  WHERE report_date >= date_trunc('month', p_month)::date
    AND report_date <  date_trunc('month', p_month)::date + interval '1 month'
  ORDER BY report_date;
$$;


ALTER FUNCTION "public"."get_food_report_finalized_dates"("p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meal_breakdown_by_org"("p_date" "date", "p_hall_id" integer) RETURNS TABLE("org_name" "text", "dep_name" "text", "heltes_name" "text", "total_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(o.name, u.organization_id, 'Байгууллага тодорхойгүй') AS org_name,
        COALESCE(a.name, u.department_name, 'Алба тодорхойгүй') AS dep_name,
        COALESCE(h.name, u.heltes_name, 'Хэлтэс тодорхойгүй') AS heltes_name,
        COUNT(ml.id) AS total_count
    FROM meal_logs ml
    LEFT JOIN users u ON (ml.user_id = u.id OR (ml.user_id IS NULL AND ml.bteg_id = u.bteg_id))
    LEFT JOIN organization o ON u.organization_id = o.bteg_id
    LEFT JOIN alba a ON u.department_id = a.bteg_id
    LEFT JOIN heltes h ON u.heltes_id = h.bteg_id
    WHERE ml.date = p_date 
      AND ml.dining_hall_id = p_hall_id
    GROUP BY 1, 2, 3 -- SELECT дээрх эхний 3 талбараар group хийнэ
    ORDER BY total_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_meal_breakdown_by_org"("p_date" "date", "p_hall_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meal_employee_details"("p_date" "date", "p_hall_id" integer, "p_org_name" "text", "p_group_name" "text", "p_group_type" "text", "p_meal_type" "text") RETURNS TABLE("worker_id" "text", "first_name" "text", "last_name" "text", "is_expected" boolean, "has_eaten" boolean, "meal_time" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH
    org_lookup AS (
        SELECT bteg_id, MAX(name)::text AS name
        FROM organization
        GROUP BY bteg_id
    ),

    alba_lookup AS (
        SELECT bteg_id, MAX(name)::text AS name
        FROM alba
        GROUP BY bteg_id
    ),

    heltes_lookup AS (
        SELECT bteg_id, MAX(name)::text AS name
        FROM heltes
        GROUP BY bteg_id
    ),

    working_shifts AS (
        SELECT DISTINCT
            v.worker_id::text AS worker_id,
            EXTRACT(HOUR FROM v.start_at)::int AS start_hour,
            EXTRACT(HOUR FROM v.end_at)::int AS end_hour,
            v.start_at::date AS shift_start_date,
            v.end_at::date AS shift_end_date
        FROM target.vw_worker_day_log_14d v
        WHERE v.start_at::date = p_date
           OR v.end_at::date = p_date
    ),

    previous_day_day_shifts AS (
        SELECT DISTINCT
            v.worker_id::text AS worker_id
        FROM target.vw_worker_day_log_14d v
        WHERE v.start_at::date = p_date - INTERVAL '1 day'
          AND v.end_at::date = p_date - INTERVAL '1 day'
          AND EXTRACT(HOUR FROM v.start_at)::int BETWEEN 7 AND 8
          AND EXTRACT(HOUR FROM v.end_at)::int BETWEEN 18 AND 20
    ),

    active_overrides AS (
        SELECT DISTINCT ON (mlo.user_id, mlo.meal_type::text)
            mlo.user_id,
            mlo.meal_type::text AS meal_type,
            mlo.dining_hall_id
        FROM meal_location_overrides mlo
        WHERE mlo.date = p_date
          AND mlo.is_deleted = false
        ORDER BY mlo.user_id, mlo.meal_type::text, mlo.id DESC
    ),

    expected_users AS (
        SELECT DISTINCT
            u.id AS user_uuid,
            u.bteg_id,
            u.first_name,
            u.last_name,
            COALESCE(o.name, u.organization_id, 'Байгууллага тодорхойгүй') AS org_name,
            COALESCE(a.name, u.department_name, 'Алба тодорхойгүй') AS dep_name,
            COALESCE(h.name, u.heltes_name, 'Хэлтэс тодорхойгүй') AS heltes_name,
            exp.meal_type AS m_type
        FROM users u
        JOIN working_shifts ws
          ON ws.worker_id = u.bteg_id

        LEFT JOIN previous_day_day_shifts pds
          ON pds.worker_id = ws.worker_id

        JOIN LATERAL (
            SELECT umc.*
            FROM user_meal_configs umc
            WHERE umc.user_id = u.id
            LIMIT 1
        ) umc ON true

        LEFT JOIN org_lookup o
          ON o.bteg_id = u.organization_id
        LEFT JOIN alba_lookup a
          ON a.bteg_id = u.department_id
        LEFT JOIN heltes_lookup h
          ON h.bteg_id = u.heltes_id

        CROSS JOIN LATERAL (
            -- 1. Өдрийн стандарт ээлж: 07/08 -> 18/19/20
            SELECT 'breakfast'::text AS meal_type
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour BETWEEN 18 AND 20

            UNION ALL
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour BETWEEN 18 AND 20

            UNION ALL
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour BETWEEN 18 AND 20

            UNION ALL

            -- 2. Богино өдрийн ээлж: 07/08 -> 12
            SELECT 'breakfast'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour = 12

            UNION ALL

            -- 3. Энгийн шөнийн ээлж: 18/19/20 -> next day 07/08
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'night_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'morning_meal'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL

            -- 4. Өдрийн ээлжнээс шөнийн ээлж рүү шилжих үеийн нэмэлт morning_meal
            SELECT 'morning_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8
              AND pds.worker_id IS NOT NULL

            UNION ALL

            -- 5. Сунгасан шөнийн ээлж: 18/19/20 -> next day 12
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'night_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'extend_morning_meal'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'extend_lunch'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL

            -- 6. Зөрж ирж буй 12/13 -> 19/20 ээлж
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 19 AND 20

            UNION ALL
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 19 AND 20

            UNION ALL

            -- 7. 12/13 -> next day 07/08 урт ээлж
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'night_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'morning_meal'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8
        ) exp

        LEFT JOIN active_overrides ovr
          ON ovr.user_id = u.id
         AND ovr.meal_type = exp.meal_type

        WHERE u.is_active = true
          AND (p_meal_type IS NULL OR exp.meal_type = p_meal_type)
          AND (
                (ovr.user_id IS NOT NULL AND ovr.dining_hall_id = p_hall_id)
                OR
                (
                    ovr.user_id IS NULL
                    AND (
                           (exp.meal_type = 'breakfast'           AND umc.breakfast_location    = p_hall_id)
                        OR (exp.meal_type = 'morning_meal'        AND umc.morning_meal_location = p_hall_id)
                        OR (exp.meal_type = 'lunch'               AND umc.lunch_location        = p_hall_id)
                        OR (exp.meal_type = 'dinner'              AND umc.dinner_location       = p_hall_id)
                        OR (exp.meal_type = 'night_meal'          AND umc.night_meal_location   = p_hall_id)
                        OR (exp.meal_type = 'extend_morning_meal' AND umc.morning_meal_location = p_hall_id)
                        OR (exp.meal_type = 'extend_lunch'        AND umc.lunch_location        = p_hall_id)
                    )
                )
          )
    ),

    actual_users AS (
        SELECT DISTINCT ON (ml.id)
            u.id AS user_uuid,
            u.bteg_id,
            u.first_name,
            u.last_name,
            COALESCE(o.name, u.organization_id, 'Байгууллага тодорхойгүй') AS org_name,
            COALESCE(a.name, u.department_name, 'Алба тодорхойгүй') AS dep_name,
            COALESCE(h.name, u.heltes_name, 'Хэлтэс тодорхойгүй') AS heltes_name,
            ml.meal_type::text AS m_type,
            ml.scanned_at
        FROM meal_logs ml

        LEFT JOIN LATERAL (
            SELECT u1.*
            FROM users u1
            WHERE u1.id = ml.user_id

            UNION ALL

            SELECT u2.*
            FROM users u2
            WHERE ml.user_id IS NULL
              AND ml.sub_employee_id IS NULL
              AND u2.bteg_id = ml.bteg_id

            LIMIT 1
        ) u ON true

        LEFT JOIN org_lookup o
          ON o.bteg_id = u.organization_id
        LEFT JOIN alba_lookup a
          ON a.bteg_id = u.department_id
        LEFT JOIN heltes_lookup h
          ON h.bteg_id = u.heltes_id

        WHERE ml.date = p_date
          AND ml.dining_hall_id = p_hall_id
          AND ml.is_extra_serving = false
          AND ml.sub_employee_id IS NULL
          AND (p_meal_type IS NULL OR ml.meal_type = p_meal_type)
    )

    SELECT
        COALESCE(e.bteg_id, a.bteg_id)::TEXT AS worker_id,
        COALESCE(e.first_name, a.first_name)::TEXT AS first_name,
        COALESCE(e.last_name, a.last_name)::TEXT AS last_name,
        (e.user_uuid IS NOT NULL)::BOOLEAN AS is_expected,
        (a.user_uuid IS NOT NULL)::BOOLEAN AS has_eaten,
        to_char(a.scanned_at, 'HH24:MI:SS')::TEXT AS meal_time
    FROM expected_users e
    FULL OUTER JOIN actual_users a
      ON e.user_uuid = a.user_uuid
     AND e.m_type = a.m_type
    WHERE COALESCE(e.org_name, a.org_name) = p_org_name
      AND (
            (p_group_type = 'alba'
             AND COALESCE(e.dep_name, a.dep_name) = p_group_name)
         OR (p_group_type = 'heltes'
             AND COALESCE(e.heltes_name, a.heltes_name) = p_group_name)
      )
    ORDER BY 5 DESC, 2 ASC;
END;
$$;


ALTER FUNCTION "public"."get_meal_employee_details"("p_date" "date", "p_hall_id" integer, "p_org_name" "text", "p_group_name" "text", "p_group_type" "text", "p_meal_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_meal_expected_vs_actual"("p_date" "date", "p_hall_id" integer) RETURNS TABLE("org_name" "text", "dep_name" "text", "heltes_name" "text", "meal_type" "text", "expected_count" bigint, "actual_count" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
BEGIN
    RETURN QUERY
    WITH
    org_lookup AS (
        SELECT bteg_id, MAX(name)::text AS name
        FROM organization
        GROUP BY bteg_id
    ),

    alba_lookup AS (
        SELECT bteg_id, MAX(name)::text AS name
        FROM alba
        GROUP BY bteg_id
    ),

    heltes_lookup AS (
        SELECT bteg_id, MAX(name)::text AS name
        FROM heltes
        GROUP BY bteg_id
    ),

    /*
      Тухайн өдөртэй холбоотой ээлжүүд:
      - p_date өдөр эхэлсэн ээлж
      - p_date өдөр дууссан ээлж
    */
    working_shifts AS (
        SELECT DISTINCT
            w.worker_id::text                  AS worker_id,
            EXTRACT(HOUR FROM w.start_at)::int AS start_hour,
            EXTRACT(HOUR FROM w.end_at)::int   AS end_hour,
            w.start_at::date                   AS shift_start_date,
            w.end_at::date                     AS shift_end_date,
            w.start_at                         AS shift_start_ts,
            w.end_at                           AS shift_end_ts
        FROM target.vw_worker_day_log_14d w
        WHERE w.start_at::date = p_date
           OR w.end_at::date = p_date
    ),

    /*
      Өмнөх өдөр өдрийн ээлжинд ажилласан хүмүүс.

      Энэ нь day shift -> night shift шилжилтийг барихад хэрэгтэй.

      Жишээ:
      2026-04-30 07:00–19:00 ажилласан
      2026-05-01 19:00–2026-05-02 07:00 шөнийн ээлж эхэлсэн

      2026-05-01 өдөр тухайн хүн morning_meal авах ёстой.
    */
    previous_day_day_shifts AS (
        SELECT DISTINCT
            w.worker_id::text AS worker_id
        FROM target.vw_worker_day_log_14d w
        WHERE w.start_at::date = p_date - INTERVAL '1 day'
          AND w.end_at::date   = p_date - INTERVAL '1 day'
          AND EXTRACT(HOUR FROM w.start_at)::int BETWEEN 7 AND 8
          AND EXTRACT(HOUR FROM w.end_at)::int BETWEEN 18 AND 20
    ),

    /*
      Нэг user + нэг өдөр + нэг meal_type дээр хамгийн сүүлийн override-г авна.
    */
    active_overrides AS (
        SELECT DISTINCT ON (mlo.user_id, mlo.meal_type::text)
            mlo.user_id,
            mlo.meal_type::text AS meal_type,
            mlo.dining_hall_id  AS dining_hall_id
        FROM meal_location_overrides mlo
        WHERE mlo.date = p_date
          AND mlo.is_deleted = false
        ORDER BY mlo.user_id, mlo.meal_type::text, mlo.id DESC
    ),

    /*
      Байнгын ажилчдын expected meal үүсгэх хэсэг.
    */
    expected_user_meals AS (
        SELECT DISTINCT
            u.id AS user_id,
            u.organization_id,
            u.department_id,
            u.heltes_id,
            u.department_name,
            u.heltes_name,
            exp.meal_type
        FROM users u
        JOIN working_shifts ws
          ON ws.worker_id = u.bteg_id

        LEFT JOIN previous_day_day_shifts pds
          ON pds.worker_id = ws.worker_id

        JOIN LATERAL (
            SELECT umc.*
            FROM user_meal_configs umc
            WHERE umc.user_id = u.id
            LIMIT 1
        ) umc ON true

        CROSS JOIN LATERAL (
            /*
              1. Өдрийн стандарт ээлж:
              07/08 -> 18/19/20
              breakfast, lunch, dinner
            */
            SELECT 'breakfast'::text AS meal_type
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour BETWEEN 18 AND 20

            UNION ALL
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour BETWEEN 18 AND 20

            UNION ALL
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour BETWEEN 18 AND 20

            UNION ALL

            /*
              2. Өдрийн богино ээлж:
              07/08 -> 12
              breakfast, lunch
            */
            SELECT 'breakfast'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 7 AND 8
              AND ws.end_hour = 12

            UNION ALL

            /*
              3. Энгийн шөнийн ээлж:
              18/19/20 -> next day 07/08

              Эхлэх өдөр:
              dinner, night_meal

              Дуусах өдөр:
              morning_meal
            */
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'night_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'morning_meal'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL

            /*
              4. Өдрийн ээлжнээс шөнийн ээлж рүү шилжих:

              Өмнөх өдөр:
              07/08 -> 18/19/20

              Өнөөдөр:
              18/19/20 -> next day 07/08

              Өнөөдөр нэмэлт morning_meal авна.
            */
            SELECT 'morning_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour BETWEEN 7 AND 8
              AND pds.worker_id IS NOT NULL

            UNION ALL

            /*
              5. Сунгасан шөнийн ээлж:
              18/19/20 -> next day 12

              Эхлэх өдөр:
              dinner, night_meal

              Дуусах өдөр:
              extend_morning_meal, extend_lunch
            */
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'night_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'extend_morning_meal'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL
            SELECT 'extend_lunch'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 18 AND 20
              AND ws.end_hour = 12

            UNION ALL

            /*
              6. Зөрж ирж буй өдрийн дунд ээлж:
              12/13 -> 19/20
              lunch, dinner
            */
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 19 AND 20

            UNION ALL
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 19 AND 20

            UNION ALL

            /*
              7. 12/13 -> next day 07/08 төрлийн урт ээлж байвал:
              эхлэх өдөр lunch, dinner, night_meal
              дуусах өдөр morning_meal
            */
            SELECT 'lunch'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'dinner'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'night_meal'::text
            WHERE ws.shift_start_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

            UNION ALL
            SELECT 'morning_meal'::text
            WHERE ws.shift_end_date = p_date
              AND ws.start_hour BETWEEN 12 AND 13
              AND ws.end_hour BETWEEN 7 AND 8

        ) exp

        LEFT JOIN active_overrides ovr
          ON ovr.user_id = u.id
         AND ovr.meal_type = exp.meal_type

        WHERE u.is_active = true
          AND (
                /*
                  Override байвал зөвхөн override-ийн гал тогоонд тоолно.
                  Ингэснээр үндсэн гал тогооноос автоматаар хасагдана.
                */
                (ovr.user_id IS NOT NULL AND ovr.dining_hall_id = p_hall_id)

                OR

                /*
                  Override байхгүй бол user_meal_configs дээрх үндсэн гал тогоонд тоолно.
                */
                (
                    ovr.user_id IS NULL
                    AND (
                           (exp.meal_type = 'breakfast'           AND umc.breakfast_location    = p_hall_id)
                        OR (exp.meal_type = 'morning_meal'        AND umc.morning_meal_location = p_hall_id)
                        OR (exp.meal_type = 'lunch'               AND umc.lunch_location        = p_hall_id)
                        OR (exp.meal_type = 'dinner'              AND umc.dinner_location       = p_hall_id)
                        OR (exp.meal_type = 'night_meal'          AND umc.night_meal_location   = p_hall_id)
                        OR (exp.meal_type = 'extend_morning_meal' AND umc.morning_meal_location = p_hall_id)
                        OR (exp.meal_type = 'extend_lunch'        AND umc.lunch_location        = p_hall_id)
                    )
                )
          )
    ),

    /*
      Байнгын ажилчдын expected-г байгууллага/алба/хэлтсээр бүлэглэх.
    */
    expected_regular_grouped AS (
        SELECT
            COALESCE(o.name, eum.organization_id, 'Байгууллага тодорхойгүй') AS o_name,
            COALESCE(a.name, eum.department_name, 'Алба тодорхойгүй')        AS d_name,
            COALESCE(h.name, eum.heltes_name, 'Хэлтэс тодорхойгүй')          AS h_name,
            eum.meal_type AS m_type,
            COUNT(*)::bigint AS exp_count
        FROM expected_user_meals eum
        LEFT JOIN org_lookup o ON o.bteg_id = eum.organization_id
        LEFT JOIN alba_lookup a ON a.bteg_id = eum.department_id
        LEFT JOIN heltes_lookup h ON h.bteg_id = eum.heltes_id
        GROUP BY 1, 2, 3, 4
    ),

    /*
      Туслах / гэрээт компанийн expected.

      sub_employee_meal_plans дээр:
      - org_id = туслах компанийн organization.id
      - dining_hall_id = тухайн хооллох гал тогоо
      - date = тухайн өдөр
      - *_count = тухайн хоолны expected тоо
    */
    expected_sub_grouped AS (
        SELECT
            COALESCE(o.name, 'Гэрээт байгууллага тодорхойгүй') AS o_name,
            'Гэрээт'::text AS d_name,
            'Гэрээт'::text AS h_name,
            mt.meal_type AS m_type,
            SUM(mt.cnt)::bigint AS exp_count
        FROM sub_employee_meal_plans smp
        JOIN organization o
          ON o.id = smp.org_id
        CROSS JOIN LATERAL (
            SELECT 'breakfast'::text AS meal_type, smp.breakfast_count::bigint AS cnt
            WHERE smp.breakfast_count > 0

            UNION ALL
            SELECT 'morning_meal'::text, coalesce(smp.morning_meal_count, 0)::bigint
            WHERE coalesce(smp.morning_meal_count, 0) > 0

            UNION ALL
            SELECT 'lunch'::text, smp.lunch_count::bigint
            WHERE smp.lunch_count > 0

            UNION ALL
            SELECT 'dinner'::text, smp.dinner_count::bigint
            WHERE smp.dinner_count > 0

            UNION ALL
            SELECT 'night_meal'::text, smp.night_meal_count::bigint
            WHERE smp.night_meal_count > 0
        ) mt
        WHERE smp.date = p_date
          AND smp.dining_hall_id = p_hall_id
        GROUP BY 1, 2, 3, 4
    ),

    expected_final AS (
        SELECT
            o_name,
            d_name,
            h_name,
            m_type,
            SUM(exp_count)::bigint AS exp_count
        FROM (
            SELECT * FROM expected_regular_grouped
            UNION ALL
            SELECT * FROM expected_sub_grouped
        ) x
        GROUP BY 1, 2, 3, 4
    ),

    /*
      Actual meal_logs-г user эсвэл sub_employee гэж ялгана.

      Байнгын ажилтан:
      - ml.user_id байгаа бол users.id
      - user_id байхгүй бол ml.bteg_id = users.bteg_id

      Гэрээт ажилтан:
      - ml.sub_employee_id байгаа бол sub_employee_for_food.id
      - тухайн sub_employee_for_food.org_id -> organization.id
    */
    actual_resolved AS (
        SELECT
            ml.id,
            ml.meal_type::text AS meal_type,

            ml.sub_employee_id IS NOT NULL AS is_sub_employee,

            ml.is_extra_serving,

            u.organization_id,
            u.department_id,
            u.heltes_id,
            u.department_name,
            u.heltes_name,

            sub_org.name::text AS sub_org_name
        FROM meal_logs ml

        LEFT JOIN LATERAL (
            SELECT u1.*
            FROM users u1
            WHERE u1.id = ml.user_id

            UNION ALL

            SELECT u2.*
            FROM users u2
            WHERE ml.user_id IS NULL
              AND ml.sub_employee_id IS NULL
              AND u2.bteg_id = ml.bteg_id

            LIMIT 1
        ) u ON true

        LEFT JOIN sub_employee_for_food sef
          ON sef.id = ml.sub_employee_id

        LEFT JOIN organization sub_org
          ON sub_org.id = sef.org_id

        WHERE ml.date = p_date
          AND ml.dining_hall_id = p_hall_id

    ),

    actual_final AS (
        SELECT
            CASE
                WHEN ar.is_sub_employee
                    THEN COALESCE(ar.sub_org_name, 'Гэрээт байгууллага тодорхойгүй')
                ELSE COALESCE(o.name, ar.organization_id, 'Байгууллага тодорхойгүй')
            END AS o_name,

            CASE
                WHEN ar.is_sub_employee
                    THEN 'Гэрээт'
                ELSE COALESCE(a.name, ar.department_name, 'Алба тодорхойгүй')
            END AS d_name,

            CASE
                WHEN ar.is_sub_employee
                    THEN 'Гэрээт'
                ELSE COALESCE(h.name, ar.heltes_name, 'Хэлтэс тодорхойгүй')
            END AS h_name,

            ar.meal_type AS m_type,
            COALESCE(SUM(CASE WHEN ar.is_extra_serving THEN 0.5 ELSE 1 END), 0)::numeric AS act_count
        FROM actual_resolved ar
        LEFT JOIN org_lookup o ON o.bteg_id = ar.organization_id
        LEFT JOIN alba_lookup a ON a.bteg_id = ar.department_id
        LEFT JOIN heltes_lookup h ON h.bteg_id = ar.heltes_id
        GROUP BY 1, 2, 3, 4
    )

    SELECT
        COALESCE(e.o_name, a.o_name) AS org_name,
        COALESCE(e.d_name, a.d_name) AS dep_name,
        COALESCE(e.h_name, a.h_name) AS heltes_name,
        COALESCE(e.m_type, a.m_type) AS meal_type,
        COALESCE(e.exp_count, 0)::bigint AS expected_count,
        COALESCE(a.act_count, 0)::numeric AS actual_count
    FROM expected_final e
    FULL OUTER JOIN actual_final a
      ON  a.o_name = e.o_name
      AND a.d_name = e.d_name
      AND a.h_name = e.h_name
      AND a.m_type = e.m_type
    ORDER BY org_name, meal_type;
END;
$$;


ALTER FUNCTION "public"."get_meal_expected_vs_actual"("p_date" "date", "p_hall_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_attendance"() RETURNS TABLE("day_date" "date", "work_start_at" timestamp without time zone, "work_end_at" timestamp without time zone, "work_duration" bigint, "status_id" bigint, "is_hotsorson" boolean, "is_ert_tarsan" boolean, "start_at" timestamp without time zone, "end_at" timestamp without time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select *
  from public.get_worker_attendance(public.current_bteg_id());
$$;


ALTER FUNCTION "public"."get_my_attendance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_attendance_with_overrides"("p_month" "date" DEFAULT NULL::"date") RETURNS TABLE("day_date" "date", "work_start_at" timestamp with time zone, "work_end_at" timestamp with time zone, "original_start_at" timestamp with time zone, "original_end_at" timestamp with time zone, "is_overridden" boolean, "work_duration" bigint, "status_id" bigint, "is_hotsorson" boolean, "is_ert_tarsan" boolean, "start_at" timestamp with time zone, "end_at" timestamp with time zone, "pending_correction_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile_id bigint;
  v_bteg_id bigint;
  v_month_start date;
  v_month_end date;
BEGIN
  v_profile_id := public.current_profile_id();
  v_bteg_id := public.current_bteg_id();

  IF v_bteg_id IS NULL THEN
    RETURN;
  END IF;

  v_month_start := COALESCE(date_trunc('month', p_month::timestamptz)::date,
                            date_trunc('month', current_date::timestamptz)::date);
  v_month_end := (v_month_start + interval '1 month - 1 day')::date;

  RETURN QUERY
  WITH base AS (
    SELECT
      wa.day_date,
      wa.work_start_at::timestamptz AS work_start_at,
      wa.work_end_at::timestamptz AS work_end_at,
      wa.work_duration,
      wa.status_id,
      wa.is_hotsorson,
      wa.is_ert_tarsan,
      wa.start_at::timestamptz AS start_at,
      wa.end_at::timestamptz AS end_at
    FROM public.get_worker_attendance(v_bteg_id) AS wa
    WHERE wa.day_date BETWEEN v_month_start AND v_month_end
  ),
  with_override AS (
    SELECT
      b.day_date,
      COALESCE(ac.start_at, b.work_start_at) AS work_start_at,
      COALESCE(ac.end_at, b.work_end_at) AS work_end_at,
      b.work_start_at AS original_start_at,
      b.work_end_at AS original_end_at,
      (ac.id IS NOT NULL) AS is_overridden,
      CASE
        WHEN ac.id IS NOT NULL
             AND COALESCE(ac.start_at, b.work_start_at) IS NOT NULL
             AND COALESCE(ac.end_at, b.work_end_at) IS NOT NULL
        THEN EXTRACT(EPOCH FROM (
          COALESCE(ac.end_at, b.work_end_at) - COALESCE(ac.start_at, b.work_start_at)
        ))::bigint / 60
        ELSE b.work_duration
      END AS work_duration,
      b.status_id,
      CASE
        WHEN ac.id IS NOT NULL AND b.start_at IS NOT NULL
        THEN COALESCE(ac.start_at, b.work_start_at) > b.start_at
        ELSE b.is_hotsorson
      END AS is_hotsorson,
      CASE
        WHEN ac.id IS NOT NULL AND b.end_at IS NOT NULL
        THEN COALESCE(ac.end_at, b.work_end_at) < b.end_at
        ELSE b.is_ert_tarsan
      END AS is_ert_tarsan,
      b.start_at,
      b.end_at
    FROM base b
    LEFT JOIN public.attendance_corrections ac
      ON ac.bteg_id = v_bteg_id
     AND ac.day_date = b.day_date
  )
  SELECT
    wo.day_date,
    wo.work_start_at,
    wo.work_end_at,
    wo.original_start_at,
    wo.original_end_at,
    wo.is_overridden,
    wo.work_duration,
    wo.status_id,
    wo.is_hotsorson,
    wo.is_ert_tarsan,
    wo.start_at,
    wo.end_at,
    (
      SELECT r.id
      FROM public.attendance_correction_requests r
      WHERE r.profile_id = v_profile_id
        AND r.day_date = wo.day_date
        AND r.status = 'pending'
      LIMIT 1
    ) AS pending_correction_id
  FROM with_override wo
  ORDER BY wo.day_date DESC;
END;
$$;


ALTER FUNCTION "public"."get_my_attendance_with_overrides"("p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_eelj_assignments"() RETURNS TABLE("eelj_id" bigint, "eelj_name" "text", "day_date" timestamp without time zone, "is_come" boolean, "autobus_id" bigint, "autobus_number" "text", "direction_name" "text", "driver_name" "text", "driver_phone" "text", "sit_number" bigint, "land_position_address" "text", "is_done" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
  with me as (select public.current_bteg_id() as bteg_id)
  select
    e.id as eelj_id,
    e.name as eelj_name,
    e.day_date,
    e.is_come,
    a.id as autobus_id,
    a.number as autobus_number,
    d.name as direction_name,
    a.driver_name,
    a.driver_phone_number as driver_phone,
    h.sit_number,
    h.land_position_address,
    h.is_done
  from target.h_user_autobus_address h
  join me on me.bteg_id is not null and h.user_id = me.bteg_id::text
  join target.h_eelj_soliltsoo e on e.id = h.eel_soliltsoo_id
  left join target.h_autobus a on a.id = h.autobus_id
  left join target.h_autobus_direction d on d.id = a.direction_id
  where e.is_active = 1
    and h.day_date >= current_date - interval '1 day'
  order by h.day_date asc, e.is_come desc;
$$;


ALTER FUNCTION "public"."get_my_eelj_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_eelj_cards"() RETURNS TABLE("eelj_id" bigint, "eelj_name" "text", "day_date" timestamp without time zone, "is_come" boolean, "autobus_id" bigint, "autobus_number" "text", "direction_name" "text", "driver_name" "text", "driver_phone" "text", "leader_name" "text", "zam_tsag" bigint, "zam_tsag_day_date" timestamp without time zone, "is_my_assignment" boolean, "request_id" bigint, "request_status" "public"."eelj_request_status", "request_decision_reason" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
  with my_shifts as (
    -- Хэрэглэгчийн ойрын ээлжүүд + хуваарилагдсан автобус (хэрэв байгаа бол)
    select
      h.eel_soliltsoo_id as eelj_id,
      max(h.autobus_id) as scheduled_autobus_id,
      max(h.zam_tsag) as zam_tsag,
      max(h.zam_tsag_day_date) as zam_tsag_day_date
    from target.h_user_autobus_address h
    where h.user_id = public.current_bteg_id()::text
      and h.day_date >= current_date - interval '1 day'
    group by h.eel_soliltsoo_id
  ),
  cards as (
    -- Хэрэв scheduled_autobus_id тогтоосон бол зөвхөн тэр автобусыг үзүүлнэ;
    -- үгүй бол тухайн ээлжийн БҮХ автобус сонголт болж харагдана.
    select
      a.id as autobus_id,
      a.eel_soliltsoo_id as eelj_id,
      ms.zam_tsag,
      ms.zam_tsag_day_date,
      (a.id = ms.scheduled_autobus_id) as is_my_assignment
    from my_shifts ms
    join target.h_autobus a
      on a.eel_soliltsoo_id = ms.eelj_id
     and (ms.scheduled_autobus_id is null or a.id = ms.scheduled_autobus_id)
  ),
  my_active_requests as (
    select id, autobus_id, eelj_id, status, decision_reason
    from public.user_autobus_request
    where profile_id = public.current_profile_id()
  )
  select
    e.id as eelj_id,
    e.name as eelj_name,
    e.day_date,
    e.is_come,
    a.id as autobus_id,
    a.number as autobus_number,
    d.name as direction_name,
    a.driver_name,
    a.driver_phone_number as driver_phone,
    a.user_name as leader_name,
    c.zam_tsag,
    c.zam_tsag_day_date,
    coalesce(c.is_my_assignment, false) as is_my_assignment,
    r.id as request_id,
    r.status as request_status,
    r.decision_reason as request_decision_reason
  from cards c
  join target.h_autobus a on a.id = c.autobus_id
  join target.h_eelj_soliltsoo e on e.id = a.eel_soliltsoo_id
  left join target.h_autobus_direction d on d.id = a.direction_id
  left join my_active_requests r on r.eelj_id = e.id and r.autobus_id = a.id
  where e.is_active = 1
  order by e.day_date asc, e.is_come desc, c.is_my_assignment desc, a.number;
$$;


ALTER FUNCTION "public"."get_my_eelj_cards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_eelj_requests"() RETURNS TABLE("id" bigint, "eelj_id" bigint, "eelj_name" "text", "autobus_id" bigint, "autobus_number" "text", "direction_name" "text", "status" "public"."eelj_request_status", "comment" "text", "requested_at" timestamp with time zone, "decided_at" timestamp with time zone, "decision_reason" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id, eelj_id, eelj_name, autobus_id, autobus_number, direction_name,
         status, comment, requested_at, decided_at, decision_reason
  from public.user_autobus_request
  where profile_id = public.current_profile_id()
  order by requested_at desc;
$$;


ALTER FUNCTION "public"."get_my_eelj_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_led_autobus_roster"() RETURNS TABLE("autobus_id" bigint, "autobus_number" "text", "day_date" timestamp without time zone, "eelj_id" bigint, "eelj_name" "text", "is_come" boolean, "direction_name" "text", "passenger_bteg_id" "text", "passenger_first_name" "text", "passenger_last_name" "text", "passenger_phone" "text", "sit_number" bigint, "land_position_address" "text", "is_done" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
  with me as (select public.current_bteg_id() as bteg_id)
  select
    a.id as autobus_id,
    a.number as autobus_number,
    a.day_date,
    e.id as eelj_id,
    e.name as eelj_name,
    e.is_come,
    d.name as direction_name,
    h.user_id as passenger_bteg_id,
    sgu.first_name as passenger_first_name,
    sgu.last_name as passenger_last_name,
    sgu.phone as passenger_phone,
    h.sit_number,
    h.land_position_address,
    h.is_done
  from target.h_autobus a
  join me on me.bteg_id is not null and a.user_id = me.bteg_id
  join target.h_eelj_soliltsoo e on e.id = a.eel_soliltsoo_id
  left join target.h_autobus_direction d on d.id = a.direction_id
  left join target.h_user_autobus_address h on h.autobus_id = a.id
  left join target.sf_guard_user sgu on sgu.id::text = h.user_id
  where e.is_active = 1
    and a.day_date >= current_date - interval '1 day'
  order by a.day_date asc, a.id asc, h.sit_number asc nulls last;
$$;


ALTER FUNCTION "public"."get_my_led_autobus_roster"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_attendance_correction_review_count"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'attendance', 'review') THEN
    RETURN 0;
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.attendance_correction_requests
  WHERE status = 'pending';

  RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_pending_attendance_correction_review_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_attendance_corrections"() RETURNS TABLE("id" "uuid", "profile_id" bigint, "requester_name" "text", "requester_department" "text", "bteg_id" bigint, "day_date" "date", "original_start_at" timestamp with time zone, "original_end_at" timestamp with time zone, "requested_start_at" timestamp with time zone, "requested_end_at" timestamp with time zone, "reason" "text", "attachment_url" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'attendance', 'review') THEN
    RAISE EXCEPTION 'EX-ATT-05: Хяналтын эрхгүй';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.profile_id,
    p.name AS requester_name,
    p.department_name AS requester_department,
    r.bteg_id,
    r.day_date,
    r.original_start_at,
    r.original_end_at,
    r.requested_start_at,
    r.requested_end_at,
    r.reason,
    r.attachment_url,
    r.created_at
  FROM public.attendance_correction_requests r
  JOIN public.profile p ON p.id = r.profile_id
  WHERE r.status = 'pending'
  ORDER BY r.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_pending_attendance_corrections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_requests_for_my_autobuses"() RETURNS TABLE("id" bigint, "eelj_id" bigint, "eelj_name" "text", "autobus_id" bigint, "autobus_number" "text", "direction_name" "text", "requester_bteg_id" bigint, "requester_first_name" "text", "requester_last_name" "text", "requester_phone" "text", "requester_position" "text", "requester_department" "text", "status" "public"."eelj_request_status", "comment" "text", "requested_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
  with my_autobuses as (
    select a.id from target.h_autobus a
    where a.user_id = public.current_bteg_id()
  )
  select r.id, r.eelj_id, r.eelj_name, r.autobus_id, r.autobus_number, r.direction_name,
         r.bteg_id as requester_bteg_id,
         r.requester_first_name, r.requester_last_name, r.requester_phone,
         r.requester_position, r.requester_department,
         r.status, r.comment, r.requested_at
  from public.user_autobus_request r
  join my_autobuses m on m.id = r.autobus_id
  where r.status = 'requested'
  order by r.requested_at asc;
$$;


ALTER FUNCTION "public"."get_pending_requests_for_my_autobuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_requestable_autobuses"("p_limit" integer DEFAULT 30) RETURNS TABLE("autobus_id" bigint, "autobus_number" "text", "eelj_id" bigint, "eelj_name" "text", "day_date" timestamp without time zone, "is_come" boolean, "direction_name" "text", "driver_name" "text", "already_requested" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
  with my_active as (
    select autobus_id from public.user_autobus_request
    where profile_id = public.current_profile_id()
      and status in ('requested', 'approved', 'force_approved')
  ),
  upcoming as (
    select e.id, e.day_date
    from target.h_eelj_soliltsoo e
    where e.is_active = 1
      and e.day_date >= current_date - interval '1 day'
    order by e.day_date asc
    limit greatest(p_limit, 1)
  )
  select a.id, a.number, e.id, e.name, e.day_date, e.is_come,
         d.name, a.driver_name,
         (mar.autobus_id is not null) as already_requested
  from target.h_autobus a
  join upcoming u on u.id = a.eel_soliltsoo_id
  join target.h_eelj_soliltsoo e on e.id = a.eel_soliltsoo_id
  left join target.h_autobus_direction d on d.id = a.direction_id
  left join my_active mar on mar.autobus_id = a.id
  order by e.day_date asc, e.is_come desc, d.name nulls last, a.number;
$$;


ALTER FUNCTION "public"."get_requestable_autobuses"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_upcoming_eelj"("p_limit" integer DEFAULT 10) RETURNS TABLE("id" bigint, "name" "text", "day_date" timestamp without time zone, "is_come" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
  select e.id, e.name, e.day_date, e.is_come
  from target.h_eelj_soliltsoo e
  where e.is_active = 1
    and e.day_date >= current_date - interval '1 day'
  order by e.day_date asc, e.id asc
  limit greatest(p_limit, 1);
$$;


ALTER FUNCTION "public"."get_upcoming_eelj"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_users_with_stats"() RETURNS TABLE("user_id" "uuid", "first_name" "text", "last_name" "text", "phone" "text", "idcard_number" "text", "bteg_id" "text", "heltes_name" "text", "position_name" "text", "breakfast_location" bigint, "lunch_location" bigint, "dinner_location" bigint, "night_meal_location" bigint, "morning_meal_location" bigint, "extend_morning_meal_location" bigint, "extend_lunch_location" bigint, "start_at" timestamp without time zone, "end_at" timestamp without time zone, "is_working" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
BEGIN
    RETURN QUERY
    WITH local_clock AS (
        SELECT
            (now() AT TIME ZONE 'Asia/Ulaanbaatar')::timestamp AS local_now,
            (now() AT TIME ZONE 'Asia/Ulaanbaatar')::date AS today,
            (now() AT TIME ZONE 'Asia/Ulaanbaatar')::time AS local_time
    ),
    candidate_shifts AS (
        SELECT
            w.*,
            CASE
                WHEN
                    w.start_at::date < w.end_at::date
                    AND w.end_at::date = lc.today
                    AND lc.local_time < TIME '15:00'
                THEN 0
                WHEN w.day_date::date = lc.today THEN 1
                ELSE 2
            END AS shift_priority
        FROM target.vw_worker_day_log_14d w
        CROSS JOIN local_clock lc
        WHERE
            w.worker_id IS NOT NULL
            AND (
                w.day_date::date = lc.today
                OR (
                    w.start_at::date < w.end_at::date
                    AND w.end_at::date = lc.today
                    AND lc.local_time < TIME '15:00'
                )
            )
    ),
    ranked_shifts AS (
        SELECT
            cs.*,
            row_number() OVER (
                PARTITION BY cs.worker_id::text
                ORDER BY cs.shift_priority ASC, cs.start_at DESC, cs.end_at DESC
            ) AS rn
        FROM candidate_shifts cs
        WHERE cs.shift_priority < 2
    )
    SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.phone,
        u.idcard_number,
        u.bteg_id,
        u.heltes_name,
        u.position_name,
        umc.breakfast_location,
        umc.lunch_location,
        umc.dinner_location,
        umc.night_meal_location,
        umc.morning_meal_location,
        umc.extend_morning_meal_location,
        umc.extend_lunch_location,
        w.start_at,
        w.end_at,
        (lc.local_now BETWEEN w.start_at AND w.end_at) AS is_working
    FROM public.users u
    CROSS JOIN local_clock lc
    LEFT JOIN public.user_meal_configs umc ON u.id = umc.user_id
    INNER JOIN ranked_shifts w ON (
        w.worker_id::text = u.bteg_id
        AND w.rn = 1
    )
    WHERE u.is_active = true;
END;
$$;


ALTER FUNCTION "public"."get_users_with_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_worker_attendance"("p_worker_id" bigint) RETURNS TABLE("day_date" "date", "work_start_at" timestamp without time zone, "work_end_at" timestamp without time zone, "work_duration" bigint, "status_id" bigint, "is_hotsorson" boolean, "is_ert_tarsan" boolean, "start_at" timestamp without time zone, "end_at" timestamp without time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT
      v.day_date::date,
      v.work_start_at,
      v.work_end_at,
      v.work_duration,
      v.status_id,
      v.is_hotsorson,
      v.is_ert_tarsan,
      v.start_at,
      v.end_at
    FROM target.vw_worker_day_log_14d v
    WHERE v.worker_id = p_worker_id
    ORDER BY v.day_date DESC;
  $$;


ALTER FUNCTION "public"."get_worker_attendance"("p_worker_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sf_guard_user_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    target_phone TEXT;
    existing_by_phone RECORD;
    existing_by_id RECORD;
    safe_org TEXT := NULL;
    safe_dept TEXT := NULL;
    safe_heltes TEXT := NULL;
BEGIN
    target_phone := COALESCE(NULLIF(NEW.phone2, ''), NULLIF(NEW.phone, ''));

    -- FK-safe: эх хүснэгтэд байгаа эсэхийг шалгаж, байхгүй бол NULL үлдээнэ
    IF NEW.organization_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.organization o WHERE o.bteg_id = NEW.organization_id::TEXT) THEN
        safe_org := NEW.organization_id::TEXT;
    END IF;
    IF NEW.department_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.alba a WHERE a.bteg_id = NEW.department_id::TEXT) THEN
        safe_dept := NEW.department_id::TEXT;
    END IF;
    IF NEW.heltes_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.heltes h WHERE h.bteg_id = NEW.heltes_id::TEXT) THEN
        safe_heltes := NEW.heltes_id::TEXT;
    END IF;

    -- 1. Ижил bteg_id-тай хэрэглэгч байгаа эсэх
    SELECT id, phone, is_active INTO existing_by_id
    FROM public.users WHERE bteg_id = NEW.id::TEXT LIMIT 1;

    -- 2. Ижил утастай өөр хэрэглэгч байгаа эсэх
    SELECT id, bteg_id, is_active INTO existing_by_phone
    FROM public.users WHERE phone = target_phone AND bteg_id != NEW.id::TEXT LIMIT 1;

    -- 3. Утасны дугаар давхардвал
    IF existing_by_phone.id IS NOT NULL THEN
        IF existing_by_phone.is_active = false THEN
            UPDATE public.users
            SET phone = phone || '_old_' || existing_by_phone.bteg_id
            WHERE id = existing_by_phone.id;
        ELSE
            RAISE NOTICE 'Идэвхтэй ажилтан ижил дугаартай байна: %', target_phone;
            RETURN NEW;
        END IF;
    END IF;

    -- 4. INSERT эсвэл UPDATE
    IF existing_by_id.id IS NOT NULL THEN
        UPDATE public.users SET
            email = NEW.email_address,
            phone = target_phone,
            idcard_number = NEW.idcard_number,
            is_active = NEW.is_active,
            address = NEW.address,
            register_number = NEW.register_number,
            gazar_id = NEW.gazar_id::TEXT,
            alba_id = NEW.alba_id::TEXT,
            heltes_id = safe_heltes,
            job_position_id = NEW.position_id::TEXT,
            nice_name = NEW.nice_name,
            updated_at = NEW.updated_at,
            first_name = NEW.first_name,
            last_name = NEW.last_name,
            organization_id = safe_org,
            department_id = safe_dept,
            department_name = NEW.department_name,
            heltes_name = NEW.heltes_name,
            position_name = NEW.position_name
        WHERE id = existing_by_id.id;
    ELSE
        IF NEW.is_active = true THEN
            INSERT INTO public.users (
                bteg_id, email, phone, idcard_number, is_active, address,
                register_number, gazar_id, alba_id, heltes_id, job_position_id,
                nice_name, created_at, updated_at, first_name, last_name,
                organization_id, department_id, department_name, heltes_name, position_name
            )
            VALUES (
                NEW.id::TEXT, NEW.email_address, target_phone, NEW.idcard_number,
                NEW.is_active, NEW.address, NEW.register_number, NEW.gazar_id::TEXT,
                NEW.alba_id::TEXT, safe_heltes, NEW.position_id::TEXT,
                NEW.nice_name, NEW.created_at, NEW.updated_at, NEW.first_name, NEW.last_name,
                safe_org, safe_dept,
                NEW.department_name, NEW.heltes_name, NEW.position_name
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sf_guard_user_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_module" "text", "p_action" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profile p
    JOIN roles_profiles op ON op.profile_id = p.id
    JOIN roles r ON r.id = op.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions per ON per.id = rp.permission_id
    WHERE p.auth_user_id = p_user_id
      AND (
        r.name = 'super_admin' 
        OR 
        (per.module = p_module AND per.action = p_action)
      )
  );
END;
$$;


ALTER FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_module" "text", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_auth_user_to_public_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Шинээр үүссэн auth user-н утасны дугаар public.users-д байгаа эсэхийг шалгах
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
        UPDATE public.users 
        SET auth_user_id = NEW.id
        WHERE phone = NEW.phone
          AND auth_user_id IS NULL;
        
        IF FOUND THEN
            RAISE NOTICE 'Auth user холбогдлоо: auth_id=%, phone=%', NEW.id, NEW.phone;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_auth_user_to_public_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_sf_guard_users"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    inserted_count INTEGER;
    skipped_count INTEGER;
BEGIN
    -- Өгөгдлийг шилжүүлэх (bteg_id ЭСВЭЛ phone давхардсан үед skip)
    WITH inserted_data AS (
        INSERT INTO public.users (
            bteg_id,
            email,
            phone,
            idcard_number,
            is_active,
            address,
            register_number,
            gazar_id,
            alba_id,
            heltes_id,
            job_position_id,
            nice_name,
            created_at,
            updated_at,
            first_name,
            last_name,
            organization_id,
            department_id,
            department_name,
            heltes_name,
            position_name
        )
        SELECT 
            su.id::TEXT as bteg_id,
            su.email_address as email,
            COALESCE(su.phone2) as phone, -- phone2-с сонгох
            su.idcard_number,
            CASE WHEN su.is_active = 1 THEN true ELSE false END as is_active,
            su.address,
            su.register_number,
            su.gazar_id::TEXT,
            su.alba_id::TEXT,
            su.heltes_id::TEXT,
            su.position_id::TEXT as job_position_id,
            su.nice_name,
            su.created_at,
            su.updated_at,
            su.first_name,
            su.last_name,
            su.organization_id::TEXT,
            su.department_id::TEXT,
            su.department_name,
            su.heltes_name,
            su.position_name
        FROM target.sf_guard_user su
        WHERE su.id IS NOT NULL
        ON CONFLICT (phone) DO NOTHING
        RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted_data;

    -- Алгассан мөрүүдийн тоо
    SELECT COUNT(*) - inserted_count INTO skipped_count
    FROM target.sf_guard_user
    WHERE id IS NOT NULL;

    RAISE NOTICE 'Амжилттай оруулсан: %, Алгассан (давхардсан): %', inserted_count, skipped_count;
END;
$$;


ALTER FUNCTION "public"."migrate_sf_guard_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_daily_meal_summary"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
    insert into public.daily_meal_summary (
        date,
        dining_hall_id,
        breakfast_count,
        morning_meal_count,
        lunch_count,
        dinner_count,
        night_meal_count,
        extend_morning_count,
        extend_lunch_count,
        manual_override_total,
        extra_serving_total,
        wrong_location_total,
        sub_employee_total,
        grand_total,
        updated_at
    )
    select
        date,
        dining_hall_id,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'breakfast'), 0) as breakfast_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'morning_meal'), 0) as morning_meal_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'lunch'), 0) as lunch_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'dinner'), 0) as dinner_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'night_meal'), 0) as night_meal_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'extend_morning_meal'), 0) as extend_morning_count,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end) filter (where meal_type = 'extend_lunch'), 0) as extend_lunch_count,
        count(*) filter (where is_manual_override = true) as manual_override_total,
        count(*) filter (where is_extra_serving = true) as extra_serving_total,
        count(*) filter (where is_wrong_location = true) as wrong_location_total,
        count(*) filter (where sub_employee_id is not null) as sub_employee_total,
        coalesce(sum(case when is_extra_serving then 0.5 else 1.0 end), 0) as grand_total,
        now()
    from public.meal_logs
    where date >= current_date - interval '1 day'
    group by date, dining_hall_id
    on conflict (date, dining_hall_id)
    do update set
        breakfast_count = excluded.breakfast_count,
        morning_meal_count = excluded.morning_meal_count,
        lunch_count = excluded.lunch_count,
        dinner_count = excluded.dinner_count,
        night_meal_count = excluded.night_meal_count,
        extend_morning_count = excluded.extend_morning_count,
        extend_lunch_count = excluded.extend_lunch_count,
        manual_override_total = excluded.manual_override_total,
        extra_serving_total = excluded.extra_serving_total,
        wrong_location_total = excluded.wrong_location_total,
        sub_employee_total = excluded.sub_employee_total,
        grand_total = excluded.grand_total,
        updated_at = now();
end;
$$;


ALTER FUNCTION "public"."refresh_daily_meal_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_attendance_correction_request"("p_request_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reviewer_id bigint;
  v_row public.attendance_correction_requests%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR char_length(p_reason) < 5 THEN
    RAISE EXCEPTION 'EX-ATT-07: Татгалзах шалтгаан 5 тэмдэгтээс багагүй';
  END IF;

  v_reviewer_id := public.current_profile_id();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-01: Reviewer profile олдсонгүй';
  END IF;
  IF NOT public.has_permission(auth.uid(), 'attendance', 'review') THEN
    RAISE EXCEPTION 'EX-ATT-05: Хяналтын эрхгүй';
  END IF;

  SELECT * INTO v_row
  FROM public.attendance_correction_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'EX-ATT-06: Хүсэлт олдсонгүй';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'EX-ATT-06: Хүсэлт хүлээгдэх төлвөөс өөр төлөвт байна';
  END IF;
  IF v_row.profile_id = v_reviewer_id THEN
    RAISE EXCEPTION 'EX-ATT-04: Өөрийнхөө хүсэлтийг хянах боломжгүй';
  END IF;

  UPDATE public.attendance_correction_requests
     SET status = 'rejected',
         reviewed_by_profile_id = v_reviewer_id,
         reviewed_at = now(),
         review_note = p_reason,
         updated_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.attendance_correction_status_history (
    request_id, from_status, to_status, actor_profile_id, note
  ) VALUES (
    p_request_id, 'pending', 'rejected', v_reviewer_id, p_reason
  );
END;
$$;


ALTER FUNCTION "public"."reject_attendance_correction_request"("p_request_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_autobus_request"("p_request_id" bigint, "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
declare
  v_bteg_id bigint;
  v_profile_id bigint;
  v_autobus_user_id bigint;
  v_autobus_id bigint;
begin
  v_bteg_id := public.current_bteg_id();
  v_profile_id := public.current_profile_id();
  if v_bteg_id is null or v_profile_id is null then
    raise exception 'Эрх олгох эрхгүй';
  end if;

  select r.autobus_id into v_autobus_id
  from public.user_autobus_request r
  where r.id = p_request_id;
  if v_autobus_id is null then
    raise exception 'Хүсэлт олдсонгүй';
  end if;

  select a.user_id into v_autobus_user_id
  from target.h_autobus a
  where a.id = v_autobus_id;
  if v_autobus_user_id is distinct from v_bteg_id then
    raise exception 'Та энэ машины ахлах биш байна';
  end if;

  update public.user_autobus_request
  set status = 'rejected'::public.eelj_request_status,
      decided_at = now(),
      decided_by_profile_id = v_profile_id,
      decision_reason = p_reason
  where id = p_request_id;
end;
$$;


ALTER FUNCTION "public"."reject_autobus_request"("p_request_id" bigint, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_autobus_seat"("p_eelj_id" bigint, "p_autobus_id" bigint, "p_comment" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
declare
  v_bteg_id bigint;
  v_profile_id bigint;
  v_request_id bigint;
  v_eelj_name text;
  v_autobus_number text;
  v_direction_name text;
  v_first_name text;
  v_last_name text;
  v_phone text;
  v_position text;
  v_department text;
begin
  v_bteg_id := public.current_bteg_id();
  if v_bteg_id is null then
    raise exception 'Хэрэглэгч intranet-тэй холбогдоогүй байна';
  end if;

  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Profile олдсонгүй';
  end if;

  select e.name into v_eelj_name
  from target.h_eelj_soliltsoo e
  where e.id = p_eelj_id and e.is_active = 1;
  if v_eelj_name is null then
    raise exception 'Идэвхтэй ээлж олдсонгүй';
  end if;

  select a.number, d.name
  into v_autobus_number, v_direction_name
  from target.h_autobus a
  left join target.h_autobus_direction d on d.id = a.direction_id
  where a.id = p_autobus_id and a.eel_soliltsoo_id = p_eelj_id;
  if v_autobus_number is null then
    raise exception 'Энэ ээлжид ийм автобус байхгүй';
  end if;

  select sgu.first_name, sgu.last_name, sgu.phone
  into v_first_name, v_last_name, v_phone
  from target.sf_guard_user sgu
  where sgu.id = v_bteg_id;

  select p.position_name, p.department_name
  into v_position, v_department
  from public.profile p
  where p.id = v_profile_id;

  insert into public.user_autobus_request (
    profile_id, bteg_id, eelj_id, autobus_id, status, comment,
    requester_first_name, requester_last_name, requester_phone,
    requester_position, requester_department,
    eelj_name, autobus_number, direction_name
  ) values (
    v_profile_id, v_bteg_id, p_eelj_id, p_autobus_id, 'requested', p_comment,
    v_first_name, v_last_name, v_phone,
    v_position, v_department,
    v_eelj_name, v_autobus_number, v_direction_name
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;


ALTER FUNCTION "public"."request_autobus_seat"("p_eelj_id" bigint, "p_autobus_id" bigint, "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_leave_request_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_leave_request_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_legal_acts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_legal_acts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_purchase_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_order_purchase_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_due_food_reports"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_report_date date := ((now() at time zone 'Asia/Ulaanbaatar')::date - 7);
begin
  return public.snapshot_food_report_day(v_report_date, false);
end;
$$;


ALTER FUNCTION "public"."snapshot_due_food_reports"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_food_report_day"("p_date" "date", "p_force" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'target'
    AS $$
declare
  v_hall_id bigint;
  v_rows integer := 0;
  v_inserted integer := 0;
  v_finalized_at timestamp with time zone := now();
begin
  if p_date is null then
    raise exception 'p_date is required';
  end if;

  for v_hall_id in
    select distinct hall_id
    from (
      select id::bigint as hall_id
      from public.dining_hall

      union

      select dining_hall_id::bigint as hall_id
      from public.meal_logs
      where date = p_date
        and dining_hall_id is not null

      union

      select dining_hall_id::bigint as hall_id
      from public.sub_employee_meal_plans
      where date = p_date
    ) halls
    where hall_id is not null
  loop
    with
    expected_actual as (
      select
        v_hall_id as dining_hall_id,
        coalesce(nullif(org_name, ''), 'Байгууллага тодорхойгүй')::text as org_name,
        coalesce(nullif(dep_name, ''), 'Алба тодорхойгүй')::text as dep_name,
        coalesce(nullif(heltes_name, ''), 'Хэлтэс тодорхойгүй')::text as heltes_name,
        coalesce(nullif(meal_type, ''), 'unknown')::text as meal_type,
        sum(expected_count)::bigint as expected_count,
        sum(actual_count)::numeric as actual_count
      from public.get_meal_expected_vs_actual(p_date, v_hall_id::integer)
      group by 1, 2, 3, 4, 5
    ),
    org_lookup as (
      select bteg_id, max(name)::text as name
      from public.organization
      group by bteg_id
    ),
    alba_lookup as (
      select bteg_id, max(name)::text as name
      from public.alba
      group by bteg_id
    ),
    heltes_lookup as (
      select bteg_id, max(name)::text as name
      from public.heltes
      group by bteg_id
    ),
    special_logs as (
      select
        case
          when ml.sub_employee_id is not null
            then coalesce(sub_org.name, 'Гэрээт байгууллага тодорхойгүй')
          else coalesce(o.name, u.organization_id, 'Байгууллага тодорхойгүй')
        end::text as org_name,
        case
          when ml.sub_employee_id is not null
            then 'Гэрээт'
          else coalesce(a.name, u.department_name, 'Алба тодорхойгүй')
        end::text as dep_name,
        case
          when ml.sub_employee_id is not null
            then 'Гэрээт'
          else coalesce(h.name, u.heltes_name, 'Хэлтэс тодорхойгүй')
        end::text as heltes_name,
        coalesce(nullif(ml.meal_type, ''), 'unknown')::text as meal_type,
        count(*) filter (where ml.is_manual_override = true)::bigint as manual_override_total,
        count(*) filter (where ml.is_extra_serving = true)::bigint as extra_serving_total,
        count(*) filter (where ml.is_wrong_location = true)::bigint as wrong_location_total
      from public.meal_logs ml
      left join lateral (
        select u1.*
        from public.users u1
        where u1.id = ml.user_id

        union all

        select u2.*
        from public.users u2
        where ml.user_id is null
          and ml.sub_employee_id is null
          and u2.bteg_id = ml.bteg_id

        limit 1
      ) u on true
      left join org_lookup o on o.bteg_id = u.organization_id
      left join alba_lookup a on a.bteg_id = u.department_id
      left join heltes_lookup h on h.bteg_id = u.heltes_id
      left join public.sub_employee_for_food sef on sef.id = ml.sub_employee_id
      left join public.organization sub_org on sub_org.id = sef.org_id
      where ml.date = p_date
        and ml.dining_hall_id = v_hall_id
        and (
          ml.is_manual_override = true
          or ml.is_extra_serving = true
          or ml.is_wrong_location = true
        )
      group by 1, 2, 3, 4
    ),
    snapshot_rows as (
      select
        p_date as report_date,
        v_hall_id as dining_hall_id,
        coalesce(ea.meal_type, sl.meal_type) as meal_type,
        coalesce(ea.org_name, sl.org_name) as org_name,
        coalesce(ea.dep_name, sl.dep_name) as dep_name,
        coalesce(ea.heltes_name, sl.heltes_name) as heltes_name,
        coalesce(ea.expected_count, 0)::bigint as expected_count,
        coalesce(ea.actual_count, 0)::numeric as actual_count,
        coalesce(sl.manual_override_total, 0)::bigint as manual_override_total,
        coalesce(sl.extra_serving_total, 0)::bigint as extra_serving_total,
        coalesce(sl.wrong_location_total, 0)::bigint as wrong_location_total
      from expected_actual ea
      full outer join special_logs sl
        on sl.org_name = ea.org_name
       and sl.dep_name = ea.dep_name
       and sl.heltes_name = ea.heltes_name
       and sl.meal_type = ea.meal_type
    ),
    upserted as (
      insert into public.food_report_daily_snapshot (
        report_date,
        dining_hall_id,
        meal_type,
        org_name,
        dep_name,
        heltes_name,
        expected_count,
        actual_count,
        manual_override_total,
        extra_serving_total,
        wrong_location_total,
        source_finalized_at,
        is_final,
        refreshed_at
      )
      select
        report_date,
        dining_hall_id,
        meal_type,
        org_name,
        dep_name,
        heltes_name,
        expected_count,
        actual_count,
        manual_override_total,
        extra_serving_total,
        wrong_location_total,
        v_finalized_at,
        true,
        now()
      from snapshot_rows
      where expected_count <> 0
         or actual_count <> 0
         or manual_override_total <> 0
         or extra_serving_total <> 0
         or wrong_location_total <> 0
      on conflict (report_date, dining_hall_id, meal_type, org_name, dep_name, heltes_name)
      do update set
        expected_count = excluded.expected_count,
        actual_count = excluded.actual_count,
        manual_override_total = excluded.manual_override_total,
        extra_serving_total = excluded.extra_serving_total,
        wrong_location_total = excluded.wrong_location_total,
        source_finalized_at = excluded.source_finalized_at,
        is_final = true,
        refreshed_at = now()
      where p_force = true
         or public.food_report_daily_snapshot.is_final = false
      returning 1
    )
    select count(*) into v_inserted from upserted;

    v_rows := v_rows + v_inserted;
  end loop;

  return v_rows;
end;
$$;


ALTER FUNCTION "public"."snapshot_food_report_day"("p_date" "date", "p_force" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_meal_config_bteg_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    SELECT bteg_id INTO NEW.bteg_id
    FROM public.users
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_meal_config_bteg_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_sf_guard_user_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Шинэ хэрэглэгч нэмэх
    INSERT INTO public.users (
        bteg_id,
        email,
        phone,
        idcard_number,
        is_active,
        address,
        register_number,
        gazar_id,
        alba_id,
        heltes_id,
        job_position_id,
        nice_name,
        created_at,
        updated_at,
        first_name,
        last_name,
        organization_id,
        department_id,
        department_name,
        heltes_name,
        position_name
    )
    VALUES (
        NEW.id::TEXT,
        NEW.email_address,
        COALESCE(NEW.phone2),
        NEW.idcard_number,
        CASE WHEN NEW.is_active = 1 THEN true ELSE false END,
        NEW.address,
        NEW.register_number,
        NEW.gazar_id::TEXT,
        NEW.alba_id::TEXT,
        NEW.heltes_id::TEXT,
        NEW.position_id::TEXT,
        NEW.nice_name,
        NEW.created_at,
        NOW(),
        NEW.first_name,
        NEW.last_name,
        NEW.organization_id::TEXT,
        NEW.department_id::TEXT,
        NEW.department_name,
        NEW.heltes_name,
        NEW.position_name
    )
    ON CONFLICT (bteg_id) DO UPDATE SET
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        idcard_number = EXCLUDED.idcard_number,
        is_active = EXCLUDED.is_active,
        address = EXCLUDED.address,
        register_number = EXCLUDED.register_number,
        gazar_id = EXCLUDED.gazar_id,
        alba_id = EXCLUDED.alba_id,
        heltes_id = EXCLUDED.heltes_id,
        job_position_id = EXCLUDED.job_position_id,
        nice_name = EXCLUDED.nice_name,
        updated_at = EXCLUDED.updated_at,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        organization_id = EXCLUDED.organization_id,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        heltes_name = EXCLUDED.heltes_name,
        position_name = EXCLUDED.position_name;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_sf_guard_user_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_sf_guard_user_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- public.users хүснэгтэд шинэчлэлт хийх
    UPDATE public.users 
    SET
        email = NEW.email_address,
        phone = COALESCE(NEW.phone2),
        idcard_number = NEW.idcard_number,
        is_active = CASE WHEN NEW.is_active = 1 THEN true ELSE false END,
        address = NEW.address,
        register_number = NEW.register_number,
        gazar_id = NEW.gazar_id::TEXT,
        alba_id = NEW.alba_id::TEXT,
        heltes_id = NEW.heltes_id::TEXT,
        job_position_id = NEW.position_id::TEXT,
        nice_name = NEW.nice_name,
        updated_at = NOW(), -- Шинэчлэгдсэн огноог өөрчлөх
        first_name = NEW.first_name,
        last_name = NEW.last_name,
        organization_id = NEW.organization_id::TEXT,
        department_id = NEW.department_id::TEXT,
        department_name = NEW.department_name,
        heltes_name = NEW.heltes_name,
        position_name = NEW.position_name
    WHERE bteg_id = OLD.id::TEXT;

    -- Хэрэв ямар ч мөр шинэчлэгдээгүй бол (ө.х bteg_id олдоогүй) мэдэгдэх
    IF NOT FOUND THEN
        RAISE NOTICE 'Шинэчлэлт хийх мөр олдсонгүй: bteg_id=%', OLD.id::TEXT;
    ELSE
        RAISE NOTICE 'Мэдээлэл шинэчлэгдлээ: bteg_id=%', OLD.id::TEXT;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_sf_guard_user_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text" DEFAULT NULL::"text", "p_change_reason" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_status VARCHAR(50);
    valid_transition BOOLEAN := false;
    revision_num INTEGER;
BEGIN
    -- Get current status
    SELECT status INTO current_status FROM orders WHERE id = p_order_id;
    
    IF current_status IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Validate status transition based on workflow rules
    valid_transition := CASE 
        WHEN current_status = 'draft' AND p_new_status = 'pending_review' THEN true
        WHEN current_status = 'pending_review' AND p_new_status IN ('in_review', 'rejected') THEN true
        WHEN current_status = 'in_review' AND p_new_status IN ('pending_approval', 'draft', 'rejected') THEN true
        WHEN current_status = 'pending_approval' AND p_new_status IN ('approved', 'rejected', 'in_review') THEN true
        WHEN current_status = 'approved' AND p_new_status IN ('final_approved', 'rejected', 'pending_approval') THEN true
        WHEN current_status = 'final_approved' AND p_new_status IN ('in_procurement', 'rejected') THEN true
        WHEN current_status = 'in_procurement' AND p_new_status IN ('completed', 'rejected') THEN true
        WHEN p_new_status = 'cancelled' THEN true -- Can cancel from any status except completed
        ELSE false
    END;
    
    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', current_status, p_new_status;
    END IF;
    
    -- Update order status
    UPDATE orders 
    SET 
        status = p_new_status,
        updated_at = NOW(),
        submitted_at = CASE WHEN p_new_status = 'pending_review' AND submitted_at IS NULL THEN NOW() ELSE submitted_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END
    WHERE id = p_order_id;
    
    -- Log workflow change
    INSERT INTO order_workflow (order_id, from_status, to_status, changed_by, change_reason, comments)
    VALUES (p_order_id, current_status, p_new_status, p_user_id, p_change_reason, p_comments);
    
    -- Create revision entry
    SELECT COALESCE(MAX(revision_number), 0) + 1 INTO revision_num 
    FROM order_revisions WHERE order_id = p_order_id;
    
    INSERT INTO order_revisions (order_id, revision_number, changed_by, change_type, changes_summary, new_data)
    VALUES (
        p_order_id, 
        revision_num, 
        p_user_id, 
        'status_change', 
        'Status changed from ' || current_status || ' to ' || p_new_status,
        jsonb_build_object('status', p_new_status, 'timestamp', NOW())
    );
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_from_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    public_user_record RECORD;
    profile_name TEXT;
    profile_position_name TEXT;
    profile_department_name TEXT;
BEGIN
    -- Зөвхөн phone, email эсвэл raw_user_meta_data өөрчлөгдсөн үед л шинэчлэх
    IF (NEW.phone IS DISTINCT FROM OLD.phone) OR
       (NEW.email IS DISTINCT FROM OLD.email) OR
       (NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data) THEN
        
        -- public.users-с шинэ утасны дугаараар хайх
        SELECT 
            nice_name,
            position_name,
            department_name
        INTO public_user_record
        FROM public.users 
        WHERE phone = NEW.phone;
        
        -- Name-г тохируулах
        IF public_user_record.nice_name IS NOT NULL THEN
            profile_name := public_user_record.nice_name;
        ELSE
            profile_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || 
                           COALESCE(NEW.raw_user_meta_data->>'last_name', '');
            IF TRIM(profile_name) = '' THEN
                profile_name := SPLIT_PART(NEW.email, '@', 1);
            END IF;
        END IF;
        
        -- Position name болон department name-г тохируулах
        profile_position_name := public_user_record.position_name;
        profile_department_name := public_user_record.department_name;
        
        -- Profile шинэчлэх
        UPDATE public.profile 
        SET
            name = profile_name,
            phone = NEW.phone,
            position_name = profile_position_name,
            department_name = profile_department_name,
            email = NEW.email
        WHERE auth_user_id = NEW.id;
        
        -- Хэрэв profile олдохгүй бол шинээр үүсгэх
        IF NOT FOUND THEN
            INSERT INTO public.profile (
                auth_user_id,
                name,
                phone,
                position_name,
                department_name,
                email
            )
            VALUES (
                NEW.id,
                profile_name,
                NEW.phone,
                profile_position_name,
                profile_department_name,
                NEW.email
            );
        END IF;
        
        RAISE NOTICE 'Profile шинэчлэгдлээ: auth_user_id=%, name=%', NEW.id, profile_name;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_profile_from_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "target"."cleanup_worker_day_log_14d"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM target.vw_worker_day_log_14d
  WHERE day_date < now() - interval '14 days';
END;
$$;


ALTER FUNCTION "target"."cleanup_worker_day_log_14d"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "target"."fn_sync_job_position"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_gazar_id text;
    v_heltes_id text;
    v_org_id text;
BEGIN
    -- 1. Gazar байгаа эсэхийг шалгах
    SELECT bteg_id INTO v_gazar_id 
    FROM public.gazar 
    WHERE bteg_id = NEW.gazar_id::text;

    -- 2. Heltes байгаа эсэхийг шалгах
    SELECT bteg_id INTO v_heltes_id 
    FROM public.heltes 
    WHERE bteg_id = NEW.heltes_id::text;

    -- 3. Organization байгаа эсэхийг шалгах
    SELECT bteg_id INTO v_org_id 
    FROM public.organization 
    WHERE bteg_id = NEW.organization_id::text;

    -- UPSERT хийх (Олдсон бол утгыг, олдоогүй бол NULL-ийг бичнэ)
    INSERT INTO public.job_position (
        bteg_id, 
        gazar_id, 
        heltes_id, 
        organization_id, 
        name, 
        description, 
        created_at, 
        is_active
    )
    VALUES (
        NEW.id::text,
        v_gazar_id,   -- Шалгагдсан утга
        v_heltes_id,  -- Шалгагдсан утга
        v_org_id,     -- Шалгагдсан утга
        NEW.name,
        NEW.description,
        COALESCE(NEW.created_at, now()),
        NEW.is_active
    )
    ON CONFLICT (bteg_id) 
    DO UPDATE SET 
        gazar_id = EXCLUDED.gazar_id,
        heltes_id = EXCLUDED.heltes_id,
        organization_id = EXCLUDED.organization_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "target"."fn_sync_job_position"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "target"."trg_sync_g_department_to_public"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    safe_gazar_id TEXT;
    safe_heltes_id TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.alba SET is_active = false, updated_at = NOW() WHERE bteg_id = OLD.id::text;
        RETURN OLD;
    ELSE
        -- gazar_id байгаа эсэхийг шалгах
        IF EXISTS (SELECT 1 FROM public.gazar WHERE bteg_id = NEW.gazar_id::text) THEN
            safe_gazar_id := NEW.gazar_id::text;
        ELSE
            safe_gazar_id := NULL;
        END IF;

        -- heltes_id байгаа эсэхийг шалгах
        IF EXISTS (SELECT 1 FROM public.heltes WHERE bteg_id = NEW.heltes_id::text) THEN
            safe_heltes_id := NEW.heltes_id::text;
        ELSE
            safe_heltes_id := NULL;
        END IF;

        INSERT INTO public.alba (
            id, bteg_id, sub_title, organization_id, name, description, gazar_id, heltes_id, is_active, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), NEW.id::text, NEW.sub_title, NEW.organization_id::text, NEW.name, NEW.description, 
            safe_gazar_id, safe_heltes_id,
            CASE WHEN NEW._sdc_deleted_at IS NOT NULL THEN false ELSE NEW.is_active END,
            NEW.created_at, NEW.updated_at
        )
        ON CONFLICT (bteg_id) DO UPDATE SET
            sub_title = EXCLUDED.sub_title,
            organization_id = EXCLUDED.organization_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            gazar_id = EXCLUDED.gazar_id,
            heltes_id = EXCLUDED.heltes_id,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at;
            
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "target"."trg_sync_g_department_to_public"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "target"."trg_sync_g_gazar_to_public"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    safe_org_id TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.gazar 
        SET is_active = false, updated_at = NOW() 
        WHERE bteg_id = OLD.id::text;

        RETURN OLD;
    ELSE
        IF EXISTS (
            SELECT 1 
            FROM public.organization 
            WHERE bteg_id = NEW.organization_id::text
        ) THEN
            safe_org_id := NEW.organization_id::text;
        ELSE
            safe_org_id := NULL;
        END IF;

        INSERT INTO public.gazar (
            id, bteg_id, created_at, updated_at, is_active, organization_id,
            name, description
        )
        VALUES (
            gen_random_uuid(),
            NEW.id::text,
            NEW.created_at,
            NEW.updated_at,
            CASE WHEN NEW._sdc_deleted_at IS NOT NULL THEN false ELSE NEW.is_active END,
            safe_org_id,
            NEW.name,
            NEW.description
        )
        ON CONFLICT (bteg_id) DO UPDATE SET
            updated_at = EXCLUDED.updated_at,
            is_active = EXCLUDED.is_active,
            organization_id = EXCLUDED.organization_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description;

        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "target"."trg_sync_g_gazar_to_public"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "target"."trg_sync_g_heltes_to_public"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    safe_gazar_id TEXT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.heltes SET is_active = false, updated_at = NOW() WHERE bteg_id = OLD.id::text;
        RETURN OLD;
    ELSE
        -- gazar_id байгаа эсэхийг шалгах
        IF EXISTS (SELECT 1 FROM public.gazar WHERE bteg_id = NEW.gazar_id::text) THEN
            safe_gazar_id := NEW.gazar_id::text;
        ELSE
            safe_gazar_id := NULL;
        END IF;

        INSERT INTO public.heltes (
            id, bteg_id, sub_title, organization_id, gazar_id, description, name, is_active, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), NEW.id::text, NEW.sub_title, NEW.organization_id::text, 
            safe_gazar_id, 
            NEW.description, NEW.name,
            CASE WHEN NEW._sdc_deleted_at IS NOT NULL THEN false ELSE NEW.is_active END,
            NEW.created_at, NEW.updated_at
        )
        ON CONFLICT (bteg_id) DO UPDATE SET
            sub_title = EXCLUDED.sub_title,
            organization_id = EXCLUDED.organization_id,
            gazar_id = EXCLUDED.gazar_id,
            description = EXCLUDED.description,
            name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at;
        
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "target"."trg_sync_g_heltes_to_public"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "target"."trg_sync_g_organization_to_public"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.organization SET is_active = false WHERE bteg_id = OLD.id::text;
        RETURN OLD;
    ELSE
        INSERT INTO public.organization (
            id, bteg_id, name, sub_title, is_hr, is_active, description, created_at
        )
        VALUES (
            gen_random_uuid(), NEW.id::text, NEW.name, NEW.sub_title, NEW.is_hr,
            CASE WHEN NEW._sdc_deleted_at IS NOT NULL OR NEW.deleted_at = true THEN false ELSE NEW.is_active END,
            NEW.description, NEW.created_at
        )
        ON CONFLICT (bteg_id) DO UPDATE SET
            name = EXCLUDED.name,
            sub_title = EXCLUDED.sub_title,
            is_hr = EXCLUDED.is_hr,
            is_active = EXCLUDED.is_active,
            description = EXCLUDED.description;
        
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "target"."trg_sync_g_organization_to_public"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alba" (
    "id" "uuid" NOT NULL,
    "bteg_id" "text",
    "sub_title" "text",
    "organization_id" "text",
    "name" "text",
    "description" "text",
    "gazar_id" "text",
    "heltes_id" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."alba" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_correction_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" bigint NOT NULL,
    "bteg_id" bigint NOT NULL,
    "day_date" "date" NOT NULL,
    "original_start_at" timestamp with time zone,
    "original_end_at" timestamp with time zone,
    "requested_start_at" timestamp with time zone,
    "requested_end_at" timestamp with time zone,
    "reason" "text" NOT NULL,
    "attachment_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by_profile_id" bigint,
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    CONSTRAINT "chk_acr_at_least_one_time" CHECK ((("requested_start_at" IS NOT NULL) OR ("requested_end_at" IS NOT NULL))),
    CONSTRAINT "chk_acr_day_not_future" CHECK (("day_date" <= CURRENT_DATE)),
    CONSTRAINT "chk_acr_day_within_30_days" CHECK (("day_date" >= (CURRENT_DATE - '30 days'::interval))),
    CONSTRAINT "chk_acr_reason_length" CHECK (("char_length"("reason") >= 10)),
    CONSTRAINT "chk_acr_start_before_end" CHECK ((("requested_start_at" IS NULL) OR ("requested_end_at" IS NULL) OR ("requested_start_at" < "requested_end_at"))),
    CONSTRAINT "chk_acr_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."attendance_correction_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."attendance_correction_requests" IS 'Ажилтны цаг засварлах хүсэлт. Зөвхөн create_attendance_correction_request() RPC-ээр insert хийгдэнэ.';



CREATE TABLE IF NOT EXISTS "public"."attendance_correction_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "actor_profile_id" bigint NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_acsh_to_status" CHECK (("to_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."attendance_correction_status_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."attendance_correction_status_history" IS 'Цаг засварлах хүсэлтийн audit log — статусын шилжилт бүрд бичигдэнэ.';



CREATE TABLE IF NOT EXISTS "public"."attendance_corrections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" bigint NOT NULL,
    "bteg_id" bigint NOT NULL,
    "day_date" "date" NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "created_from_request_id" "uuid" NOT NULL,
    "created_by_profile_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_ac_at_least_one_time" CHECK ((("start_at" IS NOT NULL) OR ("end_at" IS NOT NULL))),
    CONSTRAINT "chk_ac_start_before_end" CHECK ((("start_at" IS NULL) OR ("end_at" IS NULL) OR ("start_at" < "end_at")))
);


ALTER TABLE "public"."attendance_corrections" OWNER TO "postgres";


COMMENT ON TABLE "public"."attendance_corrections" IS 'Зөвшөөрөгдсөн override давхарга. Зөвхөн approve_attendance_correction_request() RPC үүсгэнэ.';



CREATE TABLE IF NOT EXISTS "public"."banners" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "tag" "text",
    "image_url" "text" NOT NULL,
    "link_url" "text",
    "news_id" bigint,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."banners" OWNER TO "postgres";


ALTER TABLE "public"."banners" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."banners_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."chefs" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "dining_hall_id" bigint NOT NULL,
    "pin" "text" DEFAULT '0000'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "phone" "text"
);


ALTER TABLE "public"."chefs" OWNER TO "postgres";


ALTER TABLE "public"."chefs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."chefs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."clause" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "text" "text",
    "reference_number" "text",
    "section_id" "uuid",
    "parent_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "policy_id" "uuid"
);


ALTER TABLE "public"."clause" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clause_job_position" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clause_id" "uuid",
    "job_position_id" "uuid",
    "type" "text",
    "is_checked" boolean
);


ALTER TABLE "public"."clause_job_position" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_meal_summary" (
    "id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "dining_hall_id" bigint,
    "breakfast_count" numeric(10,1) DEFAULT 0,
    "morning_meal_count" numeric(10,1) DEFAULT 0,
    "lunch_count" numeric(10,1) DEFAULT 0,
    "dinner_count" numeric(10,1) DEFAULT 0,
    "night_meal_count" numeric(10,1) DEFAULT 0,
    "extend_morning_count" numeric(10,1) DEFAULT 0,
    "extend_lunch_count" numeric(10,1) DEFAULT 0,
    "snack_count" integer DEFAULT 0,
    "manual_override_total" integer DEFAULT 0,
    "extra_serving_total" numeric(10,1) DEFAULT 0,
    "grand_total" numeric(10,1) DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "wrong_location_total" integer DEFAULT 0,
    "sub_employee_total" integer DEFAULT 0
);


ALTER TABLE "public"."daily_meal_summary" OWNER TO "postgres";


ALTER TABLE "public"."daily_meal_summary" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."daily_meal_summary_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."device_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."device_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "changed_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."device_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "uuid" NOT NULL,
    "maintenance_date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "technician" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."device_maintenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_request_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."device_request_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_request_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "note" "text",
    "changed_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."device_request_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "req_org_bteg" "text",
    "req_heltes_bteg" "text",
    "req_alba_bteg" "text",
    "request_type" "text" DEFAULT 'new'::"text" NOT NULL,
    "device_type" "text",
    "specs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "purpose" "text",
    "notes" "text",
    "old_device_id" "uuid",
    "transfer_old" boolean DEFAULT false NOT NULL,
    "transfer_to_org_bteg" "text",
    "transfer_to_heltes_bteg" "text",
    "transfer_to_alba_bteg" "text",
    "transfer_to_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "created_by" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "assigned_to" integer,
    "fulfilled_by_request_id" "uuid",
    "parent_request_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "device_requests_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "device_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['new'::"text", 'replace'::"text", 'transfer'::"text", 'decommission'::"text", 'repair'::"text"]))),
    CONSTRAINT "device_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."device_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "model" "text",
    "serial_number" "text",
    "manufacturer" "text",
    "device_type" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "location" "text",
    "purchase_date" "date",
    "warranty_expiry_date" "date",
    "notes" "text",
    "specs" "jsonb" DEFAULT '{}'::"jsonb",
    "organization_id" "uuid",
    "department_name" "text",
    "heltes_name" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "heltes_id" "uuid",
    "alba_id" "uuid",
    "paired_with_device_id" "uuid"
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dining_hall" (
    "id" bigint NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location" "text"
);


ALTER TABLE "public"."dining_hall" OWNER TO "postgres";


ALTER TABLE "public"."dining_hall" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dining_hall_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."food_report_daily_snapshot" (
    "id" bigint NOT NULL,
    "report_date" "date" NOT NULL,
    "dining_hall_id" bigint NOT NULL,
    "meal_type" "text" NOT NULL,
    "org_name" "text" NOT NULL,
    "dep_name" "text" NOT NULL,
    "heltes_name" "text" NOT NULL,
    "expected_count" bigint DEFAULT 0 NOT NULL,
    "actual_count" numeric DEFAULT 0 NOT NULL,
    "manual_override_total" bigint DEFAULT 0 NOT NULL,
    "extra_serving_total" bigint DEFAULT 0 NOT NULL,
    "wrong_location_total" bigint DEFAULT 0 NOT NULL,
    "source_finalized_at" timestamp with time zone NOT NULL,
    "is_final" boolean DEFAULT true NOT NULL,
    "refreshed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."food_report_daily_snapshot" OWNER TO "postgres";


ALTER TABLE "public"."food_report_daily_snapshot" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."food_report_daily_snapshot_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fulfillment_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fulfillment_id" bigint,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "reason" "text",
    "changed_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fulfillment_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gazar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bteg_id" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "is_active" boolean,
    "organization_id" "text",
    "name" "text",
    "description" "text"
);


ALTER TABLE "public"."gazar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."heltes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bteg_id" "text",
    "sub_title" "text",
    "organization_id" "text",
    "gazar_id" "text" DEFAULT 'NULL'::"text",
    "description" "text",
    "name" "text",
    "is_active" boolean DEFAULT false,
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."heltes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_description" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_position_id" "uuid",
    "title" "text",
    "date" "date" DEFAULT "now"(),
    "a_code" "text",
    "communication_scope" json,
    "purpose" "text",
    "schedule" "text",
    "daily_hours" "text",
    "break_time" "text",
    "duties" "text"[],
    "education_level" "text",
    "work_experience" "text",
    "general_skills" "text"[],
    "professional_skills" "text"[],
    "additional_courses" "text"[],
    "authority" "text"[],
    "responsibilities" "text"[],
    "property_liability" "text"[],
    "relevant_laws" "text"[],
    "note" "text",
    "resources" "text",
    "is_deleted" boolean DEFAULT false,
    "job_condition" "text",
    "at_code" "text",
    "subordinate_pos_id" "uuid"[],
    "supervisor_pos_id" "uuid"[],
    "duplicated_pos_id" "uuid"
);


ALTER TABLE "public"."job_description" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_position" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bteg_id" "text",
    "gazar_id" "text",
    "alba_id" "text",
    "heltes_id" "text",
    "organization_id" "text",
    "name" "text",
    "description" "text",
    "created_at" timestamp without time zone,
    "is_active" boolean
);


ALTER TABLE "public"."job_position" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosk_pairing_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dining_hall_id" bigint,
    "chef_phone" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assigned_uuid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message" "text"
);


ALTER TABLE "public"."kiosk_pairing_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosks" (
    "id" bigint NOT NULL,
    "device_name" "text" NOT NULL,
    "dining_hall_id" bigint NOT NULL,
    "device_uuid" "uuid" NOT NULL,
    "last_heartbeat" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kiosks" OWNER TO "postgres";


ALTER TABLE "public"."kiosks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."kiosks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_request_instances" (
    "id" bigint NOT NULL,
    "leave_request_id" bigint NOT NULL,
    "process_id" bigint NOT NULL,
    "current_step_order" smallint DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "process_snapshot" "jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "leave_request_instances_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."leave_request_instances" OWNER TO "postgres";


ALTER TABLE "public"."leave_request_instances" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leave_request_instances_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_request_processes" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_profile_id" bigint
);


ALTER TABLE "public"."leave_request_processes" OWNER TO "postgres";


ALTER TABLE "public"."leave_request_processes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leave_request_processes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_request_status_history" (
    "id" bigint NOT NULL,
    "leave_request_id" bigint NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by_profile_id" bigint,
    "note" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leave_request_status_history" OWNER TO "postgres";


ALTER TABLE "public"."leave_request_status_history" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leave_request_status_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_request_step_reviewers" (
    "id" bigint NOT NULL,
    "instance_id" bigint NOT NULL,
    "step_order" smallint NOT NULL,
    "reviewer_profile_id" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "note" "text",
    "reviewed_at" timestamp with time zone,
    CONSTRAINT "leave_request_step_reviewers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."leave_request_step_reviewers" OWNER TO "postgres";


ALTER TABLE "public"."leave_request_step_reviewers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leave_request_step_reviewers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_request_step_roles" (
    "id" bigint NOT NULL,
    "step_id" bigint NOT NULL,
    "role_id" bigint NOT NULL
);


ALTER TABLE "public"."leave_request_step_roles" OWNER TO "postgres";


ALTER TABLE "public"."leave_request_step_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leave_request_step_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_request_steps" (
    "id" bigint NOT NULL,
    "process_id" bigint NOT NULL,
    "step_order" smallint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."leave_request_steps" OWNER TO "postgres";


ALTER TABLE "public"."leave_request_steps" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leave_request_steps_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "leave_type_id" bigint NOT NULL,
    "duration_days" numeric(4,1) NOT NULL,
    "description" "text",
    "file_url" "text",
    "file_name" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date",
    "end_date" "date",
    "is_half_day" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "leave_requests_date_check" CHECK ((("start_date" IS NULL) OR ("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "leave_requests_duration_check" CHECK (("duration_days" > (0)::numeric)),
    CONSTRAINT "leave_requests_duration_days_check" CHECK (("duration_days" > (0)::numeric)),
    CONSTRAINT "leave_requests_half_day_check" CHECK (((NOT "is_half_day") OR ("start_date" = "end_date"))),
    CONSTRAINT "leave_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_review'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


ALTER TABLE "public"."leave_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."leave_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leave_types" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "process_id" bigint
);


ALTER TABLE "public"."leave_types" OWNER TO "postgres";


ALTER TABLE "public"."leave_types" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."leave_types_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."legal_act_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_act_id" "uuid" NOT NULL,
    "bucket" "text" DEFAULT 'policy-legal-acts'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."legal_act_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_acts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "act_type" "text" NOT NULL,
    "act_number" "text" NOT NULL,
    "act_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "body_text" "text",
    "notes" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "legal_acts_act_type_check" CHECK (("act_type" = ANY (ARRAY['03'::"text", '04'::"text"])))
);


ALTER TABLE "public"."legal_acts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meal_location_overrides" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bteg_id" "text" NOT NULL,
    "date" "date" NOT NULL,
    "meal_type" "public"."meal_type_enum" NOT NULL,
    "dining_hall_id" bigint NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" bigint,
    "is_deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."meal_location_overrides" OWNER TO "postgres";


ALTER TABLE "public"."meal_location_overrides" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."meal_location_overrides_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."meal_logs" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "dining_hall_id" bigint,
    "meal_type" "text" NOT NULL,
    "scanned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "chef_id" bigint,
    "is_extra_serving" boolean DEFAULT false NOT NULL,
    "is_manual_override" boolean DEFAULT false NOT NULL,
    "device_uuid" "uuid",
    "sync_key" "text",
    "bteg_id" "text",
    "is_wrong_location" boolean DEFAULT false,
    "sub_employee_id" "uuid",
    CONSTRAINT "meal_logs_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'night_meal'::"text", 'morning_meal'::"text", 'snack'::"text", 'extend_lunch'::"text", 'extend_morning_meal'::"text"])))
);


ALTER TABLE "public"."meal_logs" OWNER TO "postgres";


ALTER TABLE "public"."meal_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."meal_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."meal_time_slots" (
    "id" bigint NOT NULL,
    "dining_hall_id" bigint NOT NULL,
    "meal_type" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "meal_time_slots_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'night_meal'::"text", 'morning_meal'::"text", 'snack'::"text"])))
);


ALTER TABLE "public"."meal_time_slots" OWNER TO "postgres";


ALTER TABLE "public"."meal_time_slots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."meal_time_slots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."news" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "body" "text",
    "image_url" "text",
    "likes" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "published_at" timestamp with time zone,
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."news" OWNER TO "postgres";


ALTER TABLE "public"."news" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."news_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" bigint NOT NULL,
    "profile_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'success'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


ALTER TABLE "public"."notifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_fulfillment" (
    "id" bigint NOT NULL,
    "order_item_id" bigint,
    "quantity" real NOT NULL,
    "status" "text" DEFAULT 'ordered'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "purchase_line_id" bigint
);


ALTER TABLE "public"."order_fulfillment" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_fulfillment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_fulfillment_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_fulfillment_id_seq" OWNED BY "public"."order_fulfillment"."id";



CREATE TABLE IF NOT EXISTS "public"."order_instances" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_id" bigint,
    "order_process_id" bigint,
    "current_step_order" smallint DEFAULT '1'::smallint NOT NULL,
    "status" "text",
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."order_instances" OWNER TO "postgres";


ALTER TABLE "public"."order_instances" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_instances_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "part_number" character varying(100),
    "part_name" character varying(200) NOT NULL,
    "part_description" "text",
    "manufacturer" character varying(100),
    "quantity" real NOT NULL,
    "status" "text",
    "notes" "text",
    "expected_delivery_date" "date",
    "actual_delivery_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "unit" "text" NOT NULL,
    "image_url" "text",
    "spare_type" "text",
    "final_quantity" real
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_items_id_seq" OWNED BY "public"."order_items"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."order_number_seq"
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_process_allowed_heltes" (
    "id" bigint NOT NULL,
    "order_process_id" bigint NOT NULL,
    "heltes_bteg_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_process_allowed_heltes" OWNER TO "postgres";


ALTER TABLE "public"."order_process_allowed_heltes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_process_allowed_heltes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_process_purchase_roles" (
    "id" bigint NOT NULL,
    "order_process_id" bigint NOT NULL,
    "role_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_process_purchase_roles" OWNER TO "postgres";


ALTER TABLE "public"."order_process_purchase_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_process_purchase_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_steps" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_process_id" bigint,
    "step_order" smallint NOT NULL,
    "step_name" "text",
    "required_approval_count" smallint DEFAULT '1'::smallint
);


ALTER TABLE "public"."order_steps" OWNER TO "postgres";


ALTER TABLE "public"."order_steps" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_process_steps_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_processes" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."order_processes" OWNER TO "postgres";


ALTER TABLE "public"."order_processes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_processes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_purchase_batches" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "supplier_id" bigint NOT NULL,
    "reference_number" "text",
    "purchased_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "paid_at" "date",
    "notes" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quote_id" bigint
);


ALTER TABLE "public"."order_purchase_batches" OWNER TO "postgres";


ALTER TABLE "public"."order_purchase_batches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_purchase_batches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_purchase_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_batch_id" bigint NOT NULL,
    "doc_type" "text" NOT NULL,
    "bucket" "text" DEFAULT 'order-purchase-documents'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_purchase_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['invoice'::"text", 'payment_receipt'::"text"])))
);


ALTER TABLE "public"."order_purchase_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_purchase_lines" (
    "id" bigint NOT NULL,
    "purchase_batch_id" bigint NOT NULL,
    "order_item_id" bigint NOT NULL,
    "quantity" real NOT NULL,
    "unit_price" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'MNT'::"text" NOT NULL,
    "vat_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "price_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_purchase_lines_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "order_purchase_lines_quantity_check" CHECK (("quantity" > (0)::double precision)),
    CONSTRAINT "order_purchase_lines_unit_price_check" CHECK (("unit_price" >= (0)::numeric)),
    CONSTRAINT "order_purchase_lines_vat_amount_check" CHECK (("vat_amount" >= (0)::numeric))
);


ALTER TABLE "public"."order_purchase_lines" OWNER TO "postgres";


ALTER TABLE "public"."order_purchase_lines" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_purchase_lines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_purchase_quote_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" bigint NOT NULL,
    "bucket" "text" DEFAULT 'order-purchase-quotes'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_purchase_quote_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_purchase_quote_lines" (
    "id" bigint NOT NULL,
    "quote_id" bigint NOT NULL,
    "order_item_id" bigint NOT NULL,
    "quantity" real NOT NULL,
    "unit_price" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'MNT'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_purchase_quote_lines_quantity_check" CHECK (("quantity" > (0)::double precision)),
    CONSTRAINT "order_purchase_quote_lines_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_purchase_quote_lines" OWNER TO "postgres";


ALTER TABLE "public"."order_purchase_quote_lines" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_purchase_quote_lines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_purchase_quotes" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "supplier_id" bigint NOT NULL,
    "quote_number" "text",
    "quote_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date",
    "notes" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_purchase_quotes" OWNER TO "postgres";


ALTER TABLE "public"."order_purchase_quotes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_purchase_quotes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" bigint,
    "old_status" "text" NOT NULL,
    "new_status" "text" NOT NULL,
    "changed_by" bigint,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_step_reviewers" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_instance_id" bigint,
    "order_step_id" bigint,
    "reviewer_profile_id" bigint,
    "status" "text",
    "reviewed_at" timestamp with time zone,
    "role_id" bigint,
    "comment" "text"
);


ALTER TABLE "public"."order_step_reviewers" OWNER TO "postgres";


ALTER TABLE "public"."order_step_reviewers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_step_reviewers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_step_roles" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" bigint,
    "order_step_id" bigint
);


ALTER TABLE "public"."order_step_roles" OWNER TO "postgres";


ALTER TABLE "public"."order_step_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_step_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_suppliers" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "registration_number" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "order_suppliers_name_not_blank" CHECK (("length"("btrim"("name")) > 0))
);


ALTER TABLE "public"."order_suppliers" OWNER TO "postgres";


ALTER TABLE "public"."order_suppliers" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_suppliers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_workflow" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "from_status" character varying(50),
    "to_status" character varying(50) NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "change_reason" "text",
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_workflow" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_workflow_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_workflow_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_workflow_id_seq" OWNED BY "public"."order_workflow"."id";



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" bigint NOT NULL,
    "order_number" character varying(50) NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "urgency_level" character varying(20) DEFAULT 'medium'::character varying,
    "requested_delivery_date" "date",
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "submitted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "total_estimated_cost" bigint,
    "created_profile" bigint,
    "auth_user_id" "uuid",
    "order_type" "text",
    "rejected_at" timestamp with time zone,
    "order_process_id" bigint,
    "management_status" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."orders_id_seq" OWNED BY "public"."orders"."id";



CREATE TABLE IF NOT EXISTS "public"."organization" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bteg_id" "text",
    "name" "text",
    "sub_title" "text",
    "is_hr" boolean,
    "is_active" boolean,
    "description" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."organization" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "module" "text",
    "action" "text"
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


ALTER TABLE "public"."permissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."policy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "approved_date" "date",
    "reference_code" "text",
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."policy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_revision_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_revision_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "policy_id" "uuid",
    "section_id" "uuid",
    "clause_id" "uuid",
    "change_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_action" "text" DEFAULT 'updated'::"text" NOT NULL,
    CONSTRAINT "policy_revision_target_matches_type" CHECK (((("target_type" = 'policy'::"text") AND ("policy_id" IS NOT NULL) AND ("section_id" IS NULL) AND ("clause_id" IS NULL)) OR (("target_type" = 'section'::"text") AND ("section_id" IS NOT NULL) AND ("clause_id" IS NULL)) OR (("target_type" = 'clause'::"text") AND ("clause_id" IS NOT NULL)))),
    CONSTRAINT "policy_revision_targets_change_action_check" CHECK (("change_action" = ANY (ARRAY['updated'::"text", 'added'::"text", 'invalidated'::"text", 'deleted'::"text"]))),
    CONSTRAINT "policy_revision_targets_target_type_check" CHECK (("target_type" = ANY (ARRAY['policy'::"text", 'section'::"text", 'clause'::"text"])))
);


ALTER TABLE "public"."policy_revision_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_act_id" "uuid" NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."policy_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_scope_targets" (
    "id" bigint NOT NULL,
    "policy_id" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_bteg_id" "text" NOT NULL,
    "target_name" "text",
    "parent_bteg_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "policy_scope_targets_target_type_check" CHECK (("target_type" = ANY (ARRAY['heltes'::"text", 'alba'::"text"])))
);


ALTER TABLE "public"."policy_scope_targets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."policy_scope_targets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."policy_scope_targets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."policy_scope_targets_id_seq" OWNED BY "public"."policy_scope_targets"."id";



CREATE TABLE IF NOT EXISTS "public"."profile" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "name" "text",
    "phone" "text",
    "position_name" "text",
    "department_name" "text",
    "email" "text"
);


ALTER TABLE "public"."profile" OWNER TO "postgres";


ALTER TABLE "public"."profile" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profile_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rating" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "score" smallint,
    "description" "text",
    "is_deleted" boolean,
    "clause_job_position_id" "uuid",
    "rating_session_id" "uuid",
    "scored_date" "date"
);


ALTER TABLE "public"."rating" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rating_session" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "name" "text",
    "rating_process" "text"
);


ALTER TABLE "public"."rating_session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" bigint,
    "permission_id" bigint,
    "assigned_by" bigint
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


ALTER TABLE "public"."role_permissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."role_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" bigint NOT NULL,
    "name" character varying(50) NOT NULL,
    "display_name" character varying(100) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



CREATE TABLE IF NOT EXISTS "public"."roles_profiles" (
    "id" bigint NOT NULL,
    "role_id" bigint NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "notes" "text",
    "profile_id" bigint
);


ALTER TABLE "public"."roles_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."section" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "text" "text",
    "reference_number" "text",
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."section" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_employee_for_food" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "custom_label" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "bteg_id" "text"
);


ALTER TABLE "public"."sub_employee_for_food" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_employee_meal_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "dining_hall_id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "breakfast_count" integer DEFAULT 0 NOT NULL,
    "lunch_count" integer DEFAULT 0 NOT NULL,
    "dinner_count" integer DEFAULT 0 NOT NULL,
    "night_meal_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "morning_meal_count" integer DEFAULT 0
);


ALTER TABLE "public"."sub_employee_meal_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_order_item" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_item_id" bigint,
    "quantity" real,
    "status" "text",
    "description" "text",
    "created_by" bigint,
    "order_id" bigint,
    "reviewer_profile_id" bigint,
    "order_instance_id" bigint,
    "order_step_id" bigint
);


ALTER TABLE "public"."sub_order_item" OWNER TO "postgres";


ALTER TABLE "public"."sub_order_item" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sub_order_item_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_autobus_request" (
    "id" bigint NOT NULL,
    "profile_id" bigint NOT NULL,
    "bteg_id" bigint NOT NULL,
    "eelj_id" bigint NOT NULL,
    "autobus_id" bigint NOT NULL,
    "status" "public"."eelj_request_status" DEFAULT 'requested'::"public"."eelj_request_status" NOT NULL,
    "comment" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "decided_by_profile_id" bigint,
    "decision_reason" "text",
    "requester_first_name" "text",
    "requester_last_name" "text",
    "requester_phone" "text",
    "requester_position" "text",
    "requester_department" "text",
    "eelj_name" "text",
    "autobus_number" "text",
    "direction_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_autobus_request" OWNER TO "postgres";


ALTER TABLE "public"."user_autobus_request" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."user_autobus_request_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_meal_configs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "breakfast_location" bigint,
    "lunch_location" bigint,
    "dinner_location" bigint,
    "night_meal_location" bigint,
    "morning_meal_location" bigint,
    "created_by" bigint,
    "bteg_id" "text",
    "extend_morning_meal_location" bigint,
    "extend_lunch_location" bigint
);


ALTER TABLE "public"."user_meal_configs" OWNER TO "postgres";


ALTER TABLE "public"."user_meal_configs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_meal_configs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_roles_id_seq" OWNED BY "public"."roles_profiles"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bteg_id" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "idcard_number" "text",
    "is_active" boolean DEFAULT true,
    "address" "text",
    "register_number" "text",
    "gazar_id" "text",
    "alba_id" "text",
    "heltes_id" "text",
    "job_position_id" "text",
    "nice_name" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "first_name" "text",
    "last_name" "text",
    "organization_id" "text",
    "department_id" "text",
    "department_name" "text",
    "heltes_name" "text",
    "position_name" "text",
    "sms_code" "text",
    "auth_user_id" "uuid"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."users_with_stats" AS
 SELECT "user_id",
    "first_name",
    "last_name",
    "phone",
    "idcard_number",
    "bteg_id",
    "heltes_name",
    "position_name",
    "breakfast_location",
    "lunch_location",
    "dinner_location",
    "night_meal_location",
    "morning_meal_location",
    "extend_morning_meal_location",
    "extend_lunch_location",
    "start_at",
    "end_at",
    "is_working"
   FROM "public"."get_users_with_stats"() "get_users_with_stats"("user_id", "first_name", "last_name", "phone", "idcard_number", "bteg_id", "heltes_name", "position_name", "breakfast_location", "lunch_location", "dinner_location", "night_meal_location", "morning_meal_location", "extend_morning_meal_location", "extend_lunch_location", "start_at", "end_at", "is_working");


ALTER VIEW "public"."users_with_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."api_token" (
    "token" "text",
    "api_link" "text",
    "api_method" "text",
    "created_at" timestamp without time zone,
    "expired_at" timestamp without time zone,
    "id" bigint NOT NULL,
    "api_name" "text",
    "updated_at" timestamp without time zone,
    "auth_type" "text",
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."api_token" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."attendance_log" (
    "sahilga_id" bigint,
    "first_name" "text",
    "before_day_description" "text",
    "organization_id" bigint,
    "is_calculated" boolean,
    "bio_id" bigint,
    "updated_user_id" bigint,
    "created_at" timestamp without time zone,
    "created_user_id" bigint,
    "id" bigint NOT NULL,
    "terminal_alias" "text",
    "is_hr" boolean,
    "terminal_sn" "text",
    "upload_time" timestamp without time zone,
    "punch_time" timestamp without time zone,
    "last_name" "text",
    "emp_code" "text",
    "day_description" "text",
    "area_alias" "text",
    "is_sahilga" boolean,
    "updated_at" timestamp without time zone,
    "day_date" timestamp without time zone,
    "gps_location" "text",
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."attendance_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_department" (
    "updated_user_id" bigint,
    "parent_id" bigint,
    "is_active" boolean,
    "created_at" timestamp without time zone,
    "description" "text",
    "updated_at" timestamp without time zone,
    "created_user_id" bigint,
    "sub_title" "text",
    "sort_order" bigint,
    "darga_id" bigint,
    "is_new" boolean,
    "gazar_id" bigint,
    "organization_id" bigint,
    "heltes_id" bigint,
    "telegram_id" "text",
    "name" "text",
    "id" bigint NOT NULL,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."g_department" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_gazar" (
    "updated_at" timestamp without time zone,
    "organization_id" bigint,
    "created_at" timestamp without time zone,
    "description" "text",
    "darga_id" bigint,
    "name" "text",
    "id" bigint NOT NULL,
    "is_active" boolean,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."g_gazar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_heltes" (
    "updated_at" timestamp without time zone,
    "created_user_id" bigint,
    "sub_title" "text",
    "updated_user_id" bigint,
    "sort_order" bigint,
    "gazar_id" bigint,
    "is_new" boolean,
    "darga_id" bigint,
    "organization_id" bigint,
    "is_active" boolean,
    "telegram_id" "text",
    "created_at" timestamp without time zone,
    "description" "text",
    "name" "text",
    "id" bigint NOT NULL,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."g_heltes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_job_position" (
    "file_name" "text",
    "min_tsalin_zereg" numeric,
    "file_path" "text",
    "heseg_id" bigint,
    "updated_user_id" bigint,
    "min_emplyoyee" bigint,
    "at_code" "text",
    "is_active" boolean,
    "department_id" bigint,
    "created_at" timestamp without time zone,
    "description" "text",
    "max_emplyoyee" bigint,
    "max_tsalin_zereg" numeric,
    "ajil_mergejliin_angilal" "text",
    "updated_at" timestamp without time zone,
    "is_definition" boolean,
    "created_user_id" bigint,
    "sort_order" bigint,
    "created_by" bigint,
    "gazar_id" bigint,
    "is_new" boolean,
    "organization_id" bigint,
    "heltes_id" bigint,
    "type_id" bigint,
    "name" "text",
    "id" bigint NOT NULL,
    "definition" "text",
    "updated_by" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."g_job_position" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_organization" (
    "about" "text",
    "parent_id" bigint,
    "status" bigint,
    "is_featured" boolean,
    "description" "text",
    "video" "text",
    "facebook" "text",
    "note" "text",
    "expired_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "sort_order" bigint,
    "created_by" bigint,
    "is_blocked" boolean,
    "telegram_id" "text",
    "name" "text",
    "key_word" "text",
    "id" bigint NOT NULL,
    "logo_path" "text",
    "is_hr" boolean,
    "email" "text",
    "is_active" boolean,
    "created_at" timestamp without time zone,
    "deleted_at" boolean,
    "config" "text",
    "web_site" "text",
    "sector_id" bigint,
    "pinterest" "text",
    "instagram" "text",
    "sub_title" "text",
    "phone" "text",
    "fax" "text",
    "linkedin" "text",
    "twitter" "text",
    "slug" "text",
    "is_trash" boolean,
    "updated_by" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."g_organization" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."h_autobus" (
    "number" "text",
    "user_name" "text",
    "user_id" bigint,
    "eel_soliltsoo_id" bigint,
    "driver_name" "text",
    "updated_at" timestamp without time zone,
    "number_person" bigint,
    "apart_position_id" bigint,
    "is_active" boolean,
    "eelj" "text",
    "count_users" bigint,
    "day_date" timestamp without time zone,
    "created_at" timestamp without time zone,
    "apart_position" "text",
    "start_time" time without time zone,
    "extra_driver_phone_number" "text",
    "id" bigint NOT NULL,
    "full_name" "text",
    "direction_id" bigint,
    "extra_driver_name" "text",
    "driver_phone_number" "text",
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."h_autobus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."h_autobus_direction" (
    "name" "text",
    "zam_tsag" bigint,
    "district_id" bigint,
    "created_at" timestamp without time zone,
    "id" bigint NOT NULL,
    "updated_at" timestamp without time zone,
    "city_id" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."h_autobus_direction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."h_eelj_soliltsoo" (
    "updated_at" timestamp without time zone,
    "is_come" boolean,
    "name" "text",
    "day_date" timestamp without time zone,
    "created_at" timestamp without time zone,
    "id" bigint NOT NULL,
    "is_active" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."h_eelj_soliltsoo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."h_user_autobus_address" (
    "eel_soliltsoo_id" bigint,
    "machine_number" "text",
    "zam_tsag_day_date" timestamp without time zone,
    "apart_position_id" bigint,
    "is_done" boolean,
    "group_id" bigint,
    "bmisc_zam_tsag" bigint,
    "approved_zam_tsag" bigint,
    "district_id" bigint,
    "sit_number" bigint,
    "city_id" bigint,
    "land_position_address" "text",
    "street" "text",
    "zam_tsag" bigint,
    "bmisc_autobus_id" bigint,
    "user_id" "text",
    "created_at" timestamp without time zone,
    "id" bigint NOT NULL,
    "updated_at" timestamp without time zone,
    "address" "text",
    "user_direction_id" bigint,
    "day_date" timestamp without time zone,
    "user_apart_position_id" bigint,
    "not_done_issue" "text",
    "apart_position" "text",
    "is_personal_machine" boolean,
    "autobus_id" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."h_user_autobus_address" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."sf_guard_group" (
    "created_at" timestamp without time zone,
    "id" bigint NOT NULL,
    "description" "text",
    "cheif_id" bigint,
    "updated_at" timestamp without time zone,
    "created_user_id" bigint,
    "organization_id" bigint,
    "name" "text",
    "updated_user_id" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."sf_guard_group" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."sf_guard_user" (
    "password" "text",
    "nice_name" "text",
    "tsalin_zereg_id" bigint,
    "email_address" "text",
    "is_ok" boolean,
    "username" "text",
    "confirmation_token" "text",
    "work_time_id" bigint,
    "salt" "text",
    "alba_id" bigint,
    "is_super_admin" boolean,
    "nas" bigint,
    "out_text" "text",
    "work_type_id" bigint,
    "heseg_name" "text",
    "department_id" bigint,
    "command_number" "text",
    "alban_tushaal_id" bigint,
    "is_confirm" boolean,
    "credentials_expire_at" timestamp without time zone,
    "ajillasan_jil" "text",
    "zereg" "text",
    "status_id" bigint,
    "is_active" boolean,
    "birthday" timestamp without time zone,
    "position_name" "text",
    "created_user_id" bigint,
    "last_autobus_id" bigint,
    "is_tetgever" boolean,
    "created_at" timestamp without time zone,
    "expired" boolean,
    "old_position_user" bigint,
    "description" "text",
    "ajliin_gazriin_bairshil" bigint,
    "heseg_id" bigint,
    "zergiin_angilal" bigint,
    "dans_dugaar" "text",
    "is_jiremsnii_amralt" boolean,
    "d_turul_code" bigint,
    "updated_user_id" bigint,
    "locked" boolean,
    "first_name" "text",
    "group_reason" "text",
    "password_requested_at" timestamp without time zone,
    "alban_tushaal_code" bigint,
    "heltes_name" "text",
    "out_category_id" bigint,
    "huis" "text",
    "heseg" bigint,
    "last_direction_id" bigint,
    "current_not_work_days" bigint,
    "roles" "text",
    "heltes_id" bigint,
    "autobus_direction_id" bigint,
    "next_eelj_soliltoo" timestamp without time zone,
    "in_date" timestamp without time zone,
    "family_name" "text",
    "fb_user_id" bigint,
    "organization_id" bigint,
    "nd_country_year" bigint,
    "position_id" bigint,
    "sector_id" bigint,
    "eelj_soliltsoo_id" bigint,
    "last_name" "text",
    "expires_at" timestamp without time zone,
    "tsag_burtgeliin_tailbar" "text",
    "id" bigint NOT NULL,
    "profile_image" "text",
    "ndd" "text",
    "address" "text",
    "algorithm" "text",
    "code" "text",
    "is_group" boolean,
    "out_date" timestamp without time zone,
    "department_name" "text",
    "idcard_number" "text",
    "master_group" bigint,
    "is_empty_position" boolean,
    "ajillasan_nuhtsul" "text",
    "current_worked_days" bigint,
    "geree_ehelsen" timestamp without time zone,
    "emdd" "text",
    "geree_duusah" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "mobile_confirmation" "text",
    "last_login" timestamp without time zone,
    "gazar_id" bigint,
    "sanhuu_dugaar" "text",
    "out_category_type_id" bigint,
    "sf_guard_group_id" bigint,
    "kart_dugaar" "text",
    "register_number" "text",
    "ajil_mergejliin_angilal" "text",
    "job_type_id" bigint,
    "twitter_user_id" bigint,
    "phone2" "text",
    "phone" "text",
    "credentials_expired" boolean,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint,
    "udaan_jil" bigint,
    "daatguulagchin_turul" "text"
);


ALTER TABLE "target"."sf_guard_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."vw_worker_day_log_14d" (
    "iluu_tsag_night" numeric,
    "iluu_tsag" bigint,
    "lunch_time_end_punch" timestamp without time zone,
    "lunch_time_end" timestamp without time zone,
    "created_by" bigint,
    "shunu_tsag_amralt" numeric,
    "sul_zogsolt" numeric,
    "shunu_tsag_ajil" numeric,
    "shift" bigint,
    "shunu_tsag_bayar" numeric,
    "locker_id" bigint,
    "work_end_at" timestamp without time zone,
    "sungaa_tsag" numeric,
    "iluu_tsag_day" numeric,
    "status_id" bigint,
    "udur_tsag_amralt" numeric,
    "max_time" bigint,
    "udur_tsag_ajil" numeric,
    "edited_description" "text",
    "is_lunch_early" boolean,
    "is_lunch_late" boolean,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "employee_code_day_date" "text",
    "eelj_soliltsoo_id" bigint,
    "id" bigint,
    "work_duration" bigint,
    "work_start_at" timestamp without time zone,
    "lunch_time_start_punch" timestamp without time zone,
    "is_hotsorson" boolean,
    "is_online" boolean,
    "lunch_time_start" timestamp without time zone,
    "gazar_id" bigint,
    "employee_id_day_date" "text",
    "end_at" timestamp without time zone,
    "is_ert_tarsan" boolean,
    "current_group_name" "text",
    "description" "text",
    "log_id" bigint,
    "udur_tsag_bayar" numeric,
    "log_type" bigint,
    "day_date" timestamp without time zone,
    "worker_id" bigint,
    "day_zam_tsag" numeric,
    "start_at" timestamp without time zone,
    "travel_zam_tsag" numeric,
    "organization_id" bigint,
    "work_time_id" bigint,
    "_sdc_extracted_at" timestamp without time zone,
    "_sdc_received_at" timestamp without time zone,
    "_sdc_batched_at" timestamp without time zone,
    "_sdc_deleted_at" timestamp without time zone,
    "_sdc_sequence" bigint,
    "_sdc_table_version" bigint,
    "_sdc_sync_started_at" bigint
);


ALTER TABLE "target"."vw_worker_day_log_14d" OWNER TO "postgres";


ALTER TABLE ONLY "public"."order_fulfillment" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_fulfillment_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_workflow" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_workflow_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."orders" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."orders_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."policy_scope_targets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."policy_scope_targets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles_profiles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alba"
    ADD CONSTRAINT "alba_bteg_id_key" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."alba"
    ADD CONSTRAINT "alba_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_correction_requests"
    ADD CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_correction_status_history"
    ADD CONSTRAINT "attendance_correction_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_corrections"
    ADD CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banners"
    ADD CONSTRAINT "banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chefs"
    ADD CONSTRAINT "chefs_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."chefs"
    ADD CONSTRAINT "chefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clause_job_position"
    ADD CONSTRAINT "clause_job_position_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clause"
    ADD CONSTRAINT "clause_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_meal_summary"
    ADD CONSTRAINT "daily_meal_summary_date_dining_hall_id_key" UNIQUE ("date", "dining_hall_id");



ALTER TABLE ONLY "public"."daily_meal_summary"
    ADD CONSTRAINT "daily_meal_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_assignments"
    ADD CONSTRAINT "device_assignments_device_id_user_id_key" UNIQUE ("device_id", "user_id");



ALTER TABLE ONLY "public"."device_assignments"
    ADD CONSTRAINT "device_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_history"
    ADD CONSTRAINT "device_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_maintenance"
    ADD CONSTRAINT "device_maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_request_comments"
    ADD CONSTRAINT "device_request_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_request_status_history"
    ADD CONSTRAINT "device_request_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_requests"
    ADD CONSTRAINT "device_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dining_hall"
    ADD CONSTRAINT "dining_hall_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_report_daily_snapshot"
    ADD CONSTRAINT "food_report_daily_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_report_daily_snapshot"
    ADD CONSTRAINT "food_report_daily_snapshot_report_date_dining_hall_id_meal__key" UNIQUE ("report_date", "dining_hall_id", "meal_type", "org_name", "dep_name", "heltes_name");



ALTER TABLE ONLY "public"."fulfillment_status_history"
    ADD CONSTRAINT "fulfillment_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gazar"
    ADD CONSTRAINT "gazar_bteg_id_key" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."gazar"
    ADD CONSTRAINT "gazar_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."gazar"
    ADD CONSTRAINT "gazar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."heltes"
    ADD CONSTRAINT "heltes_bteg_id_key" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."heltes"
    ADD CONSTRAINT "heltes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_description"
    ADD CONSTRAINT "job_description_job_position_id_key" UNIQUE ("job_position_id");



ALTER TABLE ONLY "public"."job_description"
    ADD CONSTRAINT "job_description_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_position"
    ADD CONSTRAINT "job_position_bteg_id_key" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."job_position"
    ADD CONSTRAINT "job_position_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_pairing_requests"
    ADD CONSTRAINT "kiosk_pairing_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosks"
    ADD CONSTRAINT "kiosks_device_uuid_key" UNIQUE ("device_uuid");



ALTER TABLE ONLY "public"."kiosks"
    ADD CONSTRAINT "kiosks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_instances"
    ADD CONSTRAINT "leave_request_instances_leave_request_id_key" UNIQUE ("leave_request_id");



ALTER TABLE ONLY "public"."leave_request_instances"
    ADD CONSTRAINT "leave_request_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_processes"
    ADD CONSTRAINT "leave_request_processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_status_history"
    ADD CONSTRAINT "leave_request_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_step_reviewers"
    ADD CONSTRAINT "leave_request_step_reviewers_instance_id_step_order_reviewe_key" UNIQUE ("instance_id", "step_order", "reviewer_profile_id");



ALTER TABLE ONLY "public"."leave_request_step_reviewers"
    ADD CONSTRAINT "leave_request_step_reviewers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_step_roles"
    ADD CONSTRAINT "leave_request_step_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_step_roles"
    ADD CONSTRAINT "leave_request_step_roles_step_id_role_id_key" UNIQUE ("step_id", "role_id");



ALTER TABLE ONLY "public"."leave_request_steps"
    ADD CONSTRAINT "leave_request_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_request_steps"
    ADD CONSTRAINT "leave_request_steps_process_id_step_order_key" UNIQUE ("process_id", "step_order");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_act_attachments"
    ADD CONSTRAINT "legal_act_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_acts"
    ADD CONSTRAINT "legal_acts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_location_overrides"
    ADD CONSTRAINT "meal_location_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_sync_key_key" UNIQUE ("sync_key");



ALTER TABLE ONLY "public"."meal_time_slots"
    ADD CONSTRAINT "meal_time_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "news_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_fulfillment"
    ADD CONSTRAINT "order_fulfillment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_instances"
    ADD CONSTRAINT "order_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_process_allowed_heltes"
    ADD CONSTRAINT "order_process_allowed_heltes_order_process_id_heltes_bteg_i_key" UNIQUE ("order_process_id", "heltes_bteg_id");



ALTER TABLE ONLY "public"."order_process_allowed_heltes"
    ADD CONSTRAINT "order_process_allowed_heltes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_process_purchase_roles"
    ADD CONSTRAINT "order_process_purchase_roles_order_process_id_role_id_key" UNIQUE ("order_process_id", "role_id");



ALTER TABLE ONLY "public"."order_process_purchase_roles"
    ADD CONSTRAINT "order_process_purchase_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_steps"
    ADD CONSTRAINT "order_process_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_processes"
    ADD CONSTRAINT "order_processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_purchase_batches"
    ADD CONSTRAINT "order_purchase_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_purchase_documents"
    ADD CONSTRAINT "order_purchase_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_purchase_lines"
    ADD CONSTRAINT "order_purchase_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_purchase_quote_documents"
    ADD CONSTRAINT "order_purchase_quote_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_purchase_quote_lines"
    ADD CONSTRAINT "order_purchase_quote_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_purchase_quotes"
    ADD CONSTRAINT "order_purchase_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_step_reviewers"
    ADD CONSTRAINT "order_step_reviewers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_step_roles"
    ADD CONSTRAINT "order_step_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_suppliers"
    ADD CONSTRAINT "order_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_workflow"
    ADD CONSTRAINT "order_workflow_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_bteg_id_key" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy"
    ADD CONSTRAINT "policy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_revision_targets"
    ADD CONSTRAINT "policy_revision_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_revisions"
    ADD CONSTRAINT "policy_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_scope_targets"
    ADD CONSTRAINT "policy_scope_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_scope_targets"
    ADD CONSTRAINT "policy_scope_targets_policy_id_target_type_target_bteg_id_key" UNIQUE ("policy_id", "target_type", "target_bteg_id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating"
    ADD CONSTRAINT "rating_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_session"
    ADD CONSTRAINT "rating_session_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."section"
    ADD CONSTRAINT "section_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_employee_for_food"
    ADD CONSTRAINT "sub_employees_for_food_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_employee_meal_plans"
    ADD CONSTRAINT "sub_meal_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_employee_meal_plans"
    ADD CONSTRAINT "sub_meal_plans_unique" UNIQUE ("org_id", "dining_hall_id", "date");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "unique_bteg_id" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "unique_phone" UNIQUE ("phone");



ALTER TABLE ONLY "public"."attendance_corrections"
    ADD CONSTRAINT "uq_attendance_correction_day" UNIQUE ("bteg_id", "day_date");



ALTER TABLE ONLY "public"."user_autobus_request"
    ADD CONSTRAINT "user_autobus_request_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."api_token"
    ADD CONSTRAINT "api_token_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."attendance_log"
    ADD CONSTRAINT "attendance_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."g_department"
    ADD CONSTRAINT "g_department_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."g_gazar"
    ADD CONSTRAINT "g_gazar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."g_heltes"
    ADD CONSTRAINT "g_heltes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."g_job_position"
    ADD CONSTRAINT "g_job_position_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."g_organization"
    ADD CONSTRAINT "g_organization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."h_autobus_direction"
    ADD CONSTRAINT "h_autobus_direction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."h_autobus"
    ADD CONSTRAINT "h_autobus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."h_eelj_soliltsoo"
    ADD CONSTRAINT "h_eelj_soliltsoo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."h_user_autobus_address"
    ADD CONSTRAINT "h_user_autobus_address_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."sf_guard_group"
    ADD CONSTRAINT "sf_guard_group_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "target"."sf_guard_user"
    ADD CONSTRAINT "sf_guard_user_pkey" PRIMARY KEY ("id");



CREATE INDEX "device_requests_created_by_idx" ON "public"."device_requests" USING "btree" ("created_by");



CREATE INDEX "device_requests_status_idx" ON "public"."device_requests" USING "btree" ("status");



CREATE INDEX "idx_attendance_correction_by_profile" ON "public"."attendance_correction_requests" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "idx_attendance_correction_history_request" ON "public"."attendance_correction_status_history" USING "btree" ("request_id", "created_at");



CREATE INDEX "idx_attendance_correction_pending_queue" ON "public"."attendance_correction_requests" USING "btree" ("status", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_attendance_corrections_lookup" ON "public"."attendance_corrections" USING "btree" ("bteg_id", "day_date");



CREATE INDEX "idx_banners_sort" ON "public"."banners" USING "btree" ("sort_order", "created_at" DESC);



CREATE INDEX "idx_clause_job_position_clause" ON "public"."clause_job_position" USING "btree" ("clause_id");



CREATE INDEX "idx_clause_parent_active" ON "public"."clause" USING "btree" ("parent_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_clause_policy_active" ON "public"."clause" USING "btree" ("policy_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_clause_section_active" ON "public"."clause" USING "btree" ("section_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_device_request_comments_request_id" ON "public"."device_request_comments" USING "btree" ("request_id");



CREATE INDEX "idx_device_request_status_history_request_id" ON "public"."device_request_status_history" USING "btree" ("request_id");



CREATE INDEX "idx_device_requests_assigned_to" ON "public"."device_requests" USING "btree" ("assigned_to");



CREATE INDEX "idx_device_requests_priority" ON "public"."device_requests" USING "btree" ("priority");



CREATE INDEX "idx_device_requests_request_type" ON "public"."device_requests" USING "btree" ("request_type");



CREATE INDEX "idx_device_requests_status" ON "public"."device_requests" USING "btree" ("status");



CREATE INDEX "idx_devices_paired_with" ON "public"."devices" USING "btree" ("paired_with_device_id");



CREATE INDEX "idx_food_report_daily_snapshot_date_hall" ON "public"."food_report_daily_snapshot" USING "btree" ("report_date", "dining_hall_id");



CREATE INDEX "idx_food_report_daily_snapshot_org" ON "public"."food_report_daily_snapshot" USING "btree" ("org_name", "dep_name", "heltes_name");



CREATE INDEX "idx_leave_instances_active" ON "public"."leave_request_instances" USING "btree" ("status", "current_step_order") WHERE ("status" = 'in_progress'::"text");



CREATE INDEX "idx_leave_requests_created_at" ON "public"."leave_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leave_requests_user_status" ON "public"."leave_requests" USING "btree" ("user_id", "status");



CREATE INDEX "idx_leave_status_history_request" ON "public"."leave_request_status_history" USING "btree" ("leave_request_id", "changed_at" DESC);



CREATE INDEX "idx_leave_step_reviewers_pending" ON "public"."leave_request_step_reviewers" USING "btree" ("reviewer_profile_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_legal_act_attachments_act" ON "public"."legal_act_attachments" USING "btree" ("legal_act_id");



CREATE INDEX "idx_legal_acts_type_date" ON "public"."legal_acts" USING "btree" ("act_type", "act_date" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_meal_location_overrides_hall_date" ON "public"."meal_location_overrides" USING "btree" ("dining_hall_id", "date");



CREATE INDEX "idx_meal_logs_date" ON "public"."meal_logs" USING "btree" ("date");



CREATE INDEX "idx_meal_logs_device_uuid" ON "public"."meal_logs" USING "btree" ("device_uuid");



CREATE INDEX "idx_meal_logs_dining_hall_id" ON "public"."meal_logs" USING "btree" ("dining_hall_id");



CREATE INDEX "idx_meal_logs_sub_employee_id" ON "public"."meal_logs" USING "btree" ("sub_employee_id");



CREATE INDEX "idx_meal_logs_user_id" ON "public"."meal_logs" USING "btree" ("user_id");



CREATE INDEX "idx_meal_logs_user_meal_date" ON "public"."meal_logs" USING "btree" ("user_id", "meal_type", "date");



CREATE INDEX "idx_news_published_at" ON "public"."news" USING "btree" ("published_at" DESC);



CREATE INDEX "idx_notifications_profile_created" ON "public"."notifications" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "idx_order_fulfillment_purchase_line" ON "public"."order_fulfillment" USING "btree" ("purchase_line_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_part_number" ON "public"."order_items" USING "btree" ("part_number");



CREATE INDEX "idx_order_items_status" ON "public"."order_items" USING "btree" ("status");



CREATE INDEX "idx_order_process_allowed_heltes_heltes" ON "public"."order_process_allowed_heltes" USING "btree" ("heltes_bteg_id");



CREATE INDEX "idx_order_process_allowed_heltes_process" ON "public"."order_process_allowed_heltes" USING "btree" ("order_process_id");



CREATE INDEX "idx_order_process_purchase_roles_process" ON "public"."order_process_purchase_roles" USING "btree" ("order_process_id");



CREATE INDEX "idx_order_process_purchase_roles_role" ON "public"."order_process_purchase_roles" USING "btree" ("role_id");



CREATE INDEX "idx_order_purchase_batches_order" ON "public"."order_purchase_batches" USING "btree" ("order_id");



CREATE INDEX "idx_order_purchase_batches_quote" ON "public"."order_purchase_batches" USING "btree" ("quote_id");



CREATE INDEX "idx_order_purchase_batches_supplier" ON "public"."order_purchase_batches" USING "btree" ("supplier_id");



CREATE INDEX "idx_order_purchase_documents_batch" ON "public"."order_purchase_documents" USING "btree" ("purchase_batch_id");



CREATE INDEX "idx_order_purchase_documents_type" ON "public"."order_purchase_documents" USING "btree" ("doc_type");



CREATE INDEX "idx_order_purchase_lines_batch" ON "public"."order_purchase_lines" USING "btree" ("purchase_batch_id");



CREATE INDEX "idx_order_purchase_lines_item" ON "public"."order_purchase_lines" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_purchase_quote_documents_quote" ON "public"."order_purchase_quote_documents" USING "btree" ("quote_id");



CREATE INDEX "idx_order_purchase_quote_lines_item" ON "public"."order_purchase_quote_lines" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_purchase_quote_lines_quote" ON "public"."order_purchase_quote_lines" USING "btree" ("quote_id");



CREATE INDEX "idx_order_purchase_quotes_order" ON "public"."order_purchase_quotes" USING "btree" ("order_id");



CREATE INDEX "idx_order_purchase_quotes_supplier" ON "public"."order_purchase_quotes" USING "btree" ("supplier_id");



CREATE INDEX "idx_order_suppliers_name" ON "public"."order_suppliers" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("name", ''::"text")));



CREATE UNIQUE INDEX "idx_order_suppliers_registration_number" ON "public"."order_suppliers" USING "btree" ("registration_number") WHERE (("registration_number" IS NOT NULL) AND ("is_deleted" = false));



CREATE INDEX "idx_order_workflow_changed_by" ON "public"."order_workflow" USING "btree" ("changed_by");



CREATE INDEX "idx_order_workflow_order_id" ON "public"."order_workflow" USING "btree" ("order_id");



CREATE INDEX "idx_order_workflow_status" ON "public"."order_workflow" USING "btree" ("to_status");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_order_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_urgency" ON "public"."orders" USING "btree" ("urgency_level");



CREATE INDEX "idx_policy_revision_targets_clause" ON "public"."policy_revision_targets" USING "btree" ("clause_id");



CREATE INDEX "idx_policy_revision_targets_policy" ON "public"."policy_revision_targets" USING "btree" ("policy_id");



CREATE INDEX "idx_policy_revision_targets_revision" ON "public"."policy_revision_targets" USING "btree" ("policy_revision_id");



CREATE INDEX "idx_policy_revision_targets_section" ON "public"."policy_revision_targets" USING "btree" ("section_id");



CREATE INDEX "idx_policy_revisions_legal_act" ON "public"."policy_revisions" USING "btree" ("legal_act_id");



CREATE INDEX "idx_policy_revisions_policy" ON "public"."policy_revisions" USING "btree" ("policy_id");



CREATE INDEX "idx_policy_scope_targets_policy" ON "public"."policy_scope_targets" USING "btree" ("policy_id");



CREATE INDEX "idx_policy_scope_targets_target" ON "public"."policy_scope_targets" USING "btree" ("target_type", "target_bteg_id");



CREATE INDEX "idx_roles_name" ON "public"."roles" USING "btree" ("name");



CREATE INDEX "idx_section_policy_active" ON "public"."section" USING "btree" ("policy_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_status_history_created_at" ON "public"."order_status_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_status_history_order_id" ON "public"."order_status_history" USING "btree" ("order_id");



CREATE INDEX "idx_sub_employee_bteg_id" ON "public"."sub_employee_for_food" USING "btree" ("bteg_id");



CREATE INDEX "idx_sub_employees_org_id" ON "public"."sub_employee_for_food" USING "btree" ("org_id");



CREATE INDEX "idx_user_bteg_id" ON "public"."users" USING "btree" ("bteg_id");



CREATE INDEX "idx_user_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_user_is_active" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "idx_user_meal_configs_bteg_id" ON "public"."user_meal_configs" USING "btree" ("bteg_id");



CREATE INDEX "idx_user_phone" ON "public"."users" USING "btree" ("phone");



CREATE INDEX "idx_user_roles_expires" ON "public"."roles_profiles" USING "btree" ("expires_at");



CREATE INDEX "idx_user_roles_role_id" ON "public"."roles_profiles" USING "btree" ("role_id");



CREATE INDEX "idx_users_bteg_id" ON "public"."users" USING "btree" ("bteg_id");



CREATE INDEX "idx_users_idcard_number" ON "public"."users" USING "btree" ("idcard_number");



CREATE UNIQUE INDEX "meal_location_overrides_active_user_unique" ON "public"."meal_location_overrides" USING "btree" ("user_id", "date", "meal_type") WHERE ("is_deleted" = false);



CREATE UNIQUE INDEX "uq_attendance_correction_pending" ON "public"."attendance_correction_requests" USING "btree" ("profile_id", "day_date") WHERE ("status" = 'pending'::"text");



CREATE UNIQUE INDEX "user_autobus_request_active_uniq" ON "public"."user_autobus_request" USING "btree" ("bteg_id", "eelj_id") WHERE ("status" = ANY (ARRAY['requested'::"public"."eelj_request_status", 'approved'::"public"."eelj_request_status", 'force_approved'::"public"."eelj_request_status"]));



CREATE INDEX "user_autobus_request_autobus_status_idx" ON "public"."user_autobus_request" USING "btree" ("autobus_id", "status", "requested_at" DESC);



CREATE INDEX "user_autobus_request_profile_idx" ON "public"."user_autobus_request" USING "btree" ("profile_id", "requested_at" DESC);



CREATE UNIQUE INDEX "users_phone_uniq" ON "public"."users" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE OR REPLACE TRIGGER "devices_updated_at" BEFORE UPDATE ON "public"."devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "leave_requests_updated_at" BEFORE UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_leave_request_updated_at"();



CREATE OR REPLACE TRIGGER "legal_acts_updated_at" BEFORE UPDATE ON "public"."legal_acts" FOR EACH ROW EXECUTE FUNCTION "public"."set_legal_acts_updated_at"();



CREATE OR REPLACE TRIGGER "set_banners_updated_at" BEFORE UPDATE ON "public"."banners" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_news_updated_at" BEFORE UPDATE ON "public"."news" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_order_purchase_batches_updated_at" BEFORE UPDATE ON "public"."order_purchase_batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_purchase_updated_at"();



CREATE OR REPLACE TRIGGER "set_order_purchase_quotes_updated_at" BEFORE UPDATE ON "public"."order_purchase_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_purchase_updated_at"();



CREATE OR REPLACE TRIGGER "set_order_suppliers_updated_at" BEFORE UPDATE ON "public"."order_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_purchase_updated_at"();



CREATE OR REPLACE TRIGGER "trg_attendance_correction_updated_at" BEFORE UPDATE ON "public"."attendance_correction_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_fill_bteg_id_on_insert" BEFORE INSERT ON "public"."user_meal_configs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_meal_config_bteg_id"();



CREATE OR REPLACE TRIGGER "trigger_set_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "user_autobus_request_updated_at" BEFORE UPDATE ON "public"."user_autobus_request" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "on_sf_guard_user_change" AFTER INSERT OR UPDATE ON "target"."sf_guard_user" FOR EACH ROW EXECUTE FUNCTION "public"."handle_sf_guard_user_sync"();



CREATE OR REPLACE TRIGGER "trg_g_department_sync" AFTER INSERT OR DELETE OR UPDATE ON "target"."g_department" FOR EACH ROW EXECUTE FUNCTION "target"."trg_sync_g_department_to_public"();



CREATE OR REPLACE TRIGGER "trg_g_gazar_sync" AFTER INSERT OR DELETE OR UPDATE ON "target"."g_gazar" FOR EACH ROW EXECUTE FUNCTION "target"."trg_sync_g_gazar_to_public"();



CREATE OR REPLACE TRIGGER "trg_g_heltes_sync" AFTER INSERT OR DELETE OR UPDATE ON "target"."g_heltes" FOR EACH ROW EXECUTE FUNCTION "target"."trg_sync_g_heltes_to_public"();



CREATE OR REPLACE TRIGGER "trg_g_organization_sync" AFTER INSERT OR DELETE OR UPDATE ON "target"."g_organization" FOR EACH ROW EXECUTE FUNCTION "target"."trg_sync_g_organization_to_public"();



CREATE OR REPLACE TRIGGER "trg_sync_to_public_job_position" AFTER INSERT OR UPDATE ON "target"."g_job_position" FOR EACH ROW EXECUTE FUNCTION "target"."fn_sync_job_position"();



ALTER TABLE ONLY "public"."alba"
    ADD CONSTRAINT "alba_gazar_id_fkey" FOREIGN KEY ("gazar_id") REFERENCES "public"."gazar"("bteg_id");



ALTER TABLE ONLY "public"."alba"
    ADD CONSTRAINT "alba_heltes_id_fkey" FOREIGN KEY ("heltes_id") REFERENCES "public"."heltes"("bteg_id");



ALTER TABLE ONLY "public"."alba"
    ADD CONSTRAINT "alba_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("bteg_id");



ALTER TABLE ONLY "public"."attendance_correction_requests"
    ADD CONSTRAINT "attendance_correction_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_correction_requests"
    ADD CONSTRAINT "attendance_correction_requests_reviewed_by_profile_id_fkey" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_correction_status_history"
    ADD CONSTRAINT "attendance_correction_status_history_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profile"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_correction_status_history"
    ADD CONSTRAINT "attendance_correction_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."attendance_correction_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_corrections"
    ADD CONSTRAINT "attendance_corrections_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_corrections"
    ADD CONSTRAINT "attendance_corrections_created_from_request_id_fkey" FOREIGN KEY ("created_from_request_id") REFERENCES "public"."attendance_correction_requests"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_corrections"
    ADD CONSTRAINT "attendance_corrections_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."banners"
    ADD CONSTRAINT "banners_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."banners"
    ADD CONSTRAINT "banners_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chefs"
    ADD CONSTRAINT "chefs_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."clause_job_position"
    ADD CONSTRAINT "clause_job_position_clause_id_fkey" FOREIGN KEY ("clause_id") REFERENCES "public"."clause"("id");



ALTER TABLE ONLY "public"."clause_job_position"
    ADD CONSTRAINT "clause_job_position_job_position_id_fkey" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_position"("id");



ALTER TABLE ONLY "public"."clause"
    ADD CONSTRAINT "clause_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."clause"("id");



ALTER TABLE ONLY "public"."clause"
    ADD CONSTRAINT "clause_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id");



ALTER TABLE ONLY "public"."clause"
    ADD CONSTRAINT "clause_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."section"("id");



ALTER TABLE ONLY "public"."daily_meal_summary"
    ADD CONSTRAINT "daily_meal_summary_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."device_assignments"
    ADD CONSTRAINT "device_assignments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_assignments"
    ADD CONSTRAINT "device_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_history"
    ADD CONSTRAINT "device_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_history"
    ADD CONSTRAINT "device_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_maintenance"
    ADD CONSTRAINT "device_maintenance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_maintenance"
    ADD CONSTRAINT "device_maintenance_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_request_comments"
    ADD CONSTRAINT "device_request_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_request_comments"
    ADD CONSTRAINT "device_request_comments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."device_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_request_status_history"
    ADD CONSTRAINT "device_request_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_request_status_history"
    ADD CONSTRAINT "device_request_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."device_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_requests"
    ADD CONSTRAINT "device_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_requests"
    ADD CONSTRAINT "device_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."device_requests"
    ADD CONSTRAINT "device_requests_fulfilled_by_request_id_fkey" FOREIGN KEY ("fulfilled_by_request_id") REFERENCES "public"."device_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_requests"
    ADD CONSTRAINT "device_requests_old_device_id_fkey" FOREIGN KEY ("old_device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_requests"
    ADD CONSTRAINT "device_requests_parent_request_id_fkey" FOREIGN KEY ("parent_request_id") REFERENCES "public"."device_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_alba_id_fkey" FOREIGN KEY ("alba_id") REFERENCES "public"."alba"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_heltes_id_fkey" FOREIGN KEY ("heltes_id") REFERENCES "public"."heltes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_paired_with_device_id_fkey" FOREIGN KEY ("paired_with_device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sub_employee_for_food"
    ADD CONSTRAINT "fk_organization" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_report_daily_snapshot"
    ADD CONSTRAINT "food_report_daily_snapshot_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."fulfillment_status_history"
    ADD CONSTRAINT "fulfillment_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."fulfillment_status_history"
    ADD CONSTRAINT "fulfillment_status_history_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."order_fulfillment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."heltes"
    ADD CONSTRAINT "heltes_gazar_id_fkey" FOREIGN KEY ("gazar_id") REFERENCES "public"."gazar"("bteg_id");



ALTER TABLE ONLY "public"."heltes"
    ADD CONSTRAINT "heltes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("bteg_id");



ALTER TABLE ONLY "public"."job_description"
    ADD CONSTRAINT "job_description_job_position_id_fkey" FOREIGN KEY ("job_position_id") REFERENCES "public"."job_position"("id");



ALTER TABLE ONLY "public"."job_position"
    ADD CONSTRAINT "job_position_alba_id_fkey" FOREIGN KEY ("alba_id") REFERENCES "public"."alba"("bteg_id");



ALTER TABLE ONLY "public"."job_position"
    ADD CONSTRAINT "job_position_gazar_id_fkey" FOREIGN KEY ("gazar_id") REFERENCES "public"."gazar"("bteg_id");



ALTER TABLE ONLY "public"."job_position"
    ADD CONSTRAINT "job_position_heltes_id_fkey" FOREIGN KEY ("heltes_id") REFERENCES "public"."heltes"("bteg_id");



ALTER TABLE ONLY "public"."job_position"
    ADD CONSTRAINT "job_position_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("bteg_id");



ALTER TABLE ONLY "public"."kiosks"
    ADD CONSTRAINT "kiosks_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."leave_request_instances"
    ADD CONSTRAINT "leave_request_instances_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_request_instances"
    ADD CONSTRAINT "leave_request_instances_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."leave_request_processes"("id");



ALTER TABLE ONLY "public"."leave_request_processes"
    ADD CONSTRAINT "leave_request_processes_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_request_status_history"
    ADD CONSTRAINT "leave_request_status_history_changed_by_profile_id_fkey" FOREIGN KEY ("changed_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leave_request_status_history"
    ADD CONSTRAINT "leave_request_status_history_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_request_step_reviewers"
    ADD CONSTRAINT "leave_request_step_reviewers_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."leave_request_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_request_step_reviewers"
    ADD CONSTRAINT "leave_request_step_reviewers_reviewer_profile_id_fkey" FOREIGN KEY ("reviewer_profile_id") REFERENCES "public"."profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_request_step_roles"
    ADD CONSTRAINT "leave_request_step_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_request_step_roles"
    ADD CONSTRAINT "leave_request_step_roles_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."leave_request_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_request_steps"
    ADD CONSTRAINT "leave_request_steps_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."leave_request_processes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."leave_request_processes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_act_attachments"
    ADD CONSTRAINT "legal_act_attachments_legal_act_id_fkey" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_acts"
    ADD CONSTRAINT "legal_acts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."meal_location_overrides"
    ADD CONSTRAINT "meal_location_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."meal_location_overrides"
    ADD CONSTRAINT "meal_location_overrides_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."meal_location_overrides"
    ADD CONSTRAINT "meal_location_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "public"."chefs"("id");



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_sub_employee_id_fkey" FOREIGN KEY ("sub_employee_id") REFERENCES "public"."sub_employee_for_food"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."meal_time_slots"
    ADD CONSTRAINT "meal_time_slots_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "news_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_fulfillment"
    ADD CONSTRAINT "order_fulfillment_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_fulfillment"
    ADD CONSTRAINT "order_fulfillment_purchase_line_id_fkey" FOREIGN KEY ("purchase_line_id") REFERENCES "public"."order_purchase_lines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_instances"
    ADD CONSTRAINT "order_instances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_instances"
    ADD CONSTRAINT "order_instances_order_process_id_fkey" FOREIGN KEY ("order_process_id") REFERENCES "public"."order_processes"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_process_allowed_heltes"
    ADD CONSTRAINT "order_process_allowed_heltes_heltes_bteg_id_fkey" FOREIGN KEY ("heltes_bteg_id") REFERENCES "public"."heltes"("bteg_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_process_allowed_heltes"
    ADD CONSTRAINT "order_process_allowed_heltes_order_process_id_fkey" FOREIGN KEY ("order_process_id") REFERENCES "public"."order_processes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_process_purchase_roles"
    ADD CONSTRAINT "order_process_purchase_roles_order_process_id_fkey" FOREIGN KEY ("order_process_id") REFERENCES "public"."order_processes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_process_purchase_roles"
    ADD CONSTRAINT "order_process_purchase_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_steps"
    ADD CONSTRAINT "order_process_steps_order_process_id_fkey" FOREIGN KEY ("order_process_id") REFERENCES "public"."order_processes"("id");



ALTER TABLE ONLY "public"."order_purchase_batches"
    ADD CONSTRAINT "order_purchase_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_purchase_batches"
    ADD CONSTRAINT "order_purchase_batches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_batches"
    ADD CONSTRAINT "order_purchase_batches_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_purchase_quotes"("id");



ALTER TABLE ONLY "public"."order_purchase_batches"
    ADD CONSTRAINT "order_purchase_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."order_suppliers"("id");



ALTER TABLE ONLY "public"."order_purchase_documents"
    ADD CONSTRAINT "order_purchase_documents_purchase_batch_id_fkey" FOREIGN KEY ("purchase_batch_id") REFERENCES "public"."order_purchase_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_lines"
    ADD CONSTRAINT "order_purchase_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_lines"
    ADD CONSTRAINT "order_purchase_lines_purchase_batch_id_fkey" FOREIGN KEY ("purchase_batch_id") REFERENCES "public"."order_purchase_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_quote_documents"
    ADD CONSTRAINT "order_purchase_quote_documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_purchase_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_quote_lines"
    ADD CONSTRAINT "order_purchase_quote_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_quote_lines"
    ADD CONSTRAINT "order_purchase_quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_purchase_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_quotes"
    ADD CONSTRAINT "order_purchase_quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_purchase_quotes"
    ADD CONSTRAINT "order_purchase_quotes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_purchase_quotes"
    ADD CONSTRAINT "order_purchase_quotes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."order_suppliers"("id");



ALTER TABLE ONLY "public"."order_step_reviewers"
    ADD CONSTRAINT "order_step_reviewers_order_instance_id_fkey" FOREIGN KEY ("order_instance_id") REFERENCES "public"."order_instances"("id");



ALTER TABLE ONLY "public"."order_step_reviewers"
    ADD CONSTRAINT "order_step_reviewers_order_step_id_fkey" FOREIGN KEY ("order_step_id") REFERENCES "public"."order_steps"("id");



ALTER TABLE ONLY "public"."order_step_reviewers"
    ADD CONSTRAINT "order_step_reviewers_reviewer_profile_id_fkey" FOREIGN KEY ("reviewer_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_step_reviewers"
    ADD CONSTRAINT "order_step_reviewers_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."order_step_roles"
    ADD CONSTRAINT "order_step_roles_order_step_id_fkey" FOREIGN KEY ("order_step_id") REFERENCES "public"."order_steps"("id");



ALTER TABLE ONLY "public"."order_step_roles"
    ADD CONSTRAINT "order_step_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."order_suppliers"
    ADD CONSTRAINT "order_suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_workflow"
    ADD CONSTRAINT "order_workflow_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_workflow"
    ADD CONSTRAINT "order_workflow_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_profile_fkey" FOREIGN KEY ("created_profile") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_process_id_fkey" FOREIGN KEY ("order_process_id") REFERENCES "public"."order_processes"("id");



ALTER TABLE ONLY "public"."policy_revision_targets"
    ADD CONSTRAINT "policy_revision_targets_clause_id_fkey" FOREIGN KEY ("clause_id") REFERENCES "public"."clause"("id");



ALTER TABLE ONLY "public"."policy_revision_targets"
    ADD CONSTRAINT "policy_revision_targets_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id");



ALTER TABLE ONLY "public"."policy_revision_targets"
    ADD CONSTRAINT "policy_revision_targets_policy_revision_id_fkey" FOREIGN KEY ("policy_revision_id") REFERENCES "public"."policy_revisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_revision_targets"
    ADD CONSTRAINT "policy_revision_targets_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."section"("id");



ALTER TABLE ONLY "public"."policy_revisions"
    ADD CONSTRAINT "policy_revisions_legal_act_id_fkey" FOREIGN KEY ("legal_act_id") REFERENCES "public"."legal_acts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_revisions"
    ADD CONSTRAINT "policy_revisions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rating"
    ADD CONSTRAINT "rating_clause_job_position_id_fkey" FOREIGN KEY ("clause_job_position_id") REFERENCES "public"."clause_job_position"("id");



ALTER TABLE ONLY "public"."rating"
    ADD CONSTRAINT "rating_rating_session_id_fkey" FOREIGN KEY ("rating_session_id") REFERENCES "public"."rating_session"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."section"
    ADD CONSTRAINT "section_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policy"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_employee_for_food"
    ADD CONSTRAINT "sub_employee_for_food_bteg_id_fkey" FOREIGN KEY ("bteg_id") REFERENCES "public"."users"("bteg_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sub_employee_meal_plans"
    ADD CONSTRAINT "sub_employee_meal_plans_dining_hall_id_fkey" FOREIGN KEY ("dining_hall_id") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."sub_employee_meal_plans"
    ADD CONSTRAINT "sub_employee_meal_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_order_instance_id_fkey" FOREIGN KEY ("order_instance_id") REFERENCES "public"."order_instances"("id");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_order_step_id_fkey" FOREIGN KEY ("order_step_id") REFERENCES "public"."order_steps"("id");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_reviewer_profile_id_fkey" FOREIGN KEY ("reviewer_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."user_autobus_request"
    ADD CONSTRAINT "user_autobus_request_decided_by_profile_id_fkey" FOREIGN KEY ("decided_by_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."user_autobus_request"
    ADD CONSTRAINT "user_autobus_request_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_breakfast_location_fkey" FOREIGN KEY ("breakfast_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_dinner_location_fkey" FOREIGN KEY ("dinner_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_extend_lunch_location_fkey" FOREIGN KEY ("extend_lunch_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_extend_morning_meal_location_fkey" FOREIGN KEY ("extend_morning_meal_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_lunch_location_fkey" FOREIGN KEY ("lunch_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_morning_meal_location_fkey" FOREIGN KEY ("morning_meal_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_night_meal_location_fkey" FOREIGN KEY ("night_meal_location") REFERENCES "public"."dining_hall"("id");



ALTER TABLE ONLY "public"."user_meal_configs"
    ADD CONSTRAINT "user_meal_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."alba"("bteg_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_heltes_id_fkey" FOREIGN KEY ("heltes_id") REFERENCES "public"."heltes"("bteg_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("bteg_id");



CREATE POLICY "Admin reads all leave requests" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"));



CREATE POLICY "Admin updates any request" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"));



CREATE POLICY "Admin writes processes" ON "public"."leave_request_processes" TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"));



CREATE POLICY "Admin writes step_roles" ON "public"."leave_request_step_roles" TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"));



CREATE POLICY "Admin writes steps" ON "public"."leave_request_steps" TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"));



CREATE POLICY "All people can see dining halls" ON "public"."dining_hall" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated read" ON "public"."leave_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public delete" ON "public"."meal_location_overrides" FOR DELETE USING (true);



CREATE POLICY "Allow public insert" ON "public"."meal_location_overrides" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert on chefs" ON "public"."chefs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read" ON "public"."meal_location_overrides" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."meal_location_overrides" FOR UPDATE USING (true);



CREATE POLICY "Allow public update on chefs" ON "public"."chefs" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage chefs" ON "public"."chefs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage kiosks" ON "public"."kiosks" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage meal_logs" ON "public"."meal_logs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated reads banners" ON "public"."banners" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated reads news" ON "public"."news" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated reads processes" ON "public"."leave_request_processes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated reads step_roles" ON "public"."leave_request_step_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated reads steps" ON "public"."leave_request_steps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read food report snapshots" ON "public"."food_report_daily_snapshot" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Banner create" ON "public"."banners" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'banner'::"text", 'create'::"text"));



CREATE POLICY "Banner delete" ON "public"."banners" FOR DELETE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'banner'::"text", 'delete'::"text"));



CREATE POLICY "Banner edit" ON "public"."banners" FOR UPDATE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'banner'::"text", 'edit'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'banner'::"text", 'edit'::"text"));



CREATE POLICY "CRUD for dining hall" ON "public"."user_meal_configs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Insert history by participant" ON "public"."leave_request_status_history" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "leave_request_status_history"."leave_request_id") AND ("lr"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_request_step_reviewers" "rev" ON (("rev"."instance_id" = "inst"."id")))
  WHERE (("inst"."leave_request_id" = "leave_request_status_history"."leave_request_id") AND ("rev"."reviewer_profile_id" = "public"."current_profile_id"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")));



CREATE POLICY "Insert instances by requester or admin" ON "public"."leave_request_instances" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "leave_request_instances"."leave_request_id") AND ("lr"."user_id" = "auth"."uid"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")));



CREATE POLICY "Insert reviewers by requester or admin" ON "public"."leave_request_step_reviewers" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_requests" "lr" ON (("lr"."id" = "inst"."leave_request_id")))
  WHERE (("inst"."id" = "leave_request_step_reviewers"."instance_id") AND (("lr"."user_id" = "auth"."uid"()) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"))))) OR (EXISTS ( SELECT 1
   FROM "public"."leave_request_step_reviewers" "self"
  WHERE (("self"."instance_id" = "leave_request_step_reviewers"."instance_id") AND ("self"."reviewer_profile_id" = "public"."current_profile_id"()))))));



CREATE POLICY "Mark own notification read" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("profile_id" = "public"."current_profile_id"())) WITH CHECK (("profile_id" = "public"."current_profile_id"()));



CREATE POLICY "News create" ON "public"."news" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'news'::"text", 'create'::"text"));



CREATE POLICY "News delete" ON "public"."news" FOR DELETE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'news'::"text", 'delete'::"text"));



CREATE POLICY "News edit" ON "public"."news" FOR UPDATE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'news'::"text", 'edit'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'news'::"text", 'edit'::"text"));



CREATE POLICY "Notification create" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'notification'::"text", 'create'::"text"));



CREATE POLICY "Only authenticated can delete" ON "public"."dining_hall" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Only authenticated can insert dining hall" ON "public"."dining_hall" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Only authenticated can update" ON "public"."dining_hall" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Order purchase users can create batches" ON "public"."order_purchase_batches" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can create documents" ON "public"."order_purchase_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can create lines" ON "public"."order_purchase_lines" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can create quote documents" ON "public"."order_purchase_quote_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can create quote lines" ON "public"."order_purchase_quote_lines" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can create quotes" ON "public"."order_purchase_quotes" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can create suppliers" ON "public"."order_suppliers" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can read documents" ON "public"."order_purchase_documents" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can read lines" ON "public"."order_purchase_lines" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can read quote documents" ON "public"."order_purchase_quote_documents" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can read quote lines" ON "public"."order_purchase_quote_lines" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can read quotes" ON "public"."order_purchase_quotes" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can read suppliers" ON "public"."order_suppliers" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can update quotes" ON "public"."order_purchase_quotes" FOR UPDATE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Order purchase users can update suppliers" ON "public"."order_suppliers" FOR UPDATE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



CREATE POLICY "Policy creators can create legal act attachments" ON "public"."legal_act_attachments" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'create'::"text"));



CREATE POLICY "Policy creators can create legal acts" ON "public"."legal_acts" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'create'::"text"));



CREATE POLICY "Policy creators can create policy revision targets" ON "public"."policy_revision_targets" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'create'::"text"));



CREATE POLICY "Policy creators can create policy revisions" ON "public"."policy_revisions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'create'::"text"));



CREATE POLICY "Policy editors can update legal acts" ON "public"."legal_acts" FOR UPDATE TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'edit'::"text")) WITH CHECK ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'edit'::"text"));



CREATE POLICY "Policy users can read legal act attachments" ON "public"."legal_act_attachments" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'access'::"text"));



CREATE POLICY "Policy users can read legal acts" ON "public"."legal_acts" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'access'::"text"));



CREATE POLICY "Policy users can read policy revision targets" ON "public"."policy_revision_targets" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'access'::"text"));



CREATE POLICY "Policy users can read policy revisions" ON "public"."policy_revisions" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'policy'::"text", 'access'::"text"));



CREATE POLICY "Public can insert kiosks" ON "public"."kiosks" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert meal_logs" ON "public"."meal_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can read chefs" ON "public"."chefs" FOR SELECT USING (true);



CREATE POLICY "Public can read kiosks" ON "public"."kiosks" FOR SELECT USING (true);



CREATE POLICY "Public can read meal_logs" ON "public"."meal_logs" FOR SELECT USING (true);



CREATE POLICY "Public can read user_meal_configs" ON "public"."user_meal_configs" FOR SELECT USING (true);



CREATE POLICY "Public can update kiosks" ON "public"."kiosks" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Read history own/reviewer/admin" ON "public"."leave_request_status_history" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "leave_request_status_history"."leave_request_id") AND ("lr"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_request_step_reviewers" "rev" ON (("rev"."instance_id" = "inst"."id")))
  WHERE (("inst"."leave_request_id" = "leave_request_status_history"."leave_request_id") AND ("rev"."reviewer_profile_id" = "public"."current_profile_id"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")));



CREATE POLICY "Read instances own/reviewer/admin" ON "public"."leave_request_instances" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "leave_request_instances"."leave_request_id") AND ("lr"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leave_request_step_reviewers" "rev"
  WHERE (("rev"."instance_id" = "leave_request_instances"."id") AND ("rev"."reviewer_profile_id" = "public"."current_profile_id"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")));



CREATE POLICY "Read own or sender notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("profile_id" = "public"."current_profile_id"()) OR "public"."has_permission"("auth"."uid"(), 'notification'::"text", 'create'::"text")));



CREATE POLICY "Read reviewers own/reviewer/admin" ON "public"."leave_request_step_reviewers" FOR SELECT TO "authenticated" USING ((("reviewer_profile_id" = "public"."current_profile_id"()) OR (EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_requests" "lr" ON (("lr"."id" = "inst"."leave_request_id")))
  WHERE (("inst"."id" = "leave_request_step_reviewers"."instance_id") AND ("lr"."user_id" = "auth"."uid"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text")));



CREATE POLICY "Reviewer reads assigned requests" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_request_step_reviewers" "rev" ON (("rev"."instance_id" = "inst"."id")))
  WHERE (("inst"."leave_request_id" = "leave_requests"."id") AND ("rev"."reviewer_profile_id" = "public"."current_profile_id"())))));



CREATE POLICY "Reviewer updates assigned requests" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_request_step_reviewers" "rev" ON (("rev"."instance_id" = "inst"."id")))
  WHERE (("inst"."leave_request_id" = "leave_requests"."id") AND ("rev"."reviewer_profile_id" = "public"."current_profile_id"()))))) WITH CHECK (true);



CREATE POLICY "Update instances by reviewer/admin" ON "public"."leave_request_instances" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."leave_request_step_reviewers" "rev"
  WHERE (("rev"."instance_id" = "leave_request_instances"."id") AND ("rev"."reviewer_profile_id" = "public"."current_profile_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."leave_requests" "lr"
  WHERE (("lr"."id" = "leave_request_instances"."leave_request_id") AND ("lr"."user_id" = "auth"."uid"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"))) WITH CHECK (true);



CREATE POLICY "Update reviewers by self/requester/admin" ON "public"."leave_request_step_reviewers" FOR UPDATE TO "authenticated" USING ((("reviewer_profile_id" = "public"."current_profile_id"()) OR (EXISTS ( SELECT 1
   FROM ("public"."leave_request_instances" "inst"
     JOIN "public"."leave_requests" "lr" ON (("lr"."id" = "inst"."leave_request_id")))
  WHERE (("inst"."id" = "leave_request_step_reviewers"."instance_id") AND ("lr"."user_id" = "auth"."uid"())))) OR "public"."has_permission"("auth"."uid"(), 'leave'::"text", 'admin'::"text"))) WITH CHECK (true);



CREATE POLICY "User cancels own pending requests" ON "public"."leave_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own requests" ON "public"."leave_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own requests" ON "public"."leave_requests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ac_no_direct_write" ON "public"."attendance_corrections" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "ac_select_own_or_reviewer" ON "public"."attendance_corrections" FOR SELECT TO "authenticated" USING ((("profile_id" = "public"."current_profile_id"()) OR "public"."has_permission"("auth"."uid"(), 'attendance'::"text", 'review'::"text")));



CREATE POLICY "acr_insert_via_rpc_only" ON "public"."attendance_correction_requests" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "acr_no_delete" ON "public"."attendance_correction_requests" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "acr_select_own_or_reviewer" ON "public"."attendance_correction_requests" FOR SELECT TO "authenticated" USING ((("profile_id" = "public"."current_profile_id"()) OR "public"."has_permission"("auth"."uid"(), 'attendance'::"text", 'review'::"text")));



CREATE POLICY "acr_update_own_cancel" ON "public"."attendance_correction_requests" FOR UPDATE TO "authenticated" USING ((("profile_id" = "public"."current_profile_id"()) AND ("status" = 'pending'::"text"))) WITH CHECK ((("profile_id" = "public"."current_profile_id"()) AND ("status" = 'cancelled'::"text")));



CREATE POLICY "acsh_no_direct_write" ON "public"."attendance_correction_status_history" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "acsh_select_own_or_reviewer" ON "public"."attendance_correction_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."attendance_correction_requests" "r"
  WHERE (("r"."id" = "attendance_correction_status_history"."request_id") AND (("r"."profile_id" = "public"."current_profile_id"()) OR "public"."has_permission"("auth"."uid"(), 'attendance'::"text", 'review'::"text"))))));



ALTER TABLE "public"."attendance_correction_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_correction_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dining_hall" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_report_daily_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gazar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kiosks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_request_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_request_processes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_request_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_request_step_reviewers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_request_step_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_request_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_act_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_acts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_location_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."news" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_purchase_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_purchase_batches read creator" ON "public"."order_purchase_batches" FOR SELECT TO "authenticated" USING ("public"."has_permission"("auth"."uid"(), 'order'::"text", 'purchase'::"text"));



ALTER TABLE "public"."order_purchase_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_purchase_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_purchase_quote_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_purchase_quote_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_purchase_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_revision_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_revisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_autobus_request" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_meal_configs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "bgs_attendance" TO "authenticated";
GRANT USAGE ON SCHEMA "bgs_attendance" TO "anon";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT USAGE ON SCHEMA "target" TO "authenticated";



GRANT ALL ON FUNCTION "bgs_attendance"."get_my_roster_overview"("p_today" "date") TO "authenticated";











































































































































































GRANT ALL ON FUNCTION "public"."approve_attendance_correction_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_attendance_correction_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_attendance_correction_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_autobus_request"("p_request_id" bigint, "p_force" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."approve_autobus_request"("p_request_id" bigint, "p_force" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_autobus_request"("p_request_id" bigint, "p_force" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."broadcast_notification"("p_title" "text", "p_message" "text", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."broadcast_notification"("p_title" "text", "p_message" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_notification"("p_title" "text", "p_message" "text", "p_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_attendance_correction_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_attendance_correction_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_attendance_correction_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_attendance_correction_request"("p_day_date" "date", "p_requested_start_at" timestamp with time zone, "p_requested_end_at" timestamp with time zone, "p_reason" "text", "p_attachment_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_attendance_correction_request"("p_day_date" "date", "p_requested_start_at" timestamp with time zone, "p_requested_end_at" timestamp with time zone, "p_reason" "text", "p_attachment_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_attendance_correction_request"("p_day_date" "date", "p_requested_start_at" timestamp with time zone, "p_requested_end_at" timestamp with time zone, "p_reason" "text", "p_attachment_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profile_from_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profile_from_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profile_from_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profiles_for_existing_auth_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profiles_for_existing_auth_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profiles_for_existing_auth_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_bteg_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_bteg_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_bteg_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_profile_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_profile_on_auth_user_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_profile_on_auth_user_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_profile_on_auth_user_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_auth_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."disable_auth_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_auth_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_shift_for_modal"("p_bteg_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_shift_for_modal"("p_bteg_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_shift_for_modal"("p_bteg_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_food_daily_report"("p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_food_daily_report"("p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_food_daily_report"("p_month" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_food_monthly_report"("p_month" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_food_monthly_report"("p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_food_monthly_report"("p_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_food_report_finalized_dates"("p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_food_report_finalized_dates"("p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_food_report_finalized_dates"("p_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_breakdown_by_org"("p_date" "date", "p_hall_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_breakdown_by_org"("p_date" "date", "p_hall_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_breakdown_by_org"("p_date" "date", "p_hall_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_employee_details"("p_date" "date", "p_hall_id" integer, "p_org_name" "text", "p_group_name" "text", "p_group_type" "text", "p_meal_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_employee_details"("p_date" "date", "p_hall_id" integer, "p_org_name" "text", "p_group_name" "text", "p_group_type" "text", "p_meal_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_employee_details"("p_date" "date", "p_hall_id" integer, "p_org_name" "text", "p_group_name" "text", "p_group_type" "text", "p_meal_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_meal_expected_vs_actual"("p_date" "date", "p_hall_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_meal_expected_vs_actual"("p_date" "date", "p_hall_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_meal_expected_vs_actual"("p_date" "date", "p_hall_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_attendance"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_attendance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_attendance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_attendance_with_overrides"("p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_attendance_with_overrides"("p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_attendance_with_overrides"("p_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_eelj_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_eelj_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_eelj_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_eelj_cards"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_eelj_cards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_eelj_cards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_eelj_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_eelj_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_eelj_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_led_autobus_roster"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_led_autobus_roster"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_led_autobus_roster"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_attendance_correction_review_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_attendance_correction_review_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_attendance_correction_review_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_attendance_corrections"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_attendance_corrections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_attendance_corrections"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_requests_for_my_autobuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_requests_for_my_autobuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_requests_for_my_autobuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_requestable_autobuses"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_requestable_autobuses"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_requestable_autobuses"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_upcoming_eelj"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_upcoming_eelj"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_upcoming_eelj"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_users_with_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_users_with_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_users_with_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_worker_attendance"("p_worker_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_worker_attendance"("p_worker_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_worker_attendance"("p_worker_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sf_guard_user_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sf_guard_user_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sf_guard_user_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_module" "text", "p_action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_module" "text", "p_action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_module" "text", "p_action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_auth_user_to_public_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_auth_user_to_public_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_auth_user_to_public_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_sf_guard_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_sf_guard_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_sf_guard_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_daily_meal_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_daily_meal_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_daily_meal_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_attendance_correction_request"("p_request_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_attendance_correction_request"("p_request_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_attendance_correction_request"("p_request_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_autobus_request"("p_request_id" bigint, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_autobus_request"("p_request_id" bigint, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_autobus_request"("p_request_id" bigint, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_autobus_seat"("p_eelj_id" bigint, "p_autobus_id" bigint, "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_autobus_seat"("p_eelj_id" bigint, "p_autobus_id" bigint, "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_autobus_seat"("p_eelj_id" bigint, "p_autobus_id" bigint, "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_leave_request_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_leave_request_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_leave_request_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_legal_acts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_legal_acts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_legal_acts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_purchase_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_purchase_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_purchase_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."snapshot_due_food_reports"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."snapshot_due_food_reports"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."snapshot_food_report_day"("p_date" "date", "p_force" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."snapshot_food_report_day"("p_date" "date", "p_force" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_meal_config_bteg_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_meal_config_bteg_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_meal_config_bteg_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_from_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_from_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_from_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";
























GRANT ALL ON TABLE "public"."alba" TO "anon";
GRANT ALL ON TABLE "public"."alba" TO "authenticated";
GRANT ALL ON TABLE "public"."alba" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_correction_requests" TO "anon";
GRANT ALL ON TABLE "public"."attendance_correction_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_correction_requests" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."attendance_correction_requests" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."attendance_correction_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."attendance_correction_status_history" TO "anon";
GRANT ALL ON TABLE "public"."attendance_correction_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_correction_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_corrections" TO "anon";
GRANT ALL ON TABLE "public"."attendance_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_corrections" TO "service_role";



GRANT ALL ON TABLE "public"."banners" TO "anon";
GRANT ALL ON TABLE "public"."banners" TO "authenticated";
GRANT ALL ON TABLE "public"."banners" TO "service_role";



GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."banners_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chefs" TO "anon";
GRANT ALL ON TABLE "public"."chefs" TO "authenticated";
GRANT ALL ON TABLE "public"."chefs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."chefs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."chefs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."chefs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clause" TO "anon";
GRANT ALL ON TABLE "public"."clause" TO "authenticated";
GRANT ALL ON TABLE "public"."clause" TO "service_role";



GRANT ALL ON TABLE "public"."clause_job_position" TO "anon";
GRANT ALL ON TABLE "public"."clause_job_position" TO "authenticated";
GRANT ALL ON TABLE "public"."clause_job_position" TO "service_role";



GRANT ALL ON TABLE "public"."daily_meal_summary" TO "anon";
GRANT ALL ON TABLE "public"."daily_meal_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_meal_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_meal_summary_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_meal_summary_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_meal_summary_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."device_assignments" TO "anon";
GRANT ALL ON TABLE "public"."device_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."device_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."device_history" TO "anon";
GRANT ALL ON TABLE "public"."device_history" TO "authenticated";
GRANT ALL ON TABLE "public"."device_history" TO "service_role";



GRANT ALL ON TABLE "public"."device_maintenance" TO "anon";
GRANT ALL ON TABLE "public"."device_maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."device_maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."device_request_comments" TO "anon";
GRANT ALL ON TABLE "public"."device_request_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."device_request_comments" TO "service_role";



GRANT ALL ON TABLE "public"."device_request_status_history" TO "anon";
GRANT ALL ON TABLE "public"."device_request_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."device_request_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."device_requests" TO "anon";
GRANT ALL ON TABLE "public"."device_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."device_requests" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "anon";
GRANT ALL ON TABLE "public"."devices" TO "authenticated";
GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."dining_hall" TO "anon";
GRANT ALL ON TABLE "public"."dining_hall" TO "authenticated";
GRANT ALL ON TABLE "public"."dining_hall" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dining_hall_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dining_hall_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dining_hall_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."food_report_daily_snapshot" TO "service_role";
GRANT SELECT ON TABLE "public"."food_report_daily_snapshot" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."food_report_daily_snapshot_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."food_report_daily_snapshot_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."food_report_daily_snapshot_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fulfillment_status_history" TO "anon";
GRANT ALL ON TABLE "public"."fulfillment_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."fulfillment_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."gazar" TO "anon";
GRANT ALL ON TABLE "public"."gazar" TO "authenticated";
GRANT ALL ON TABLE "public"."gazar" TO "service_role";



GRANT ALL ON TABLE "public"."heltes" TO "anon";
GRANT ALL ON TABLE "public"."heltes" TO "authenticated";
GRANT ALL ON TABLE "public"."heltes" TO "service_role";



GRANT ALL ON TABLE "public"."job_description" TO "anon";
GRANT ALL ON TABLE "public"."job_description" TO "authenticated";
GRANT ALL ON TABLE "public"."job_description" TO "service_role";



GRANT ALL ON TABLE "public"."job_position" TO "anon";
GRANT ALL ON TABLE "public"."job_position" TO "authenticated";
GRANT ALL ON TABLE "public"."job_position" TO "service_role";



GRANT ALL ON TABLE "public"."kiosk_pairing_requests" TO "anon";
GRANT ALL ON TABLE "public"."kiosk_pairing_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."kiosk_pairing_requests" TO "service_role";



GRANT ALL ON TABLE "public"."kiosks" TO "anon";
GRANT ALL ON TABLE "public"."kiosks" TO "authenticated";
GRANT ALL ON TABLE "public"."kiosks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kiosks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kiosks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kiosks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_request_instances" TO "anon";
GRANT ALL ON TABLE "public"."leave_request_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_request_instances" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_request_instances_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_request_instances_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_request_instances_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_request_processes" TO "anon";
GRANT ALL ON TABLE "public"."leave_request_processes" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_request_processes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_request_processes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_request_processes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_request_processes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_request_status_history" TO "anon";
GRANT ALL ON TABLE "public"."leave_request_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_request_status_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_request_status_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_request_status_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_request_status_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_request_step_reviewers" TO "anon";
GRANT ALL ON TABLE "public"."leave_request_step_reviewers" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_request_step_reviewers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_request_step_reviewers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_request_step_reviewers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_request_step_reviewers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_request_step_roles" TO "anon";
GRANT ALL ON TABLE "public"."leave_request_step_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_request_step_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_request_step_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_request_step_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_request_step_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_request_steps" TO "anon";
GRANT ALL ON TABLE "public"."leave_request_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_request_steps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_request_steps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_request_steps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_request_steps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_types" TO "anon";
GRANT ALL ON TABLE "public"."leave_types" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."legal_act_attachments" TO "anon";
GRANT ALL ON TABLE "public"."legal_act_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_act_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."legal_acts" TO "anon";
GRANT ALL ON TABLE "public"."legal_acts" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_acts" TO "service_role";



GRANT ALL ON TABLE "public"."meal_location_overrides" TO "anon";
GRANT ALL ON TABLE "public"."meal_location_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_location_overrides" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meal_location_overrides_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meal_location_overrides_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meal_location_overrides_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meal_logs" TO "anon";
GRANT ALL ON TABLE "public"."meal_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meal_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meal_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meal_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."meal_time_slots" TO "anon";
GRANT ALL ON TABLE "public"."meal_time_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_time_slots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meal_time_slots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meal_time_slots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meal_time_slots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."news" TO "anon";
GRANT ALL ON TABLE "public"."news" TO "authenticated";
GRANT ALL ON TABLE "public"."news" TO "service_role";



GRANT ALL ON SEQUENCE "public"."news_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."news_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."news_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_fulfillment" TO "anon";
GRANT ALL ON TABLE "public"."order_fulfillment" TO "authenticated";
GRANT ALL ON TABLE "public"."order_fulfillment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_fulfillment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_fulfillment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_fulfillment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_instances" TO "anon";
GRANT ALL ON TABLE "public"."order_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."order_instances" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_instances_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_instances_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_instances_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_process_allowed_heltes" TO "anon";
GRANT ALL ON TABLE "public"."order_process_allowed_heltes" TO "authenticated";
GRANT ALL ON TABLE "public"."order_process_allowed_heltes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_process_allowed_heltes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_process_allowed_heltes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_process_allowed_heltes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_process_purchase_roles" TO "anon";
GRANT ALL ON TABLE "public"."order_process_purchase_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."order_process_purchase_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_process_purchase_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_process_purchase_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_process_purchase_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_steps" TO "anon";
GRANT ALL ON TABLE "public"."order_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."order_steps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_process_steps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_process_steps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_process_steps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_processes" TO "anon";
GRANT ALL ON TABLE "public"."order_processes" TO "authenticated";
GRANT ALL ON TABLE "public"."order_processes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_processes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_processes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_processes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_purchase_batches" TO "anon";
GRANT ALL ON TABLE "public"."order_purchase_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."order_purchase_batches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_purchase_batches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_purchase_batches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_purchase_batches_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_purchase_documents" TO "anon";
GRANT ALL ON TABLE "public"."order_purchase_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."order_purchase_documents" TO "service_role";



GRANT ALL ON TABLE "public"."order_purchase_lines" TO "anon";
GRANT ALL ON TABLE "public"."order_purchase_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."order_purchase_lines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_purchase_lines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_purchase_lines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_purchase_lines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_purchase_quote_documents" TO "anon";
GRANT ALL ON TABLE "public"."order_purchase_quote_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."order_purchase_quote_documents" TO "service_role";



GRANT ALL ON TABLE "public"."order_purchase_quote_lines" TO "anon";
GRANT ALL ON TABLE "public"."order_purchase_quote_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."order_purchase_quote_lines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_purchase_quote_lines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_purchase_quote_lines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_purchase_quote_lines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_purchase_quotes" TO "anon";
GRANT ALL ON TABLE "public"."order_purchase_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."order_purchase_quotes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_purchase_quotes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_purchase_quotes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_purchase_quotes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."order_step_reviewers" TO "anon";
GRANT ALL ON TABLE "public"."order_step_reviewers" TO "authenticated";
GRANT ALL ON TABLE "public"."order_step_reviewers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_step_reviewers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_step_reviewers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_step_reviewers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_step_roles" TO "anon";
GRANT ALL ON TABLE "public"."order_step_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."order_step_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_step_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_step_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_step_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."order_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."order_suppliers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_suppliers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_suppliers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_suppliers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_workflow" TO "anon";
GRANT ALL ON TABLE "public"."order_workflow" TO "authenticated";
GRANT ALL ON TABLE "public"."order_workflow" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_workflow_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_workflow_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_workflow_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organization" TO "anon";
GRANT ALL ON TABLE "public"."organization" TO "authenticated";
GRANT ALL ON TABLE "public"."organization" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."policy" TO "anon";
GRANT ALL ON TABLE "public"."policy" TO "authenticated";
GRANT ALL ON TABLE "public"."policy" TO "service_role";



GRANT ALL ON TABLE "public"."policy_revision_targets" TO "anon";
GRANT ALL ON TABLE "public"."policy_revision_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_revision_targets" TO "service_role";



GRANT ALL ON TABLE "public"."policy_revisions" TO "anon";
GRANT ALL ON TABLE "public"."policy_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_revisions" TO "service_role";



GRANT ALL ON TABLE "public"."policy_scope_targets" TO "anon";
GRANT ALL ON TABLE "public"."policy_scope_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_scope_targets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."policy_scope_targets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."policy_scope_targets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."policy_scope_targets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile" TO "anon";
GRANT ALL ON TABLE "public"."profile" TO "authenticated";
GRANT ALL ON TABLE "public"."profile" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rating" TO "anon";
GRANT ALL ON TABLE "public"."rating" TO "authenticated";
GRANT ALL ON TABLE "public"."rating" TO "service_role";



GRANT ALL ON TABLE "public"."rating_session" TO "anon";
GRANT ALL ON TABLE "public"."rating_session" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_session" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles_profiles" TO "anon";
GRANT ALL ON TABLE "public"."roles_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."section" TO "anon";
GRANT ALL ON TABLE "public"."section" TO "authenticated";
GRANT ALL ON TABLE "public"."section" TO "service_role";



GRANT ALL ON TABLE "public"."sub_employee_for_food" TO "anon";
GRANT ALL ON TABLE "public"."sub_employee_for_food" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_employee_for_food" TO "service_role";



GRANT ALL ON TABLE "public"."sub_employee_meal_plans" TO "anon";
GRANT ALL ON TABLE "public"."sub_employee_meal_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_employee_meal_plans" TO "service_role";



GRANT ALL ON TABLE "public"."sub_order_item" TO "anon";
GRANT ALL ON TABLE "public"."sub_order_item" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_order_item" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sub_order_item_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sub_order_item_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sub_order_item_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_autobus_request" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_autobus_request_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_autobus_request_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_autobus_request_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_meal_configs" TO "anon";
GRANT ALL ON TABLE "public"."user_meal_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_meal_configs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_meal_configs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_meal_configs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_meal_configs_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."users_with_stats" TO "anon";
GRANT ALL ON TABLE "public"."users_with_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."users_with_stats" TO "service_role";



GRANT SELECT ON TABLE "target"."h_autobus" TO "authenticated";



GRANT SELECT ON TABLE "target"."h_eelj_soliltsoo" TO "authenticated";



GRANT SELECT ON TABLE "target"."h_user_autobus_address" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

revoke references on table "public"."food_report_daily_snapshot" from "anon";

revoke trigger on table "public"."food_report_daily_snapshot" from "anon";

revoke truncate on table "public"."food_report_daily_snapshot" from "anon";

revoke references on table "public"."food_report_daily_snapshot" from "authenticated";

revoke trigger on table "public"."food_report_daily_snapshot" from "authenticated";

revoke truncate on table "public"."food_report_daily_snapshot" from "authenticated";

revoke references on table "public"."user_autobus_request" from "anon";

revoke trigger on table "public"."user_autobus_request" from "anon";

revoke truncate on table "public"."user_autobus_request" from "anon";

revoke references on table "public"."user_autobus_request" from "authenticated";

revoke trigger on table "public"."user_autobus_request" from "authenticated";

revoke truncate on table "public"."user_autobus_request" from "authenticated";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.link_auth_user_to_public_user();

CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_profile_from_auth_user();

CREATE TRIGGER on_auth_user_deleted_profile AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.delete_profile_on_auth_user_delete();

CREATE TRIGGER on_auth_user_updated_profile AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.update_profile_from_auth_user();


  create policy "Auth users can read own"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'leave-attachments'::text));



  create policy "Auth users can upload"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'leave-attachments'::text));



  create policy "Order purchase users can read purchase files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'order-purchase-documents'::text) AND public.has_permission(auth.uid(), 'order'::text, 'purchase'::text)));



  create policy "Order purchase users can read quote files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'order-purchase-quotes'::text) AND public.has_permission(auth.uid(), 'order'::text, 'purchase'::text)));



  create policy "Order purchase users can upload purchase files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'order-purchase-documents'::text) AND public.has_permission(auth.uid(), 'order'::text, 'purchase'::text)));



  create policy "Order purchase users can upload quote files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'order-purchase-quotes'::text) AND public.has_permission(auth.uid(), 'order'::text, 'purchase'::text)));



  create policy "Policy creators can upload legal act files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'policy-legal-acts'::text) AND public.has_permission(auth.uid(), 'policy'::text, 'create'::text)));



  create policy "Policy editors can replace legal act files"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'policy-legal-acts'::text) AND public.has_permission(auth.uid(), 'policy'::text, 'edit'::text)))
with check (((bucket_id = 'policy-legal-acts'::text) AND public.has_permission(auth.uid(), 'policy'::text, 'edit'::text)));



  create policy "Policy users can read legal act files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'policy-legal-acts'::text) AND public.has_permission(auth.uid(), 'policy'::text, 'access'::text)));



  create policy "attendance_attach_delete_admin"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'attendance-attachments'::text) AND public.has_permission(auth.uid(), 'attendance'::text, 'admin'::text)));



  create policy "attendance_attach_no_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id <> 'attendance-attachments'::text));



  create policy "attendance_attach_select_own_or_reviewer"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'attendance-attachments'::text) AND (((storage.foldername(name))[2] = (auth.uid())::text) OR public.has_permission(auth.uid(), 'attendance'::text, 'review'::text))));



  create policy "attendance_attach_upload_own"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'attendance-attachments'::text) AND ((storage.foldername(name))[1] = 'users'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



  create policy "crud method for order item image uploading 1bcsxr9_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'order-item-bucket'::text));



  create policy "crud method for order item image uploading 1bcsxr9_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'order-item-bucket'::text));



  create policy "crud method for order item image uploading 1bcsxr9_2"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'order-item-bucket'::text));



  create policy "crud method for order item image uploading 1bcsxr9_3"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'order-item-bucket'::text));



