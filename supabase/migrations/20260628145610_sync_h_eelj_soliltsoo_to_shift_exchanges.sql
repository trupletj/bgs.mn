-- Mirror the intranet shift-change events (target.h_eelj_soliltsoo) into
-- bgs_attendance.shift_exchanges so HR no longer creates exchanges manually —
-- they flow in from the system already in use. Buses/passengers keep linking to
-- shift_exchanges as before. Follows the eelj_groups / autobus_direction pattern.

ALTER TABLE bgs_attendance.shift_exchanges
  ADD COLUMN IF NOT EXISTS eelj_id bigint;
ALTER TABLE bgs_attendance.shift_exchanges
  ADD CONSTRAINT shift_exchanges_eelj_id_key UNIQUE (eelj_id);

CREATE OR REPLACE FUNCTION bgs_attendance.handle_h_eelj_soliltsoo_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bgs_attendance, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE bgs_attendance.shift_exchanges SET status='cancelled', updated_at=now()
    WHERE eelj_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW._sdc_deleted_at IS NOT NULL THEN
    UPDATE bgs_attendance.shift_exchanges SET status='cancelled', updated_at=now()
    WHERE eelj_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.day_date IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO bgs_attendance.shift_exchanges
    (eelj_id, name, exchange_date, direction, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, to_char(NEW.day_date, 'YYYY.MM.DD')),
    NEW.day_date::date,
    CASE WHEN NEW.is_come THEN 'arriving' ELSE 'departing' END,
    CASE WHEN COALESCE(NEW.is_active,0) = 1 THEN 'published' ELSE 'cancelled' END,
    now(), now()
  )
  ON CONFLICT (eelj_id) DO UPDATE SET
    name = EXCLUDED.name,
    exchange_date = EXCLUDED.exchange_date,
    direction = EXCLUDED.direction,
    status = CASE
               WHEN COALESCE(NEW.is_active,0) = 0 THEN 'cancelled'
               WHEN bgs_attendance.shift_exchanges.status = 'cancelled' THEN 'published'
               ELSE bgs_attendance.shift_exchanges.status
             END,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_h_eelj_soliltsoo_sync ON target.h_eelj_soliltsoo;
CREATE TRIGGER trg_h_eelj_soliltsoo_sync
AFTER INSERT OR UPDATE OR DELETE ON target.h_eelj_soliltsoo
FOR EACH ROW EXECUTE FUNCTION bgs_attendance.handle_h_eelj_soliltsoo_sync();

-- Backfill recent + upcoming events (last 30 days onward)
INSERT INTO bgs_attendance.shift_exchanges
  (eelj_id, name, exchange_date, direction, status, created_at, updated_at)
SELECT
  h.id,
  COALESCE(h.name, to_char(h.day_date, 'YYYY.MM.DD')),
  h.day_date::date,
  CASE WHEN h.is_come THEN 'arriving' ELSE 'departing' END,
  CASE WHEN COALESCE(h.is_active,0) = 1 THEN 'published' ELSE 'cancelled' END,
  now(), now()
FROM target.h_eelj_soliltsoo h
WHERE h._sdc_deleted_at IS NULL
  AND h.day_date IS NOT NULL
  AND h.day_date >= current_date - interval '30 days'
ON CONFLICT (eelj_id) DO NOTHING;
