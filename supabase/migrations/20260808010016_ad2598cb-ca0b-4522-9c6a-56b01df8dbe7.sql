-- Attendance
DROP POLICY IF EXISTS "attendance readable" ON public.attendance_events;
DROP POLICY IF EXISTS "attendance insertable" ON public.attendance_events;

CREATE POLICY "attendance readable by staff or owner"
ON public.attendance_events FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance_events.employee_id AND e.user_id = auth.uid())
);

CREATE POLICY "attendance insertable by staff or owner"
ON public.attendance_events FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance_events.employee_id AND e.user_id = auth.uid())
);

-- Employees
DROP POLICY IF EXISTS "employees readable" ON public.employees;
CREATE POLICY "employees readable by staff or self"
ON public.employees FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

-- Profiles
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by owner or staff"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_staff(auth.uid()));

-- Harden SECURITY DEFINER face matching
CREATE OR REPLACE FUNCTION public.match_face(probe vector, max_distance real DEFAULT 0.4)
RETURNS TABLE(employee_id uuid, employee_code text, full_name text, distance real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT e.id, e.employee_code, e.full_name, (f.embedding <=> probe)::real AS distance
  FROM public.face_embeddings f
  JOIN public.employees e ON e.id = f.employee_id
  WHERE e.status = 'active' AND (f.embedding <=> probe) <= max_distance
  ORDER BY f.embedding <=> probe
  LIMIT 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_face(vector, real) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_face(vector, real) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;