/*
# Add Admin Role System

1. Modified Tables
- `profiles`: adds `is_admin` boolean column (default false) and `admin_role` text column (nullable, for future role granularity like 'super_admin', 'moderator').

2. Security
- Adds SELECT policy so authenticated users can see their own profile (already exists, but ensures admin flag is readable).
- Adds a SECURITY DEFINER function `is_admin()` that safely checks whether the current user's `profiles.is_admin` is true. This avoids exposing the is_admin column to all users via RLS — the function can be called in policies without granting broad SELECT on profiles.
- Adds admin-only RLS policies on `incidents`, `sos_alerts`, `emergency_contacts`, `emergency_incidents`, and `hospital_notifications` so admins can update status / assigned responders / delete inappropriate content.
- All existing user-scoped policies remain intact. Admin policies are additive.

3. Important Notes
- The `is_admin` column defaults to false. To grant admin access, a superuser must set `is_admin = true` on the user's profile row directly in the database (or via a future admin UI).
- The `is_admin()` function is SECURITY DEFINER owned by the postgres user, so it bypasses RLS when reading the profiles table — this is intentional and safe because it only returns a boolean.
*/

-- Add admin columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role text;

-- SECURITY DEFINER function to check admin status (bypasses RLS safely)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============ Admin policies on incidents ============
-- Admins can update any incident (e.g. change status, verify)
DROP POLICY IF EXISTS "admin_update_incidents" ON incidents;
CREATE POLICY "admin_update_incidents"
ON incidents FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Admins can delete any incident
DROP POLICY IF EXISTS "admin_delete_incidents" ON incidents;
CREATE POLICY "admin_delete_incidents"
ON incidents FOR DELETE
TO authenticated
USING (is_admin());

-- ============ Admin policies on sos_alerts ============
DROP POLICY IF EXISTS "admin_update_sos_alerts" ON sos_alerts;
CREATE POLICY "admin_update_sos_alerts"
ON sos_alerts FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_sos_alerts" ON sos_alerts;
CREATE POLICY "admin_delete_sos_alerts"
ON sos_alerts FOR DELETE
TO authenticated
USING (is_admin());

-- ============ Admin policies on emergency_contacts ============
DROP POLICY IF EXISTS "admin_update_contacts" ON emergency_contacts;
CREATE POLICY "admin_update_contacts"
ON emergency_contacts FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_contacts" ON emergency_contacts;
CREATE POLICY "admin_delete_contacts"
ON emergency_contacts FOR DELETE
TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_contacts" ON emergency_contacts;
CREATE POLICY "admin_insert_contacts"
ON emergency_contacts FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- ============ Admin policies on emergency_incidents ============
DROP POLICY IF EXISTS "admin_update_emergency_incidents" ON emergency_incidents;
CREATE POLICY "admin_update_emergency_incidents"
ON emergency_incidents FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_emergency_incidents" ON emergency_incidents;
CREATE POLICY "admin_delete_emergency_incidents"
ON emergency_incidents FOR DELETE
TO authenticated
USING (is_admin());

-- ============ Admin policies on hospital_notifications ============
DROP POLICY IF EXISTS "admin_update_hospital_notifications" ON hospital_notifications;
CREATE POLICY "admin_update_hospital_notifications"
ON hospital_notifications FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_hospital_notifications" ON hospital_notifications;
CREATE POLICY "admin_delete_hospital_notifications"
ON hospital_notifications FOR DELETE
TO authenticated
USING (is_admin());

-- ============ Admin can read all profiles (for user management) ============
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_admin());

-- Admin can update profiles (e.g. toggle admin flag, edit user info)
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
CREATE POLICY "admin_update_all_profiles"
ON profiles FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
