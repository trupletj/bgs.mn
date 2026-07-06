-- Extend handle_h_user_autobus_address_sync() so the external legacy system
-- can also drive passenger_assignments.bus_id (resolved via
-- h_user_autobus_address.autobus_id -> buses.h_autobus_id), with
-- "external wins" semantics: only overwrites bus_id when the external bus
-- is actually resolvable; never clobbers an HR assignment when it isn't.
-- On delete/soft-delete, bus_id is reverted to NULL (back to pool) so HR
-- can reassign. Sets bgs_attendance.sync_write=true (transaction-local) so
-- trg_track_bus_assignment_source correctly flags these writes.

CREATE OR REPLACE FUNCTION bgs_attendance.handle_h_user_autobus_address_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
DECLARE
  v_shift_exchange_id bigint;
  v_internal_user_id  uuid;
  v_row_id bigint;
  v_ext_bus_id bigint;
BEGIN
  PERFORM set_config('bgs_attendance.sync_write', 'true', true);

  v_row_id := COALESCE(NEW.id, OLD.id);

  IF TG_OP = 'DELETE' OR (TG_OP <> 'DELETE' AND NEW._sdc_deleted_at IS NOT NULL) THEN
    SELECT se.id INTO v_shift_exchange_id FROM bgs_attendance.shift_exchanges se
      WHERE se.eelj_id = COALESCE(NEW.eel_soliltsoo_id, OLD.eel_soliltsoo_id);
    SELECT u.id INTO v_internal_user_id FROM public.users u
      WHERE u.bteg_id = COALESCE(NEW.user_id, OLD.user_id);
    IF v_shift_exchange_id IS NOT NULL AND v_internal_user_id IS NOT NULL THEN
      UPDATE bgs_attendance.passenger_assignments SET
        bus_id = NULL,
        pickup_address = NULL, pickup_street = NULL, pickup_land_position_address = NULL,
        pickup_apart_position = NULL, pickup_apart_position_id = NULL,
        pickup_user_apart_position_id = NULL, pickup_district_id = NULL, pickup_city_id = NULL,
        seat_number = NULL, approved_zam_tsag = NULL, is_personal_machine = NULL,
        machine_number = NULL, not_done_issue = NULL, legacy_is_done = NULL,
        h_user_autobus_address_id = NULL, legacy_synced_at = now()
      WHERE shift_exchange_id = v_shift_exchange_id AND internal_user_id = v_internal_user_id
        AND h_user_autobus_address_id = v_row_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT se.id INTO v_shift_exchange_id FROM bgs_attendance.shift_exchanges se
    WHERE se.eelj_id = NEW.eel_soliltsoo_id;
  SELECT u.id INTO v_internal_user_id FROM public.users u WHERE u.bteg_id = NEW.user_id;
  IF v_shift_exchange_id IS NULL OR v_internal_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.id INTO v_ext_bus_id FROM bgs_attendance.buses b WHERE b.h_autobus_id = NEW.autobus_id;

  INSERT INTO bgs_attendance.passenger_assignments (
    shift_exchange_id, internal_user_id, bteg_id, bus_id,
    h_user_autobus_address_id, pickup_address, pickup_street, pickup_land_position_address,
    pickup_apart_position, pickup_apart_position_id, pickup_user_apart_position_id,
    pickup_district_id, pickup_city_id, seat_number, approved_zam_tsag,
    is_personal_machine, machine_number, not_done_issue, legacy_is_done,
    legacy_synced_at, created_at
  ) VALUES (
    v_shift_exchange_id, v_internal_user_id, NEW.user_id, v_ext_bus_id,
    NEW.id, NEW.address, NEW.street, NEW.land_position_address,
    NEW.apart_position, NEW.apart_position_id, NEW.user_apart_position_id,
    NEW.district_id, NEW.city_id, NEW.sit_number, NEW.approved_zam_tsag,
    NEW.is_personal_machine, NEW.machine_number, NEW.not_done_issue, NEW.is_done,
    now(), now()
  )
  ON CONFLICT (shift_exchange_id, internal_user_id) DO UPDATE SET
    bus_id = CASE WHEN v_ext_bus_id IS NOT NULL THEN v_ext_bus_id
                  ELSE bgs_attendance.passenger_assignments.bus_id END,
    h_user_autobus_address_id    = EXCLUDED.h_user_autobus_address_id,
    pickup_address               = EXCLUDED.pickup_address,
    pickup_street                = EXCLUDED.pickup_street,
    pickup_land_position_address = EXCLUDED.pickup_land_position_address,
    pickup_apart_position        = EXCLUDED.pickup_apart_position,
    pickup_apart_position_id     = EXCLUDED.pickup_apart_position_id,
    pickup_user_apart_position_id= EXCLUDED.pickup_user_apart_position_id,
    pickup_district_id           = EXCLUDED.pickup_district_id,
    pickup_city_id                = EXCLUDED.pickup_city_id,
    seat_number                  = EXCLUDED.seat_number,
    approved_zam_tsag            = EXCLUDED.approved_zam_tsag,
    is_personal_machine          = EXCLUDED.is_personal_machine,
    machine_number                = EXCLUDED.machine_number,
    not_done_issue                = EXCLUDED.not_done_issue,
    legacy_is_done                 = EXCLUDED.legacy_is_done,
    legacy_synced_at              = now();
  RETURN NEW;
END;
$function$;
