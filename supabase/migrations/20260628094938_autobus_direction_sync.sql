-- 1.0 — public.autobus_direction synced from target.h_autobus_direction
--       + public.users.autobus_direction_id synced from target.sf_guard_user

CREATE TABLE IF NOT EXISTS public.autobus_direction (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bteg_id      text UNIQUE NOT NULL,          -- target.h_autobus_direction.id
  name         text,
  zam_tsag     bigint,
  district_id  text,
  city_id      text,
  created_at   timestamp,
  updated_at   timestamp
);

CREATE OR REPLACE FUNCTION public.handle_h_autobus_direction_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.autobus_direction WHERE bteg_id = OLD.id::TEXT;
        RETURN OLD;
    END IF;

    IF NEW._sdc_deleted_at IS NOT NULL THEN
        DELETE FROM public.autobus_direction WHERE bteg_id = NEW.id::TEXT;
        RETURN NEW;
    END IF;

    INSERT INTO public.autobus_direction
        (bteg_id, name, zam_tsag, district_id, city_id, created_at, updated_at)
    VALUES
        (NEW.id::TEXT, NEW.name, NEW.zam_tsag, NEW.district_id::TEXT,
         NEW.city_id::TEXT, NEW.created_at, NEW.updated_at)
    ON CONFLICT (bteg_id) DO UPDATE SET
        name = EXCLUDED.name, zam_tsag = EXCLUDED.zam_tsag,
        district_id = EXCLUDED.district_id, city_id = EXCLUDED.city_id,
        created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_h_autobus_direction_sync ON target.h_autobus_direction;
CREATE TRIGGER trg_h_autobus_direction_sync
AFTER INSERT OR UPDATE OR DELETE ON target.h_autobus_direction
FOR EACH ROW EXECUTE FUNCTION public.handle_h_autobus_direction_sync();

INSERT INTO public.autobus_direction
    (bteg_id, name, zam_tsag, district_id, city_id, created_at, updated_at)
SELECT id::TEXT, name, zam_tsag, district_id::TEXT, city_id::TEXT, created_at, updated_at
FROM target.h_autobus_direction
WHERE _sdc_deleted_at IS NULL
ON CONFLICT (bteg_id) DO NOTHING;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS autobus_direction_id text
  REFERENCES public.autobus_direction(bteg_id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Extend the existing user-sync trigger to carry autobus_direction_id
CREATE OR REPLACE FUNCTION public.handle_sf_guard_user_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    target_phone TEXT;
    existing_by_phone RECORD;
    existing_by_id RECORD;
    safe_org TEXT := NULL;
    safe_dept TEXT := NULL;
    safe_heltes TEXT := NULL;
    safe_group TEXT := NULL;
    safe_direction TEXT := NULL;
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.users
        SET is_active = false, updated_at = now()
        WHERE bteg_id = OLD.id::TEXT;
        RETURN OLD;
    END IF;

    target_phone := COALESCE(NULLIF(NEW.phone2, ''), NULLIF(NEW.phone, ''));

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
    IF NEW.sf_guard_group_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.eelj_groups g WHERE g.bteg_id = NEW.sf_guard_group_id::TEXT) THEN
        safe_group := NEW.sf_guard_group_id::TEXT;
    END IF;
    IF NEW.autobus_direction_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.autobus_direction d WHERE d.bteg_id = NEW.autobus_direction_id::TEXT) THEN
        safe_direction := NEW.autobus_direction_id::TEXT;
    END IF;

    SELECT id, phone, is_active INTO existing_by_id
    FROM public.users WHERE bteg_id = NEW.id::TEXT LIMIT 1;

    SELECT id, bteg_id, is_active INTO existing_by_phone
    FROM public.users WHERE phone = target_phone AND bteg_id != NEW.id::TEXT LIMIT 1;

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

    IF existing_by_id.id IS NOT NULL THEN
        UPDATE public.users SET
            email = NEW.email_address, phone = target_phone,
            idcard_number = NEW.idcard_number, is_active = NEW.is_active,
            address = NEW.address, register_number = NEW.register_number,
            gazar_id = NEW.gazar_id::TEXT, alba_id = NEW.alba_id::TEXT,
            heltes_id = safe_heltes, job_position_id = NEW.position_id::TEXT,
            nice_name = NEW.nice_name, updated_at = NEW.updated_at,
            first_name = NEW.first_name, last_name = NEW.last_name,
            organization_id = safe_org, department_id = safe_dept,
            department_name = NEW.department_name, heltes_name = NEW.heltes_name,
            position_name = NEW.position_name,
            sf_guard_group_id = safe_group,
            autobus_direction_id = safe_direction
        WHERE id = existing_by_id.id;
    ELSE
        IF NEW.is_active = true THEN
            INSERT INTO public.users (
                bteg_id, email, phone, idcard_number, is_active, address,
                register_number, gazar_id, alba_id, heltes_id, job_position_id,
                nice_name, created_at, updated_at, first_name, last_name,
                organization_id, department_id, department_name, heltes_name, position_name,
                sf_guard_group_id, autobus_direction_id
            )
            VALUES (
                NEW.id::TEXT, NEW.email_address, target_phone, NEW.idcard_number,
                NEW.is_active, NEW.address, NEW.register_number, NEW.gazar_id::TEXT,
                NEW.alba_id::TEXT, safe_heltes, NEW.position_id::TEXT,
                NEW.nice_name, NEW.created_at, NEW.updated_at, NEW.first_name, NEW.last_name,
                safe_org, safe_dept, NEW.department_name, NEW.heltes_name, NEW.position_name,
                safe_group, safe_direction
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

UPDATE public.users u
SET autobus_direction_id = s.autobus_direction_id::TEXT
FROM target.sf_guard_user s
WHERE u.bteg_id = s.id::TEXT
  AND s.autobus_direction_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.autobus_direction d
    WHERE d.bteg_id = s.autobus_direction_id::TEXT
  );
