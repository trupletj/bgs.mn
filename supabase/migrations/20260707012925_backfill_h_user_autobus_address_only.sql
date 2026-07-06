INSERT INTO bgs_attendance.passenger_assignments (
  shift_exchange_id, internal_user_id, bteg_id,
  h_user_autobus_address_id, pickup_address, pickup_street, pickup_land_position_address,
  pickup_apart_position, pickup_apart_position_id, pickup_user_apart_position_id,
  pickup_district_id, pickup_city_id, seat_number, approved_zam_tsag,
  is_personal_machine, machine_number, not_done_issue, legacy_is_done,
  legacy_synced_at, created_at
)
SELECT DISTINCT ON (se.id, u.id)
  se.id, u.id, h.user_id,
  h.id, h.address, h.street, h.land_position_address,
  h.apart_position, h.apart_position_id, h.user_apart_position_id,
  h.district_id, h.city_id, h.sit_number, h.approved_zam_tsag,
  h.is_personal_machine, h.machine_number, h.not_done_issue, h.is_done,
  now(), now()
FROM target.h_user_autobus_address h
JOIN bgs_attendance.shift_exchanges se ON se.eelj_id = h.eel_soliltsoo_id
JOIN public.users u ON u.bteg_id = h.user_id
WHERE h._sdc_deleted_at IS NULL
ORDER BY se.id, u.id, h.updated_at DESC NULLS LAST, h.id DESC
ON CONFLICT (shift_exchange_id, internal_user_id) DO UPDATE SET
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
