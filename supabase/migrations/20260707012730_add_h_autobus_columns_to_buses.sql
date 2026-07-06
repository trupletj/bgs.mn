ALTER TABLE bgs_attendance.buses
  ADD COLUMN h_autobus_id bigint,
  ADD COLUMN h_autobus_number text,
  ADD COLUMN h_autobus_driver_name text,
  ADD COLUMN h_autobus_driver_phone text,
  ADD COLUMN h_autobus_extra_driver_name text,
  ADD COLUMN h_autobus_extra_driver_phone text,
  ADD COLUMN h_autobus_apart_position text;

CREATE UNIQUE INDEX uq_buses_h_autobus_id
  ON bgs_attendance.buses (h_autobus_id) WHERE h_autobus_id IS NOT NULL;
