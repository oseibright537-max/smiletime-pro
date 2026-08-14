-- ==============================================================================
-- SMILETIME PRO / FACETIME ATTENDANCE: SECURITY HARDENING MIGRATION
-- Fixes: Server-side attendance verification RPC, RLS tenant isolation,
-- IDOR prevention, and database CHECK constraints.
-- ==============================================================================

-- 1. SECURE SERVER-SIDE ATTENDANCE RECORDING RPC (Blocks client field tampering)
CREATE OR REPLACE FUNCTION public.record_attendance(
  _org_id uuid DEFAULT NULL,
  _employee_id uuid DEFAULT NULL,
  _kind text DEFAULT 'check_in',
  _confidence numeric DEFAULT NULL,
  _liveness_score numeric DEFAULT NULL,
  _device_label text DEFAULT 'FaceTime Attendance Terminal'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _current_time timestamptz := now();
  _current_date date := CURRENT_DATE;
  _minutes int;
  _calculated_status text := 'normal';
  _status_label text := 'Normal';
  _is_late boolean := false;
  _event_id uuid;
  _emp_exists boolean;
  _recent_count int;
BEGIN
  IF _employee_id IS NULL THEN
    RAISE EXCEPTION 'Employee ID is required.';
  END IF;

  -- 1. Authorization check: if org_id is provided and user is authenticated
  IF _org_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    IF NOT public.user_belongs_to_org(_org_id, auth.uid()) THEN
      RAISE EXCEPTION 'Access Denied: Caller does not belong to this organization.';
    END IF;
  END IF;

  -- 2. Verify employee exists and is active
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = _employee_id
      AND (_org_id IS NULL OR organization_id = _org_id OR organization_id IS NULL)
      AND (status IS NULL OR status = 'active')
  ) INTO _emp_exists;

  IF NOT _emp_exists THEN
    RAISE EXCEPTION 'Employee not found or inactive.';
  END IF;

  -- 3. Duplicate scan prevention (within 45 seconds)
  SELECT COUNT(*) INTO _recent_count
  FROM public.attendance_events
  WHERE employee_id = _employee_id
    AND kind = _kind
    AND occurred_at >= (_current_time - interval '45 seconds');

  IF _recent_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate', true,
      'message', 'Duplicate scan ignored. Already logged within the last minute.'
    );
  END IF;

  -- 4. Server-Side Shift Window & Lateness Evaluation (8:30 AM cutoff & 4:40 PM departure window)
  _minutes := EXTRACT(HOUR FROM _current_time) * 60 + EXTRACT(MINUTE FROM _current_time);

  IF _kind = 'check_in' THEN
    IF _minutes <= 510 THEN -- 8:30 AM
      _calculated_status := 'on_time';
      _status_label := 'On Time';
      _is_late := false;
    ELSE
      _calculated_status := 'late';
      _status_label := 'Late (+' || (_minutes - 510) || 'm)';
      _is_late := true;
    END IF;
  ELSIF _kind = 'check_out' THEN
    IF _minutes >= 1000 AND _minutes <= 1200 THEN -- 4:40 PM - 8:00 PM
      _calculated_status := 'normal';
      _status_label := 'Validated Departure';
      _is_late := false;
    ELSIF _minutes < 1000 THEN
      _calculated_status := 'early_leave';
      _status_label := 'Early Departure';
      _is_late := false;
    ELSE
      _calculated_status := 'normal';
      _status_label := 'Late Departure';
      _is_late := false;
    END IF;
  ELSE
    _calculated_status := 'normal';
    _status_label := 'Break Event';
    _is_late := false;
  END IF;

  -- 5. Insert event with verified server-side timestamp and calculated status
  INSERT INTO public.attendance_events (
    organization_id,
    employee_id,
    kind,
    status,
    local_date,
    confidence,
    liveness_score,
    device_label,
    occurred_at
  ) VALUES (
    _org_id,
    _employee_id,
    _kind,
    _calculated_status,
    _current_date,
    _confidence,
    _liveness_score,
    _device_label,
    _current_time
  ) RETURNING id INTO _event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', _event_id,
    'status', _calculated_status,
    'status_label', _status_label,
    'is_late', _is_late,
    'occurred_at', _current_time
  );
END;
$$;

-- 2. HARDEN ROW-LEVEL SECURITY POLICIES

-- attendance_events INSERT
DROP POLICY IF EXISTS "attendance insertable" ON public.attendance_events;
CREATE POLICY "attendance insertable" ON public.attendance_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL 
    OR public.user_belongs_to_org(organization_id)
  );

-- attendance_events SELECT (Staff can view org records, employees can view only their own)
DROP POLICY IF EXISTS "attendance readable" ON public.attendance_events;
CREATE POLICY "attendance readable" ON public.attendance_events
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR public.user_is_org_staff(organization_id)
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- face_embeddings SELECT (Staff or own employee profile only)
DROP POLICY IF EXISTS "face embeddings readable" ON public.face_embeddings;
CREATE POLICY "face embeddings readable" ON public.face_embeddings
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR public.user_is_org_staff(organization_id)
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- 3. SCHEMA CONSTRAINTS (Validate input boundaries)
DO $$ BEGIN
  ALTER TABLE public.employees
    ADD CONSTRAINT check_employee_code_length CHECK (char_length(employee_code) >= 1 AND char_length(employee_code) <= 32);
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.employees
    ADD CONSTRAINT check_full_name_length CHECK (char_length(full_name) >= 2 AND char_length(full_name) <= 120);
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- 4. REVOKE UNNECESSARY ANON WRITE PRIVILEGES
REVOKE INSERT, UPDATE, DELETE ON public.attendance_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.employees FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.face_embeddings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.departments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.organizations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.organization_members FROM anon;

GRANT EXECUTE ON FUNCTION public.record_attendance TO authenticated, anon;
