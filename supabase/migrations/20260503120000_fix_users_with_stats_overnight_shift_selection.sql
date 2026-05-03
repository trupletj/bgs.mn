CREATE OR REPLACE FUNCTION public.get_users_with_stats()
RETURNS TABLE (
    user_id uuid,
    first_name text,
    last_name text,
    phone text,
    idcard_number text,
    bteg_id text,
    heltes_name text,
    position_name text,
    breakfast_location bigint,
    lunch_location bigint,
    dinner_location bigint,
    night_meal_location bigint,
    morning_meal_location bigint,
    extend_morning_meal_location bigint,
    extend_lunch_location bigint,
    start_at timestamp without time zone,
    end_at timestamp without time zone,
    is_working boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, target
AS $$
BEGIN
    RETURN QUERY
    WITH local_clock AS (
        SELECT
            (now() AT TIME ZONE 'Asia/Ulaanbaatar')::timestamp AS local_now,
            (now() AT TIME ZONE 'Asia/Ulaanbaatar')::date AS today,
            (now() AT TIME ZONE 'Asia/Ulaanbaatar')::time AS local_time
    ),
    candidate_shifts AS (
        SELECT
            w.*,
            CASE
                WHEN
                    w.start_at::date < w.end_at::date
                    AND w.end_at::date = lc.today
                    AND lc.local_time < TIME '15:00'
                THEN 0
                WHEN w.day_date::date = lc.today THEN 1
                ELSE 2
            END AS shift_priority
        FROM target.vw_worker_day_log_14d w
        CROSS JOIN local_clock lc
        WHERE
            w.worker_id IS NOT NULL
            AND (
                w.day_date::date = lc.today
                OR (
                    w.start_at::date < w.end_at::date
                    AND w.end_at::date = lc.today
                    AND lc.local_time < TIME '15:00'
                )
            )
    ),
    ranked_shifts AS (
        SELECT
            cs.*,
            row_number() OVER (
                PARTITION BY cs.worker_id::text
                ORDER BY cs.shift_priority ASC, cs.start_at DESC, cs.end_at DESC
            ) AS rn
        FROM candidate_shifts cs
        WHERE cs.shift_priority < 2
    )
    SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.phone,
        u.idcard_number,
        u.bteg_id,
        u.heltes_name,
        u.position_name,
        umc.breakfast_location,
        umc.lunch_location,
        umc.dinner_location,
        umc.night_meal_location,
        umc.morning_meal_location,
        umc.extend_morning_meal_location,
        umc.extend_lunch_location,
        w.start_at,
        w.end_at,
        (lc.local_now BETWEEN w.start_at AND w.end_at) AS is_working
    FROM public.users u
    CROSS JOIN local_clock lc
    LEFT JOIN public.user_meal_configs umc ON u.id = umc.user_id
    INNER JOIN ranked_shifts w ON (
        w.worker_id::text = u.bteg_id
        AND w.rn = 1
    )
    WHERE u.is_active = true;
END;
$$;

CREATE OR REPLACE VIEW public.users_with_stats AS
SELECT * FROM public.get_users_with_stats();
