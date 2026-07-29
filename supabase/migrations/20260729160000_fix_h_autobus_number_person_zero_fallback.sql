-- Bug: bgs_attendance.handle_h_autobus_sync() sets buses.capacity from
-- `COALESCE(NEW.number_person, 45)::int` — this only falls back to 45 when
-- the legacy h_autobus.number_person is NULL. The legacy system sometimes
-- sends 0 (not NULL) for number_person, which COALESCE does not catch, so
-- capacity ends up 0.
--
-- Impact (found 2026-07-29 while investigating why buses with >45 assigned
-- passengers weren't accepting more via auto_distribute_pool): nearly every
-- bus for the 2026-07-31 shift exchange had capacity=0 despite already
-- having 40+ people assigned via the capacity-agnostic
-- handle_h_user_autobus_address_sync() "external wins" path. With
-- capacity=0, auto_distribute_pool (passenger_capacity(0) = 0) can never
-- place a single person on that bus via the pool — only the external sync
-- can seed the first passenger, after which
-- grow_bus_capacity_to_assigned_count (20260729150000) grows it further.
--
-- Fix: treat 0 the same as NULL — COALESCE(NULLIF(NEW.number_person, 0), 45).

CREATE OR REPLACE FUNCTION bgs_attendance.handle_h_autobus_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
DECLARE
  v_shift_exchange_id bigint;
  v_direction text;
  v_trip_leader_id uuid;
  v_dir_uuid uuid;
  v_bus_id bigint;
BEGIN
  PERFORM set_config('bgs_attendance.sync_write', 'true', true);

  IF TG_OP = 'DELETE' THEN
    UPDATE bgs_attendance.buses SET is_active = false, updated_at = now()
    WHERE h_autobus_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW._sdc_deleted_at IS NOT NULL THEN
    UPDATE bgs_attendance.buses SET is_active = false, updated_at = now()
    WHERE h_autobus_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT se.id, se.direction INTO v_shift_exchange_id, v_direction
  FROM bgs_attendance.shift_exchanges se WHERE se.eelj_id = NEW.eel_soliltsoo_id;
  IF v_shift_exchange_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.id INTO v_trip_leader_id FROM public.users u WHERE u.bteg_id = NEW.user_id::text;

  IF v_trip_leader_id IS NOT NULL THEN
    UPDATE bgs_attendance.buses
    SET trip_leader_id = NULL
    WHERE shift_exchange_id = v_shift_exchange_id
      AND trip_leader_id = v_trip_leader_id
      AND h_autobus_id IS DISTINCT FROM NEW.id
      AND trip_leader_assigned_externally IS NOT FALSE;
  END IF;

  INSERT INTO bgs_attendance.buses (
    h_autobus_id, shift_exchange_id, direction, name, capacity,
    departure_time, trip_leader_id, is_active,
    h_autobus_number, h_autobus_driver_name, h_autobus_driver_phone,
    h_autobus_extra_driver_name, h_autobus_extra_driver_phone,
    h_autobus_apart_position, created_at, updated_at
  ) VALUES (
    NEW.id, v_shift_exchange_id, v_direction,
    COALESCE(NEW.full_name, NEW.eelj, 'Автобус #' || NEW.id),
    COALESCE(NULLIF(NEW.number_person, 0), 45)::int,
    CASE WHEN NEW.day_date IS NOT NULL
      THEN (NEW.day_date::date + COALESCE(NEW.start_time, time '00:30')) AT TIME ZONE 'Asia/Ulaanbaatar'
      ELSE NULL END,
    v_trip_leader_id, COALESCE(NEW.is_active, true),
    NEW.number, NEW.driver_name, NEW.driver_phone_number,
    NEW.extra_driver_name, NEW.extra_driver_phone_number, NEW.apart_position,
    now(), now()
  )
  ON CONFLICT (h_autobus_id) WHERE h_autobus_id IS NOT NULL DO UPDATE SET
    shift_exchange_id = EXCLUDED.shift_exchange_id,
    direction          = EXCLUDED.direction,
    name               = EXCLUDED.name,
    capacity           = EXCLUDED.capacity,
    departure_time     = EXCLUDED.departure_time,
    trip_leader_id     = CASE
                            WHEN bgs_attendance.buses.trip_leader_assigned_externally IS NOT FALSE
                            THEN EXCLUDED.trip_leader_id
                            ELSE bgs_attendance.buses.trip_leader_id
                          END,
    is_active          = EXCLUDED.is_active,
    h_autobus_number             = EXCLUDED.h_autobus_number,
    h_autobus_driver_name        = EXCLUDED.h_autobus_driver_name,
    h_autobus_driver_phone       = EXCLUDED.h_autobus_driver_phone,
    h_autobus_extra_driver_name  = EXCLUDED.h_autobus_extra_driver_name,
    h_autobus_extra_driver_phone = EXCLUDED.h_autobus_extra_driver_phone,
    h_autobus_apart_position     = EXCLUDED.h_autobus_apart_position,
    updated_at = now()
  RETURNING id INTO v_bus_id;

  SELECT ad.id INTO v_dir_uuid FROM public.autobus_direction ad
  WHERE ad.h_autobus_direction_id = NEW.direction_id::text;
  IF v_dir_uuid IS NOT NULL THEN
    INSERT INTO bgs_attendance.bus_routes (bus_id, direction_id, stop_order)
    VALUES (v_bus_id, v_dir_uuid, 1)
    ON CONFLICT (bus_id, direction_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
