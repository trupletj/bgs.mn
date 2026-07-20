-- Catch-up migration: captures schema objects that existed live on production
-- (supa.bgs.mn / Cloud) but were never recorded as a migration file, due to the
-- historical cloud-only DDL workflow. Discovered by diffing pg_tables/pg_proc on
-- supa.bgs.mn against everything already present in supabase/migrations/.
-- Placed last: trip_leader_notes' RLS policies reference bgs_attendance.buses.h_autobus_id,
-- which is only added by 20260707012730_add_h_autobus_columns_to_buses.sql.

CREATE SCHEMA IF NOT EXISTS mobile;

--
-- Name: current_org_on_bus(bigint); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.current_org_on_bus(p_bus_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
  select exists (
    select 1
    from bgs_attendance.passenger_assignments pa
    join public.users u on u.id = pa.internal_user_id
    where pa.bus_id = p_bus_id
      and u.organization_id = public.current_user_org_id()
  );
$$;

--
-- Name: get_passenger_current_bus(bigint, bigint); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.get_passenger_current_bus(p_bteg_id bigint, p_target_bus_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
    DECLARE
      v_user record;
      v_shift_exchange_id bigint;
      v_current_bus_name text;
    BEGIN
      IF NOT (
        public.has_permission(auth.uid(),'shift_exchange','admin')
        OR EXISTS (
          SELECT 1 FROM bgs_attendance.trip_leaders tl
          WHERE tl.bus_id = p_target_bus_id AND tl.is_active
            AND tl.bteg_id = public.current_bteg_id()::text
        )
      ) THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;

      SELECT id, first_name, last_name, department_name, position_name INTO v_user
      FROM public.users WHERE bteg_id = p_bteg_id::text;

      IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('status','not_found');
      END IF;

      SELECT b.shift_exchange_id INTO v_shift_exchange_id
      FROM bgs_attendance.buses b WHERE b.id = p_target_bus_id;

      IF v_shift_exchange_id IS NOT NULL THEN
        SELECT bus.name INTO v_current_bus_name
        FROM bgs_attendance.passenger_assignments pa
        JOIN bgs_attendance.buses bus ON bus.id = pa.bus_id
        WHERE pa.internal_user_id = v_user.id
          AND pa.shift_exchange_id = v_shift_exchange_id
        LIMIT 1;
      END IF;

      RETURN jsonb_build_object(
        'status','ok',
        'name', nullif(trim(concat_ws(' ', v_user.last_name, v_user.first_name)), ''),
        'departmentName', v_user.department_name,
        'positionName', v_user.position_name,
        'currentBusName', v_current_bus_name
      );
    END;
    $$;

--
-- Name: register_scanned_passenger(bigint, bigint); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.register_scanned_passenger(p_bteg_id bigint, p_target_bus_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
    DECLARE
      v_uid uuid;
      v_user record;
      v_target_bus record;
      v_asgn record;
      v_cur_count int;
      v_name text;
      v_new_original bigint;
    BEGIN
      v_uid := public.current_user_id();
      IF v_uid IS NULL THEN
        RETURN jsonb_build_object('status','error','message','Нэвтрээгүй хэрэглэгч');
      END IF;

      IF NOT (
        public.has_permission(auth.uid(),'shift_exchange','admin')
        OR EXISTS (
          SELECT 1 FROM bgs_attendance.trip_leaders tl
          WHERE tl.bus_id = p_target_bus_id AND tl.is_active
            AND tl.bteg_id = public.current_bteg_id()::text
        )
      ) THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;

      SELECT id, first_name, last_name INTO v_user
      FROM public.users WHERE bteg_id = p_bteg_id::text;

      IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('status','user_not_found');
      END IF;
      v_name := nullif(trim(concat_ws(' ', v_user.last_name, v_user.first_name)), '');

      SELECT id, shift_exchange_id, capacity INTO v_target_bus
      FROM bgs_attendance.buses WHERE id = p_target_bus_id;

      IF v_target_bus.id IS NULL THEN
        RETURN jsonb_build_object('status','bus_not_found');
      END IF;

      SELECT id, bus_id, original_bus_id INTO v_asgn
      FROM bgs_attendance.passenger_assignments
      WHERE internal_user_id = v_user.id
        AND shift_exchange_id = v_target_bus.shift_exchange_id
      LIMIT 1;

      IF v_asgn.id IS NOT NULL AND v_asgn.bus_id = p_target_bus_id THEN
        RETURN jsonb_build_object('status','already_this_bus', 'passenger_name', v_name);
      END IF;

      SELECT count(*) INTO v_cur_count
      FROM bgs_attendance.passenger_assignments WHERE bus_id = p_target_bus_id;
      IF v_cur_count >= bgs_attendance.passenger_capacity(v_target_bus.capacity) THEN
        RETURN jsonb_build_object('status','full', 'message',
          format('Автобус дүүрсэн байна (%s/%s)', v_cur_count, bgs_attendance.passenger_capacity(v_target_bus.capacity)));
      END IF;

      IF v_asgn.id IS NULL THEN
        INSERT INTO bgs_attendance.passenger_assignments
          (internal_user_id, bteg_id, bus_id, original_bus_id, shift_exchange_id,
           is_confirmed, confirmed_at, confirmed_by, confirmed_by_bteg_id)
        VALUES
          (v_user.id, p_bteg_id::text, p_target_bus_id, p_target_bus_id, v_target_bus.shift_exchange_id,
           true, now(), v_uid, public.current_bteg_id()::text);
      ELSE
        -- Зорчигч жинхэнэ анхны автобус руугаа (шилжилт хийгдэхээс өмнөх/анхны бичлэгийн
        -- bus_id-руу) буцаж байгаа бол original_bus_id-г NULL болгоно — эс бөгөөс
        -- original_bus_id = bus_id (target) болж "Ээлжийн бус" гэж буруу тэмдэглэгдэж,
        -- дараа нь "Цуцлах" дарахад removeDirectPassenger (бүрмөсөн DELETE) дуудагдах
        -- боломжтой байсан (reverse_transfer-ийн оронд).
        v_new_original := coalesce(v_asgn.original_bus_id, v_asgn.bus_id);
        IF v_new_original = p_target_bus_id THEN
          v_new_original := NULL;
        END IF;

        UPDATE bgs_attendance.passenger_assignments
        SET original_bus_id = v_new_original,
            bus_id = p_target_bus_id,
            is_confirmed = true,
            confirmed_at = now(),
            confirmed_by = v_uid,
            confirmed_by_bteg_id = public.current_bteg_id()::text
        WHERE id = v_asgn.id;
      END IF;
      RETURN jsonb_build_object('status','transferred', 'passenger_name', v_name);
    END;
    $$;

--
-- Name: remove_direct_passenger(bigint); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.remove_direct_passenger(p_assignment_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
    DECLARE
      v_bus_id bigint;
    BEGIN
      SELECT bus_id INTO v_bus_id
      FROM bgs_attendance.passenger_assignments
      WHERE id = p_assignment_id;

      IF v_bus_id IS NULL THEN
        RETURN jsonb_build_object('status','not_found');
      END IF;

      IF NOT (
        public.has_permission(auth.uid(),'shift_exchange','admin')
        OR EXISTS (
          SELECT 1 FROM bgs_attendance.trip_leaders tl
          WHERE tl.bus_id = v_bus_id AND tl.is_active
            AND tl.bteg_id = public.current_bteg_id()::text
        )
      ) THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;

      DELETE FROM bgs_attendance.passenger_assignments WHERE id = p_assignment_id;

      RETURN jsonb_build_object('status','removed');
    END;
    $$;

--
-- Name: reverse_transfer(bigint); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.reverse_transfer(p_assignment_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_bus_id bigint;
  v_orig_id bigint;
BEGIN
  SELECT bus_id, original_bus_id
  INTO v_bus_id, v_orig_id
  FROM bgs_attendance.passenger_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_orig_id IS NULL OR v_orig_id = v_bus_id THEN
    RETURN jsonb_build_object('status', 'not_a_transfer');
  END IF;

  UPDATE bgs_attendance.passenger_assignments
  SET
    bus_id = v_orig_id,
    original_bus_id = NULL,
    is_confirmed = false,
    confirmed_at = NULL,
    confirmed_by = NULL
  WHERE id = p_assignment_id;

  RETURN jsonb_build_object('status', 'reversed');
END;
$$;

--
-- Name: set_pa_confirmed_by_name(); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.set_pa_confirmed_by_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.confirmed_by IS NULL THEN
    NEW.confirmed_by_name := NULL;
  ELSE
    SELECT u.nice_name INTO NEW.confirmed_by_name FROM public.users u WHERE u.id = NEW.confirmed_by;
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: set_pa_submitted_by_snapshot(); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.set_pa_submitted_by_snapshot() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.submitted_by IS NULL THEN
    NEW.submitted_by_name := NULL;
    NEW.submitted_by_bteg_id := NULL;
  ELSE
    SELECT u.nice_name, u.bteg_id INTO NEW.submitted_by_name, NEW.submitted_by_bteg_id
    FROM public.users u WHERE u.id = NEW.submitted_by;
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: set_trip_leader_note_bteg_created_by_id(); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.set_trip_leader_note_bteg_created_by_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  SELECT u.bteg_id INTO NEW.bteg_created_by_id
  FROM public.users u
  WHERE u.id = NEW.created_by;
  RETURN NEW;
END;
$$;

--
-- Name: sync_confirmed_by_bteg_id(); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.sync_confirmed_by_bteg_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
begin
  if NEW.confirmed_by is null then
    NEW.confirmed_by_bteg_id := null;
  else
    select u.bteg_id into NEW.confirmed_by_bteg_id
    from public.users u
    where u.id = NEW.confirmed_by;
  end if;
  return NEW;
end;
$$;

--
-- Name: sync_pa_h_autobus_id(); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.sync_pa_h_autobus_id() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.bus_id IS NULL THEN
    NEW.h_autobus_id := NULL;
  ELSE
    SELECT b.h_autobus_id INTO NEW.h_autobus_id
    FROM bgs_attendance.buses b WHERE b.id = NEW.bus_id;
  END IF;

  IF NEW.original_bus_id IS NULL THEN
    NEW.original_h_autobus_id := NULL;
  ELSE
    SELECT b.h_autobus_id INTO NEW.original_h_autobus_id
    FROM bgs_attendance.buses b WHERE b.id = NEW.original_bus_id;
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: sync_trip_leader_to_passenger_assignments(); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.sync_trip_leader_to_passenger_assignments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
DECLARE
  v_shift_exchange_id bigint;
  v_internal_user_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT u.id INTO v_internal_user_id
    FROM public.users u WHERE u.bteg_id = OLD.bteg_id;

    -- Match on OLD.bus_id directly (not via buses join): when this fires
    -- because the bus itself was deleted (ON DELETE CASCADE), the buses
    -- row is already gone by the time this trigger runs.
    IF v_internal_user_id IS NOT NULL THEN
      DELETE FROM bgs_attendance.passenger_assignments
      WHERE bus_id = OLD.bus_id
        AND internal_user_id = v_internal_user_id
        AND is_trip_leader = true;
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT
  SELECT b.shift_exchange_id INTO v_shift_exchange_id
  FROM bgs_attendance.buses b WHERE b.id = NEW.bus_id;

  SELECT u.id INTO v_internal_user_id
  FROM public.users u WHERE u.bteg_id = NEW.bteg_id;

  IF v_shift_exchange_id IS NOT NULL AND v_internal_user_id IS NOT NULL THEN
    INSERT INTO bgs_attendance.passenger_assignments
      (shift_exchange_id, bus_id, internal_user_id, is_trip_leader,
       is_confirmed, confirmed_at, confirmed_by, confirmed_by_bteg_id)
    VALUES (v_shift_exchange_id, NEW.bus_id, v_internal_user_id, true,
            true, now(), v_internal_user_id, NEW.bteg_id)
    ON CONFLICT (shift_exchange_id, internal_user_id) DO UPDATE
      SET bus_id = EXCLUDED.bus_id,
          is_trip_leader = true,
          is_confirmed = true,
          confirmed_at = coalesce(bgs_attendance.passenger_assignments.confirmed_at, now()),
          confirmed_by = v_internal_user_id,
          confirmed_by_bteg_id = NEW.bteg_id;
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: unconfirm_passenger(bigint, bigint); Type: FUNCTION; Schema: bgs_attendance; Owner: -
--

CREATE FUNCTION bgs_attendance.unconfirm_passenger(p_bteg_id bigint, p_bus_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'bgs_attendance', 'public'
    AS $$
    DECLARE
      v_assignment_id bigint;
    BEGIN
      IF NOT (
        public.has_permission(auth.uid(),'shift_exchange','admin')
        OR EXISTS (
          SELECT 1 FROM bgs_attendance.trip_leaders tl
          WHERE tl.bus_id = p_bus_id AND tl.is_active
            AND tl.bteg_id = public.current_bteg_id()::text
        )
      ) THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;

      SELECT id INTO v_assignment_id
      FROM bgs_attendance.passenger_assignments
      WHERE bus_id = p_bus_id AND bteg_id = p_bteg_id::text
      LIMIT 1;

      IF v_assignment_id IS NULL THEN
        RETURN jsonb_build_object('status','not_found');
      END IF;

      UPDATE bgs_attendance.passenger_assignments
      SET is_confirmed = false, confirmed_at = NULL, confirmed_by = NULL,
          confirmed_by_bteg_id = NULL
      WHERE id = v_assignment_id;

      RETURN jsonb_build_object('status','unconfirmed');
    END;
    $$;


--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: trip_leader_notes; Type: TABLE; Schema: bgs_attendance; Owner: -
--

CREATE TABLE bgs_attendance.trip_leader_notes (
    id bigint NOT NULL,
    created_by uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bteg_h_autobus_id bigint NOT NULL,
    bteg_created_by_id text
);


--
-- Name: trip_leader_notes_id_seq; Type: SEQUENCE; Schema: bgs_attendance; Owner: -
--

CREATE SEQUENCE bgs_attendance.trip_leader_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trip_leader_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: bgs_attendance; Owner: -
--

ALTER SEQUENCE bgs_attendance.trip_leader_notes_id_seq OWNED BY bgs_attendance.trip_leader_notes.id;


--
-- Name: trip_leader_notes id; Type: DEFAULT; Schema: bgs_attendance; Owner: -
--

ALTER TABLE ONLY bgs_attendance.trip_leader_notes ALTER COLUMN id SET DEFAULT nextval('bgs_attendance.trip_leader_notes_id_seq'::regclass);


--
-- Name: trip_leader_notes trip_leader_notes_pkey; Type: CONSTRAINT; Schema: bgs_attendance; Owner: -
--

ALTER TABLE ONLY bgs_attendance.trip_leader_notes
    ADD CONSTRAINT trip_leader_notes_pkey PRIMARY KEY (id);


--
-- Name: idx_trip_leader_notes_bteg_h_autobus_id; Type: INDEX; Schema: bgs_attendance; Owner: -
--

CREATE INDEX idx_trip_leader_notes_bteg_h_autobus_id ON bgs_attendance.trip_leader_notes USING btree (bteg_h_autobus_id);


--
-- Name: trip_leader_notes trg_set_trip_leader_note_bteg_created_by_id; Type: TRIGGER; Schema: bgs_attendance; Owner: -
--

CREATE TRIGGER trg_set_trip_leader_note_bteg_created_by_id BEFORE INSERT ON bgs_attendance.trip_leader_notes FOR EACH ROW EXECUTE FUNCTION bgs_attendance.set_trip_leader_note_bteg_created_by_id();


--
-- Name: trip_leader_notes trip_leader_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: bgs_attendance; Owner: -
--

ALTER TABLE ONLY bgs_attendance.trip_leader_notes
    ADD CONSTRAINT trip_leader_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: trip_leader_notes tln_admin_all; Type: POLICY; Schema: bgs_attendance; Owner: -
--

CREATE POLICY tln_admin_all ON bgs_attendance.trip_leader_notes USING (( SELECT public.has_permission(auth.uid(), 'shift_exchange'::text, 'admin'::text) AS has_permission)) WITH CHECK (( SELECT public.has_permission(auth.uid(), 'shift_exchange'::text, 'admin'::text) AS has_permission));


--
-- Name: trip_leader_notes tln_trip_leader_all; Type: POLICY; Schema: bgs_attendance; Owner: -
--

CREATE POLICY tln_trip_leader_all ON bgs_attendance.trip_leader_notes USING ((bteg_h_autobus_id IN ( SELECT b.h_autobus_id
   FROM bgs_attendance.buses b
  WHERE ((b.trip_leader_id = ( SELECT public.current_user_id() AS current_user_id)) AND (b.h_autobus_id IS NOT NULL))))) WITH CHECK ((bteg_h_autobus_id IN ( SELECT b.h_autobus_id
   FROM bgs_attendance.buses b
  WHERE ((b.trip_leader_id = ( SELECT public.current_user_id() AS current_user_id)) AND (b.h_autobus_id IS NOT NULL)))));


--
-- Name: trip_leader_notes tln_view_select; Type: POLICY; Schema: bgs_attendance; Owner: -
--

CREATE POLICY tln_view_select ON bgs_attendance.trip_leader_notes FOR SELECT USING (( SELECT public.has_permission(auth.uid(), 'shift_exchange'::text, 'view'::text) AS has_permission));


--
-- Name: trip_leader_notes; Type: ROW SECURITY; Schema: bgs_attendance; Owner: -
--

ALTER TABLE bgs_attendance.trip_leader_notes ENABLE ROW LEVEL SECURITY;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: add_group_member(bigint, uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.add_group_member(p_conversation_id bigint, p_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_type text; v_vis text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  SELECT type, visibility INTO v_type, v_vis
    FROM mobile.conversations WHERE id = p_conversation_id;
  IF v_type IS DISTINCT FROM 'group' THEN RAISE EXCEPTION 'not a group'; END IF;
  IF NOT mobile.is_member(p_conversation_id) THEN RAISE EXCEPTION 'not a member'; END IF;

  -- private бол зөвхөн админ
  IF v_vis = 'private' AND NOT mobile.is_group_admin(p_conversation_id) THEN
    RAISE EXCEPTION 'only admin can add members to a private group';
  END IF;

  -- урих хүн нь уригчийн accepted contact байх ёстой
  IF NOT EXISTS (
    SELECT 1 FROM mobile.contacts c WHERE c.status='accepted'
      AND ((c.requester_id = v_me AND c.addressee_id = p_user_id)
        OR (c.requester_id = p_user_id AND c.addressee_id = v_me))
  ) THEN
    RAISE EXCEPTION 'can only add your own contacts';
  END IF;

  INSERT INTO mobile.conversation_members(conversation_id, user_id, role)
  VALUES (p_conversation_id, p_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN 'added';
END;
$$;


--
-- Name: contact_status(uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.contact_status(p_other uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT CASE
    WHEN p_other = mobile.me() THEN 'self'
    WHEN EXISTS (SELECT 1 FROM mobile.contacts c WHERE c.status='accepted'
      AND ((c.requester_id=mobile.me() AND c.addressee_id=p_other)
        OR (c.requester_id=p_other AND c.addressee_id=mobile.me()))) THEN 'accepted'
    WHEN EXISTS (SELECT 1 FROM mobile.contacts c WHERE c.status='pending'
      AND c.requester_id=mobile.me() AND c.addressee_id=p_other) THEN 'pending_out'
    WHEN EXISTS (SELECT 1 FROM mobile.contacts c WHERE c.status='pending'
      AND c.requester_id=p_other AND c.addressee_id=mobile.me()) THEN 'pending_in'
    ELSE 'none'
  END;
$$;


--
-- Name: create_direct_conversation(uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.create_direct_conversation(p_other_user_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_key text; v_id bigint;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'invalid target user';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mobile.contacts c WHERE c.status='accepted'
      AND ((c.requester_id = v_me AND c.addressee_id = p_other_user_id)
        OR (c.requester_id = p_other_user_id AND c.addressee_id = v_me))
  ) THEN
    RAISE EXCEPTION 'not an accepted contact';
  END IF;

  v_key := LEAST(v_me::text, p_other_user_id::text) || '_' || GREATEST(v_me::text, p_other_user_id::text);

  SELECT id INTO v_id FROM mobile.conversations WHERE direct_key = v_key;
  IF v_id IS NULL THEN
    INSERT INTO mobile.conversations(type, direct_key, created_by)
    VALUES ('direct', v_key, v_me) RETURNING id INTO v_id;
    INSERT INTO mobile.conversation_members(conversation_id, user_id, role)
    VALUES (v_id, v_me, 'member'), (v_id, p_other_user_id, 'member');
  END IF;
  RETURN v_id;
END;
$$;


--
-- Name: create_group_conversation(text, uuid[], text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.create_group_conversation(p_title text, p_member_ids uuid[], p_visibility text DEFAULT 'private'::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_id bigint; v_uid uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;

  INSERT INTO mobile.conversations(type, title, visibility, created_by)
  VALUES ('group', COALESCE(NULLIF(trim(p_title), ''), 'Группын чат'),
          CASE WHEN p_visibility = 'public' THEN 'public' ELSE 'private' END, v_me)
  RETURNING id INTO v_id;

  INSERT INTO mobile.conversation_members(conversation_id, user_id, role)
  VALUES (v_id, v_me, 'admin');

  IF p_member_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_member_ids LOOP
      IF v_uid <> v_me AND EXISTS (SELECT 1 FROM public.users WHERE id = v_uid) THEN
        INSERT INTO mobile.conversation_members(conversation_id, user_id, role)
        VALUES (v_id, v_uid, 'member')
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN v_id;
END;
$$;


--
-- Name: delete_push_token(text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.delete_push_token(p_token text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  delete from mobile.push_tokens where token = p_token;
$$;


--
-- Name: get_contact_requests(); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_contact_requests() RETURNS TABLE(requester_id uuid, name text, position_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT c.requester_id,
    TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) AS name,
    u.position_name, c.created_at
  FROM mobile.contacts c
  JOIN public.users u ON u.id = c.requester_id
  WHERE c.addressee_id = mobile.me() AND c.status = 'pending'
  ORDER BY c.created_at DESC;
$$;


--
-- Name: get_contacts(); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_contacts() RETURNS TABLE(user_id uuid, name text, position_name text, heltes_name text, phone text, avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT u.id,
    TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) AS name,
    u.position_name, u.heltes_name, u.phone, u.avatar_url
  FROM mobile.contacts c
  JOIN public.users u
    ON u.id = CASE WHEN c.requester_id = mobile.me() THEN c.addressee_id ELSE c.requester_id END
  WHERE c.status = 'accepted'
    AND (c.requester_id = mobile.me() OR c.addressee_id = mobile.me())
  ORDER BY name;
$$;


--
-- Name: get_conversations(); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_conversations() RETURNS TABLE(id text, name text, avatar_url text, type text, last_message text, last_message_at timestamp with time zone, unread integer, is_group boolean, is_official boolean, is_muted boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT
    c.id::text,
    CASE
      WHEN c.type IN ('group','official') THEN COALESCE(c.title, 'Чат')
      ELSE COALESCE((
        SELECT NULLIF(TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')), '')
        FROM mobile.conversation_members om
        JOIN public.users u ON u.id = om.user_id
        WHERE om.conversation_id = c.id AND om.user_id <> mobile.me()
        LIMIT 1
      ), 'Чат')
    END AS name,
    CASE
      WHEN c.type = 'direct' THEN (
        SELECT u.avatar_url
        FROM mobile.conversation_members om
        JOIN public.users u ON u.id = om.user_id
        WHERE om.conversation_id = c.id AND om.user_id <> mobile.me()
        LIMIT 1
      )
      ELSE c.avatar_url
    END AS avatar_url,
    c.type,
    c.last_message_preview AS last_message,
    c.last_message_at,
    CASE
      WHEN m.user_id IS NULL THEN 0
      ELSE (
        SELECT count(*)::int FROM mobile.messages msg
        WHERE msg.conversation_id = c.id
          AND msg.created_at > m.last_read_at
          AND (msg.sender_id IS NULL OR msg.sender_id <> mobile.me())
      )
    END AS unread,
    (c.type = 'group')    AS is_group,
    (c.type = 'official') AS is_official,
    COALESCE(m.muted, false) AS is_muted
  FROM mobile.conversations c
  LEFT JOIN mobile.conversation_members m
    ON m.conversation_id = c.id AND m.user_id = mobile.me()
  WHERE (m.user_id IS NOT NULL OR c.type = 'official')
    AND (m.hidden_at IS NULL OR c.last_message_at > m.hidden_at)
  ORDER BY c.last_message_at DESC;
$$;


--
-- Name: get_direct_peer(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_direct_peer(p_conversation_id bigint) RETURNS TABLE(user_id uuid, name text, position_name text, heltes_name text, phone text, avatar_url text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  select u.id,
    trim(coalesce(u.last_name,'') || ' ' || coalesce(u.first_name,'')) as name,
    u.position_name, u.heltes_name, u.phone, u.avatar_url
  from mobile.conversation_members cm
  join public.users u on u.id = cm.user_id
  where cm.conversation_id = p_conversation_id
    and cm.user_id <> mobile.me()
    and mobile.is_member(p_conversation_id)
  limit 1;
$$;


--
-- Name: get_group_detail(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_group_detail(p_conversation_id bigint) RETURNS TABLE(id text, title text, visibility text, is_admin boolean, member_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT c.id::text, c.title, c.visibility, mobile.is_group_admin(c.id),
    (SELECT count(*)::int FROM mobile.conversation_members m WHERE m.conversation_id = c.id)
  FROM mobile.conversations c
  WHERE c.id = p_conversation_id AND c.type = 'group' AND mobile.is_member(c.id);
$$;


--
-- Name: get_group_join_requests(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_group_join_requests(p_conversation_id bigint) RETURNS TABLE(user_id uuid, name text, position_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT r.user_id,
    TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) AS name,
    u.position_name, r.created_at
  FROM mobile.group_join_requests r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.conversation_id = p_conversation_id AND r.status = 'pending'
    AND mobile.is_group_admin(p_conversation_id)
  ORDER BY r.created_at;
$$;


--
-- Name: get_group_members(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_group_members(p_conversation_id bigint) RETURNS TABLE(user_id uuid, name text, position_name text, role text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT m.user_id,
    TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) AS name,
    u.position_name, m.role
  FROM mobile.conversation_members m
  JOIN public.users u ON u.id = m.user_id
  WHERE m.conversation_id = p_conversation_id AND mobile.is_member(p_conversation_id)
  ORDER BY (m.role = 'admin') DESC, name;
$$;


--
-- Name: get_messages(bigint, integer, timestamp with time zone); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_messages(p_conversation_id bigint, p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(id text, sender_id uuid, sender_name text, sender_staff text, sender_avatar text, body text, created_at timestamp with time zone, is_mine boolean, actions jsonb, kind text, attachment_url text, attachment_name text, attachment_mime text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_is_official boolean; v_title text;
BEGIN
  SELECT (c.type='official'), c.title INTO v_is_official, v_title
    FROM mobile.conversations c WHERE c.id = p_conversation_id;
  IF v_is_official IS NULL THEN RAISE EXCEPTION 'conversation not found'; END IF;
  IF NOT (mobile.is_member(p_conversation_id) OR v_is_official) THEN
    RAISE EXCEPTION 'not a member of conversation %', p_conversation_id;
  END IF;

  RETURN QUERY
    SELECT s.id, s.sender_id, s.sender_name, s.sender_staff, s.sender_avatar, s.body, s.created_at,
           s.is_mine, s.actions, s.kind, s.attachment_url, s.attachment_name, s.attachment_mime
    FROM (
      SELECT m.id::text AS id, m.sender_id AS sender_id,
             CASE WHEN v_is_official THEN COALESCE(v_title, 'Систем')
                  ELSE TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) END AS sender_name,
             CASE WHEN v_is_official AND m.sender_id IS NOT NULL
                  THEN TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,''))
                  ELSE NULL END AS sender_staff,
             u.avatar_url AS sender_avatar,
             m.body AS body, m.created_at AS created_at,
             (m.sender_id = v_me) AS is_mine, m.actions AS actions,
             m.type AS kind, m.attachment_url AS attachment_url,
             m.attachment_name AS attachment_name, m.attachment_mime AS attachment_mime
      FROM mobile.messages m
      LEFT JOIN public.users u ON u.id = m.sender_id
      WHERE m.conversation_id = p_conversation_id
        AND (p_before IS NULL OR m.created_at < p_before)
      ORDER BY m.created_at DESC
      LIMIT p_limit
    ) s
    ORDER BY s.created_at ASC;
END;
$$;


--
-- Name: get_org_group_members(text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_org_group_members(p_group_bteg_id text) RETURNS TABLE(id uuid, name text, position_name text, heltes_name text, phone text, contact_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT u.id,
    TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) AS name,
    u.position_name, u.heltes_name, u.phone, mobile.contact_status(u.id)
  FROM public.user_groups ug
  JOIN public.users u ON u.bteg_id = ug.user_id
  WHERE ug.group_id = p_group_bteg_id
    AND u.auth_user_id IS NOT NULL
    AND u.id <> mobile.me()
  ORDER BY name;
$$;


--
-- Name: get_org_groups(); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_org_groups() RETURNS TABLE(group_id text, name text, member_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT DISTINCT eg.bteg_id AS group_id,
    eg.name,
    (SELECT count(*)::int FROM public.user_groups ug2
       JOIN public.users u2 ON u2.bteg_id = ug2.user_id
       WHERE ug2.group_id = eg.bteg_id AND u2.auth_user_id IS NOT NULL) AS member_count
  FROM public.user_groups ug
  JOIN public.eelj_groups eg ON eg.bteg_id = ug.group_id
  WHERE ug.user_id = (SELECT bteg_id FROM public.users WHERE id = mobile.me())
  ORDER BY eg.name;
$$;


--
-- Name: get_peer_read_at(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.get_peer_read_at(p_conversation_id bigint) RETURNS timestamp with time zone
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  select max(cm.last_read_at)
  from mobile.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id <> mobile.me()
    and mobile.is_member(p_conversation_id);
$$;


--
-- Name: hide_conversation(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.hide_conversation(p_conversation_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  UPDATE mobile.conversation_members SET hidden_at = now()
   WHERE conversation_id=p_conversation_id AND user_id=v_me;
END;
$$;


--
-- Name: is_group_admin(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.is_group_admin(p_conversation_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM mobile.conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.user_id = mobile.me() AND m.role = 'admin'
  );
$$;


--
-- Name: is_member(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.is_member(p_conversation_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM mobile.conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.user_id = mobile.me()
  );
$$;


--
-- Name: leave_group(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.leave_group(p_conversation_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_was_admin boolean; v_admins int;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mobile.conversations WHERE id=p_conversation_id AND type='group') THEN
    RAISE EXCEPTION 'not a group';
  END IF;
  SELECT (role='admin') INTO v_was_admin FROM mobile.conversation_members
    WHERE conversation_id=p_conversation_id AND user_id=v_me;
  IF v_was_admin IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  DELETE FROM mobile.conversation_members WHERE conversation_id=p_conversation_id AND user_id=v_me;

  IF v_was_admin THEN
    SELECT count(*) INTO v_admins FROM mobile.conversation_members
      WHERE conversation_id=p_conversation_id AND role='admin';
    IF v_admins = 0 THEN
      UPDATE mobile.conversation_members SET role='admin'
       WHERE conversation_id=p_conversation_id
         AND user_id = (SELECT user_id FROM mobile.conversation_members
                        WHERE conversation_id=p_conversation_id ORDER BY joined_at LIMIT 1);
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mobile.conversation_members WHERE conversation_id=p_conversation_id) THEN
    DELETE FROM mobile.conversations WHERE id=p_conversation_id;
  END IF;
END;
$$;


--
-- Name: mark_read(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.mark_read(p_conversation_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;
  INSERT INTO mobile.conversation_members(conversation_id, user_id, role, last_read_at)
  VALUES (p_conversation_id, v_me, 'subscriber', now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = now();
END;
$$;


--
-- Name: me(); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.me() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT COALESCE(
    (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1),
    public.current_user_id()
  );
$$;


--
-- Name: post_official_message(text, text, jsonb, uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.post_official_message(p_channel_key text, p_body text, p_actions jsonb DEFAULT NULL::jsonb, p_sender uuid DEFAULT NULL::uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_conv bigint; v_perm text; v_id bigint;
BEGIN
  SELECT id, post_permission INTO v_conv, v_perm
    FROM mobile.conversations WHERE channel_key = p_channel_key AND type='official';
  IF v_conv IS NULL THEN RAISE EXCEPTION 'unknown channel %', p_channel_key; END IF;
  IF auth.uid() IS NOT NULL THEN
    IF v_perm IS NULL OR NOT public.has_permission(auth.uid(), v_perm, 'create') THEN
      RAISE EXCEPTION 'not authorized to post to %', p_channel_key;
    END IF;
  END IF;
  INSERT INTO mobile.messages(conversation_id, sender_id, body, type, actions)
  VALUES (v_conv, p_sender, p_body, 'system', p_actions) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: remove_contact(uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.remove_contact(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  DELETE FROM mobile.contacts
   WHERE (requester_id = v_me AND addressee_id = p_user_id)
      OR (requester_id = p_user_id AND addressee_id = v_me);
END;
$$;


--
-- Name: remove_group_member(bigint, uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.remove_group_member(p_conversation_id bigint, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  IF NOT mobile.is_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'not a group admin'; END IF;
  IF p_user_id = v_me THEN RAISE EXCEPTION 'use leave_group to leave'; END IF;
  DELETE FROM mobile.conversation_members
   WHERE conversation_id=p_conversation_id AND user_id=p_user_id;
END;
$$;


--
-- Name: request_join_group(bigint); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.request_join_group(p_conversation_id bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mobile.conversations c
                 WHERE c.id = p_conversation_id AND c.type='group' AND c.visibility='public') THEN
    RAISE EXCEPTION 'not a public group';
  END IF;
  IF mobile.is_member(p_conversation_id) THEN RETURN 'member'; END IF;
  INSERT INTO mobile.group_join_requests(conversation_id, user_id, status)
  VALUES (p_conversation_id, v_me, 'pending')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET status='pending', responded_at=NULL, responded_by=NULL;
  RETURN 'pending';
END;
$$;


--
-- Name: respond_contact_request(uuid, boolean); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.respond_contact_request(p_requester_id uuid, p_accept boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  UPDATE mobile.contacts
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE requester_id = p_requester_id AND addressee_id = v_me AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending request'; END IF;
  RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
END;
$$;


--
-- Name: respond_group_join_request(bigint, uuid, boolean); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.respond_group_join_request(p_conversation_id bigint, p_user_id uuid, p_accept boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  IF NOT mobile.is_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'not a group admin'; END IF;
  UPDATE mobile.group_join_requests
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now(), responded_by = v_me
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending request'; END IF;
  IF p_accept THEN
    INSERT INTO mobile.conversation_members(conversation_id, user_id, role)
    VALUES (p_conversation_id, p_user_id, 'member')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
END;
$$;


--
-- Name: save_push_token(text, text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.save_push_token(p_token text, p_platform text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  insert into mobile.push_tokens(user_id, token, platform, updated_at)
  values (mobile.me(), p_token, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
$$;


--
-- Name: search_public_groups(text, integer); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.search_public_groups(p_query text, p_limit integer DEFAULT 50) RETURNS TABLE(id text, name text, member_count integer, join_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT c.id::text,
    COALESCE(c.title, 'Группа') AS name,
    (SELECT count(*)::int FROM mobile.conversation_members m WHERE m.conversation_id = c.id),
    CASE
      WHEN mobile.is_member(c.id) THEN 'member'
      WHEN EXISTS (SELECT 1 FROM mobile.group_join_requests r
                   WHERE r.conversation_id = c.id AND r.user_id = mobile.me() AND r.status='pending') THEN 'pending'
      ELSE 'none'
    END AS join_status
  FROM mobile.conversations c
  WHERE c.type = 'group' AND c.visibility = 'public'
    AND (p_query IS NULL OR p_query = '' OR COALESCE(c.title,'') ILIKE '%' || p_query || '%')
  ORDER BY c.title
  LIMIT p_limit;
$$;


--
-- Name: search_system_users(text, integer); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.search_system_users(p_query text, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, name text, position_name text, heltes_name text, phone text, contact_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
  SELECT u.id,
    TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')) AS name,
    u.position_name, u.heltes_name, u.phone,
    mobile.contact_status(u.id)
  FROM public.users u
  WHERE u.auth_user_id IS NOT NULL
    AND u.id <> mobile.me()
    AND (
      p_query IS NULL OR p_query = ''
      OR (COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) ILIKE '%' || p_query || '%'
      OR COALESCE(u.phone,'') ILIKE '%' || p_query || '%'
    )
  ORDER BY name
  LIMIT p_limit;
$$;


--
-- Name: send_contact_request(uuid); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.send_contact_request(p_addressee_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_status text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  IF p_addressee_id IS NULL OR p_addressee_id = v_me THEN RAISE EXCEPTION 'invalid target'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_addressee_id AND auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'target is not a system user';
  END IF;

  UPDATE mobile.contacts SET status='accepted', responded_at=now()
   WHERE requester_id = p_addressee_id AND addressee_id = v_me AND status='pending';
  IF FOUND THEN RETURN 'accepted'; END IF;

  IF EXISTS (SELECT 1 FROM mobile.contacts
             WHERE requester_id = p_addressee_id AND addressee_id = v_me AND status='accepted') THEN
    RETURN 'accepted';
  END IF;

  SELECT status INTO v_status FROM mobile.contacts
   WHERE requester_id = v_me AND addressee_id = p_addressee_id;
  IF v_status IS NOT NULL THEN
    IF v_status = 'declined' THEN
      UPDATE mobile.contacts SET status='pending', responded_at=NULL
       WHERE requester_id = v_me AND addressee_id = p_addressee_id;
      RETURN 'pending';
    END IF;
    RETURN v_status;
  END IF;

  INSERT INTO mobile.contacts(requester_id, addressee_id, status)
  VALUES (v_me, p_addressee_id, 'pending');
  RETURN 'pending';
END;
$$;


--
-- Name: send_media_message(bigint, text, text, text, text, text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.send_media_message(p_conversation_id bigint, p_body text, p_url text, p_name text, p_mime text, p_kind text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_id bigint;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  IF EXISTS (SELECT 1 FROM mobile.conversations c WHERE c.id=p_conversation_id AND c.type='official') THEN
    RAISE EXCEPTION 'official channel is read-only';
  END IF;
  IF NOT mobile.is_member(p_conversation_id) THEN RAISE EXCEPTION 'not a member'; END IF;
  IF p_url IS NULL OR length(trim(p_url))=0 THEN RAISE EXCEPTION 'no attachment'; END IF;

  INSERT INTO mobile.messages(conversation_id, sender_id, body, type,
                              attachment_url, attachment_name, attachment_mime)
  VALUES (p_conversation_id, v_me, COALESCE(p_body,''),
          CASE WHEN p_kind='image' THEN 'image' ELSE 'file' END,
          p_url, p_name, p_mime)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: send_message(bigint, text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.send_message(p_conversation_id bigint, p_body text) RETURNS TABLE(id text, sender_id uuid, sender_name text, body text, created_at timestamp with time zone, is_mine boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me(); v_id bigint;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  IF EXISTS (SELECT 1 FROM mobile.conversations c WHERE c.id = p_conversation_id AND c.type='official') THEN
    RAISE EXCEPTION 'official channel is read-only';
  END IF;
  IF NOT mobile.is_member(p_conversation_id) THEN
    RAISE EXCEPTION 'not a member of conversation %', p_conversation_id;
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'empty message';
  END IF;

  INSERT INTO mobile.messages(conversation_id, sender_id, body)
  VALUES (p_conversation_id, v_me, p_body)
  RETURNING messages.id INTO v_id;

  RETURN QUERY
    SELECT m.id::text, m.sender_id,
           TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')),
           m.body, m.created_at, true
    FROM mobile.messages m
    JOIN public.users u ON u.id = m.sender_id
    WHERE m.id = v_id;
END;
$$;


--
-- Name: set_avatar(text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.set_avatar(p_url text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'no current user'; END IF;
  UPDATE public.users SET avatar_url = p_url WHERE id = v_me;
END;
$$;


--
-- Name: set_group_title(bigint, text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.set_group_title(p_conversation_id bigint, p_title text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
BEGIN
  IF NOT mobile.is_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'not a group admin'; END IF;
  IF length(trim(COALESCE(p_title,''))) = 0 THEN RAISE EXCEPTION 'empty title'; END IF;
  UPDATE mobile.conversations SET title=trim(p_title)
   WHERE id=p_conversation_id AND type='group';
END;
$$;


--
-- Name: set_group_visibility(bigint, text); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.set_group_visibility(p_conversation_id bigint, p_visibility text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
BEGIN
  IF p_visibility NOT IN ('private','public') THEN RAISE EXCEPTION 'invalid visibility'; END IF;
  IF NOT mobile.is_group_admin(p_conversation_id) THEN RAISE EXCEPTION 'not a group admin'; END IF;
  UPDATE mobile.conversations SET visibility = p_visibility
   WHERE id = p_conversation_id AND type = 'group';
END;
$$;


--
-- Name: set_mute(bigint, boolean); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.set_mute(p_conversation_id bigint, p_muted boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
DECLARE v_me uuid := mobile.me();
BEGIN
  UPDATE mobile.conversation_members SET muted = p_muted
   WHERE conversation_id=p_conversation_id AND user_id=v_me;
END;
$$;


--
-- Name: tg_msg_after_insert(); Type: FUNCTION; Schema: mobile; Owner: -
--

CREATE FUNCTION mobile.tg_msg_after_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'mobile', 'public'
    AS $$
BEGIN
  UPDATE mobile.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = CASE
        WHEN NEW.type = 'image' THEN '📷 Зураг'
        WHEN NEW.type = 'file'  THEN COALESCE(NULLIF(NEW.attachment_name,''), '📎 Файл')
        ELSE left(NEW.body, 140)
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: contacts; Type: TABLE; Schema: mobile; Owner: -
--

CREATE TABLE mobile.contacts (
    id bigint NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT contacts_check CHECK ((requester_id <> addressee_id)),
    CONSTRAINT contacts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: mobile; Owner: -
--

ALTER TABLE mobile.contacts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME mobile.contacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conversation_members; Type: TABLE; Schema: mobile; Owner: -
--

CREATE TABLE mobile.conversation_members (
    conversation_id bigint NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone NOT NULL,
    muted boolean DEFAULT false NOT NULL,
    hidden_at timestamp with time zone,
    CONSTRAINT conversation_members_role_check CHECK ((role = ANY (ARRAY['member'::text, 'admin'::text, 'subscriber'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: mobile; Owner: -
--

CREATE TABLE mobile.conversations (
    id bigint NOT NULL,
    type text DEFAULT 'direct'::text NOT NULL,
    title text,
    avatar_url text,
    direct_key text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_preview text,
    visibility text DEFAULT 'private'::text NOT NULL,
    channel_key text,
    post_permission text,
    CONSTRAINT conversations_type_check CHECK ((type = ANY (ARRAY['direct'::text, 'group'::text, 'official'::text]))),
    CONSTRAINT conversations_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'public'::text])))
);

ALTER TABLE ONLY mobile.conversations REPLICA IDENTITY FULL;


--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: mobile; Owner: -
--

ALTER TABLE mobile.conversations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME mobile.conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: group_join_requests; Type: TABLE; Schema: mobile; Owner: -
--

CREATE TABLE mobile.group_join_requests (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    responded_by uuid,
    CONSTRAINT group_join_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: group_join_requests_id_seq; Type: SEQUENCE; Schema: mobile; Owner: -
--

ALTER TABLE mobile.group_join_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME mobile.group_join_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: messages; Type: TABLE; Schema: mobile; Owner: -
--

CREATE TABLE mobile.messages (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    sender_id uuid,
    body text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actions jsonb,
    attachment_url text,
    attachment_name text,
    attachment_mime text
);

ALTER TABLE ONLY mobile.messages REPLICA IDENTITY FULL;


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: mobile; Owner: -
--

ALTER TABLE mobile.messages ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME mobile.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: push_tokens; Type: TABLE; Schema: mobile; Owner: -
--

CREATE TABLE mobile.push_tokens (
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_requester_id_addressee_id_key; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.contacts
    ADD CONSTRAINT contacts_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);


--
-- Name: conversation_members conversation_members_pkey; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.conversation_members
    ADD CONSTRAINT conversation_members_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_direct_key_key; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.conversations
    ADD CONSTRAINT conversations_direct_key_key UNIQUE (direct_key);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: group_join_requests group_join_requests_conversation_id_user_id_key; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.group_join_requests
    ADD CONSTRAINT group_join_requests_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: group_join_requests group_join_requests_pkey; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.group_join_requests
    ADD CONSTRAINT group_join_requests_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (token);


--
-- Name: idx_mobile_contacts_addressee; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_contacts_addressee ON mobile.contacts USING btree (addressee_id, status);


--
-- Name: idx_mobile_contacts_requester; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_contacts_requester ON mobile.contacts USING btree (requester_id, status);


--
-- Name: idx_mobile_conv_created_by; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_conv_created_by ON mobile.conversations USING btree (created_by);


--
-- Name: idx_mobile_conv_last_msg; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_conv_last_msg ON mobile.conversations USING btree (last_message_at DESC);


--
-- Name: idx_mobile_gjr_conv; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_gjr_conv ON mobile.group_join_requests USING btree (conversation_id, status);


--
-- Name: idx_mobile_gjr_responded_by; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_gjr_responded_by ON mobile.group_join_requests USING btree (responded_by);


--
-- Name: idx_mobile_gjr_user; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_gjr_user ON mobile.group_join_requests USING btree (user_id, status);


--
-- Name: idx_mobile_members_user; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_members_user ON mobile.conversation_members USING btree (user_id);


--
-- Name: idx_mobile_messages_conv; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_messages_conv ON mobile.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_mobile_messages_sender; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX idx_mobile_messages_sender ON mobile.messages USING btree (sender_id);


--
-- Name: push_tokens_user_id_idx; Type: INDEX; Schema: mobile; Owner: -
--

CREATE INDEX push_tokens_user_id_idx ON mobile.push_tokens USING btree (user_id);


--
-- Name: uq_conv_channel_key; Type: INDEX; Schema: mobile; Owner: -
--

CREATE UNIQUE INDEX uq_conv_channel_key ON mobile.conversations USING btree (channel_key) WHERE (channel_key IS NOT NULL);


--
-- Name: messages trg_msg_after_insert; Type: TRIGGER; Schema: mobile; Owner: -
--

CREATE TRIGGER trg_msg_after_insert AFTER INSERT ON mobile.messages FOR EACH ROW EXECUTE FUNCTION mobile.tg_msg_after_insert();


--
-- Name: contacts contacts_addressee_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.contacts
    ADD CONSTRAINT contacts_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(id);


--
-- Name: contacts contacts_requester_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.contacts
    ADD CONSTRAINT contacts_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id);


--
-- Name: conversation_members conversation_members_conversation_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.conversation_members
    ADD CONSTRAINT conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES mobile.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_members conversation_members_user_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.conversation_members
    ADD CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: group_join_requests group_join_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.group_join_requests
    ADD CONSTRAINT group_join_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES mobile.conversations(id) ON DELETE CASCADE;


--
-- Name: group_join_requests group_join_requests_responded_by_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.group_join_requests
    ADD CONSTRAINT group_join_requests_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.users(id);


--
-- Name: group_join_requests group_join_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.group_join_requests
    ADD CONSTRAINT group_join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES mobile.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: mobile; Owner: -
--

ALTER TABLE ONLY mobile.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contacts; Type: ROW SECURITY; Schema: mobile; Owner: -
--

ALTER TABLE mobile.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_select; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY contacts_select ON mobile.contacts FOR SELECT TO authenticated USING (((requester_id = mobile.me()) OR (addressee_id = mobile.me())));


--
-- Name: conversations conv_select; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY conv_select ON mobile.conversations FOR SELECT TO authenticated USING (((type = 'official'::text) OR mobile.is_member(id)));


--
-- Name: conversation_members; Type: ROW SECURITY; Schema: mobile; Owner: -
--

ALTER TABLE mobile.conversation_members ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: mobile; Owner: -
--

ALTER TABLE mobile.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: group_join_requests gjr_select; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY gjr_select ON mobile.group_join_requests FOR SELECT TO authenticated USING (((user_id = mobile.me()) OR mobile.is_group_admin(conversation_id)));


--
-- Name: group_join_requests; Type: ROW SECURITY; Schema: mobile; Owner: -
--

ALTER TABLE mobile.group_join_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_members mem_select; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY mem_select ON mobile.conversation_members FOR SELECT TO authenticated USING (mobile.is_member(conversation_id));


--
-- Name: conversation_members mem_update_own; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY mem_update_own ON mobile.conversation_members FOR UPDATE TO authenticated USING ((user_id = mobile.me())) WITH CHECK ((user_id = mobile.me()));


--
-- Name: messages; Type: ROW SECURITY; Schema: mobile; Owner: -
--

ALTER TABLE mobile.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages msg_insert; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY msg_insert ON mobile.messages FOR INSERT TO authenticated WITH CHECK (((sender_id = mobile.me()) AND mobile.is_member(conversation_id) AND (NOT (EXISTS ( SELECT 1
   FROM mobile.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.type = 'official'::text)))))));


--
-- Name: messages msg_select; Type: POLICY; Schema: mobile; Owner: -
--

CREATE POLICY msg_select ON mobile.messages FOR SELECT TO authenticated USING ((mobile.is_member(conversation_id) OR (EXISTS ( SELECT 1
   FROM mobile.conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.type = 'official'::text))))));


--
-- Name: push_tokens; Type: ROW SECURITY; Schema: mobile; Owner: -
--

ALTER TABLE mobile.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- Catch-up: individual columns that were added directly on production (cloud-only DDL)
-- without ever being captured as a migration, discovered by diffing information_schema.columns
-- on supa.bgs.mn against the schema this migration set produces. All nullable, safe to add here.

ALTER TABLE bgs_attendance.buses ADD COLUMN bus_number integer;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN confirmed_by_bteg_id text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN confirmed_by_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN department_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN first_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN h_autobus_id bigint;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN h_eelj_soliltsoo_id bigint;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN heltes_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN is_eeljiin_bus boolean DEFAULT false;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN is_trip_leader boolean DEFAULT false;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN last_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN original_bus_id bigint;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN original_h_autobus_id bigint;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN phone text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN position_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN submitted_by_bteg_id text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN submitted_by_name text;
ALTER TABLE bgs_attendance.passenger_assignments ADD COLUMN zam_tsag bigint;
ALTER TABLE bgs_attendance.trip_leaders ADD COLUMN autobus_direction_id text;
ALTER TABLE bgs_attendance.trip_leaders ADD COLUMN eelj_id bigint;
ALTER TABLE public.users ADD COLUMN avatar_url text;
ALTER TABLE public.users ADD COLUMN bus_number integer;
ALTER TABLE public.users ADD COLUMN sf_guard_group_id text;
ALTER TABLE target.h_autobus ADD COLUMN default_autobus_id bigint;
ALTER TABLE target.sf_guard_user ADD COLUMN default_autobus_id bigint;
ALTER TABLE target.sf_guard_user ADD COLUMN default_group_id bigint;

-- Catch-up: view missing from migrations
CREATE OR REPLACE VIEW public.bus_roster_public AS
 SELECT se.id AS exchange_id,
    se.name AS exchange_name,
    se.exchange_date,
    se.direction AS exchange_direction,
    b.id AS bus_id,
    b.name AS bus_name,
    b.departure_time,
    pa.id AS assignment_id,
    u.last_name,
    u.first_name,
    TRIM(BOTH FROM (COALESCE(u.last_name, ''::text) || ' '::text) || COALESCE(u.first_name, ''::text)) AS passenger_name,
    u.position_name,
        CASE
            WHEN u.department_id IS NOT NULL THEN u.department_name
            ELSE NULL::text
        END AS alba_name,
    u.heltes_name,
    o.name AS organization_name,
    pa.is_confirmed,
    false AS is_leader
   FROM bgs_attendance.passenger_assignments pa
     JOIN bgs_attendance.buses b ON b.id = pa.bus_id
     JOIN bgs_attendance.shift_exchanges se ON se.id = pa.shift_exchange_id
     JOIN public.users u ON u.id = pa.internal_user_id
     LEFT JOIN public.organization o ON o.bteg_id = u.organization_id
  WHERE se.status = 'published'::text AND se.exchange_date >= (CURRENT_DATE - '3 days'::interval)
UNION ALL
 SELECT se.id AS exchange_id,
    se.name AS exchange_name,
    se.exchange_date,
    se.direction AS exchange_direction,
    b.id AS bus_id,
    b.name AS bus_name,
    b.departure_time,
    NULL::bigint AS assignment_id,
    u.last_name,
    u.first_name,
    TRIM(BOTH FROM (COALESCE(u.last_name, ''::text) || ' '::text) || COALESCE(u.first_name, ''::text)) AS passenger_name,
    u.position_name,
        CASE
            WHEN u.department_id IS NOT NULL THEN u.department_name
            ELSE NULL::text
        END AS alba_name,
    u.heltes_name,
    o.name AS organization_name,
    false AS is_confirmed,
    true AS is_leader
   FROM bgs_attendance.buses b
     JOIN bgs_attendance.shift_exchanges se ON se.id = b.shift_exchange_id
     JOIN public.users u ON u.id = b.trip_leader_id
     LEFT JOIN public.organization o ON o.bteg_id = u.organization_id
  WHERE se.status = 'published'::text AND se.exchange_date >= (CURRENT_DATE - '3 days'::interval) AND b.trip_leader_id IS NOT NULL;
