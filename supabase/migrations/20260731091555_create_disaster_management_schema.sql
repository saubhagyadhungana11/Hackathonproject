/*
# Disaster Management System — Nepal
Multi-user disaster management platform with incident tracking, SOS alerts,
soil moisture monitoring, emergency contacts, hospital notifications, and
incident photo/video uploads.

## 1. New Tables
- `profiles` — extends auth.users with username + phone (1:1 with auth.users)
- `incidents` — user-submitted disaster/road-condition reports with optional media
- `sos_alerts` — emergency SOS signals with live victim location + severity
- `soil_readings` — soil moisture sensor readings for landslide/rockfall risk
- `emergency_contacts` — curated emergency service contacts (police, ambulance, etc.)
- `hospital_notifications` — record of hospital alerts dispatched from the app

## 2. Storage
- Public bucket `incident-media` for user-uploaded incident photos/videos.

## 3. Security (RLS)
- `profiles`: owner can read/update own row; anyone authenticated can read.
- `incidents`: owner can CRUD own; everyone authenticated can read (shared situational awareness).
- `sos_alerts`: owner can insert/update own; everyone authenticated can read (responder visibility).
- `soil_readings`: owner can insert own; everyone authenticated can read (authorities visibility).
- `emergency_contacts`: everyone authenticated can read; only owner can manage contributed contacts.
- `hospital_notifications`: owner can insert/read own.
- Storage: authenticated users can upload to `incident-media`; everyone can read.

## 4. Notes
- `user_id` columns default to `auth.uid()` so inserts that omit the owner succeed.
- Seeded emergency_contacts for Nepal (Police 100, Ambulance 102, Armed Police 111, NDRRMA).
*/

-- ===== PROFILES =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_all" ON public.profiles;
CREATE POLICY "profiles_select_own_or_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ===== INCIDENTS =====
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate',
  description text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_name text,
  media_url text,
  media_type text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON public.incidents(status);

DROP POLICY IF EXISTS "incidents_select_all" ON public.incidents;
CREATE POLICY "incidents_select_all" ON public.incidents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "incidents_insert_own" ON public.incidents;
CREATE POLICY "incidents_insert_own" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "incidents_update_own" ON public.incidents;
CREATE POLICY "incidents_update_own" ON public.incidents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "incidents_delete_own" ON public.incidents;
CREATE POLICY "incidents_delete_own" ON public.incidents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== SOS ALERTS =====
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_name text,
  severity text NOT NULL DEFAULT 'critical',
  message text,
  status text NOT NULL DEFAULT 'active',
  responder_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS sos_alerts_status_idx ON public.sos_alerts(status);
CREATE INDEX IF NOT EXISTS sos_alerts_created_at_idx ON public.sos_alerts(created_at DESC);

DROP POLICY IF EXISTS "sos_select_all" ON public.sos_alerts;
CREATE POLICY "sos_select_all" ON public.sos_alerts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sos_insert_own" ON public.sos_alerts;
CREATE POLICY "sos_insert_own" ON public.sos_alerts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sos_update_own" ON public.sos_alerts;
CREATE POLICY "sos_update_own" ON public.sos_alerts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sos_delete_own" ON public.sos_alerts;
CREATE POLICY "sos_delete_own" ON public.sos_alerts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== SOIL READINGS =====
CREATE TABLE IF NOT EXISTS public.soil_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_name text,
  moisture_pct double precision NOT NULL,
  rainfall_mm double precision DEFAULT 0,
  slope_angle double precision DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.soil_readings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS soil_readings_created_at_idx ON public.soil_readings(created_at DESC);

DROP POLICY IF EXISTS "soil_select_all" ON public.soil_readings;
CREATE POLICY "soil_select_all" ON public.soil_readings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "soil_insert_own" ON public.soil_readings;
CREATE POLICY "soil_insert_own" ON public.soil_readings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "soil_delete_own" ON public.soil_readings;
CREATE POLICY "soil_delete_own" ON public.soil_readings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== EMERGENCY CONTACTS =====
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  role text NOT NULL,
  phone text NOT NULL,
  region text,
  latitude double precision,
  longitude double precision,
  is_official boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS emergency_contacts_region_idx ON public.emergency_contacts(region);

DROP POLICY IF EXISTS "contacts_select_all" ON public.emergency_contacts;
CREATE POLICY "contacts_select_all" ON public.emergency_contacts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contacts_insert_own" ON public.emergency_contacts;
CREATE POLICY "contacts_insert_own" ON public.emergency_contacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "contacts_update_own" ON public.emergency_contacts;
CREATE POLICY "contacts_update_own" ON public.emergency_contacts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "contacts_delete_own" ON public.emergency_contacts;
CREATE POLICY "contacts_delete_own" ON public.emergency_contacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== HOSPITAL NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS public.hospital_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_name text NOT NULL,
  hospital_lat double precision NOT NULL,
  hospital_lng double precision NOT NULL,
  patient_lat double precision NOT NULL,
  patient_lng double precision NOT NULL,
  severity text NOT NULL,
  condition_description text,
  estimated_eta_min int,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hospital_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospnotif_select_own" ON public.hospital_notifications;
CREATE POLICY "hospnotif_select_own" ON public.hospital_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "hospnotif_insert_own" ON public.hospital_notifications;
CREATE POLICY "hospnotif_insert_own" ON public.hospital_notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ===== STORAGE BUCKET =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-media', 'incident-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "incident_media_read_public" ON storage.objects;
CREATE POLICY "incident_media_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'incident-media');

DROP POLICY IF EXISTS "incident_media_upload_auth" ON storage.objects;
CREATE POLICY "incident_media_upload_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'incident-media');

-- ===== SEED: Nepal emergency contacts =====
INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Nepal Police', 'Police', '100', 'National', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE phone = '100' AND is_official = true);

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Ambulance Service', 'Ambulance', '102', 'National', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE phone = '102' AND is_official = true);

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Armed Police Force', 'Police', '111', 'National', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE phone = '111' AND is_official = true);

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'NDRRMA Disaster Hotline', 'Disaster Authority', '114', 'National', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE phone = '114' AND is_official = true);

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Red Cross Nepal', 'Rescue', '4228004', 'Kathmandu', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE phone = '4228004' AND is_official = true);

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Tribhuvan University Teaching Hospital', 'Hospital', '4412403', 'Kathmandu', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Tribhuvan University Teaching Hospital');

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Patan Hospital', 'Hospital', '5527706', 'Lalitpur', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Patan Hospital');

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Bharatpur Hospital', 'Hospital', '5220167', 'Chitwan', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Bharatpur Hospital');

INSERT INTO public.emergency_contacts (name, role, phone, region, is_official)
SELECT 'Pokhara Academy of Health Sciences', 'Hospital', '061-466016', 'Pokhara', true
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts WHERE name = 'Pokhara Academy of Health Sciences');
