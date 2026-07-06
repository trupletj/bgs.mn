-- Read-only aid for HR to manually reconcile internally-created ("synthetic")
-- buses with newly-landed real buses covering the same exchange+direction.
-- No automatic merging is performed.
CREATE OR REPLACE VIEW bgs_attendance.synthetic_bus_overlap_report AS
SELECT
  syn.id AS synthetic_bus_id, syn.name AS synthetic_bus_name,
  syn.shift_exchange_id,
  (SELECT count(*) FROM bgs_attendance.passenger_assignments p WHERE p.bus_id = syn.id) AS synthetic_passenger_count,
  real_b.id AS real_bus_id, real_b.name AS real_bus_name, real_b.h_autobus_number,
  (SELECT count(*) FROM bgs_attendance.passenger_assignments p WHERE p.bus_id = real_b.id) AS real_passenger_count,
  br.direction_id
FROM bgs_attendance.buses syn
JOIN bgs_attendance.bus_routes br ON br.bus_id = syn.id
JOIN bgs_attendance.bus_routes br2 ON br2.direction_id = br.direction_id AND br2.bus_id <> syn.id
JOIN bgs_attendance.buses real_b ON real_b.id = br2.bus_id
  AND real_b.shift_exchange_id = syn.shift_exchange_id AND real_b.h_autobus_id IS NOT NULL
WHERE syn.h_autobus_id IS NULL AND syn.is_active AND real_b.is_active;
