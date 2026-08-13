-- ==============================================================================
-- SMILETIME PRO: COMPLETE SUPABASE DATABASE SETUP SCHEMA
-- Copy and paste this entire script into your Supabase project's SQL Editor and click "Run".
-- ==============================================================================

-- 1. ENABLE REQUIRED EXTENSIONS
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

-- 3. USER PROFILES & ROLES
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

-- Security Definer Role Checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'hr'));
$$;

-- First registered user automatically becomes Admin, subsequent users become Employee
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. DEPARTMENTS
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "departments readable" ON public.departments;
CREATE POLICY "departments readable" ON public.departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "departments managed by staff" ON public.departments;
CREATE POLICY "departments managed by staff" ON public.departments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Insert Default Standard Departments
INSERT INTO public.departments (name) VALUES 
  ('Engineering'),
  ('Human Resources'),
  ('Marketing & Sales'),
  ('Operations'),
  ('Executive')
ON CONFLICT (name) DO NOTHING;

-- 5. EMPLOYEES DIRECTORY
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  status public.employee_status NOT NULL DEFAULT 'active',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees readable" ON public.employees;
CREATE POLICY "employees readable" ON public.employees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employees managed by staff" ON public.employees;
CREATE POLICY "employees managed by staff" ON public.employees FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

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

-- 6. BIOMETRIC FACE EMBEDDINGS (128-D Vector)
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  embedding vector(128) NOT NULL,
  pose text DEFAULT 'front',
  quality numeric(4,3) DEFAULT 1.0,
  model text DEFAULT 'face-api/facenet-128',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "face embeddings readable" ON public.face_embeddings;
CREATE POLICY "face embeddings readable" ON public.face_embeddings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "face embeddings managed by staff" ON public.face_embeddings;
CREATE POLICY "face embeddings managed by staff" ON public.face_embeddings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Fast Cosine Distance Match Function
CREATE OR REPLACE FUNCTION public.match_face(probe vector(128), max_distance numeric DEFAULT 0.52)
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
    AND (fe.embedding <=> probe) <= max_distance
  ORDER BY fe.embedding <=> probe ASC
  LIMIT 1;
$$;

-- 7. ATTENDANCE EVENTS & REAL-TIME LOGS
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE POLICY "attendance readable" ON public.attendance_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "attendance insertable" ON public.attendance_events;
CREATE POLICY "attendance insertable" ON public.attendance_events FOR INSERT TO authenticated WITH CHECK (true);

-- Enable Realtime for live kiosk feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_events;

-- 8. GRANT PRIVILEGES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- Setup Complete!
