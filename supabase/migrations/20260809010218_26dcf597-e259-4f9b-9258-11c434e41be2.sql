DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('on_time','late','early_leave','normal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.attendance_events
  ADD COLUMN IF NOT EXISTS status public.attendance_status NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS local_date date;

CREATE INDEX IF NOT EXISTS attendance_events_emp_time_idx
  ON public.attendance_events (employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS attendance_events_emp_date_idx
  ON public.attendance_events (employee_id, local_date);

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

  SELECT EXISTS (SELECT 1 FROM public.attendance_events a
                 WHERE a.employee_id = _employee_id AND a.occurred_at > now() - interval '60 seconds')
    INTO v_recent;
  IF v_recent THEN
    RAISE EXCEPTION 'Too soon — please wait a minute before scanning again.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.attendance_events a
                 WHERE a.employee_id = _employee_id AND a.local_date = v_date AND a.kind = 'check_in'),
         EXISTS (SELECT 1 FROM public.attendance_events a
                 WHERE a.employee_id = _employee_id AND a.local_date = v_date AND a.kind = 'check_out')
    INTO v_has_in, v_has_out;

  IF v_has_in AND v_has_out THEN
    RAISE EXCEPTION 'Attendance for today is already complete.';
  ELSIF NOT v_has_in THEN
    v_kind := 'check_in';
    v_status := CASE WHEN v_time > time '09:30' THEN 'late'::public.attendance_status
                     ELSE 'on_time'::public.attendance_status END;
  ELSE
    IF v_time < time '16:55' THEN
      RAISE EXCEPTION 'Check-out opens at 4:55 PM.';
    END IF;
    v_kind := 'check_out';
    v_status := CASE WHEN v_time < time '17:00' THEN 'early_leave'::public.attendance_status
                     ELSE 'normal'::public.attendance_status END;
  END IF;

  RETURN QUERY
  INSERT INTO public.attendance_events (employee_id, kind, status, confidence, liveness_score, device_label, local_date)
  VALUES (_employee_id, v_kind, v_status, _confidence, _liveness, _device_label, v_date)
  RETURNING attendance_events.kind, attendance_events.status, attendance_events.occurred_at;
END;
$$;

REVOKE ALL ON FUNCTION public.log_attendance(uuid, real, real, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_attendance(uuid, real, real, text, text) TO authenticated;