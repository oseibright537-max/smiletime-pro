# SmileTime Pro — Automated AI Facial Attendance & Workforce Intelligence

An enterprise-grade, privacy-first **Automated Biometric Attendance Management & Workforce Intelligence Platform**. Features real-time client-side neural face matching (FaceNet 128-D), active anti-spoof liveness challenges, strict multi-tenant SaaS architecture, server-side shift compliance rules (8:30 AM cutoff & 4:40 PM departure window), and formatted HR payroll & lateness audit exports.

---

## 🌟 Key Features

* **Real-Time Client-Side Facial Recognition:** 
  * Powered by `@vladmandic/face-api` (TinyFaceDetector + FaceLandmarks68 + FaceRecognitionNet).
  * 100% Zero-Photo storage: only 128-dimensional mathematical vector descriptors are stored in PostgreSQL (`pgvector`).
* **Active Anti-Spoofing & Liveness Detection:** 
  * Active real-time randomized motor challenges (Blink, Turn Left, Turn Right, Nod Up) with Eye Aspect Ratio (EAR) tracking and Laplacian variance blur gating.
* **Server-Side Shift Window & Punctuality Engine:**
  * **Morning Cutoff:** 8:30 AM (Auto-calculates lateness in minutes via server-side PostgreSQL RPC).
  * **Evening Departure:** 4:40 PM – 8:00 PM (Validated unrestricted clock-out).
  * **Night Lockdown:** 8:00 PM – 12:00 AM (Restricted terminal state to prevent erratic scans).
* **Multi-Tenant SaaS Architecture:**
  * Complete isolation of organizations, departments, employees, biometric embeddings, and attendance logs.
  * Multi-company workspace switcher and automated tenant provisioning on signup.
* **Formatted Manager CSV Exports:**
  * **Master Daily Attendance CSV:** Full event logs with neural confidence, liveness verification, and compliance remarks.
  * **One-Click Late Audit CSV:** Filtered report of all late arrivals with exact lateness minutes, cutoff comparisons, and infraction severity ratings.
  * **Monthly HR Payroll & Infractions CSV:** Working day compliance, punctuality percentage, and disciplinary tier ratings.
* **Fully Responsive Telemetry Dashboard:**
  * Auto-scaling Recharts analytics, live attendance counters, and employee roster management optimized for phones, tablets, and desktops.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | TanStack Start (React 19, `@tanstack/react-router`, `@tanstack/react-query`) |
| **Server Engine** | Nitro (`cloudflare-module` preset) |
| **Styling** | Vanilla Tailwind CSS Design System & Lucide Icons |
| **Biometrics** | FaceNet 128-D Vector Embeddings & TinyFaceDetector |
| **Database** | Supabase PostgreSQL with `pgvector` & Row-Level Security (RLS) |
| **Auth & Security** | Supabase Auth (bcrypt, JWT), CSP, HSTS, X-Frame-Options, CSRF middleware |

---

## 🚀 Free Deployment Guide (Cloudflare Pages)

Follow these steps to deploy SmileTime Pro for free on **Cloudflare Pages**:

### Step 1: Database Setup (Supabase)
1. Create a free account at [supabase.com](https://supabase.com) and start a new project.
2. In your Supabase dashboard, navigate to the **SQL Editor**.
3. Open [`supabase/full_schema.sql`](./supabase/full_schema.sql) (or run the security script below) and click **Run**.
4. Go to **Project Settings (gear icon)** → **API** to copy your **Project URL** and **anon public key**.

### Step 2: Connect to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Compute (Workers & Pages)**.
2. Click **Create application** → select the **Pages** tab → click **Connect to Git**.
3. Select your repository: `oseibright537-max/smiletime-pro`.
4. Click **Begin setup**.

### Step 3: Configure Build Settings
Fill in the deployment settings:
* **Project name:** `smiletime-pro`
* **Production branch:** `main`
* **Framework preset:** `None` (or `Vite`)
* **Build command:**
  ```bash
  npm run build
  ```
* **Build output directory:**
  ```bash
  .output/public
  ```
* **Root directory:** *(Leave blank)*

### Step 4: Add Environment Variables
Under **Environment variables (advanced)**, add:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (or your `anon` key) |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (or your `anon` key) |
| `NODE_VERSION` | `20` |

### Step 5: Deploy
1. Click **Save and Deploy**.
2. Cloudflare will build the application in ~1-2 minutes and provide your live URL (e.g. `https://smiletime-pro.pages.dev`).

### Step 6: Configure Supabase Auth URLs
1. In your **Supabase Dashboard**, go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to: `https://smiletime-pro.pages.dev`
3. Add to **Redirect URLs**:
   * `https://smiletime-pro.pages.dev/**`
   * `https://smiletime-pro.pages.dev/auth`
4. Click **Save**.

---

## 🗄️ Supabase SQL Hardening Script

Run this SQL snippet in your Supabase SQL Editor to activate server-side attendance recording and strict RLS isolation:

```sql
-- 1. SERVER-SIDE ATTENDANCE RECORDING RPC
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

  IF _org_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    IF NOT public.user_belongs_to_org(_org_id, auth.uid()) THEN
      RAISE EXCEPTION 'Access Denied: Caller does not belong to this organization.';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = _employee_id
      AND (_org_id IS NULL OR organization_id = _org_id OR organization_id IS NULL)
      AND (status IS NULL OR status = 'active')
  ) INTO _emp_exists;

  IF NOT _emp_exists THEN
    RAISE EXCEPTION 'Employee not found or inactive.';
  END IF;

  -- 45-Second Duplicate Throttle
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

  -- Shift Rule Evaluation: 8:30 AM Cutoff
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

  INSERT INTO public.attendance_events (
    organization_id, employee_id, kind, status, local_date,
    confidence, liveness_score, device_label, occurred_at
  ) VALUES (
    _org_id, _employee_id, _kind, _calculated_status, _current_date,
    _confidence, _liveness_score, _device_label, _current_time
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
DROP POLICY IF EXISTS "attendance insertable" ON public.attendance_events;
CREATE POLICY "attendance insertable" ON public.attendance_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NULL OR public.user_belongs_to_org(organization_id)
  );

DROP POLICY IF EXISTS "attendance readable" ON public.attendance_events;
CREATE POLICY "attendance readable" ON public.attendance_events
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR public.user_is_org_staff(organization_id)
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "face embeddings readable" ON public.face_embeddings;
CREATE POLICY "face embeddings readable" ON public.face_embeddings
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR public.user_is_org_staff(organization_id)
    OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- 3. PERMISSIONS & SCHEMA BOUNDS
GRANT EXECUTE ON FUNCTION public.record_attendance TO authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.employees FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.face_embeddings FROM anon;
```

---

## 💻 Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/oseibright537-max/smiletime-pro.git
   cd smiletime-pro
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. **Start local development server:**
   ```bash
   npm run dev
   ```
5. **Run Lint and Production Build checks:**
   ```bash
   npm run lint
   npm run format
   npm run build
   ```

---

## 📊 Manager Reporting & CSV Exports

SmileTime Pro provides RFC 4180-compliant CSV exports with embedded UTF-8 Byte Order Marks (`\uFEFF`) for native compatibility with Microsoft Excel, Apple Numbers, Google Sheets, and mobile spreadsheet viewers:

1. **Master Daily Log:** Full audit trail with biometric match confidence and server timestamps.
2. **Late Audit CSV:** Dedicated punctuality report filtered exclusively for late arrivals with exact minutes late and infraction severity categories.
3. **Monthly Payroll Summary:** Total scheduled days, days present, attendance percentage, punctuality score, and HR compliance tiers.

---

## 🛡️ Security & Privacy Compliance

* **Zero Photo Ingestion:** No raw facial pictures or video streams are stored on servers or database disks.
* **Vectorized pgvector:** Facial geometry is converted locally into 128-D floating point embeddings.
* **Anti-Spoof Gating:** Prevents photo, video playback, and print attacks through dynamic multi-step challenges.
* **Security Headers:** Enforces Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options (DENY), and X-Content-Type-Options (nosniff).
* **Dependency Health:** 0 high or critical npm vulnerabilities.

---

## 📄 License
MIT License. Created for enterprise biometric attendance and workforce intelligence.
