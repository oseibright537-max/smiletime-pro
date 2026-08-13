-- Migration: Enforce Enterprise Time-Window Rules & Automated Status Categorization
-- Morning Window: 00:00 - 8:30 AM (On Time)
-- Late Window: 8:31 AM+ (Late)
-- Evening Window: 4:40 PM (16:40) - 8:00 PM (20:00) (Normal / Validated Departure)
-- Night Lockdown: 8:01 PM - 11:59 PM (Disabled)

CREATE OR REPLACE FUNCTION public.log_attendance(
  _employee_id uuid,
  _confidence real DEFAULT NULL,
  _liveness real DEFAULT NULL,
  _device_label text DEFAULT NULL,
  _tz text DEFAULT 'UTC'
)
RETURNS TABLE(kind public.attendance_kind, status public.attendance_status, occurred_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local timestamp;
  v_date date;
  v_time time;
  v_kind public.attendance_kind;
  v_status public.attendance_status;
  v_has_in boolean;
  v_has_out boolean;
  v_recent boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT (public.is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = _employee_id AND e.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = _employee_id AND e.status = 'active') THEN
    RAISE EXCEPTION 'employee is not active';
  END IF;

  v_local := (now() AT TIME ZONE COALESCE(NULLIF(_tz,''), 'UTC'));
  v_date := v_local::date;
  v_time := v_local::time;

  -- 1. Night Lockdown Check (20:01 - 23:59:59)
  IF v_time > time '20:00' THEN
    RAISE EXCEPTION 'Night Lockdown: Attendance logging is closed after 8:00 PM.';
  END IF;

  -- 2. Anti-spam throttle (60s)
  SELECT EXISTS (SELECT 1 FROM public.attendance_events a
                 WHERE a.employee_id = _employee_id AND a.occurred_at > now() - interval '60 seconds')
    INTO v_recent;
  IF v_recent THEN
    RAISE EXCEPTION 'Too soon — please wait a minute before scanning again.';
  END IF;

  -- 3. Check existing today records
  SELECT EXISTS (SELECT 1 FROM public.attendance_events a
                 WHERE a.employee_id = _employee_id AND a.local_date = v_date AND a.kind = 'check_in'),
         EXISTS (SELECT 1 FROM public.attendance_events a
                 WHERE a.employee_id = _employee_id AND a.local_date = v_date AND a.kind = 'check_out')
    INTO v_has_in, v_has_out;

  IF v_has_in AND v_has_out THEN
    RAISE EXCEPTION 'Attendance for today is already complete.';
  ELSIF NOT v_has_in THEN
    v_kind := 'check_in';
    -- Morning cutoff: 8:30 AM
    v_status := CASE WHEN v_time > time '08:30' THEN 'late'::public.attendance_status
                     ELSE 'on_time'::public.attendance_status END;
  ELSE
    -- Clock-out window check: opens at 4:40 PM (16:40)
    IF v_time < time '16:40' THEN
      RAISE EXCEPTION 'Standard check-out opens at 4:40 PM. Working hours clock-outs are locked.';
    END IF;

    v_kind := 'check_out';
    -- Evening clock-out between 4:40 PM and 8:00 PM is normal/validated
    v_status := 'normal'::public.attendance_status;
  END IF;

  RETURN QUERY
  INSERT INTO public.attendance_events (employee_id, kind, status, confidence, liveness_score, device_label, local_date)
  VALUES (_employee_id, v_kind, v_status, _confidence, _liveness, _device_label, v_date)
  RETURNING attendance_events.kind, attendance_events.status, attendance_events.occurred_at;
END;
$$;
