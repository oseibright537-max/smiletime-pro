-- ==============================================================================
-- MIGRATION: MULTI-TENANT SAAS ARCHITECTURE (COMPANY ISOLATION)
-- Allows multiple companies/tenants to independently sign up, enroll staff,
-- run isolated hardware kiosks, and maintain strict data segregation.
-- ==============================================================================

-- 1. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{
    "morning_cutoff": "08:30",
    "evening_window_start": "16:40",
    "evening_window_end": "20:00",
    "match_threshold": 0.52
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. ORGANIZATION MEMBERS (User Roles per Company)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security helper: check if user belongs to an organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
  );
$$;

-- Security helper: check if user is staff/admin in organization
CREATE OR REPLACE FUNCTION public.user_is_org_staff(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND role IN ('admin', 'hr')
  );
$$;

-- RLS for Organizations
DROP POLICY IF EXISTS "organizations viewable by members" ON public.organizations;
CREATE POLICY "organizations viewable by members" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "organizations editable by staff" ON public.organizations;
CREATE POLICY "organizations editable by staff" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.user_is_org_staff(id) OR created_by = auth.uid())
  WITH CHECK (public.user_is_org_staff(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "organizations insertable by authenticated" ON public.organizations;
CREATE POLICY "organizations insertable by authenticated" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS for Organization Members
DROP POLICY IF EXISTS "members viewable by org members" ON public.organization_members;
CREATE POLICY "members viewable by org members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "members manageable by org staff" ON public.organization_members;
CREATE POLICY "members manageable by org staff" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.user_is_org_staff(organization_id))
  WITH CHECK (public.user_is_org_staff(organization_id));

-- 3. ADD ORGANIZATION_ID TO ALL APPLICATION ENTITIES
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.face_embeddings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_events ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update unique constraints to be scoped per organization
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE public.departments ADD CONSTRAINT departments_org_name_unique UNIQUE (organization_id, name);

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
ALTER TABLE public.employees ADD CONSTRAINT employees_org_code_unique UNIQUE (organization_id, employee_code);

-- 4. TENANT-SCOPED RLS POLICIES
-- Departments
DROP POLICY IF EXISTS "departments readable" ON public.departments;
CREATE POLICY "departments readable" ON public.departments
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "departments managed by staff" ON public.departments;
CREATE POLICY "departments managed by staff" ON public.departments
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.user_is_org_staff(organization_id))
  WITH CHECK (organization_id IS NULL OR public.user_is_org_staff(organization_id));

-- Employees
DROP POLICY IF EXISTS "employees readable" ON public.employees;
CREATE POLICY "employees readable" ON public.employees
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "employees managed by staff" ON public.employees;
CREATE POLICY "employees managed by staff" ON public.employees
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.user_is_org_staff(organization_id))
  WITH CHECK (organization_id IS NULL OR public.user_is_org_staff(organization_id));

-- Face Embeddings
DROP POLICY IF EXISTS "face embeddings readable" ON public.face_embeddings;
CREATE POLICY "face embeddings readable" ON public.face_embeddings
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "face embeddings managed by staff" ON public.face_embeddings;
CREATE POLICY "face embeddings managed by staff" ON public.face_embeddings
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.user_is_org_staff(organization_id))
  WITH CHECK (organization_id IS NULL OR public.user_is_org_staff(organization_id));

-- Attendance Events
DROP POLICY IF EXISTS "attendance readable" ON public.attendance_events;
CREATE POLICY "attendance readable" ON public.attendance_events
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "attendance insertable" ON public.attendance_events;
CREATE POLICY "attendance insertable" ON public.attendance_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. MULTI-TENANT ISOLATED BIOMETRIC MATCH RPC
CREATE OR REPLACE FUNCTION public.match_face(
  probe vector(128),
  _org_id uuid DEFAULT NULL,
  max_distance numeric DEFAULT 0.52
)
RETURNS TABLE (
  employee_id uuid,
  employee_code text,
  full_name text,
  distance numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    e.id AS employee_id,
    e.employee_code,
    e.full_name,
    (fe.embedding <=> probe)::numeric AS distance
  FROM public.face_embeddings fe
  JOIN public.employees e ON e.id = fe.employee_id
  WHERE e.status = 'active'
    AND (_org_id IS NULL OR fe.organization_id = _org_id OR e.organization_id = _org_id)
    AND (fe.embedding <=> probe) <= max_distance
  ORDER BY fe.embedding <=> probe ASC
  LIMIT 1;
$$;

-- 6. AUTOMATED COMPANY PROVISIONING SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid;
  company_label text;
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- 2. Determine Company Name from signup form metadata
  company_label := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || ' Organization'
  );

  -- 3. Provision new tenant organization
  INSERT INTO public.organizations (name, created_by)
  VALUES (company_label, NEW.id)
  RETURNING id INTO new_org_id;

  -- 4. Assign user as Admin/Owner of the new company
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');

  -- Legacy user_roles fallback
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 5. Seed starter departments for the new company
  INSERT INTO public.departments (organization_id, name) VALUES 
    (new_org_id, 'Engineering'),
    (new_org_id, 'Human Resources'),
    (new_org_id, 'Marketing & Sales'),
    (new_org_id, 'Operations')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. BACKFILL EXISTING LEGACY RECORDS (IF ANY)
DO $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
  
  IF default_org_id IS NOT NULL THEN
    UPDATE public.departments SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.employees SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.face_embeddings SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.attendance_events SET organization_id = default_org_id WHERE organization_id IS NULL;
  END IF;
END $$;
