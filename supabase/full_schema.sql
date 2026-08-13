-- ==============================================================================
-- SMILETIME PRO: COMPLETE MULTI-TENANT SAAS SUPABASE SCHEMA
-- Supports multi-company isolation, independent rosters, hardware kiosks, and pgvector.
-- Copy and paste this script into your Supabase SQL Editor and click "Run".
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'manager', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.employee_status AS ENUM ('active', 'suspended', 'terminated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.attendance_kind AS ENUM ('check_in', 'check_out', 'break_start', 'break_end');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.attendance_status_type AS ENUM ('on_time', 'late', 'normal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "own profile upsert" ON public.profiles;
CREATE POLICY "own profile upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- 4. ORGANIZATIONS / TENANTS TABLE (Each company gets its own isolated tenant)
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

-- 5. ORGANIZATION MEMBERSHIP (Role-based access per company)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security helper functions
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_staff(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND role IN ('admin', 'hr')
  );
$$;

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

DROP POLICY IF EXISTS "members viewable by org members" ON public.organization_members;
CREATE POLICY "members viewable by org members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "members manageable by org staff" ON public.organization_members;
CREATE POLICY "members manageable by org staff" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.user_is_org_staff(organization_id))
  WITH CHECK (public.user_is_org_staff(organization_id));

-- Legacy user_roles table for backwards compatibility
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 6. DEPARTMENTS (Scoped per Organization)
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments readable" ON public.departments;
CREATE POLICY "departments readable" ON public.departments
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "departments managed by staff" ON public.departments;
CREATE POLICY "departments managed by staff" ON public.departments
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.user_is_org_staff(organization_id))
  WITH CHECK (organization_id IS NULL OR public.user_is_org_staff(organization_id));

-- 7. EMPLOYEES DIRECTORY (Scoped per Organization)
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  status public.employee_status NOT NULL DEFAULT 'active',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_code)
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees readable" ON public.employees;
CREATE POLICY "employees readable" ON public.employees
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "employees managed by staff" ON public.employees;
CREATE POLICY "employees managed by staff" ON public.employees
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.user_is_org_staff(organization_id))
  WITH CHECK (organization_id IS NULL OR public.user_is_org_staff(organization_id));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END; 
$$;

DROP TRIGGER IF EXISTS employees_touch ON public.employees;
CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. BIOMETRIC FACE EMBEDDINGS (Scoped per Organization & Employee)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  embedding vector(128) NOT NULL,
  pose text DEFAULT 'front',
  quality numeric(4,3) DEFAULT 1.0,
  model text DEFAULT 'face-api/facenet-128',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "face embeddings readable" ON public.face_embeddings;
CREATE POLICY "face embeddings readable" ON public.face_embeddings
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "face embeddings managed by staff" ON public.face_embeddings;
CREATE POLICY "face embeddings managed by staff" ON public.face_embeddings
  FOR ALL TO authenticated
  USING (organization_id IS NULL OR public.user_is_org_staff(organization_id))
  WITH CHECK (organization_id IS NULL OR public.user_is_org_staff(organization_id));

-- 9. MULTI-TENANT ISOLATED BIOMETRIC MATCH RPC
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
  WHERE (e.status IS NULL OR e.status = 'active')
    AND (_org_id IS NULL OR fe.organization_id = _org_id OR fe.organization_id IS NULL)
    AND (_org_id IS NULL OR e.organization_id = _org_id OR e.organization_id IS NULL)
    AND (fe.embedding <=> probe) <= max_distance
  ORDER BY fe.embedding <=> probe ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.match_face(
  probe text,
  _org_id uuid DEFAULT NULL,
  max_distance numeric DEFAULT 0.52
)
RETURNS TABLE (
  employee_id uuid,
  employee_code text,
  full_name text,
  distance numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.match_face(probe::vector(128), _org_id, max_distance);
$$;

-- 10. ATTENDANCE EVENTS (Scoped per Organization)
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'check_in',
  status text NOT NULL DEFAULT 'normal',
  local_date date NOT NULL DEFAULT CURRENT_DATE,
  confidence numeric(4,3),
  liveness_score numeric(4,3),
  device_label text DEFAULT 'Attendance Terminal',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance readable" ON public.attendance_events;
CREATE POLICY "attendance readable" ON public.attendance_events
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "attendance insertable" ON public.attendance_events;
CREATE POLICY "attendance insertable" ON public.attendance_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable Realtime safely
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_events;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- 11. AUTOMATIC COMPANY REGISTRATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id uuid;
  company_label text;
BEGIN
  -- Profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Determine Company Name from signup form metadata
  company_label := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || ' Organization'
  );

  -- Provision new tenant organization
  INSERT INTO public.organizations (name, created_by)
  VALUES (company_label, NEW.id)
  RETURNING id INTO new_org_id;

  -- Assign user as Admin of the new company
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Seed starter departments for the company
  INSERT INTO public.departments (organization_id, name) VALUES 
    (new_org_id, 'Engineering'),
    (new_org_id, 'Human Resources'),
    (new_org_id, 'Marketing & Sales'),
    (new_org_id, 'Operations')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
