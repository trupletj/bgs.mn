-- One-time backfill: trg_h_autobus_sync only fires on future writes to
-- target.h_autobus, so historical rows never landed in bgs_attendance.buses.
-- This mirrors the trigger's insert logic in bulk, resolves trip leaders
-- via a deterministic window function (one leader per bus per exchange,
-- preferring the most recently updated h_autobus row) instead of the
-- trigger's imperative "steal the seat" approach, then backfills bus_routes.
--
-- Known limitation: the recency-based trip-leader tie-break only matters
-- for a hypothetical future re-run of this backfill; this is a one-time
-- landing so there is no prior state to conflict with.

INSERT INTO bgs_attendance.buses (
  h_autobus_id, shift_exchange_id, direction, name, capacity,
  departure_time, trip_leader_id, is_active,
  h_autobus_number, h_autobus_driver_name, h_autobus_driver_phone,
  h_autobus_extra_driver_name, h_autobus_extra_driver_phone,
  h_autobus_apart_position, created_at, updated_at
)
SELECT
  a.id, se.id, se.direction,
  COALESCE(a.full_name, a.eelj, 'Автобус #' || a.id),
  COALESCE(a.number_person, 45)::int,
  CASE WHEN a.day_date IS NOT NULL
    THEN (a.day_date::date + COALESCE(a.start_time, time '00:30')) AT TIME ZONE 'Asia/Ulaanbaatar'
    ELSE NULL END,
  NULL, COALESCE(a.is_active, true),
  a.number, a.driver_name, a.driver_phone_number,
  a.extra_driver_name, a.extra_driver_phone_number, a.apart_position,
  now(), now()
FROM target.h_autobus a
JOIN bgs_attendance.shift_exchanges se ON se.eelj_id = a.eel_soliltsoo_id
WHERE a._sdc_deleted_at IS NULL
ON CONFLICT (h_autobus_id) WHERE h_autobus_id IS NOT NULL DO UPDATE SET
  shift_exchange_id = EXCLUDED.shift_exchange_id,
  direction          = EXCLUDED.direction,
  name               = EXCLUDED.name,
  capacity           = EXCLUDED.capacity,
  departure_time     = EXCLUDED.departure_time,
  is_active          = EXCLUDED.is_active,
  h_autobus_number             = EXCLUDED.h_autobus_number,
  h_autobus_driver_name        = EXCLUDED.h_autobus_driver_name,
  h_autobus_driver_phone       = EXCLUDED.h_autobus_driver_phone,
  h_autobus_extra_driver_name  = EXCLUDED.h_autobus_extra_driver_name,
  h_autobus_extra_driver_phone = EXCLUDED.h_autobus_extra_driver_phone,
  h_autobus_apart_position     = EXCLUDED.h_autobus_apart_position,
  updated_at = now();

-- Two separate statements (not sibling CTEs) so the "steal" happens
-- strictly before the "assign", avoiding uq_bus_leader_per_exchange
-- violations when a leader is already set on another (e.g. synthetic)
-- bus in the same exchange.
WITH candidates AS (
  SELECT b.id AS bus_id, b.shift_exchange_id, u.id AS trip_leader_id,
    row_number() OVER (PARTITION BY b.shift_exchange_id, u.id
                        ORDER BY a.updated_at DESC NULLS LAST, a.id DESC) AS rn
  FROM target.h_autobus a
  JOIN bgs_attendance.buses b ON b.h_autobus_id = a.id
  JOIN public.users u ON u.bteg_id = a.user_id::text
  WHERE a._sdc_deleted_at IS NULL
)
UPDATE bgs_attendance.buses b SET trip_leader_id = NULL
FROM candidates c
WHERE c.rn = 1
  AND b.shift_exchange_id = c.shift_exchange_id
  AND b.trip_leader_id = c.trip_leader_id
  AND b.id <> c.bus_id;

WITH candidates AS (
  SELECT b.id AS bus_id, u.id AS trip_leader_id,
    row_number() OVER (PARTITION BY b.shift_exchange_id, u.id
                        ORDER BY a.updated_at DESC NULLS LAST, a.id DESC) AS rn
  FROM target.h_autobus a
  JOIN bgs_attendance.buses b ON b.h_autobus_id = a.id
  JOIN public.users u ON u.bteg_id = a.user_id::text
  WHERE a._sdc_deleted_at IS NULL
)
UPDATE bgs_attendance.buses b SET trip_leader_id = c.trip_leader_id
FROM candidates c WHERE b.id = c.bus_id AND c.rn = 1;

INSERT INTO bgs_attendance.bus_routes (bus_id, direction_id, stop_order)
SELECT DISTINCT b.id, d.id, 1
FROM target.h_autobus a
JOIN bgs_attendance.buses b ON b.h_autobus_id = a.id
JOIN public.autobus_direction d ON d.h_autobus_direction_id = a.direction_id::text
WHERE a._sdc_deleted_at IS NULL
ON CONFLICT (bus_id, direction_id) DO NOTHING;
