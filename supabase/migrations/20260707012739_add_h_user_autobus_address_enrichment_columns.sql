ALTER TABLE bgs_attendance.passenger_assignments
  ADD COLUMN h_user_autobus_address_id bigint,
  ADD COLUMN legacy_synced_at timestamptz,
  ADD COLUMN pickup_address text,
  ADD COLUMN pickup_street text,
  ADD COLUMN pickup_land_position_address text,
  ADD COLUMN pickup_apart_position text,
  ADD COLUMN pickup_apart_position_id bigint,
  ADD COLUMN pickup_user_apart_position_id bigint,
  ADD COLUMN pickup_district_id bigint,
  ADD COLUMN pickup_city_id bigint,
  ADD COLUMN seat_number bigint,
  ADD COLUMN approved_zam_tsag bigint,
  ADD COLUMN is_personal_machine boolean,
  ADD COLUMN machine_number text,
  ADD COLUMN not_done_issue text,
  ADD COLUMN legacy_is_done boolean;

CREATE INDEX idx_pa_h_user_autobus_address_id
  ON bgs_attendance.passenger_assignments (h_user_autobus_address_id)
  WHERE h_user_autobus_address_id IS NOT NULL;
