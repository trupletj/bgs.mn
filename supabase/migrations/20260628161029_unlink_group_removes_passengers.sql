-- Unlinking an eelj group from an exchange should also remove that group's
-- workers from the exchange (pool + bus), EXCEPT QR-confirmed ones (they have
-- attendance_logs / are already boarded). Returns counts for the toast.
CREATE OR REPLACE FUNCTION bgs_attendance.unlink_group(
  p_exchange_id   bigint,
  p_group_bteg_id text
)
RETURNS TABLE (removed int, kept_confirmed int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = bgs_attendance, public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(),'shift_exchange','admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT count(*) INTO kept_confirmed
  FROM bgs_attendance.passenger_assignments pa
  JOIN public.users u ON u.id = pa.internal_user_id
  WHERE pa.shift_exchange_id = p_exchange_id
    AND u.sf_guard_group_id = p_group_bteg_id
    AND pa.is_confirmed;

  WITH grp AS (
    SELECT id FROM public.users WHERE sf_guard_group_id = p_group_bteg_id
  ),
  del AS (
    DELETE FROM bgs_attendance.passenger_assignments pa
    USING grp
    WHERE pa.shift_exchange_id = p_exchange_id
      AND pa.internal_user_id = grp.id
      AND NOT pa.is_confirmed
    RETURNING 1
  )
  SELECT count(*)::int INTO removed FROM del;

  DELETE FROM bgs_attendance.shift_exchange_groups
  WHERE shift_exchange_id = p_exchange_id AND group_bteg_id = p_group_bteg_id;

  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION bgs_attendance.unlink_group(bigint, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION bgs_attendance.unlink_group(bigint, text) TO authenticated;
