
\restrict nQ9RVO5nJ5rhTOMeyWZmnxMo3RchJgxFIkH8hwXelbWlTDaJDd9SUCwTkDxvZzt


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "target";


ALTER SCHEMA "target" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_order_total"("p_order_id" bigint) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    total_cost DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(total_price), 0) 
    INTO total_cost 
    FROM order_items 
    WHERE order_id = p_order_id AND status != 'cancelled';
    
    -- Update the order total
    UPDATE orders 
    SET total_estimated_cost = total_cost, updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN total_cost;
END;
$$;


ALTER FUNCTION "public"."calculate_order_total"("p_order_id" bigint) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_order_total_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_order_total(OLD.order_id);
        RETURN OLD;
    ELSE
        PERFORM calculate_order_total(NEW.order_id);
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_order_total_trigger"() OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "part_id" bigint,
    "part_number" character varying(100),
    "part_name" character varying(200) NOT NULL,
    "part_description" "text",
    "manufacturer" character varying(100),
    "quantity" integer DEFAULT 1 NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "notes" "text",
    "supplier_name" character varying(200),
    "supplier_quote_reference" character varying(100),
    "expected_delivery_date" "date",
    "actual_delivery_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_price" integer
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


CREATE TABLE IF NOT EXISTS "public"."order_reviewers" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "reviewer_type" character varying(50) NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "comments" "text",
    "profile_id" bigint,
    "assigned_by" bigint
);


ALTER TABLE "public"."order_reviewers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_reviewers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_reviewers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_reviewers_id_seq" OWNED BY "public"."order_reviewers"."id";



CREATE TABLE IF NOT EXISTS "public"."order_revisions" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "revision_number" integer NOT NULL,
    "change_type" character varying(50) NOT NULL,
    "changes_summary" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "changed_by" bigint
);


ALTER TABLE "public"."order_revisions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_revisions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_revisions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_revisions_id_seq" OWNED BY "public"."order_revisions"."id";



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
    "equipment_name" character varying(200),
    "equipment_model" character varying(100),
    "equipment_serial" character varying(100),
    "equipment_location" character varying(200),
    "urgency_level" character varying(20) DEFAULT 'medium'::character varying,
    "requested_delivery_date" "date",
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "created_by" "uuid" NOT NULL,
    "assigned_technical_reviewer" "uuid",
    "assigned_department_approver" "uuid",
    "assigned_final_approver" "uuid",
    "assigned_procurement_officer" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "submitted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "internal_reference" character varying(100),
    "total_estimated_cost" bigint,
    "created_profile" bigint
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



CREATE TABLE IF NOT EXISTS "public"."parts_catalog" (
    "id" bigint NOT NULL,
    "part_number" character varying(100) NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "category" character varying(100),
    "manufacturer" character varying(100),
    "model_compatibility" "text"[],
    "availability_status" character varying(50) DEFAULT 'available'::character varying,
    "lead_time_days" integer,
    "minimum_order_quantity" integer DEFAULT 1,
    "specifications" "jsonb",
    "image_url" character varying(500),
    "supplier_info" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parts_catalog" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."parts_catalog_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."parts_catalog_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."parts_catalog_id_seq" OWNED BY "public"."parts_catalog"."id";



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



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" bigint NOT NULL,
    "name" character varying(50) NOT NULL,
    "display_name" character varying(100) NOT NULL,
    "description" "text",
    "permissions" "jsonb",
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
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
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "profile_id" bigint
);


ALTER TABLE "public"."roles_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_order_item" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_item_id" bigint,
    "created_by" "uuid",
    "quantity" integer,
    "status" "text",
    "description" "text"
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


CREATE TABLE IF NOT EXISTS "target"."g_department" (
    "id" bigint NOT NULL,
    "is_new" bigint,
    "name" "text",
    "description" "text",
    "organization_id" bigint,
    "is_active" bigint,
    "sort_order" bigint,
    "darga_id" bigint,
    "parent_id" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "heltes_id" bigint,
    "gazar_id" bigint,
    "sub_title" "text",
    "updated_user_id" bigint,
    "created_user_id" bigint,
    "telegram_id" "text"
);


ALTER TABLE "target"."g_department" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_gazar" (
    "id" bigint NOT NULL,
    "name" "text",
    "description" "text",
    "darga_id" bigint,
    "organization_id" bigint,
    "is_active" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone
);


ALTER TABLE "target"."g_gazar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_heltes" (
    "id" bigint NOT NULL,
    "is_new" bigint,
    "name" "text",
    "description" "text",
    "organization_id" bigint,
    "gazar_id" bigint,
    "darga_id" bigint,
    "sort_order" bigint,
    "is_active" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "sub_title" "text",
    "updated_user_id" bigint,
    "created_user_id" bigint,
    "telegram_id" "text"
);


ALTER TABLE "target"."g_heltes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_job_position" (
    "id" bigint NOT NULL,
    "is_new" bigint,
    "type_id" bigint,
    "name" "text",
    "description" "text",
    "organization_id" bigint,
    "department_id" bigint,
    "file_path" "text",
    "created_by" bigint,
    "updated_by" bigint,
    "is_active" bigint,
    "sort_order" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "is_definition" bigint,
    "definition" "text",
    "gazar_id" bigint,
    "heltes_id" bigint,
    "heseg_id" bigint,
    "file_name" "text",
    "at_code" "text",
    "max_emplyoyee" bigint,
    "min_emplyoyee" bigint,
    "updated_user_id" bigint,
    "created_user_id" bigint,
    "max_tsalin_zereg" numeric,
    "min_tsalin_zereg" numeric,
    "ajil_mergejliin_angilal" "text"
);


ALTER TABLE "target"."g_job_position" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."g_organization" (
    "id" bigint NOT NULL,
    "name" "text",
    "sub_title" "text",
    "sector_id" bigint,
    "description" "text",
    "note" "text",
    "about" "text",
    "logo_path" "text",
    "phone" "text",
    "fax" "text",
    "web_site" "text",
    "email" "text",
    "is_featured" bigint,
    "video" "text",
    "is_trash" bigint,
    "deleted_at" bigint,
    "created_by" bigint,
    "updated_by" bigint,
    "is_active" bigint,
    "is_blocked" bigint,
    "status" bigint,
    "sort_order" bigint,
    "slug" "text",
    "expired_at" timestamp without time zone,
    "config" "text",
    "facebook" "text",
    "twitter" "text",
    "linkedin" "text",
    "pinterest" "text",
    "instagram" "text",
    "key_word" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "parent_id" bigint,
    "is_hr" bigint,
    "telegram_id" "text"
);


ALTER TABLE "target"."g_organization" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "target"."sf_guard_user" (
    "id" bigint NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email_address" "text",
    "username" "text",
    "algorithm" "text",
    "salt" "text",
    "password" "text",
    "is_active" bigint,
    "is_confirm" bigint,
    "is_super_admin" bigint,
    "last_login" timestamp without time zone,
    "phone" "text",
    "phone2" "text",
    "address" "text",
    "profile_image" "text",
    "fb_user_id" bigint,
    "organization_id" bigint,
    "twitter_user_id" bigint,
    "sector_id" bigint,
    "locked" bigint,
    "expired" bigint,
    "expires_at" timestamp without time zone,
    "confirmation_token" "text",
    "password_requested_at" timestamp without time zone,
    "roles" "text",
    "credentials_expired" bigint,
    "credentials_expire_at" timestamp without time zone,
    "mobile_confirmation" "text",
    "department_id" bigint,
    "position_id" bigint,
    "master_group" bigint,
    "code" "text",
    "heseg" bigint,
    "nas" bigint,
    "huis" "text",
    "ndd" "text",
    "emdd" "text",
    "ajillasan_jil" "text",
    "register_number" "text",
    "zergiin_angilal" bigint,
    "zereg" "text",
    "geree_ehelsen" "date",
    "geree_duusah" "date",
    "kart_dugaar" "text",
    "dans_dugaar" "text",
    "d_turul_code" bigint,
    "alban_tushaal_code" bigint,
    "family_name" "text",
    "ajil_mergejliin_angilal" "text",
    "ajliin_gazriin_bairshil" bigint,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "is_group" bigint,
    "is_jiremsnii_amralt" bigint,
    "is_tetgever" bigint,
    "heltes_id" bigint,
    "gazar_id" bigint,
    "alba_id" bigint,
    "heseg_id" bigint,
    "alban_tushaal_id" bigint,
    "tsalin_zereg_id" bigint,
    "job_type_id" bigint,
    "sanhuu_dugaar" "text",
    "position_name" "text",
    "group_reason" "text",
    "ajillasan_nuhtsul" "text",
    "old_position_user" bigint,
    "is_empty_position" bigint,
    "out_date" "date",
    "command_number" "text",
    "description" "text",
    "status_id" bigint,
    "is_ok" bigint,
    "out_category_id" bigint,
    "out_text" "text",
    "work_time_id" bigint,
    "out_category_type_id" bigint,
    "work_type_id" bigint,
    "department_name" "text",
    "nice_name" "text",
    "autobus_direction_id" bigint,
    "in_date" "date",
    "heltes_name" "text",
    "tsag_burtgeliin_tailbar" "text",
    "updated_user_id" bigint,
    "created_user_id" bigint,
    "last_autobus_id" bigint,
    "last_direction_id" bigint,
    "sf_guard_group_id" bigint,
    "eelj_soliltsoo_id" bigint,
    "current_worked_days" bigint,
    "current_not_work_days" bigint,
    "next_eelj_soliltoo" "date",
    "idcard_number" "text",
    "heseg_name" "text",
    "nd_country_year" bigint
);


ALTER TABLE "target"."sf_guard_user" OWNER TO "postgres";


ALTER TABLE ONLY "public"."order_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_reviewers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_reviewers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_revisions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_revisions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_workflow" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_workflow_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."orders" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."orders_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."parts_catalog" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."parts_catalog_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles_profiles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_reviewers"
    ADD CONSTRAINT "order_reviewers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_revisions"
    ADD CONSTRAINT "order_revisions_order_id_revision_number_key" UNIQUE ("order_id", "revision_number");



ALTER TABLE ONLY "public"."order_revisions"
    ADD CONSTRAINT "order_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_workflow"
    ADD CONSTRAINT "order_workflow_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parts_catalog"
    ADD CONSTRAINT "parts_catalog_part_number_key" UNIQUE ("part_number");



ALTER TABLE ONLY "public"."parts_catalog"
    ADD CONSTRAINT "parts_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "unique_bteg_id" UNIQUE ("bteg_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "unique_phone" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "target"."sf_guard_user"
    ADD CONSTRAINT "sf_guard_user_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_part_id" ON "public"."order_items" USING "btree" ("part_id");



CREATE INDEX "idx_order_items_part_number" ON "public"."order_items" USING "btree" ("part_number");



CREATE INDEX "idx_order_items_status" ON "public"."order_items" USING "btree" ("status");



CREATE INDEX "idx_order_reviewers_order_id" ON "public"."order_reviewers" USING "btree" ("order_id");



CREATE INDEX "idx_order_reviewers_type" ON "public"."order_reviewers" USING "btree" ("reviewer_type");



CREATE INDEX "idx_order_revisions_order_id" ON "public"."order_revisions" USING "btree" ("order_id");



CREATE INDEX "idx_order_workflow_changed_by" ON "public"."order_workflow" USING "btree" ("changed_by");



CREATE INDEX "idx_order_workflow_order_id" ON "public"."order_workflow" USING "btree" ("order_id");



CREATE INDEX "idx_order_workflow_status" ON "public"."order_workflow" USING "btree" ("to_status");



CREATE INDEX "idx_orders_assigned_reviewers" ON "public"."orders" USING "btree" ("assigned_technical_reviewer", "assigned_department_approver", "assigned_final_approver");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_created_by" ON "public"."orders" USING "btree" ("created_by");



CREATE INDEX "idx_orders_order_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_urgency" ON "public"."orders" USING "btree" ("urgency_level");



CREATE INDEX "idx_parts_catalog_active" ON "public"."parts_catalog" USING "btree" ("is_active");



CREATE INDEX "idx_parts_catalog_availability" ON "public"."parts_catalog" USING "btree" ("availability_status");



CREATE INDEX "idx_parts_catalog_category" ON "public"."parts_catalog" USING "btree" ("category");



CREATE INDEX "idx_parts_catalog_manufacturer" ON "public"."parts_catalog" USING "btree" ("manufacturer");



CREATE INDEX "idx_parts_catalog_name_search" ON "public"."parts_catalog" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((("name")::"text" || ' '::"text") || "description")));



CREATE INDEX "idx_parts_catalog_part_number" ON "public"."parts_catalog" USING "btree" ("part_number");



CREATE INDEX "idx_roles_is_active" ON "public"."roles" USING "btree" ("is_active");



CREATE INDEX "idx_roles_name" ON "public"."roles" USING "btree" ("name");



CREATE INDEX "idx_user_bteg_id" ON "public"."users" USING "btree" ("bteg_id");



CREATE INDEX "idx_user_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_user_is_active" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "idx_user_phone" ON "public"."users" USING "btree" ("phone");



CREATE INDEX "idx_user_roles_active" ON "public"."roles_profiles" USING "btree" ("is_active");



CREATE INDEX "idx_user_roles_expires" ON "public"."roles_profiles" USING "btree" ("expires_at");



CREATE INDEX "idx_user_roles_role_id" ON "public"."roles_profiles" USING "btree" ("role_id");



CREATE UNIQUE INDEX "users_phone_uniq" ON "public"."users" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trigger_set_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "trigger_update_order_total" AFTER INSERT OR DELETE OR UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_total_trigger"();



CREATE OR REPLACE TRIGGER "on_sf_guard_user_insert" AFTER INSERT ON "target"."sf_guard_user" FOR EACH ROW EXECUTE FUNCTION "public"."sync_sf_guard_user_insert"();



CREATE OR REPLACE TRIGGER "on_sf_guard_user_update" AFTER UPDATE ON "target"."sf_guard_user" FOR EACH ROW EXECUTE FUNCTION "public"."sync_sf_guard_user_update"();



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "public"."parts_catalog"("id");



ALTER TABLE ONLY "public"."order_reviewers"
    ADD CONSTRAINT "order_reviewers_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_reviewers"
    ADD CONSTRAINT "order_reviewers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_reviewers"
    ADD CONSTRAINT "order_reviewers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_revisions"
    ADD CONSTRAINT "order_revisions_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."order_revisions"
    ADD CONSTRAINT "order_revisions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_workflow"
    ADD CONSTRAINT "order_workflow_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_workflow"
    ADD CONSTRAINT "order_workflow_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_department_approver_fkey" FOREIGN KEY ("assigned_department_approver") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_final_approver_fkey" FOREIGN KEY ("assigned_final_approver") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_procurement_officer_fkey" FOREIGN KEY ("assigned_procurement_officer") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_technical_reviewer_fkey" FOREIGN KEY ("assigned_technical_reviewer") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_profile_fkey" FOREIGN KEY ("created_profile") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_order_item"
    ADD CONSTRAINT "sub_order_item_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."roles_profiles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




























































































































































GRANT ALL ON FUNCTION "public"."calculate_order_total"("p_order_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_order_total"("p_order_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_order_total"("p_order_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profile_from_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profile_from_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profile_from_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profiles_for_existing_auth_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profiles_for_existing_auth_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profiles_for_existing_auth_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_profile_on_auth_user_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_profile_on_auth_user_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_profile_on_auth_user_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_auth_user_to_public_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_auth_user_to_public_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_auth_user_to_public_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_sf_guard_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_sf_guard_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_sf_guard_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sf_guard_user_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_order_status"("p_order_id" bigint, "p_new_status" character varying, "p_user_id" "uuid", "p_comments" "text", "p_change_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_total_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_total_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_total_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_from_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_from_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_from_auth_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_reviewers" TO "anon";
GRANT ALL ON TABLE "public"."order_reviewers" TO "authenticated";
GRANT ALL ON TABLE "public"."order_reviewers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_reviewers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_reviewers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_reviewers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_revisions" TO "anon";
GRANT ALL ON TABLE "public"."order_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."order_revisions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_revisions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_revisions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_revisions_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."parts_catalog" TO "anon";
GRANT ALL ON TABLE "public"."parts_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."parts_catalog" TO "service_role";



GRANT ALL ON SEQUENCE "public"."parts_catalog_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."parts_catalog_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."parts_catalog_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile" TO "anon";
GRANT ALL ON TABLE "public"."profile" TO "authenticated";
GRANT ALL ON TABLE "public"."profile" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles_profiles" TO "anon";
GRANT ALL ON TABLE "public"."roles_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sub_order_item" TO "anon";
GRANT ALL ON TABLE "public"."sub_order_item" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_order_item" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sub_order_item_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sub_order_item_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sub_order_item_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









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






























\unrestrict nQ9RVO5nJ5rhTOMeyWZmnxMo3RchJgxFIkH8hwXelbWlTDaJDd9SUCwTkDxvZzt

RESET ALL;
