/*
# Emergency Incident System — Crash Detection, Multi-Service Dispatch & Responder Dashboard

This migration adds the complete backend for an AI-powered crash detection and emergency SOS system.

## New Tables

### 1. emergency_incidents
The core table for all emergency incidents — both manual SOS and auto-detected crashes.
Tracks the full lifecycle: DETECTED → VERIFYING → CONFIRMED → AUTHORITIES_NOTIFIED → RESCUE_DISPATCHED → RESCUE_ARRIVED → RESOLVED.

Columns:
- id (uuid PK)
- user_id (uuid, defaults to auth.uid(), FK to auth.users)
- incident_type (text): 'vehicle_crash', 'fall', 'disaster', 'manual_sos', 'other'
- latitude / longitude (float8): exact GPS coordinates
- location_name (text, nullable): reverse-geocoded place name
- crash_score (int, 0-100): AI crash confidence score
- impact_severity (text, nullable): 'minor', 'moderate', 'severe', 'critical'
- verification_status (text): 'detected', 'verifying', 'user_confirmed', 'no_response', 'confirmed', 'false_alarm'
- user_response (text, nullable): 'ok', 'confirmed', 'no_response'
- battery_level (int, nullable): device battery at time of incident
- speed_before (float8, nullable): movement speed before event (km/h)
- speed_after (float8, nullable): movement speed after event (km/h)
- device_orientation_change (float8, nullable): rotation in degrees
- num_people (int, nullable): number of people involved
- medical_info (text, nullable): user's voluntarily-provided medical info
- assigned_police (text, nullable): name of assigned police station
- assigned_fire (text, nullable): name of assigned fire station
- assigned_ambulance (text, nullable): name of assigned ambulance service
- assigned_hospital (text, nullable): name of assigned hospital
- incident_status (text): the lifecycle status
- responder_notes (text, nullable): notes from responders
- created_at / updated_at (timestamptz)

### 2. user_medical_info
Voluntary medical information that users can configure for emergency situations.

Columns:
- id (uuid PK)
- user_id (uuid, defaults to auth.uid(), FK to auth.users, UNIQUE)
- blood_type (text, nullable)
- allergies (text, nullable)
- medications (text, nullable)
- chronic_conditions (text, nullable)
- emergency_contact_name (text, nullable)
- emergency_contact_phone (text, nullable)
- emergency_contact2_name (text, nullable)
- emergency_contact2_phone (text, nullable)
- updated_at (timestamptz)

### 3. hospital_alert_photos
Photos uploaded by patients that are sent to hospitals for preparation.

Columns:
- id (uuid PK)
- user_id (uuid, defaults to auth.uid(), FK to auth.users)
- notification_id (uuid, nullable, FK to hospital_notifications)
- photo_url (text): Supabase Storage URL
- photo_description (text, nullable)
- condition_tags (text, nullable): comma-separated condition tags
- created_at (timestamptz)

### 4. incident_audit_log
Audit trail for all emergency alerts — who triggered, who responded, status changes.

Columns:
- id (uuid PK)
- incident_id (uuid, FK to emergency_incidents)
- action (text): what happened
- performed_by (uuid, nullable, FK to auth.users)
- details (text, nullable)
- created_at (timestamptz)

## Modified Tables

### sos_alerts
Added column:
- incident_id (uuid, nullable, FK to emergency_incidents): links SOS alerts to emergency incidents

### hospital_notifications
Added columns:
- condition_tags (text, nullable): tags describing patient condition for AI matching
- photo_urls (text[], nullable): array of photo URLs attached to the alert
- incident_type (text, nullable): type of emergency

## Security

- RLS enabled on all new tables.
- emergency_incidents: owner-scoped INSERT/UPDATE/DELETE, SELECT visible to all authenticated users (responders need to see all active emergencies).
- user_medical_info: strictly owner-scoped (only the user can read/write their own medical info).
- hospital_alert_photos: owner-scoped INSERT/DELETE, SELECT visible to all (hospital staff need to view).
- incident_audit_log: INSERT by any authenticated user, SELECT visible to all authenticated users.
- sos_alerts new column: covered by existing policies.
- hospital_notifications new columns: covered by existing policies.

## Storage

- A public storage bucket 'hospital-photos' is created for patient photo uploads.
*/

-- ===== EMERGENCY INCIDENTS TABLE =====
CREATE TABLE IF NOT EXISTS emergency_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_type text NOT NULL DEFAULT 'manual_sos',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_name text,
  crash_score int DEFAULT 0,
  impact_severity text,
  verification_status text DEFAULT 'detected',
  user_response text,
  battery_level int,
  speed_before double precision,
  speed_after double precision,
  device_orientation_change double precision,
  num_people int,
  medical_info text,
  assigned_police text,
  assigned_fire text,
  assigned_ambulance text,
  assigned_hospital text,
  incident_status text NOT NULL DEFAULT 'detected',
  responder_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE emergency_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select_all" ON emergency_incidents;
CREATE POLICY "incidents_select_all"
ON emergency_incidents FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "incidents_insert_own" ON emergency_incidents;
CREATE POLICY "incidents_insert_own"
ON emergency_incidents FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "incidents_update_own" ON emergency_incidents;
CREATE POLICY "incidents_update_own"
ON emergency_incidents FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "incidents_delete_own" ON emergency_incidents;
CREATE POLICY "incidents_delete_own"
ON emergency_incidents FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ===== USER MEDICAL INFO TABLE =====
CREATE TABLE IF NOT EXISTS user_medical_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_type text,
  allergies text,
  medications text,
  chronic_conditions text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact2_name text,
  emergency_contact2_phone text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_medical_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_select_own" ON user_medical_info;
CREATE POLICY "medical_select_own"
ON user_medical_info FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_insert_own" ON user_medical_info;
CREATE POLICY "medical_insert_own"
ON user_medical_info FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_update_own" ON user_medical_info;
CREATE POLICY "medical_update_own"
ON user_medical_info FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "medical_delete_own" ON user_medical_info;
CREATE POLICY "medical_delete_own"
ON user_medical_info FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ===== HOSPITAL ALERT PHOTOS TABLE =====
CREATE TABLE IF NOT EXISTS hospital_alert_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES hospital_notifications(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_description text,
  condition_tags text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hospital_alert_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_select_all" ON hospital_alert_photos;
CREATE POLICY "photos_select_all"
ON hospital_alert_photos FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "photos_insert_own" ON hospital_alert_photos;
CREATE POLICY "photos_insert_own"
ON hospital_alert_photos FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "photos_delete_own" ON hospital_alert_photos;
CREATE POLICY "photos_delete_own"
ON hospital_alert_photos FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ===== INCIDENT AUDIT LOG TABLE =====
CREATE TABLE IF NOT EXISTS incident_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incident_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_all" ON incident_audit_log;
CREATE POLICY "audit_select_all"
ON incident_audit_log FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_insert_own" ON incident_audit_log;
CREATE POLICY "audit_insert_own"
ON incident_audit_log FOR INSERT
TO authenticated WITH CHECK (true);

-- ===== ADD COLUMNS TO EXISTING TABLES =====

-- sos_alerts: link to emergency incidents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sos_alerts' AND column_name = 'incident_id') THEN
    ALTER TABLE sos_alerts ADD COLUMN incident_id uuid REFERENCES emergency_incidents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- hospital_notifications: add condition tags, photo URLs, incident type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospital_notifications' AND column_name = 'condition_tags') THEN
    ALTER TABLE hospital_notifications ADD COLUMN condition_tags text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospital_notifications' AND column_name = 'photo_urls') THEN
    ALTER TABLE hospital_notifications ADD COLUMN photo_urls text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospital_notifications' AND column_name = 'incident_type') THEN
    ALTER TABLE hospital_notifications ADD COLUMN incident_type text;
  END IF;
END $$;

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_status ON emergency_incidents(incident_status);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_user ON emergency_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_incidents_created ON emergency_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_hospital_photos_notification ON hospital_alert_photos(notification_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_incident ON incident_audit_log(incident_id);

-- ===== STORAGE BUCKET FOR HOSPITAL PHOTOS =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('hospital-photos', 'hospital-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload, everyone can read
DROP POLICY IF EXISTS "hospital_photos_upload" ON storage.objects;
CREATE POLICY "hospital_photos_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hospital-photos');

DROP POLICY IF EXISTS "hospital_photos_read" ON storage.objects;
CREATE POLICY "hospital_photos_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'hospital-photos');

DROP POLICY IF EXISTS "hospital_photos_delete" ON storage.objects;
CREATE POLICY "hospital_photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'hospital-photos');
