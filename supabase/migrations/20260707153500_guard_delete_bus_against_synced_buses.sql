-- Buses synced from target.h_autobus are owned by the external system:
-- hard-deleting one would just get silently re-inserted (as a fresh row)
-- on the next target.h_autobus UPDATE, losing any manual edits. Block
-- deletion of synced buses; they can only go inactive via the sync
-- trigger itself (is_active=false on delete/soft-delete upstream).
CREATE OR REPLACE FUNCTION bgs_attendance.delete_bus(p_bus_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bgs_attendance', 'public'
AS $function$
declare
  v_moved int;
  v_h_autobus_id bigint;
begin
  if not public.has_permission(auth.uid(), 'shift_exchange', 'admin') then
    raise exception 'Permission denied';
  end if;

  select h_autobus_id into v_h_autobus_id from bgs_attendance.buses where id = p_bus_id;
  if v_h_autobus_id is not null then
    raise exception 'Энэ автобус гадаад системээс синкжсэн тул устгах боломжгүй (h_autobus_id=%). Идэвхгүй болгохыг систем автоматаар зохицуулна.', v_h_autobus_id;
  end if;

  with upd as (
    update bgs_attendance.passenger_assignments
    set bus_id = null
    where bus_id = p_bus_id
    returning 1
  )
  select count(*)::int into v_moved from upd;

  update bgs_attendance.passenger_assignments
  set original_bus_id = null
  where original_bus_id = p_bus_id;

  delete from bgs_attendance.buses where id = p_bus_id;

  return v_moved;
end;
$function$;
