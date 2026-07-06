-- One-time backfill: resolve passenger_assignments.bus_id from
-- h_user_autobus_address.autobus_id -> buses.h_autobus_id for existing
-- rows, now that Step 4 has landed real buses. Intended "external wins"
-- semantics: this can move already-HR-assigned passengers to a different
-- bus if the external system disagrees. Sets the sync GUC so
-- trg_track_bus_assignment_source flags these rows correctly.
SELECT set_config('bgs_attendance.sync_write', 'true', true);

WITH resolved AS (
  SELECT pa.id AS pa_id, b.id AS bus_id
  FROM bgs_attendance.passenger_assignments pa
  JOIN target.h_user_autobus_address h ON h.id = pa.h_user_autobus_address_id
  JOIN bgs_attendance.buses b ON b.h_autobus_id = h.autobus_id
  WHERE h._sdc_deleted_at IS NULL AND h.autobus_id IS NOT NULL
)
UPDATE bgs_attendance.passenger_assignments pa
SET bus_id = r.bus_id
FROM resolved r
WHERE pa.id = r.pa_id AND pa.bus_id IS DISTINCT FROM r.bus_id;
