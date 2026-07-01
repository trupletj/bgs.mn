-- 1.1 — bgs_attendance schema + shift-exchange core tables
CREATE SCHEMA IF NOT EXISTS bgs_attendance;
GRANT USAGE ON SCHEMA bgs_attendance TO authenticated, anon;

CREATE TABLE bgs_attendance.shift_exchanges (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  exchange_date  date NOT NULL,
  direction      text NOT NULL CHECK (direction IN ('arriving','departing')),
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','published','completed','cancelled')),
  notes          text,
  created_by     uuid REFERENCES public.users(id),
  published_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz
);
CREATE INDEX idx_shift_exchanges_date ON bgs_attendance.shift_exchanges(exchange_date);

CREATE TABLE bgs_attendance.buses (
  id                 bigserial PRIMARY KEY,
  shift_exchange_id  bigint NOT NULL
    REFERENCES bgs_attendance.shift_exchanges(id) ON DELETE CASCADE,
  direction          text NOT NULL CHECK (direction IN ('arriving','departing')),
  name               text NOT NULL,
  description        text,
  capacity           int NOT NULL DEFAULT 45,
  departure_time     timestamptz,
  trip_leader_id     uuid REFERENCES public.users(id),
  is_active          boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz
);
CREATE INDEX idx_buses_shift_exchange ON bgs_attendance.buses(shift_exchange_id);
CREATE INDEX idx_buses_trip_leader    ON bgs_attendance.buses(trip_leader_id);

CREATE TABLE bgs_attendance.bus_routes (
  id            bigserial PRIMARY KEY,
  bus_id        bigint NOT NULL REFERENCES bgs_attendance.buses(id) ON DELETE CASCADE,
  direction_id  uuid NOT NULL REFERENCES public.autobus_direction(id),
  stop_order    int NOT NULL DEFAULT 1,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (bus_id, direction_id)
);
CREATE INDEX idx_bus_routes_bus       ON bgs_attendance.bus_routes(bus_id);
CREATE INDEX idx_bus_routes_direction ON bgs_attendance.bus_routes(direction_id);

CREATE TABLE bgs_attendance.external_companies (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE bgs_attendance.external_operators (
  id          bigserial PRIMARY KEY,
  company_id  bigint NOT NULL
    REFERENCES bgs_attendance.external_companies(id) ON DELETE CASCADE,
  profile_id  bigint REFERENCES public.profile(id) ON DELETE SET NULL,
  name        text NOT NULL,
  phone       text,
  email       text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_external_operators_company ON bgs_attendance.external_operators(company_id);
CREATE INDEX idx_external_operators_profile ON bgs_attendance.external_operators(profile_id);

CREATE TABLE bgs_attendance.external_passengers (
  id              bigserial PRIMARY KEY,
  company_id      bigint NOT NULL
    REFERENCES bgs_attendance.external_companies(id),
  submitted_by    bigint
    REFERENCES bgs_attendance.external_operators(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  phone           text,
  id_card_number  text,
  home_address    text,
  notes           text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz
);
CREATE INDEX idx_external_passengers_company ON bgs_attendance.external_passengers(company_id);

CREATE TABLE bgs_attendance.passenger_assignments (
  id                     bigserial PRIMARY KEY,
  shift_exchange_id      bigint NOT NULL
    REFERENCES bgs_attendance.shift_exchanges(id) ON DELETE CASCADE,
  bus_id                 bigint NOT NULL
    REFERENCES bgs_attendance.buses(id) ON DELETE CASCADE,
  internal_user_id       uuid REFERENCES public.users(id) ON DELETE CASCADE,
  external_passenger_id  bigint
    REFERENCES bgs_attendance.external_passengers(id) ON DELETE CASCADE,
  is_confirmed           boolean DEFAULT false,
  confirmed_at           timestamptz,
  confirmed_by           uuid REFERENCES public.users(id),
  notes                  text,
  created_at             timestamptz DEFAULT now(),
  CONSTRAINT uq_internal_per_exchange
    UNIQUE (shift_exchange_id, internal_user_id),
  CONSTRAINT uq_external_per_exchange
    UNIQUE (shift_exchange_id, external_passenger_id),
  CONSTRAINT chk_one_passenger CHECK (
    (internal_user_id IS NOT NULL AND external_passenger_id IS NULL) OR
    (internal_user_id IS NULL     AND external_passenger_id IS NOT NULL)
  )
);
CREATE INDEX idx_pa_shift     ON bgs_attendance.passenger_assignments(shift_exchange_id);
CREATE INDEX idx_pa_bus       ON bgs_attendance.passenger_assignments(bus_id);
CREATE INDEX idx_pa_internal  ON bgs_attendance.passenger_assignments(internal_user_id);
CREATE INDEX idx_pa_external  ON bgs_attendance.passenger_assignments(external_passenger_id);
CREATE INDEX idx_pa_confirmed ON bgs_attendance.passenger_assignments(is_confirmed);

CREATE TABLE bgs_attendance.attendance_logs (
  id                       bigserial PRIMARY KEY,
  passenger_assignment_id  bigint NOT NULL
    REFERENCES bgs_attendance.passenger_assignments(id),
  scanned_by               uuid NOT NULL REFERENCES public.users(id),
  scanned_at               timestamptz NOT NULL DEFAULT now(),
  device_info              text,
  notes                    text
);
CREATE INDEX idx_attendance_logs_assignment ON bgs_attendance.attendance_logs(passenger_assignment_id);

CREATE OR REPLACE FUNCTION bgs_attendance.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER shift_exchanges_updated_at
  BEFORE UPDATE ON bgs_attendance.shift_exchanges
  FOR EACH ROW EXECUTE FUNCTION bgs_attendance.set_updated_at();
CREATE TRIGGER buses_updated_at
  BEFORE UPDATE ON bgs_attendance.buses
  FOR EACH ROW EXECUTE FUNCTION bgs_attendance.set_updated_at();
CREATE TRIGGER external_passengers_updated_at
  BEFORE UPDATE ON bgs_attendance.external_passengers
  FOR EACH ROW EXECUTE FUNCTION bgs_attendance.set_updated_at();
