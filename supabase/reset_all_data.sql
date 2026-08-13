-- ==============================================================================
-- SMILETIME PRO: COMPLETE SYSTEM & ACCOUNT WIPE SCRIPT
-- WARNING: This will permanently delete ALL users, company accounts, employees,
-- biometric face templates, attendance logs, and departments.
-- 
-- Run this in your Supabase SQL Editor (supabase.com/dashboard -> SQL Editor)
-- to restore the system to a brand-new pristine state.
-- ==============================================================================

-- 1. Wipe all operational attendance telemetry & biometric face vectors
TRUNCATE TABLE public.attendance_events CASCADE;
TRUNCATE TABLE public.face_embeddings CASCADE;

-- 2. Wipe workforce directory and departments
TRUNCATE TABLE public.employees CASCADE;
TRUNCATE TABLE public.departments CASCADE;

-- 3. Wipe multi-tenant company organizations & memberships
TRUNCATE TABLE public.organization_members CASCADE;
TRUNCATE TABLE public.organizations CASCADE;

-- 4. Wipe user roles and public profiles
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- 5. Delete all registered email logins and authentication records from Supabase Auth
DELETE FROM auth.users;

-- Completed: Database is now 100% fresh and clean as brand new!
